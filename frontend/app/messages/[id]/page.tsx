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

const ALG_INFO: Record<KemAlg, { name: string; color: string; bg: string; desc: string }> = {
  kyber: { name: "Kyber", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/20", desc: "Post-quantum (Ring-LWE)" },
  frodo: { name: "Frodo", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/20", desc: "Post-quantum (LWE)" },
  ntru: { name: "NTRU", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/20", desc: "Post-quantum (Lattice)" },
  ecdh: { name: "Classic", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/20", desc: "Traditional (ECDH P-256)" },
};

// Format timestamp for message display
function formatMessageTime(timestamp?: string): string {
  if (!timestamp) return "";
  
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  if (isToday) {
    return timeStr;
  } else if (isYesterday) {
    return `Yesterday ${timeStr}`;
  } else {
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
  }
}

export default function MessagesPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = String((params as any).id);

  const [messages, setMessages] = useState<ViewMessage[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [messagesLoaded, setMessagesLoaded] = useState(false);  // NEW: Track loading state

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
  const [handshakeStarted, setHandshakeStarted] = useState<boolean>(false);
  
  // Typing indicators and read receipts
  const [otherUserTyping, setOtherUserTyping] = useState<boolean>(false);
  const [lastReadMessageId, setLastReadMessageId] = useState<number | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const clientRef = useRef<Client | null>(null);
  const subRef = useRef<StompSubscription | null>(null);
  const typingSubRef = useRef<StompSubscription | null>(null);
  const readSubRef = useRef<StompSubscription | null>(null);
  const usernameRef = useRef<string>("");
  const rawMessagesRef = useRef<Message[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function getUsername(): string {
    return localStorage.getItem("username") || localStorage.getItem("user") || "";
  }

  function getLockedAlg(): KemAlg | null {
    const stored = localStorage.getItem(`e2ee_alg_locked:${conversationId}`);
    if (stored === "kyber" || stored === "frodo" || stored === "ntru" || stored === "ecdh") return stored;
    return null;
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Debug: Monitor pendingInvite state changes
  useEffect(() => {
    console.log(`[STATE] pendingInvite changed:`, pendingInvite);
    if (pendingInvite) {
      console.log(`[STATE] Banner SHOULD be visible now for ${pendingInvite.alg} from ${pendingInvite.fromUsername}`);
    }
  }, [pendingInvite]);

  async function loadConversations() {
    try {
      const myUsername = getUsername();
      const data: Conversation[] = await api("/conversations/me");
      
      const items: SidebarItem[] = await Promise.all(data.map(async (c) => {
        const u1 = c.user1?.username || "";
        const u2 = c.user2?.username || "";
        const other = u1 === myUsername ? u2 : u1;
        
        if (String(c.id) === conversationId) {
          setOtherUsername(other || "Unknown");
        }
        
        let lastMessage: string | undefined;
        try {
          const lastMsg = await api(`/messages/${c.id}/last`);
          if (lastMsg) {
            lastMessage = formatLastMessage(lastMsg, myUsername);
          }
        } catch {
          // No messages yet
        }
        
        return {
          id: c.id,
          title: other || "Unknown",
          lastMessage,
          unread: 0,
        };
      }));
      
      setConversations(items);
    } catch (e: any) {
      console.error("Failed to load conversations:", e);
    }
  }
  
  function formatLastMessage(msg: any, myUsername: string): string {
    const prefix = msg.senderUsername === myUsername ? "You: " : "";
    
    if (msg.content) {
      try {
        const env = JSON.parse(msg.content);
        if (env.type === "E2EE_HELLO") return "🔐 Encryption requested";
        if (env.type === "E2EE_KEY") return "✓ Encryption established";
        if (env.type === "E2EE_MSG") return "🔒 Encrypted message";
      } catch {
        if (msg.content.startsWith("IMG:")) {
          return prefix + "📷 Image";
        }
        const text = msg.content.length > 30 
          ? msg.content.substring(0, 30) + "..." 
          : msg.content;
        return prefix + text;
      }
    }
    
    return "No messages yet";
  }
  
  function updateSidebarLastMessage(msg: Message) {
    const myUsername = usernameRef.current;
    const formattedMessage = formatLastMessage(msg, myUsername);
    
    setConversations(prev => prev.map(c => {
      if (String(c.id) === conversationId) {
        return { ...c, lastMessage: formattedMessage };
      }
      return c;
    }));
  }

  async function decorateMessage(m: Message, canDecrypt: boolean): Promise<ViewMessage> {
    const env = tryParseEnvelope(m.content);

    if (!env) {
      const imgData = parseImageMessage(m.content);
      if (imgData) {
        return { ...m, displayContent: "[Image]", imageData: imgData };
      }
      return { ...m, displayContent: m.content };
    }

    if (env.type === "E2EE_HELLO") {
      const algName = ALG_INFO[env.alg]?.name || env.alg;
      return { ...m, displayContent: `🔐 Encryption requested using ${algName}` };
    }

    if (env.type === "E2EE_KEY") {
      const algName = ALG_INFO[env.alg]?.name || env.alg;
      return { ...m, displayContent: `✓ Encryption established using ${algName}` };
    }

    if (env.type === "E2EE_MSG") {
      if (canDecrypt && hasSession(conversationId)) {
        try {
          const { plaintext } = await benchmarkedDecryptChatMessage(conversationId, env);
          const imgData = parseImageMessage(plaintext);
          if (imgData) {
            return { ...m, displayContent: "[Image]", imageData: imgData };
          }
          return { ...m, displayContent: plaintext };
        } catch {
          return { ...m, displayContent: "🔒 Encrypted message" };
        }
      } else {
        return { ...m, displayContent: "🔒 Encrypted message" };
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
    setMessagesLoaded(false);  // Start loading
    
    console.log(`[LOAD] ========================================`);
    console.log(`[LOAD] Loading messages for conversation ${conversationId}`);
    console.log(`[LOAD] Current session exists: ${hasSession(conversationId)}`);
    
    try {
      const data: Message[] = await api(`/messages/${conversationId}`);
      rawMessagesRef.current = data;
      
      console.log(`[LOAD] Loaded ${data.length} messages`);
      
      const canDecrypt = hasSession(conversationId);
      const decorated = await Promise.all(data.map(m => decorateMessage(m, canDecrypt)));
      setMessages(decorated);
      
      const myUsername = getUsername();
      console.log(`[LOAD] My username: ${myUsername}`);
      
      // Check for existing HELLO or KEY messages to determine algorithm
      // Strategy: First check for KEY (encryption established), then for most recent HELLO
      let foundAlg: KemAlg | null = null;
      let foundHelloForInvite: { msg: Message; env: E2eeHello } | null = null;
      let hasKeyResponse = false;
      let iStartedHandshake = false;
      
      // First pass: Look for the most recent KEY message (encryption established)
      for (let i = data.length - 1; i >= 0; i--) {
        const m = data[i];
        const env = tryParseEnvelope(m.content);
        
        if (env?.type === "E2EE_KEY") {
          console.log(`[LOAD] Found KEY message from ${m.senderUsername} using ${env.alg}`);
          hasKeyResponse = true;
          foundAlg = env.alg;
          break; // KEY is authoritative
        }
      }
      
      // Second pass: If no KEY, look for the most recent HELLO
      if (!hasKeyResponse) {
        console.log(`[LOAD] Looking for HELLO messages...`);
        for (let i = data.length - 1; i >= 0; i--) {
          const m = data[i];
          const env = tryParseEnvelope(m.content);
          
          if (env?.type === "E2EE_HELLO") {
            console.log(`[LOAD] Found HELLO message from "${m.senderUsername}" using ${env.alg}`);
            console.log(`[LOAD] My username is "${myUsername}"`);
            console.log(`[LOAD] Sender !== Me? ${m.senderUsername !== myUsername}`);
            console.log(`[LOAD] Has session? ${hasSession(conversationId)}`);
            foundAlg = env.alg;
            
            // If HELLO is from other user and we don't have a session, it's a pending invite
            if (m.senderUsername !== myUsername && !hasSession(conversationId)) {
              console.log(`[LOAD] *** THIS IS A PENDING INVITE ***`);
              foundHelloForInvite = { msg: m, env: env as E2eeHello };
            }
            // If HELLO is from us, we already started a handshake
            if (m.senderUsername === myUsername && !hasSession(conversationId)) {
              console.log(`[LOAD] I started this handshake`);
              iStartedHandshake = true;
            }
            break; // Found the most recent HELLO, stop
          }
        }
      } else {
        console.log(`[LOAD] Skipping HELLO search - KEY already found`);
      }
      
      // Build pending invite if we found one
      let foundPendingInvite: PendingInvite | null = null;
      if (foundHelloForInvite) {
        foundPendingInvite = {
          fromUsername: foundHelloForInvite.msg.senderUsername || "Unknown",
          alg: foundHelloForInvite.env.alg,
          hello: foundHelloForInvite.env,
        };
      }
      
      // Lock algorithm if we found one in messages (this takes precedence over localStorage)
      if (foundAlg) {
        console.log(`[LOAD] Setting algorithm to: ${foundAlg}`);
        localStorage.setItem(`e2ee_alg_locked:${conversationId}`, foundAlg);
        setAlg(foundAlg);
        setAlgLocked(true);
      } else {
        // No algorithm found in messages - check localStorage or default to kyber
        const storedAlg = localStorage.getItem(`e2ee_alg_locked:${conversationId}`);
        if (storedAlg && (storedAlg === "kyber" || storedAlg === "frodo" || storedAlg === "ntru" || storedAlg === "ecdh")) {
          console.log(`[LOAD] Using stored algorithm: ${storedAlg}`);
          setAlg(storedAlg as KemAlg);
          setAlgLocked(true);
        } else {
          console.log(`[LOAD] No algorithm found, defaulting to kyber`);
          setAlg("kyber");
          setAlgLocked(false);
        }
      }
      
      // Set handshake started if we found our own HELLO
      if (iStartedHandshake) {
        setHandshakeStarted(true);
      }
      
      // Set pending invite if found
      if (foundPendingInvite) {
        console.log(`[LOAD] *** SETTING PENDING INVITE ***`);
        console.log(`[LOAD] From: ${foundPendingInvite.fromUsername}`);
        console.log(`[LOAD] Algorithm: ${foundPendingInvite.alg}`);
        console.log(`[LOAD] Hello data:`, foundPendingInvite.hello);
        setPendingInvite(foundPendingInvite);
      } else {
        console.log(`[LOAD] No pending invite found`);
      }
      
    } catch (e: any) {
      setError(e?.message || "Failed to load messages");
      if (String(e?.message).includes("401")) router.push("/login");
    } finally {
      setMessagesLoaded(true);  // Done loading
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
        const incoming: Message = JSON.parse(msg.body);
        const myUsername = usernameRef.current;

        const env = tryParseEnvelope(incoming.content);
        
        if (env) {
          console.log(`[WS] ========================================`);
          console.log(`[WS] Received ${env.type} from "${incoming.senderUsername}"`);
          console.log(`[WS] Algorithm: ${(env as any).alg}`);
          console.log(`[WS] My username: "${myUsername}"`);
          
          if (env.type === "E2EE_HELLO") {
            console.log(`[WS] Is from other user? ${incoming.senderUsername !== myUsername}`);
            console.log(`[WS] Has session? ${hasSession(conversationId)}`);
            
            if (incoming.senderUsername !== myUsername) {
              // Other user sent a HELLO - this is an invite to encrypt
              console.log(`[WS] Processing HELLO with algorithm: ${env.alg}`);
              if (!hasSession(conversationId)) {
                // Lock to their algorithm
                console.log(`[WS] *** SETTING PENDING INVITE VIA WEBSOCKET ***`);
                localStorage.setItem(`e2ee_alg_locked:${conversationId}`, env.alg);
                setAlg(env.alg);
                setAlgLocked(true);
                
                // Clear any handshake we might have started
                setHandshakeStarted(false);
                
                setPendingInvite({
                  fromUsername: incoming.senderUsername || "Unknown",
                  alg: env.alg,
                  hello: env as E2eeHello,
                });
              } else {
                console.log(`[WS] NOT setting pending invite - session already exists`);
              }
            } else {
              console.log(`[WS] This is my own HELLO, ignoring`);
            }
          }

          if (env.type === "E2EE_KEY" && incoming.senderUsername !== myUsername) {
            // Other user accepted our HELLO
            await benchmarkedHandleKeyAndStoreSession(conversationId, myUsername, env);
            setE2eeReady(true);
            setHandshakeStarted(false);
            setPendingInvite(null);
            
            // Re-decrypt messages now that we have a session
            showDecryptedMessages();
          }
        }

        // Clear typing indicator when message received from other user
        if (incoming.senderUsername !== myUsername) {
          setOtherUserTyping(false);
        }

        rawMessagesRef.current = [...rawMessagesRef.current, incoming];
        
        const canDecrypt = hasSession(conversationId);
        const decorated = await decorateMessage(incoming, canDecrypt);
        setMessages((prev) => [...prev, decorated]);
        
        updateSidebarLastMessage(incoming);
        
        if (incoming.senderUsername !== myUsername) {
          sendReadReceipt(incoming.id);
        }
      });
      
      // Subscribe to typing events
      typingSubRef.current?.unsubscribe();
      typingSubRef.current = client.subscribe(`/topic/conversations/${conversationId}/typing`, (msg: IMessage) => {
        const event = JSON.parse(msg.body);
        const myUsername = usernameRef.current;
        
        if (event.username !== myUsername) {
          setOtherUserTyping(event.isTyping);
          
          if (event.isTyping) {
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }
            typingTimeoutRef.current = setTimeout(() => {
              setOtherUserTyping(false);
            }, 3000);
          }
        }
      });
      
      // Subscribe to read receipts
      readSubRef.current?.unsubscribe();
      readSubRef.current = client.subscribe(`/topic/conversations/${conversationId}/read`, (msg: IMessage) => {
        const receipt = JSON.parse(msg.body);
        const myUsername = usernameRef.current;
        
        if (receipt.username !== myUsername) {
          setLastReadMessageId(receipt.messageId);
        }
      });
      
      setTimeout(() => {
        sendReadReceiptsForUnreadMessages();
      }, 500);
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

    console.log(`[HANDSHAKE] Starting handshake with algorithm: ${selectedAlg}`);
    
    setHandshakeStarted(true);
    
    localStorage.setItem(`e2ee_alg_locked:${conversationId}`, selectedAlg);
    setAlg(selectedAlg);
    setAlgLocked(true);

    const kp = await benchmarkedGetOrCreateKeyPair(myUsername, selectedAlg);
    const helloContent = makeHello(selectedAlg, kp.pk);
    
    console.log(`[HANDSHAKE] HELLO content preview:`, helloContent.substring(0, 100));

    const client = clientRef.current;
    if (!client || !client.connected) throw new Error("WebSocket not connected");

    client.publish({
      destination: "/app/chat.send",
      body: JSON.stringify({
        conversationId: Number(conversationId),
        content: helloContent,
      }),
    });
    
    console.log(`[HANDSHAKE] HELLO sent`);
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
        const { ciphertext } = await benchmarkedEncryptChatMessage(conversationId, messageContent);
        outgoingContent = ciphertext;
      }

      client.publish({
        destination: "/app/chat.send",
        body: JSON.stringify({
          conversationId: Number(conversationId),
          content: outgoingContent,
        }),
      });
    } catch (e: any) {
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

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("Image must be smaller than 2MB");
      return;
    }

    setSendingImage(true);
    setError(null);

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      const imageMessage = createImageMessage(file.type, base64Data);
      await sendMessage(imageMessage);
    } catch (err: any) {
      setError(err?.message || "Failed to send image");
    } finally {
      setSendingImage(false);
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
    localStorage.removeItem(`e2ee_alg_locked:${conversationId}`);
    
    setE2eeReady(false);
    setPendingInvite(null);
    setAlgLocked(false);
    setHandshakeStarted(false);
    setAlg("kyber");
    
    hideEncryptedMessages();
  }

  function handleAlgChange(newAlg: KemAlg) {
    if (algLocked) return;
    setAlg(newAlg);
  }

  function sendTypingEvent(isTyping: boolean) {
    const client = clientRef.current;
    if (!client || !client.connected) return;
    
    client.publish({
      destination: "/app/chat.typing",
      body: JSON.stringify({
        conversationId: Number(conversationId),
        isTyping,
      }),
    });
  }

  function handleInputChange(value: string) {
    setContent(value);
    
    const now = Date.now();
    if (now - lastTypingSentRef.current > 1000) {
      sendTypingEvent(value.length > 0);
      lastTypingSentRef.current = now;
    }
  }

  function sendReadReceipt(messageId: number) {
    const client = clientRef.current;
    if (!client || !client.connected) return;
    
    client.publish({
      destination: "/app/chat.read",
      body: JSON.stringify({
        conversationId: Number(conversationId),
        messageId,
      }),
    });
  }

  function sendReadReceiptsForUnreadMessages() {
    const client = clientRef.current;
    if (!client || !client.connected) return;
    
    const myUsername = usernameRef.current;
    const messages = rawMessagesRef.current;
    
    const lastMessageFromOther = [...messages]
      .reverse()
      .find(m => m.senderUsername !== myUsername);
    
    if (lastMessageFromOther) {
      sendReadReceipt(lastMessageFromOther.id);
    }
  }

  useEffect(() => {
    if (!conversationId) return;

    // Debug: Log startup info
    const myUsername = getUsername();
    const sessionKey = `e2ee_session_v1:${conversationId}`;
    const existingSession = localStorage.getItem(sessionKey);
    console.log(`[STARTUP] ========================================`);
    console.log(`[STARTUP] Conversation ID: ${conversationId}`);
    console.log(`[STARTUP] My username: "${myUsername}"`);
    console.log(`[STARTUP] Session exists: ${!!existingSession}`);
    if (existingSession) {
      console.log(`[STARTUP] Session data:`, existingSession.substring(0, 100) + "...");
    }
    console.log(`[STARTUP] Locked alg in storage:`, localStorage.getItem(`e2ee_alg_locked:${conversationId}`));

    // Reset all state
    setMessages([]);
    setError(null);
    setPendingInvite(null);
    setOtherUsername("");
    setShowDisableWarning(false);
    setHandshakeStarted(false);
    setOtherUserTyping(false);
    setLastReadMessageId(null);
    setMessagesLoaded(false);
    rawMessagesRef.current = [];
    usernameRef.current = myUsername;
    
    // Check for pre-selected algorithm from conversations page
    // But DON'T set a default yet - let loadInitialMessages determine it from existing messages
    const lockedAlg = getLockedAlg();
    if (lockedAlg) {
      setAlg(lockedAlg);
      setAlgLocked(true);
    } else {
      // Don't set alg here - loadInitialMessages will determine it from existing HELLO messages
      // Only set to kyber if there are NO existing messages
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
      typingSubRef.current?.unsubscribe();
      typingSubRef.current = null;
      readSubRef.current?.unsubscribe();
      readSubRef.current = null;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
    };
  }, [conversationId]);

  const displayAlg = pendingInvite?.alg || alg;
  const algInfo = ALG_INFO[displayAlg];
  const inputDisabled = (e2eeEnabled && !e2eeReady) || sendingImage;
  
  // Only show encryption setup if messages are loaded and there's no pending invite
  const showEncryptionSetup = messagesLoaded && e2eeEnabled && !e2eeReady && !handshakeStarted && !pendingInvite;

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        <AppShell
          sidebar={<ConversationsSidebar items={conversations} />}
          header={
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/conversations")}
                  className="h-8 px-2"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </Button>
                <div className="h-4 w-px bg-border" />
                <div className="font-semibold">{otherUsername || `Conversation`}</div>
                
                {e2eeEnabled ? (
                  <div className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    e2eeReady 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}>
                    {e2eeReady ? (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>{algInfo.name}</span>
                      </>
                    ) : (
                      <span>{handshakeStarted ? "Waiting..." : pendingInvite ? "Invite pending" : "Setup needed"}</span>
                    )}
                  </div>
                ) : (
                  <div className="text-xs px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-500">
                    Unencrypted
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBenchmark(!showBenchmark)}
                  className={`h-8 px-2 ${showBenchmark ? 'bg-muted' : ''}`}
                  title="Toggle benchmark panel"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </Button>

                <div className="h-4 w-px bg-border" />

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">E2EE</span>
                  <Switch
                    checked={e2eeEnabled}
                    onCheckedChange={handleE2eeToggle}
                  />
                </div>

                {e2eeEnabled && e2eeReady && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                    title="Reset encryption"
                  >
                    Reset
                  </Button>
                )}
                
                {/* Debug: Force clear all E2EE data for this conversation */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Clear everything for this conversation
                    const sessionKey = `e2ee_session_v1:${conversationId}`;
                    localStorage.removeItem(sessionKey);
                    localStorage.removeItem(`e2ee_alg_locked:${conversationId}`);
                    localStorage.removeItem(`e2ee_enabled:${conversationId}`);
                    console.log(`[DEBUG] Cleared all E2EE data for conversation ${conversationId}`);
                    // Reload the page to reset state
                    window.location.reload();
                  }}
                  className="h-8 px-2 text-xs text-red-500 hover:text-red-600"
                  title="Clear all E2EE data for this conversation (debug)"
                >
                  🗑️ Clear
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex h-full flex-col">
            {/* Loading indicator */}
            {!messagesLoaded && (
              <div className="px-4 py-3 text-sm text-muted-foreground border-b bg-muted/30 flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading messages...
              </div>
            )}

            {/* Encryption Setup Bar - only show after messages are loaded */}
            {showEncryptionSetup && (
              <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Start encrypted conversation</div>
                      <div className="text-xs text-muted-foreground">
                        {algLocked ? `Using ${ALG_INFO[alg].name}` : "Select algorithm and begin"}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Algorithm Pills - disabled if already locked */}
                    {!algLocked && (
                      <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
                        {(["kyber", "frodo", "ntru", "ecdh"] as KemAlg[]).map((a) => (
                          <button
                            key={a}
                            onClick={() => handleAlgChange(a)}
                            className={`px-3 py-1 text-xs rounded-md transition-all ${
                              alg === a
                                ? `${ALG_INFO[a].bg} ${ALG_INFO[a].color} font-medium`
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {ALG_INFO[a].name}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {algLocked && (
                      <div className={`px-3 py-1 text-xs rounded-md ${ALG_INFO[alg].bg} ${ALG_INFO[alg].color} font-medium`}>
                        {ALG_INFO[alg].name}
                      </div>
                    )}
                    
                    <Button
                      size="sm"
                      onClick={() => startE2eeHandshake(alg).catch((e) => setError(e?.message))}
                      className="bg-primary hover:bg-primary/90"
                    >
                      Start
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Disable Warning */}
            {showDisableWarning && (
              <div className="border-b border-red-500/20 bg-red-500/5 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-600 dark:text-red-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Turn off encryption?</div>
                      <div className="text-xs text-muted-foreground">Messages will not be encrypted</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowDisableWarning(false)}>Cancel</Button>
                    <Button size="sm" onClick={confirmDisableE2ee} className="bg-red-600 hover:bg-red-700 text-white">Turn off</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Pending Invite */}
            {pendingInvite && (
              <div className="border-b border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-medium">{pendingInvite.fromUsername} wants to encrypt</div>
                      <div className="text-xs text-muted-foreground">Using {ALG_INFO[pendingInvite.alg].name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={declineInvite}>Later</Button>
                    <Button size="sm" onClick={acceptInvite} className="bg-emerald-600 hover:bg-emerald-700 text-white">Accept</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Waiting for acceptance */}
            {e2eeEnabled && !e2eeReady && handshakeStarted && !pendingInvite && messagesLoaded && (
              <div className="px-4 py-2 text-sm text-muted-foreground border-b bg-muted/30 flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Waiting for {otherUsername || "other user"} to accept {ALG_INFO[alg].name} encryption...
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="px-4 py-2 text-sm text-red-500 border-b border-red-500/20 bg-red-500/5">
                {error}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-auto p-4 space-y-3">
                {messages.map((m, index) => {
                  const isMe = (m.senderUsername ?? "") === usernameRef.current;
                  const isRead = isMe && lastReadMessageId !== null && m.id <= lastReadMessageId;
                  
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        <div className={[
                          "max-w-[70%] min-w-[160px] rounded-2xl px-4 py-2.5 text-sm",
                          isMe ? "bg-primary text-primary-foreground" : "bg-muted",
                        ].join(" ")}>
                          <div className="mb-1.5 text-[11px] opacity-70 flex items-center justify-between gap-3">
                            <span className="font-medium truncate">{m.senderUsername ?? "Unknown"}</span>
                            <span className="text-[10px] whitespace-nowrap shrink-0">{formatMessageTime(m.timestamp)}</span>
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
                        {isMe && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 mr-1 flex items-center gap-1">
                            {isRead ? (
                              <>
                                <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-blue-500">Read</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Sent</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {otherUserTyping && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">{otherUsername}</span>
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="border-t p-3">
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
              
              <div className="flex gap-2">
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={inputDisabled}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted transition disabled:opacity-50"
                  title="Send image"
                >
                  {sendingImage ? (
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>

                <input
                  type="text"
                  className="flex-1 h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={content}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder={
                    inputDisabled
                      ? "Waiting for encryption..."
                      : e2eeEnabled
                        ? "Type a message..."
                        : "Type a message (unencrypted)..."
                  }
                  disabled={inputDisabled}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                
                <Button onClick={send} disabled={inputDisabled} className="h-10 px-4">
                  Send
                </Button>
              </div>
              
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                {e2eeEnabled && e2eeReady 
                  ? `🔐 End-to-end encrypted with ${algInfo.name}` 
                  : e2eeEnabled 
                    ? "Setting up encryption..."
                    : "⚠️ Messages are not encrypted"}
              </div>
            </div>
          </div>
        </AppShell>
      </div>
      
      <BenchmarkPanel isOpen={showBenchmark} onClose={() => setShowBenchmark(false)} />
    </div>
  );
}
