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

  const clientRef = useRef<Client | null>(null);
  const subRef = useRef<StompSubscription | null>(null);

  const usernameRef = useRef<string>("");

  function getUsername(): string {
    const u = localStorage.getItem("username") || localStorage.getItem("user") || "";
    return u;
  }

  async function decorateMessage(m: Message): Promise<ViewMessage> {
    const env = tryParseEnvelope(m.content);

    if (!e2eeEnabled || !env) {
      return { ...m, displayContent: m.content };
    }

    if (env.type === "E2EE_HELLO") {
      return { ...m, displayContent: "🔑 E2EE handshake started" };
    }

    if (env.type === "E2EE_KEY") {
      return { ...m, displayContent: "✅ E2EE key established" };
    }

    if (env.type === "E2EE_MSG") {
      const plain = await decryptChatMessage(conversationId, env);
      return { ...m, displayContent: plain };
    }

    return { ...m, displayContent: m.content };
  }

  async function loadInitialMessages() {
    try {
      const data: Message[] = await api(`/messages/${conversationId}`);
      const decorated = await Promise.all(data.map(decorateMessage));
      setMessages(decorated);
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

        const env = tryParseEnvelope(incoming.content);
        if (e2eeEnabled && env) {
          const myUsername = usernameRef.current;

          if (env.type === "E2EE_HELLO") {
            if (!hasSession(conversationId)) {
              const reply = await handleHelloAndCreateKeyReply(conversationId, myUsername, env);
              if (reply) {
                client.publish({
                  destination: "/app/chat.send",
                  body: JSON.stringify({
                    conversationId: Number(conversationId),
                    content: reply.replyContent,
                  }),
                });
                setE2eeReady(true);
              }
            }
          }

          if (env.type === "E2EE_KEY") {
            await handleKeyAndStoreSession(conversationId, myUsername, env);
            setE2eeReady(true);
          }
        }

        const decorated = await decorateMessage(incoming);
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
    if (!myUsername) throw new Error("No username in localStorage. Save it after login.");

    const kp = await getOrCreateKeyPair(myUsername, selectedAlg);
    const helloContent = makeHello(selectedAlg, kp.pk);

    const client = clientRef.current;
    if (!client || !client.connected) throw new Error("WebSocket not connected yet");

    client.publish({
      destination: "/app/chat.send",
      body: JSON.stringify({
        conversationId: Number(conversationId),
        content: helloContent,
      }),
    });
  }

  async function send() {
    if (!content.trim()) return;

    const client = clientRef.current;
    if (!client || !client.connected) {
      setError("Not connected to chat server yet");
      return;
    }

    try {
      setError(null);

      let outgoingContent = content;

      if (e2eeEnabled) {
        if (!hasSession(conversationId)) {
          await startE2eeHandshake(alg);
          setError("E2EE handshake started — try sending again in a moment.");
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
  
  useEffect(() => {
    localStorage.setItem(`e2ee_alg_v1:${conversationId}`, alg);
  }, [alg, conversationId]);

  useEffect(() => {
    usernameRef.current = getUsername();
    setAlg(normAlg(localStorage.getItem(`e2ee_alg_v1:${conversationId}`) || "kyber"));
    setE2eeReady(hasSession(conversationId));
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

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
  }, [conversationId, e2eeEnabled]);

  return (
    <AppShell
      sidebar={
        <ConversationsSidebar
          items={[
            { id: 1, title: "admin", lastMessage: "yo", unread: 0 },
            { id: 2, title: "test", lastMessage: "secure msg", unread: 3 },
          ]}
        />
      }
      header={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="font-semibold">Conversation {conversationId}</div>
            {e2eeEnabled && (
              <div className="text-xs text-muted-foreground">
                {e2eeReady ? "✅ Secure" : "⏳ Handshaking"}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">E2EE</span>
              <Switch
                checked={e2eeEnabled}
                onCheckedChange={async (checked) => {
                  const next = checked;
                  setE2eeEnabled(next);
                  if (!next) {
                    setE2eeReady(false);
                    return;
                  }
                  try {
                    setError(null);
                    setE2eeReady(hasSession(conversationId));
                    if (!hasSession(conversationId)) {
                      await startE2eeHandshake(alg); 
                    }
                  } catch (e: any) {
                    setError(e?.message || "Failed to start E2EE");
                  }
                }}
              />
            </div>

            {e2eeEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearSession(conversationId);
                  setE2eeReady(false);
                  setError("E2EE session cleared. Toggle ON to re-handshake.");
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex h-full flex-col">
        {error && (
          <div className="px-4 py-2 text-sm text-red-500 border-b">
            {error}
          </div>
        )}

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

        <div className="border-t p-3">
          <div className="flex gap-2">
            <textarea
              className="flex-1 resize-none rounded-lg border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                e2eeEnabled
                  ? e2eeReady
                    ? "Message (secure)…"
                    : "Handshake in progress…"
                  : "Message…"
              }
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button onClick={send} className="h-[52px]">
              Send
            </Button>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Tip: Enter sends • Shift+Enter new line
          </div>
        </div>
      </div>
    </AppShell>
  );
}