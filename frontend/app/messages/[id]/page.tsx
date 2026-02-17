"use client";
import AppShell from "@/components/ui/app-shell";
import ConversationsSidebar from "@/components/ui/conversations-sidebar";
import BenchmarkPanel from "@/components/ui/benchmark-panel";
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
  hasSession,
  clearSession,
  KemAlg,
  E2eeHello,
} from "@/lib/crypto/e2ee";
import {
  benchmarkedGetOrCreateKeyPair,
  benchmarkedHandleHelloAndCreateKeyReply,
  benchmarkedHandleKeyAndStoreSession,
  benchmarkedEncryptChatMessage,
  benchmarkedDecryptChatMessage,
} from "@/lib/crypto/benchmark";

// Image message format: IMG:<mimeType>:<base64Data>
const IMAGE_PREFIX = "IMG:";

function isImageMessage(content: string): boolean {
  return content.startsWith(IMAGE_PREFIX);
}

function parseImageMessage(content: string): { mimeType: string; data: string } | null {
  if (!isImageMessage(content)) return null;
  const withoutPrefix = content.slice(IMAGE_PREFIX.length);
  const colonIndex = withoutPrefix.indexOf(":");
  if (colonIndex === -1) return null;
  return {
    mimeType: withoutPrefix.slice(0, colonIndex),
    data: withoutPrefix.slice(colonIndex + 1),
  };
}

function createImageMessage(mimeType: string, base64Data: string): string {
  return `${IMAGE_PREFIX}${mimeType}:${base64Data}`;
}

type Message = {
  id: number;
  content: string;
  senderUsername?: string;
  timestamp?: string;
};

