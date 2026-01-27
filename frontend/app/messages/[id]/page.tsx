"use client";
import AppShell from "@/components/ui/app-shell";
import ConversationsSidebar from "@/components/ui/conversations-sidebar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  tryParseEnvelope,
  makeHello,
  handleHelloAndCreateKeyReply,
  handleKeyAndStoreSession,
  encryptChatMessage,
  decryptChatMessage,
  getOrCreateKeyPair,
  hasSession,
  clearSession,
  KemAlg,
  E2eeHello,
} from "@/lib/crypto/e2ee";

type Message = {
  id: number;
  content: string;
  senderUsername?: string;
  timestamp?: string;
};

type ViewMessage = Message & {
  displayContent: string;
};

type PendingInvite = {
  fromUsername: string;
  alg: KemAlg;
  hello: E2eeHello;
};

type Conversation = {
  id: number;
  user1?: { username?: string };
  user2?: { username?: string };
};

type SidebarItem = {
  id: number | string;
  title: string;
  lastMessage?: string;
  unread?: number;
};

function normAlg(a: any): KemAlg {
  const v = String(a || "").toLowerCase();
  if (v === "kyber" || v === "frodo") return v;
  return "kyber";
}

export default function MessagesPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = String((params as any).id);

  const [messages, setMessages] = useState<ViewMessage[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [e2eeEnabled, setE2eeEnabled] = useState<boolean>(false);
  const [e2eeReady, setE2eeReady] = useState<boolean>(false);
  const [alg, setAlg] = useState<KemAlg>("kyber");
  
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);
  const [conversations, setConversations] = useState<SidebarItem[]>([]);
  const [otherUsername, setOtherUsername] = useState<string>("");

  const clientRef = useRef<Client | null>(null);
  const subRef = useRef<StompSubscription | null>(null);
  const usernameRef = useRef<string>("");
  const rawMessagesRef = useRef<Message[]>([]);

  function getUsername(): string {
    return localStorage.getItem("username") || localStorage.getItem("user") || "";
  }

  async function loadConversations() {
    try {
      const myUsername = getUsername();
      const data: Conversation[] = await api("/conversations/me");
      
      const items: SidebarItem[] = data.map((c) => {
        const u1 = c.user1?.username || "";
        const u2 = c.user2?.username || "";
        const other = u1 === myUsername ? u2 : u1;
        
        if (String(c.id) === conversationId) {
          setOtherUsername(other || "Unknown");
        }
        
        return {
          id: c.id,
          title: other || "Unknown",
          lastMessage: undefined,
          unread: 0,
        };
      });
      
      setConversations(items);
    } catch (e: any) {
      console.error("Failed to load conversations:", e);
    }
  }

  async function decorateMessage(m: Message, canDecrypt: boolean): Promise<ViewMessage> {
    const env = tryParseEnvelope(m.content);

    if (!env) {
      return { ...m, displayContent: m.content };
    }

    if (env.type === "E2EE_HELLO") {
      const algName = env.alg === "frodo" ? "Frodo" : "Kyber";
      return { ...m, displayContent: `Encryption requested using ${algName}` };
    }

    if (env.type === "E2EE_KEY") {
      const algName = env.alg === "frodo" ? "Frodo" : "Kyber";
      return { ...m, displayContent: `Encryption established using ${algName}` };
    }

    if (env.type === "E2EE_MSG") {
      if (canDecrypt && hasSession(conversationId)) {
        try {
          const plain = await decryptChatMessage(conversationId, env);
          return { ...m, displayContent: plain };
        } catch {
          return { ...m, displayContent: "Encrypted message" };
        }
      } else {
        return { ...m, displayContent: "Encrypted message" };
      }
    }

    return { ...m, displayContent: m.content };
  }

  async function showDecryptedMessages() {
    const redecorated = await Promise.all(
      rawMessagesRef.current.map(m => decorateMessage(m, true))
    );
    setMessages(redecorated);
  }

  async function hideEncryptedMessages() {
    const redecorated = await Promise.all(
      rawMessagesRef.current.map(m => decorateMessage(m, false))
    );
    setMessages(redecorated);
  }

  async function loadInitialMessages() {
    try {
      const data: Message[] = await api(`/messages/${conversationId}`);
      rawMessagesRef.current = data;
      
      const canDecrypt = hasSession(conversationId);
      const decorated = await Promise.all(data.map(m => decorateMessage(m, canDecrypt)));
      setMessages(decorated);
      
      const myUsername = getUsername();
      for (const m of data) {
        const env = tryParseEnvelope(m.content);
        if (env?.type === "E2EE_HELLO" && m.senderUsername !== myUsername && !hasSession(conversationId)) {
          const hasKeyResponse = data.some(msg => {
            const e = tryParseEnvelope(msg.content);
            return e?.type === "E2EE_KEY";
          });
          
          if (!hasKeyResponse) {
            setPendingInvite({
              fromUsername: m.senderUsername || "Unknown",
              alg: env.alg,
              hello: env as E2eeHello,
            });
          }
        }
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load messages");
      if (String(e?.message).includes("401")) router.push("/login");
    }
  }

  function connectSocket() {
    const token = localStorage.getItem("token") || "";

    const client = new Client({
      webSocketFactory: () => new SockJS("http://127.0.0.1:8080/ws"),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 2000,
    });

    client.onConnect = () => {
      setError(null);

      subRef.current?.unsubscribe();
      subRef.current = client.subscribe(`/topic/conversations/${conversationId}`, async (msg: IMessage) => {
        const incoming: Message = JSON.parse(msg.body);
        const myUsername = usernameRef.current;

        const env = tryParseEnvelope(incoming.content);
        
        if (env) {
          if (env.type === "E2EE_HELLO" && incoming.senderUsername !== myUsername) {
            if (!hasSession(conversationId)) {
              setPendingInvite({
                fromUsername: incoming.senderUsername || "Unknown",
                alg: env.alg,
                hello: env as E2eeHello,
              });
            }
          }

          if (env.type === "E2EE_KEY" && incoming.senderUsername !== myUsername) {
            await handleKeyAndStoreSession(conversationId, myUsername, env);
            setE2eeReady(true);
            setPendingInvite(null);
          }
        }

        rawMessagesRef.current = [...rawMessagesRef.current, incoming];
        
        const canDecrypt = hasSession(conversationId);
        const decorated = await decorateMessage(incoming, canDecrypt);
        setMessages((prev) => [...prev, decorated]);
      });
    };

    client.onStompError = (frame) => {
      setError(frame.headers["message"] || "WebSocket error");
    };

    client.onWebSocketError = () => {
      setError("WebSocket connection error");
    };

    client.activate();
    clientRef.current = client;
  }

  async function startE2eeHandshake(selectedAlg: KemAlg) {
    const myUsername = usernameRef.current;
    if (!myUsername) throw new Error("No username in localStorage");

    const kp = await getOrCreateKeyPair(myUsername, selectedAlg);
    const helloContent = makeHello(selectedAlg, kp.pk);

    const client = clientRef.current;
    if (!client || !client.connected) throw new Error("WebSocket not connected");

    client.publish({
      destination: "/app/chat.send",
      body: JSON.stringify({
        conversationId: Number(conversationId),
        content: helloContent,
      }),
    });
  }

  async function acceptInvite() {
    if (!pendingInvite) return;
    
    const myUsername = usernameRef.current;
    const client = clientRef.current;
    
    if (!client || !client.connected) {
      setError("WebSocket not connected");
      return;
    }

    try {
      const reply = await handleHelloAndCreateKeyReply(
        conversationId,
        myUsername,
        pendingInvite.hello
      );
      
      if (reply) {
        client.publish({
          destination: "/app/chat.send",
          body: JSON.stringify({
            conversationId: Number(conversationId),
            content: reply.replyContent,
          }),
        });
        
        setAlg(pendingInvite.alg);
        setE2eeEnabled(true);
        setE2eeReady(true);
        setPendingInvite(null);
        
        showDecryptedMessages();
      }
    } catch (e: any) {
      setError(e?.message || "Failed to accept encryption request");
    }
  }

  function declineInvite() {
    setPendingInvite(null);
  }

  async function send() {
    if (!content.trim()) return;

    const client = clientRef.current;
    if (!client || !client.connected) {
      setError("Not connected to server");
      return;
    }

    try {
      setError(null);

      let outgoingContent = content;

      if (e2eeEnabled) {
        if (!hasSession(conversationId)) {
          setError("Waiting for encryption to be accepted");
          return;
        }
        outgoingContent = await encryptChatMessage(conversationId, content);
      }

      client.publish({
        destination: "/app/chat.send",
        body: JSON.stringify({
          conversationId: Number(conversationId),
          content: outgoingContent,
        }),
      });

      setContent("");
    } catch (e: any) {
      setError(e?.message || "Failed to send");
    }
  }

  async function handleE2eeToggle(checked: boolean) {
    if (checked) {
      setE2eeEnabled(true);
      if (hasSession(conversationId)) {
        setE2eeReady(true);
        showDecryptedMessages();
      } else {
        try {
          await startE2eeHandshake(alg);
        } catch (e: any) {
          setError(e?.message || "Failed to start encryption");
          setE2eeEnabled(false);
        }
      }
    } else {
      setE2eeEnabled(false);
      setE2eeReady(false);
      hideEncryptedMessages();
    }
  }

  function handleReset() {
    clearSession(conversationId);
    setE2eeEnabled(false);
    setE2eeReady(false);
    setPendingInvite(null);
    hideEncryptedMessages();
  }

  useEffect(() => {
    localStorage.setItem(`e2ee_alg_v1:${conversationId}`, alg);
  }, [alg, conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    setMessages([]);
    setError(null);
    setPendingInvite(null);
    setOtherUsername("");
    rawMessagesRef.current = [];
    usernameRef.current = getUsername();
    
    setAlg(normAlg(localStorage.getItem(`e2ee_alg_v1:${conversationId}`) || "kyber"));
    
    const sessionExists = hasSession(conversationId);
    setE2eeEnabled(sessionExists);
    setE2eeReady(sessionExists);

    loadConversations();
    loadInitialMessages();
    connectSocket();

    return () => {
      subRef.current?.unsubscribe();
      subRef.current = null;
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
    };
  }, [conversationId]);

  const algDisplayName = alg === "kyber" ? "Kyber" : "Frodo";

  return (
    <AppShell
      sidebar={<ConversationsSidebar items={conversations} />}
      header={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="font-semibold">{otherUsername || `Conversation ${conversationId}`}</div>
            {e2eeEnabled && (
              <div className={`text-xs px-2 py-0.5 rounded-full ${
                e2eeReady 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}>
                {e2eeReady ? `Encrypted · ${algDisplayName}` : "Connecting..."}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!e2eeEnabled && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Algorithm:</span>
                <select
                  value={alg}
                  onChange={(e) => setAlg(e.target.value as KemAlg)}
                  className="h-7 rounded-md border border-border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="kyber">Kyber</option>
                  <option value="frodo">Frodo</option>
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">E2EE</span>
              <Switch
                checked={e2eeEnabled}
                onCheckedChange={handleE2eeToggle}
              />
            </div>

            {e2eeEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex h-full flex-col">
        {/* E2EE Invitation Banner */}
        {pendingInvite && (
          <div className="border-b border-border bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {pendingInvite.fromUsername} wants to turn on encryption
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Using {pendingInvite.alg === "frodo" ? "Frodo" : "Kyber"} · All messages will be end-to-end encrypted
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={declineInvite}
                    className="text-xs"
                  >
                    Later
                  </Button>
                  <Button
                    size="sm"
                    onClick={acceptInvite}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  >
                    Accept
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="px-4 py-2 text-sm text-red-500 border-b border-red-500/20 bg-red-500/5">
            {error}
          </div>
        )}

        {/* Waiting Banner */}
        {e2eeEnabled && !e2eeReady && !pendingInvite && (
          <div className="px-4 py-2 text-sm text-muted-foreground border-b bg-muted/30 flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Waiting for {otherUsername || "the other user"} to accept encryption
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto p-4 space-y-3">
            {messages.map((m) => {
              const isMe = (m.senderUsername ?? "") === usernameRef.current;
              return (
                <div
                  key={m.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={[
                      "max-w-[70%] rounded-2xl px-4 py-2 text-sm",
                      isMe
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted",
                    ].join(" ")}
                  >
                    <div className="mb-1 text-[11px] opacity-70">
                      {m.senderUsername ?? "Unknown"}
                    </div>
                    <div className="whitespace-pre-wrap break-words">
                      {m.displayContent}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex gap-2">
            <textarea
              className="flex-1 resize-none rounded-lg border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                e2eeEnabled
                  ? e2eeReady
                    ? "Write a message..."
                    : "Waiting for encryption..."
                  : "Write a message..."
              }
              disabled={e2eeEnabled && !e2eeReady}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button 
              onClick={send} 
              className="h-[52px]"
              disabled={e2eeEnabled && !e2eeReady}
            >
              Send
            </Button>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {e2eeEnabled && e2eeReady 
              ? `Messages are encrypted with ${algDisplayName}` 
              : "Press Enter to send"}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