type ViewMessage = Message & {
  displayContent: string;
  imageData?: { mimeType: string; data: string };
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

export default function MessagesPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = String((params as any).id);

  const [messages, setMessages] = useState<ViewMessage[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [e2eeEnabled, setE2eeEnabled] = useState<boolean>(true);
  const [e2eeReady, setE2eeReady] = useState<boolean>(false);
  const [alg, setAlg] = useState<KemAlg>("kyber");
  const [algLocked, setAlgLocked] = useState<boolean>(false);
  
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);
  const [conversations, setConversations] = useState<SidebarItem[]>([]);
  const [otherUsername, setOtherUsername] = useState<string>("");
  
  const [showDisableWarning, setShowDisableWarning] = useState<boolean>(false);
  const [showBenchmark, setShowBenchmark] = useState<boolean>(false);
  const [sendingImage, setSendingImage] = useState<boolean>(false);

  const clientRef = useRef<Client | null>(null);
  const subRef = useRef<StompSubscription | null>(null);
  const usernameRef = useRef<string>("");
  const rawMessagesRef = useRef<Message[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function getUsername(): string {
    return localStorage.getItem("username") || localStorage.getItem("user") || "";
  }

  function getLockedAlg(): KemAlg | null {
    const stored = localStorage.getItem(`e2ee_alg_locked:${conversationId}`);
    if (stored === "kyber" || stored === "frodo") return stored;
    return null;
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      // Check if it's an image message (unencrypted)
      const imgData = parseImageMessage(m.content);
      if (imgData) {
        return { ...m, displayContent: "[Image]", imageData: imgData };
      }
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
          const { plaintext } = await benchmarkedDecryptChatMessage(conversationId, env);
          // Check if decrypted content is an image
          const imgData = parseImageMessage(plaintext);
          if (imgData) {
            return { ...m, displayContent: "[Image]", imageData: imgData };
          }
          return { ...m, displayContent: plaintext };
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
        
        if (env?.type === "E2EE_HELLO" || env?.type === "E2EE_KEY") {
          if (!getLockedAlg()) {
            localStorage.setItem(`e2ee_alg_locked:${conversationId}`, env.alg);
            setAlg(env.alg);
            setAlgLocked(true);
          }
        }
        
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
      debug: (str) => console.log("[STOMP]", str),
    });

    client.onConnect = () => {
      setError(null);

      subRef.current?.unsubscribe();
      subRef.current = client.subscribe(`/topic/conversations/${conversationId}`, async (msg: IMessage) => {
        console.log("[WS] Received message:", msg.body.substring(0, 200) + "...");
        const incoming: Message = JSON.parse(msg.body);
        console.log("[WS] Parsed message id:", incoming.id, "content length:", incoming.content?.length);
        const myUsername = usernameRef.current;

        const env = tryParseEnvelope(incoming.content);
        
        if (env) {
          if (env.type === "E2EE_HELLO" && incoming.senderUsername !== myUsername) {
            if (!hasSession(conversationId)) {
              if (!getLockedAlg()) {
                localStorage.setItem(`e2ee_alg_locked:${conversationId}`, env.alg);
                setAlg(env.alg);
                setAlgLocked(true);
              }
              
              setPendingInvite({
                fromUsername: incoming.senderUsername || "Unknown",
                alg: env.alg,
                hello: env as E2eeHello,
              });
            }
          }

          if (env.type === "E2EE_KEY" && incoming.senderUsername !== myUsername) {
            await benchmarkedHandleKeyAndStoreSession(conversationId, myUsername, env);
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

    const kp = await benchmarkedGetOrCreateKeyPair(myUsername, selectedAlg);
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
      const reply = await benchmarkedHandleHelloAndCreateKeyReply(
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
        
        localStorage.setItem(`e2ee_enabled:${conversationId}`, "true");
        
        showDecryptedMessages();
      }
    } catch (e: any) {
      setError(e?.message || "Failed to accept encryption request");
    }
  }

  function declineInvite() {
    setPendingInvite(null);
  }

  async function sendMessage(messageContent: string) {
    const client = clientRef.current;
    console.log("[Send] Starting, client connected:", client?.connected, "content length:", messageContent.length);
    
    if (!client || !client.connected) {
      setError("Not connected to server");
      return;
    }

    try {
      setError(null);

      let outgoingContent = messageContent;

      if (e2eeEnabled) {
        if (!hasSession(conversationId)) {
          setError("Waiting for encryption to be accepted");
          return;
        }
        console.log("[Send] Encrypting message...");
        const { ciphertext } = await benchmarkedEncryptChatMessage(conversationId, messageContent);
        outgoingContent = ciphertext;
        console.log("[Send] Encrypted, ciphertext length:", ciphertext.length);
      }

      console.log("[Send] Publishing to WebSocket, final length:", outgoingContent.length);
      client.publish({
        destination: "/app/chat.send",
        body: JSON.stringify({
          conversationId: Number(conversationId),
          content: outgoingContent,
        }),
      });
      console.log("[Send] Published successfully");
    } catch (e: any) {
      console.error("[Send] Error:", e);
      setError(e?.message || "Failed to send");
      throw e;
    }
  }

  async function send() {
    if (!content.trim()) return;
    await sendMessage(content);
    setContent("");
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("[Image] Selected file:", file.name, file.type, file.size, "bytes");

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Limit file size (2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("Image must be smaller than 2MB");
      return;
    }

    setSendingImage(true);
    setError(null);

    try {
      // Read file as base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data URL prefix (e.g., "data:image/png;base64,")
          const base64 = result.split(",")[1];
          console.log("[Image] Base64 length:", base64.length);
          resolve(base64);
        };
        reader.onerror = (err) => {
          console.error("[Image] FileReader error:", err);
          reject(err);
        };
        reader.readAsDataURL(file);
      });

      // Create image message
      const imageMessage = createImageMessage(file.type, base64Data);
      console.log("[Image] Message length:", imageMessage.length);
      
      // Send it
      await sendMessage(imageMessage);
      console.log("[Image] Message sent successfully");
    } catch (err: any) {
      console.error("[Image] Error sending:", err);
      setError(err?.message || "Failed to send image");
    } finally {
      setSendingImage(false);
      // Reset input
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  }

  async function handleE2eeToggle(checked: boolean) {
    if (checked) {
      setE2eeEnabled(true);
      localStorage.setItem(`e2ee_enabled:${conversationId}`, "true");
      
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
      setShowDisableWarning(true);
    }
  }

  function confirmDisableE2ee() {
    setE2eeEnabled(false);
    setE2eeReady(false);
    localStorage.setItem(`e2ee_enabled:${conversationId}`, "false");
    setShowDisableWarning(false);
    hideEncryptedMessages();
  }

  function handleReset() {
    clearSession(conversationId);
    setE2eeReady(false);
    setPendingInvite(null);
    
    if (e2eeEnabled) {
      startE2eeHandshake(alg).catch((e) => {
        setError(e?.message || "Failed to restart encryption");
      });
    } else {
      hideEncryptedMessages();
    }
  }

  useEffect(() => {
    if (!conversationId) return;

    setMessages([]);
    setError(null);
    setPendingInvite(null);
    setOtherUsername("");
    setShowDisableWarning(false);
    rawMessagesRef.current = [];
    usernameRef.current = getUsername();
    
    const lockedAlg = getLockedAlg();
    if (lockedAlg) {
      setAlg(lockedAlg);
      setAlgLocked(true);
    } else {
      setAlg("kyber");
      setAlgLocked(false);
    }
    
    const e2eeEnabledStored = localStorage.getItem(`e2ee_enabled:${conversationId}`);
    const shouldEnableE2ee = e2eeEnabledStored !== "false";
    
    const sessionExists = hasSession(conversationId);
    setE2eeEnabled(shouldEnableE2ee);
    setE2eeReady(sessionExists && shouldEnableE2ee);

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

  useEffect(() => {
    if (e2eeEnabled && !e2eeReady && !hasSession(conversationId) && !pendingInvite && clientRef.current?.connected) {
      startE2eeHandshake(alg).catch((e) => {
        console.error("Auto-handshake failed:", e);
      });
    }
  }, [e2eeEnabled, e2eeReady, conversationId, alg, pendingInvite]);

  const displayAlg = pendingInvite?.alg || alg;
  const algDisplayName = displayAlg === "kyber" ? "Kyber" : "Frodo";
  const showAlgBadge = algLocked || pendingInvite !== null;
  const inputDisabled = (e2eeEnabled && !e2eeReady) || sendingImage;

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        <AppShell
          sidebar={<ConversationsSidebar items={conversations} />}
          header={
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="font-semibold">{otherUsername || `Conversation ${conversationId}`}</div>
                
                {showAlgBadge && (
                  <div className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {algDisplayName}
                  </div>
                )}
                
                {e2eeEnabled && (
                  <div className={`text-xs px-2 py-0.5 rounded-full ${
                    e2eeReady 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}>
                    {e2eeReady ? "Encrypted" : "Connecting..."}
                  </div>
                )}
                
                {!e2eeEnabled && (
                  <div className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                    Not encrypted
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant={showBenchmark ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowBenchmark(!showBenchmark)}
                  className="text-xs"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M3 3v18h18"/>
                    <path d="m19 9-5 5-4-4-3 3"/>
                  </svg>
                  Benchmark
                </Button>

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
            {showDisableWarning && (
              <div className="border-b border-border bg-red-500/5">
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/20 text-red-600 dark:text-red-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 9v4"/>
                          <path d="M12 17h.01"/>
                          <path d="M3.586 20.414A2 2 0 0 0 5 21h14a2 2 0 0 0 1.414-.586l.001-.001A2 2 0 0 0 21 19V5a2 2 0 0 0-.586-1.414A2 2 0 0 0 19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 .586 1.414z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Turn off encryption?</div>
                        <div className="text-xs text-muted-foreground">
                          New messages will be sent without encryption and can be read by the server.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowDisableWarning(false)} className="text-xs">
                        Cancel
                      </Button>
                      <Button size="sm" onClick={confirmDisableE2ee} className="bg-red-600 hover:bg-red-700 text-white text-xs">
                        Turn off
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                      <Button variant="outline" size="sm" onClick={declineInvite} className="text-xs">
                        Later
                      </Button>
                      <Button size="sm" onClick={acceptInvite} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                        Accept
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="px-4 py-2 text-sm text-red-500 border-b border-red-500/20 bg-red-500/5">
                {error}
              </div>
            )}

            {e2eeEnabled && !e2eeReady && !pendingInvite && !showDisableWarning && (
              <div className="px-4 py-2 text-sm text-muted-foreground border-b bg-muted/30 flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Waiting for {otherUsername || "the other user"} to accept encryption
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-auto p-4 space-y-3">
                {messages.map((m) => {
                  const isMe = (m.senderUsername ?? "") === usernameRef.current;
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={[
                        "max-w-[70%] rounded-2xl px-4 py-2 text-sm",
                        isMe ? "bg-primary text-primary-foreground" : "bg-muted",
                      ].join(" ")}>
                        <div className="mb-1 text-[11px] opacity-70">
                          {m.senderUsername ?? "Unknown"}
                        </div>
                        {m.imageData ? (
                          <img 
                            src={`data:${m.imageData.mimeType};base64,${m.imageData.data}`}
                            alt="Shared image"
                            className="max-w-full rounded-lg max-h-64 object-contain"
                          />
                        ) : (
                          <div className="whitespace-pre-wrap break-words">
                            {m.displayContent}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t p-3">
              {/* Hidden file input */}
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
              
              <div className="flex gap-2">
                {/* Image upload button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={inputDisabled}
                  className="h-[52px] w-[52px] shrink-0"
                  title="Send image"
                >
                  {sendingImage ? (
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                      <circle cx="9" cy="9" r="2"/>
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                    </svg>
                  )}
                </Button>

                <textarea
                  className="flex-1 resize-none rounded-lg border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    sendingImage
                      ? "Sending image..."
                      : e2eeEnabled
                        ? e2eeReady
                          ? "Write a message..."
                          : "Waiting for encryption..."
                        : "Write a message (not encrypted)..."
                  }
                  disabled={inputDisabled}
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <Button onClick={send} className="h-[52px]" disabled={inputDisabled}>
                  Send
                </Button>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {e2eeEnabled && e2eeReady 
                  ? `Messages are encrypted${showAlgBadge ? ` with ${algDisplayName}` : ""} · Images up to 2MB` 
                  : e2eeEnabled 
                    ? "Encryption in progress..."
                    : "Messages are not encrypted"}
              </div>
            </div>
          </div>
        </AppShell>
      </div>
      
      <BenchmarkPanel isOpen={showBenchmark} onClose={() => setShowBenchmark(false)} />
    </div>
  );
}
