"use client";
import AppShell from "@/components/ui/app-shell";
import ConversationsSidebar from "@/components/ui/conversations-sidebar";
import BenchmarkPanel from "@/components/ui/benchmark-panel";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, profilePictureUrl } from "@/lib/api";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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

// ============ Constants ============

const IMAGE_PREFIX = "IMG:";
const VOICE_PREFIX = "VOICE:";

const ALG_INFO: Record<KemAlg, { name: string; color: string; bg: string; desc: string }> = {
  kyber: { name: "Kyber", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/20", desc: "Post-quantum (Ring-LWE)" },
  frodo: { name: "Frodo", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/20", desc: "Post-quantum (LWE)" },
  ntru: { name: "NTRU", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/20", desc: "Post-quantum (Lattice)" },
  ecdh: { name: "Classic", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/20", desc: "Traditional (ECDH P-256)" },
};

const VALID_ALGS: KemAlg[] = ["kyber", "frodo", "ntru", "ecdh"];

// ============ Types ============

type Message = {
  id: number;
  content: string;
  senderUsername?: string;
  timestamp?: string;
  edited?: boolean;
  editedAt?: string;
  deleted?: boolean;
};

type ViewMessage = Message & {
  displayContent: string;
  imageData?: { mimeType: string; data: string };
  voiceData?: { mimeType: string; data: string };
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

// ============ Utility Functions ============

function isValidAlg(alg: string | null): alg is KemAlg {
  return alg !== null && VALID_ALGS.includes(alg as KemAlg);
}

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

function isVoiceMessage(content: string): boolean {
  return content.startsWith(VOICE_PREFIX);
}

function parseVoiceMessage(content: string): { mimeType: string; data: string } | null {
  if (!isVoiceMessage(content)) return null;
  const withoutPrefix = content.slice(VOICE_PREFIX.length);
  const colonIndex = withoutPrefix.indexOf(":");
  if (colonIndex === -1) return null;
  return {
    mimeType: withoutPrefix.slice(0, colonIndex),
    data: withoutPrefix.slice(colonIndex + 1),
  };
}

function createVoiceMessage(mimeType: string, base64Data: string): string {
  return `${VOICE_PREFIX}${mimeType}:${base64Data}`;
}

function formatMessageTime(timestamp?: string): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return timeStr;
  if (isYesterday) return `Yesterday ${timeStr}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
}

// ============ Main Component ============

export default function MessagesPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = String((params as any).id);

  // Core state
  const [messages, setMessages] = useState<ViewMessage[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [messagesLoaded, setMessagesLoaded] = useState(false);

  // E2EE state
  const [e2eeEnabled, setE2eeEnabled] = useState<boolean>(true);
  const [e2eeReady, setE2eeReady] = useState<boolean>(false);
  const [alg, setAlg] = useState<KemAlg>("kyber");
  const [algLocked, setAlgLocked] = useState<boolean>(false);
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);
  const [handshakeStarted, setHandshakeStarted] = useState<boolean>(false);

  // UI state
  const [conversations, setConversations] = useState<SidebarItem[]>([]);
  const [otherUsername, setOtherUsername] = useState<string>("");
  const [showDisableWarning, setShowDisableWarning] = useState<boolean>(false);
  const [showBenchmark, setShowBenchmark] = useState<boolean>(false);
  const [sendingImage, setSendingImage] = useState<boolean>(false);
  const [recording, setRecording] = useState<boolean>(false);
  const [sendingVoice, setSendingVoice] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [contextMenuMessageId, setContextMenuMessageId] = useState<number | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });



  // Typing & read receipts
  const [otherUserTyping, setOtherUserTyping] = useState<boolean>(false);
  const [lastReadMessageId, setLastReadMessageId] = useState<number | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Refs
  const clientRef = useRef<Client | null>(null);
  const subRef = useRef<StompSubscription | null>(null);
  const typingSubRef = useRef<StompSubscription | null>(null);
  const readSubRef = useRef<StompSubscription | null>(null);
  const editSubRef = useRef<StompSubscription | null>(null);
  const deleteSubRef = useRef<StompSubscription | null>(null);
  const usernameRef = useRef<string>("");
  const rawMessagesRef = useRef<Message[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // ============ Helper Functions ============

  function getUsername(): string {
    return localStorage.getItem("username") || localStorage.getItem("user") || "";
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ============ Message Formatting ============

  function formatLastMessage(msg: any, myUsername: string): string {
    const prefix = msg.senderUsername === myUsername ? "You: " : "";
    if (msg.deleted) return prefix + "This message was deleted";
    if (msg.content) {
      try {
        const env = JSON.parse(msg.content);
        if (env.type === "E2EE_HELLO") return "Encryption requested";
        if (env.type === "E2EE_KEY") return "Encryption established";
        if (env.type === "E2EE_MSG") return "Encrypted message";
      } catch {
        if (msg.content.startsWith("IMG:")) return prefix + "Image";
        if (msg.content.startsWith("VOICE:")) return prefix + "Voice message";
        const text = msg.content.length > 30 ? msg.content.substring(0, 30) + "..." : msg.content;
        return prefix + text;
      }
    }
    return "No messages yet";
  }

  async function decorateMessage(m: Message, canDecrypt: boolean): Promise<ViewMessage> {
    if (m.deleted) {
      return { ...m, displayContent: "" };
    }

    const env = tryParseEnvelope(m.content);

    if (!env) {
      const imgData = parseImageMessage(m.content);
      if (imgData) return { ...m, displayContent: "[Image]", imageData: imgData };
      const voiceData = parseVoiceMessage(m.content);
      if (voiceData) return { ...m, displayContent: "[Voice Message]", voiceData };
      return { ...m, displayContent: m.content };
    }

    if (env.type === "E2EE_HELLO") {
      const algName = ALG_INFO[env.alg]?.name || env.alg;
      return { ...m, displayContent: `Encryption requested using ${algName}` };
    }

    if (env.type === "E2EE_KEY") {
      const algName = ALG_INFO[env.alg]?.name || env.alg;
      return { ...m, displayContent: `Encryption established using ${algName}` };
    }

    if (env.type === "E2EE_MSG") {
      if (canDecrypt && hasSession(conversationId)) {
        try {
          const { plaintext } = await benchmarkedDecryptChatMessage(conversationId, env);
          const imgData = parseImageMessage(plaintext);
          if (imgData) return { ...m, displayContent: "[Image]", imageData: imgData };
          const voiceData = parseVoiceMessage(plaintext);
          if (voiceData) return { ...m, displayContent: "[Voice Message]", voiceData };
          return { ...m, displayContent: plaintext };
        } catch {
          return { ...m, displayContent: "Encrypted message" };
        }
      }
      return { ...m, displayContent: "Encrypted message" };
    }

    return { ...m, displayContent: m.content };
  }

  async function showDecryptedMessages() {
    const redecorated = await Promise.all(rawMessagesRef.current.map(m => decorateMessage(m, true)));
    setMessages(redecorated);
  }

  async function hideEncryptedMessages() {
    const redecorated = await Promise.all(rawMessagesRef.current.map(m => decorateMessage(m, false)));
    setMessages(redecorated);
  }

  // ============ Data Loading ============

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
          if (lastMsg) lastMessage = formatLastMessage(lastMsg, myUsername);
        } catch { /* No messages */ }
        
        return { id: c.id, title: other || "Unknown", lastMessage, unread: 0 };
      }));
      
      setConversations(items);
    } catch (e: any) {
      console.error("Failed to load conversations:", e);
    }
  }

  function updateSidebarLastMessage(msg: Message) {
    const formattedMessage = formatLastMessage(msg, usernameRef.current);
    setConversations(prev => prev.map(c => 
      String(c.id) === conversationId ? { ...c, lastMessage: formattedMessage } : c
    ));
  }

  /**
   * Analyzes message history to determine encryption state.
   * Returns the algorithm and any pending invite.
   */
  function analyzeMessageHistory(messages: Message[], myUsername: string): {
    algorithm: KemAlg | null;
    pendingInvite: PendingInvite | null;
    iStartedHandshake: boolean;
    hasEstablishedSession: boolean;
  } {
    let algorithm: KemAlg | null = null;
    let pendingInvite: PendingInvite | null = null;
    let iStartedHandshake = false;
    let hasEstablishedSession = false;

    // Scan from newest to oldest
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const env = tryParseEnvelope(m.content);
      if (!env) continue;

      // KEY message = encryption already established
      if (env.type === "E2EE_KEY") {
        algorithm = env.alg;
        hasEstablishedSession = true;
        break; // KEY is authoritative
      }

      // HELLO message = handshake in progress (only if we haven't found one yet)
      if (env.type === "E2EE_HELLO" && !algorithm) {
        algorithm = env.alg;
        
        if (m.senderUsername !== myUsername && !hasSession(conversationId)) {
          // Other user sent HELLO, we need to accept
          pendingInvite = {
            fromUsername: m.senderUsername || "Unknown",
            alg: env.alg,
            hello: env as E2eeHello,
          };
        } else if (m.senderUsername === myUsername && !hasSession(conversationId)) {
          // I sent HELLO, waiting for response
          iStartedHandshake = true;
        }
        break; // Use the most recent HELLO
      }
    }

    return { algorithm, pendingInvite, iStartedHandshake, hasEstablishedSession };
  }

  async function loadInitialMessages() {
    setMessagesLoaded(false);
    
    try {
      const data: Message[] = await api(`/messages/${conversationId}`);
      rawMessagesRef.current = data;
      
      const myUsername = getUsername();
      
      // First, analyze message history to check for KEY messages
      const analysis = analyzeMessageHistory(data, myUsername);
      // Clear stale session if there's no KEY message in history
      // This handles the case where localStorage has old session data
      // but the conversation was reset or messages were deleted
      let sessionExists = hasSession(conversationId);
      if (sessionExists && !analysis.hasEstablishedSession) {
        clearSession(conversationId);
        sessionExists = false;
      }
      
      // Re-analyze with correct session state (pendingInvite depends on !hasSession)
      const finalAnalysis = sessionExists ? analysis : analyzeMessageHistory(data, myUsername);
      
      // Decorate messages
      const decorated = await Promise.all(data.map(m => decorateMessage(m, sessionExists)));
      setMessages(decorated);
      
      // Determine algorithm to use (priority: message history > localStorage > default)
      let finalAlg: KemAlg = "kyber";
      let shouldLockAlg = false;
      
      if (finalAnalysis.algorithm) {
        finalAlg = finalAnalysis.algorithm;
        shouldLockAlg = true;
      } else {
        const storedAlg = localStorage.getItem(`e2ee_alg_locked:${conversationId}`);
        if (isValidAlg(storedAlg)) {
          finalAlg = storedAlg;
          shouldLockAlg = true;
        }
      }
      
      // Apply state
      setAlg(finalAlg);
      setAlgLocked(shouldLockAlg);
      
      if (finalAnalysis.pendingInvite) {
        setPendingInvite(finalAnalysis.pendingInvite);
      }
      
      if (finalAnalysis.iStartedHandshake) {
        setHandshakeStarted(true);
      }
      
      if (sessionExists) {
        setE2eeReady(true);
      }
      
    } catch (e: any) {
      setError(e?.message || "Failed to load messages");
      if (String(e?.message).includes("401")) router.push("/login");
    } finally {
      setMessagesLoaded(true);
    }
  }

  // ============ WebSocket ============

  function connectSocket() {
    const token = localStorage.getItem("token") || "";

    const client = new Client({
      webSocketFactory: () => new SockJS("http://127.0.0.1:8080/ws"),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 2000,
    });

    client.onConnect = () => {
      setError(null);

      // Main message subscription
      subRef.current?.unsubscribe();
      subRef.current = client.subscribe(`/topic/conversations/${conversationId}`, async (msg: IMessage) => {
        const incoming: Message = JSON.parse(msg.body);
        const myUsername = usernameRef.current;
        const env = tryParseEnvelope(incoming.content);

        if (env) {
          // Handle HELLO from other user
          if (env.type === "E2EE_HELLO" && incoming.senderUsername !== myUsername) {
            if (!hasSession(conversationId)) {
              localStorage.setItem(`e2ee_alg_locked:${conversationId}`, env.alg);
              setAlg(env.alg);
              setAlgLocked(true);
              setHandshakeStarted(false);
              setPendingInvite({
                fromUsername: incoming.senderUsername || "Unknown",
                alg: env.alg,
                hello: env as E2eeHello,
              });
            }
          }

          // Handle KEY response (other user accepted)
          if (env.type === "E2EE_KEY" && incoming.senderUsername !== myUsername) {
            await benchmarkedHandleKeyAndStoreSession(conversationId, myUsername, env);
            setE2eeReady(true);
            setHandshakeStarted(false);
            setPendingInvite(null);
            showDecryptedMessages();
          }
        }

        // Clear typing indicator
        if (incoming.senderUsername !== myUsername) {
          setOtherUserTyping(false);
        }

        // Check if this is an update to an existing message (edit/delete)
        const existingIndex = rawMessagesRef.current.findIndex(m => m.id === incoming.id);
        if (existingIndex !== -1) {
          rawMessagesRef.current = rawMessagesRef.current.map(m =>
            m.id === incoming.id ? incoming : m
          );
          const decorated = await decorateMessage(incoming, hasSession(conversationId));
          setMessages(prev => prev.map(m => m.id === incoming.id ? decorated : m));
          updateSidebarLastMessage(incoming);
        } else {
          // New message
          rawMessagesRef.current = [...rawMessagesRef.current, incoming];
          const decorated = await decorateMessage(incoming, hasSession(conversationId));
          setMessages(prev => [...prev, decorated]);
          updateSidebarLastMessage(incoming);
        }

        // Send read receipt
        if (incoming.senderUsername !== myUsername) {
          sendReadReceipt(incoming.id);
        }
      });

      // Typing subscription
      typingSubRef.current?.unsubscribe();
      typingSubRef.current = client.subscribe(`/topic/conversations/${conversationId}/typing`, (msg: IMessage) => {
        const event = JSON.parse(msg.body);
        if (event.username !== usernameRef.current) {
          setOtherUserTyping(event.isTyping);
          if (event.isTyping) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setOtherUserTyping(false), 3000);
          }
        }
      });

      // Read receipts subscription
      readSubRef.current?.unsubscribe();
      readSubRef.current = client.subscribe(`/topic/conversations/${conversationId}/read`, (msg: IMessage) => {
        const receipt = JSON.parse(msg.body);
        if (receipt.username !== usernameRef.current) {
          setLastReadMessageId(receipt.messageId);
        }
      });

      // Edit subscription
      editSubRef.current?.unsubscribe();
      editSubRef.current = client.subscribe(`/topic/conversations/${conversationId}/edit`, async (msg: IMessage) => {
        const edited: Message = JSON.parse(msg.body);
        rawMessagesRef.current = rawMessagesRef.current.map((m) =>
          m.id === edited.id ? edited : m
        );
        const decorated = await decorateMessage(edited, hasSession(conversationId));
        setMessages((prev) =>
          prev.map((m) => (m.id === edited.id ? decorated : m))
        );
      });

      // Delete subscription
      deleteSubRef.current?.unsubscribe();
      deleteSubRef.current = client.subscribe(`/topic/conversations/${conversationId}/delete`, (msg: IMessage) => {
        const deleted: Message = JSON.parse(msg.body);
        rawMessagesRef.current = rawMessagesRef.current.map((m) =>
          m.id === deleted.id ? { ...m, deleted: true, content: "" } : m
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === deleted.id
              ? { ...m, deleted: true, displayContent: "", voiceData: undefined, imageData: undefined }
              : m
          )
        );
      });

      // Send read receipts for existing messages
      setTimeout(sendReadReceiptsForUnreadMessages, 500);
    };

    client.onStompError = (frame) => setError(frame.headers["message"] || "WebSocket error");
    client.onWebSocketError = () => setError("WebSocket connection error");

    client.activate();
    clientRef.current = client;
  }

  // ============ E2EE Actions ============

  async function startE2eeHandshake(selectedAlg: KemAlg) {
    const myUsername = usernameRef.current;
    if (!myUsername) throw new Error("No username");

    setHandshakeStarted(true);
    localStorage.setItem(`e2ee_alg_locked:${conversationId}`, selectedAlg);
    setAlg(selectedAlg);
    setAlgLocked(true);

    const kp = await benchmarkedGetOrCreateKeyPair(myUsername, selectedAlg);
    const helloContent = makeHello(selectedAlg, kp.pk);

    const client = clientRef.current;
    if (!client?.connected) throw new Error("WebSocket not connected");

    client.publish({
      destination: "/app/chat.send",
      body: JSON.stringify({ conversationId: Number(conversationId), content: helloContent }),
    });
  }

  async function acceptInvite() {
    if (!pendingInvite) return;
    
    const myUsername = usernameRef.current;
    const client = clientRef.current;
    
    if (!client?.connected) {
      setError("WebSocket not connected");
      return;
    }

    try {
      const reply = await benchmarkedHandleHelloAndCreateKeyReply(conversationId, myUsername, pendingInvite.hello);
      
      if (reply) {
        client.publish({
          destination: "/app/chat.send",
          body: JSON.stringify({ conversationId: Number(conversationId), content: reply.replyContent }),
        });
        
        setAlg(pendingInvite.alg);
        setE2eeEnabled(true);
        setE2eeReady(true);
        setPendingInvite(null);
        localStorage.setItem(`e2ee_enabled:${conversationId}`, "true");
        showDecryptedMessages();
      }
    } catch (e: any) {
      setError(e?.message || "Failed to accept encryption");
    }
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

  // ============ Messaging ============

  async function sendMessage(messageContent: string) {
    const client = clientRef.current;
    if (!client?.connected) {
      setError("Not connected");
      return;
    }

    try {
      setError(null);
      let outgoingContent = messageContent;

      if (e2eeEnabled) {
        if (!hasSession(conversationId)) {
          setError("Waiting for encryption");
          return;
        }
        const { ciphertext } = await benchmarkedEncryptChatMessage(conversationId, messageContent);
        outgoingContent = ciphertext;
      }

      client.publish({
        destination: "/app/chat.send",
        body: JSON.stringify({ conversationId: Number(conversationId), content: outgoingContent }),
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

  function startEditing(m: ViewMessage) {
    setEditingMessageId(m.id);
    setEditContent(m.displayContent);
  }

  function cancelEditing() {
    setEditingMessageId(null);
    setEditContent("");
  }

  async function saveEdit() {
    if (!editingMessageId || !editContent.trim()) return;
    const client = clientRef.current;
    if (!client?.connected) {
      setError("Not connected");
      return;
    }

    try {
      setError(null);
      let outgoingContent = editContent;

      if (e2eeEnabled && hasSession(conversationId)) {
        const { ciphertext } = await benchmarkedEncryptChatMessage(conversationId, editContent);
        outgoingContent = ciphertext;
      }

      client.publish({
        destination: "/app/chat.edit",
        body: JSON.stringify({
          conversationId: Number(conversationId),
          messageId: editingMessageId,
          content: outgoingContent,
        }),
      });
      setEditingMessageId(null);
      setEditContent("");
    } catch (e: any) {
      setError(e?.message || "Failed to edit message");
    }
  }

  async function deleteMessage(messageId: number) {
    const client = clientRef.current;
    if (!client?.connected) {
      setError("Not connected");
      return;
    }

    try {
      setError(null);
      client.publish({
        destination: "/app/chat.delete",
        body: JSON.stringify({
          conversationId: Number(conversationId),
          messageId,
        }),
      });
    } catch (e: any) {
      setError(e?.message || "Failed to delete message");
    }
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be < 2MB");
      return;
    }

    setSendingImage(true);
    setError(null);

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await sendMessage(createImageMessage(file.type, base64Data));
    } catch (err: any) {
      setError(err?.message || "Failed to send image");
    } finally {
      setSendingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function startRecording() {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      // 100ms timeslice: chunks accumulate every 100ms so all audio is
      // captured before stop(). No-timeslice mode causes Safari to fire
      // ondataavailable with 0 bytes, producing silent/empty recordings.
      recorder.start(100);
      setRecording(true);
      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err: any) {
      setError("Microphone access denied");
    }
  }

  async function stopRecordingAndSend() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    setSendingVoice(true);

    // Request any buffered data that hasn't been delivered yet, then stop.
    // This flushes the current 100ms chunk before onstop fires, ensuring
    // no audio is lost between the last timeslice and the stop call.
    recorder.requestData();
    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });

    // Stop all mic tracks
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    setRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });

    if (blob.size > 2 * 1024 * 1024) {
      setError("Recording too long (max 2MB)");
      setSendingVoice(false);
      return;
    }

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const mimeType = recorder.mimeType || "audio/webm";
      await sendMessage(createVoiceMessage(mimeType, base64Data));
    } catch (err: any) {
      setError(err?.message || "Failed to send voice message");
    } finally {
      setSendingVoice(false);
    }
  }

  function cancelRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }

  // ============ Edit / Delete ============

  function handleContextMenu(e: React.MouseEvent, messageId: number) {
    e.preventDefault();
    setContextMenuMessageId(messageId);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  }

  function closeContextMenu() {
    setContextMenuMessageId(null);
  }

  function startEditing(msg: ViewMessage) {
    setEditingMessageId(msg.id);
    setEditContent(msg.displayContent);
    closeContextMenu();
  }

  async function submitEdit() {
    if (!editingMessageId || !editContent.trim()) return;
    const client = clientRef.current;
    if (!client?.connected) return;

    let outgoingContent = editContent.trim();

    if (e2eeEnabled && e2eeReady && hasSession(conversationId)) {
      const { ciphertext } = await benchmarkedEncryptChatMessage(conversationId, outgoingContent);
      outgoingContent = ciphertext;
    }

    client.publish({
      destination: "/app/chat.edit",
      body: JSON.stringify({
        messageId: editingMessageId,
        conversationId: Number(conversationId),
        content: outgoingContent,
      }),
    });
    setEditingMessageId(null);
    setEditContent("");
  }

  function cancelEdit() {
    setEditingMessageId(null);
    setEditContent("");
  }

  function deleteMessage(messageId: number) {
    const client = clientRef.current;
    if (!client?.connected) return;

    client.publish({
      destination: "/app/chat.delete",
      body: JSON.stringify({
        messageId,
        conversationId: Number(conversationId),
      }),
    });
    closeContextMenu();
  }

  // ============ UI Handlers ============

  function handleE2eeToggle(checked: boolean) {
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

  function handleAlgChange(newAlg: KemAlg) {
    if (!algLocked) setAlg(newAlg);
  }

  function sendTypingEvent(isTyping: boolean) {
    const client = clientRef.current;
    if (!client?.connected) return;
    client.publish({
      destination: "/app/chat.typing",
      body: JSON.stringify({ conversationId: Number(conversationId), isTyping }),
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
    if (!client?.connected) return;
    client.publish({
      destination: "/app/chat.read",
      body: JSON.stringify({ conversationId: Number(conversationId), messageId }),
    });
  }

  function sendReadReceiptsForUnreadMessages() {
    const client = clientRef.current;
    if (!client?.connected) return;
    const lastFromOther = [...rawMessagesRef.current].reverse().find(m => m.senderUsername !== usernameRef.current);
    if (lastFromOther) sendReadReceipt(lastFromOther.id);
  }

  // ============ Initialization ============

  useEffect(() => {
    if (!conversationId) return;

    // Reset state
    setMessages([]);
    setError(null);
    setPendingInvite(null);
    setOtherUsername("");
    setShowDisableWarning(false);
    setHandshakeStarted(false);
    setOtherUserTyping(false);
    setLastReadMessageId(null);
    setMessagesLoaded(false);
    setEditingMessageId(null);
    setEditContent("");
    setE2eeReady(false);
    setAlgLocked(false);
    rawMessagesRef.current = [];
    usernameRef.current = getUsername();

    // Check E2EE preference
    const e2eeEnabledStored = localStorage.getItem(`e2ee_enabled:${conversationId}`);
    setE2eeEnabled(e2eeEnabledStored !== "false");

    // Load data
    loadConversations();
    loadInitialMessages();
    connectSocket();

    return () => {
      subRef.current?.unsubscribe();
      typingSubRef.current?.unsubscribe();
      readSubRef.current?.unsubscribe();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      clientRef.current?.deactivate();
    };
  }, [conversationId]);

  // ============ Derived State ============

  const displayAlg = pendingInvite?.alg || alg;
  const algInfo = ALG_INFO[displayAlg];
  const inputDisabled = (e2eeEnabled && !e2eeReady) || sendingImage;
  const showEncryptionSetup = messagesLoaded && e2eeEnabled && !e2eeReady && !handshakeStarted && !pendingInvite;

  // ============ Render ============

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        <AppShell
          sidebar={<ConversationsSidebar items={conversations} />}
          header={
            <div className="flex w-full items-center justify-between">
              {/* Left section: Back button + User info */}
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => router.push("/conversations")} 
                  className="h-8 px-2 -ml-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Button>
                
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 border border-border">
                    {otherUsername && (
                      <AvatarImage src={profilePictureUrl(otherUsername)} alt={otherUsername} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-xs font-medium">
                      {otherUsername ? otherUsername.charAt(0).toUpperCase() : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold">{otherUsername || "Conversation"}</span>

                  {e2eeEnabled ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      e2eeReady 
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}>
                      {e2eeReady ? (
                        <>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          {algInfo.name}
                        </>
                      ) : (
                        handshakeStarted ? "Waiting..." : pendingInvite ? "Invite pending" : "Setup needed"
                      )}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-500">
                      Unencrypted
                    </span>
                  )}
                </div>
              </div>

              {/* Right section: Controls */}
              <div className="flex items-center gap-3">
                {/* E2EE Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">E2EE</span>
                  <Switch checked={e2eeEnabled} onCheckedChange={handleE2eeToggle} />
                </div>

                {e2eeEnabled && e2eeReady && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleReset} 
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reset
                  </Button>
                )}

                <div className="h-4 w-px bg-border" />

                {/* Benchmark button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBenchmark(!showBenchmark)}
                  className={`h-8 px-3 gap-1.5 ${showBenchmark ? 'bg-muted' : ''}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-xs">Benchmarks</span>
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex h-full flex-col">
            {/* Loading */}
            {!messagesLoaded && (
              <div className="border-b border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <svg className="h-4 w-4 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm text-muted-foreground">Loading messages...</span>
                </div>
              </div>
            )}

            {/* Encryption Setup */}
            {showEncryptionSetup && (
              <div className="border-b border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Start encrypted conversation</p>
                      <p className="text-xs text-muted-foreground">
                        {algLocked ? `Using ${ALG_INFO[alg].name}` : "Select an encryption algorithm"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {!algLocked && (
                      <div className="flex rounded-lg border border-border p-0.5 bg-background">
                        {VALID_ALGS.map((a) => (
                          <button
                            key={a}
                            onClick={() => handleAlgChange(a)}
                            className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                              alg === a 
                                ? `${ALG_INFO[a].bg} ${ALG_INFO[a].color} font-medium` 
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            }`}
                          >
                            {ALG_INFO[a].name}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {algLocked && (
                      <span className={`px-3 py-1.5 text-xs rounded-md ${ALG_INFO[alg].bg} ${ALG_INFO[alg].color} font-medium`}>
                        {ALG_INFO[alg].name}
                      </span>
                    )}
                    
                    <Button 
                      size="sm" 
                      onClick={() => startE2eeHandshake(alg).catch(e => setError(e?.message))} 
                      className="h-8"
                    >
                      Start Encryption
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Disable Warning */}
            {showDisableWarning && (
              <div className="border-b border-red-500/30 bg-red-500/5 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Turn off encryption?</p>
                      <p className="text-xs text-muted-foreground">Messages will be sent without encryption</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowDisableWarning(false)}>Cancel</Button>
                    <Button size="sm" className="h-8 bg-red-600 hover:bg-red-700 text-white" onClick={confirmDisableE2ee}>Turn Off</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Pending Invite */}
            {pendingInvite && (
              <div className="border-b border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{pendingInvite.fromUsername} wants to encrypt</p>
                      <p className="text-xs text-muted-foreground">Using {ALG_INFO[pendingInvite.alg].name} encryption</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => setPendingInvite(null)}>Later</Button>
                    <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={acceptInvite}>Accept</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Waiting for other user */}
            {e2eeEnabled && !e2eeReady && handshakeStarted && !pendingInvite && messagesLoaded && (
              <div className="border-b border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Waiting for {otherUsername || "other user"}</p>
                    <p className="text-xs text-muted-foreground">Encryption request sent using {ALG_INFO[alg].name}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="border-b border-red-500/30 bg-red-500/5 px-4 py-2">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-auto p-4 space-y-3">
                {messages.length === 0 && messagesLoaded && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-sm text-muted-foreground">No messages yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Start the conversation</p>
                  </div>
                )}
                
                {messages.map((m) => {
                  const isMe = (m.senderUsername ?? "") === usernameRef.current;
                  const isRead = isMe && lastReadMessageId !== null && m.id <= lastReadMessageId;
                  const isEditing = editingMessageId === m.id;

                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`relative flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[75%] group`}
                        onContextMenu={isMe && !m.deleted ? (e) => handleContextMenu(e, m.id) : undefined}
                      >
                        {/* Hover action bar — own non-deleted non-editing messages only */}
                        {isMe && !m.deleted && !isEditing && (
                          <div className="hidden group-hover:flex items-center gap-1 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!m.voiceData && !m.imageData && (
                              <button
                                onClick={() => startEditing(m)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title="Edit message"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                              </button>
                            )}
                            <button
                              onClick={() => deleteMessage(m.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              title="Delete message"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        )}
                        <div className={`rounded-2xl px-4 py-2.5 text-sm ${m.deleted ? "bg-muted/50 italic" : isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <div className="mb-1 text-[11px] opacity-70 flex items-center justify-between gap-4">
                            <span className="font-medium">{m.senderUsername ?? "Unknown"}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {m.edited && !m.deleted && (
                                <span className="text-[10px] opacity-60">edited</span>
                              )}
                              <span className="text-[10px]">{formatMessageTime(m.timestamp)}</span>
                            </div>
                          </div>
                          {m.deleted ? (
                            <p className="text-muted-foreground text-xs">This message was deleted</p>
                          ) : isEditing ? (
                            <div className="flex flex-col gap-2">
                              <input
                                type="text"
                                className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground outline-none"
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { e.preventDefault(); submitEdit(); }
                                  if (e.key === "Escape") cancelEdit();
                                }}
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end">
                                <button onClick={cancelEdit} className="text-[11px] opacity-70 hover:opacity-100">Cancel</button>
                                <button onClick={submitEdit} className="text-[11px] font-medium opacity-90 hover:opacity-100">Save</button>
                              </div>
                            </div>
                          ) : m.voiceData ? (
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                              </svg>
                              <audio
                                controls
                                src={`data:${m.voiceData.mimeType};base64,${m.voiceData.data}`}
                                className="max-w-[240px] h-8"
                              />
                            </div>
                          ) : m.imageData ? (
                            <img
                              src={`data:${m.imageData.mimeType};base64,${m.imageData.data}`}
                              alt="Image"
                              className="max-w-full rounded-lg max-h-64 object-contain"
                            />
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{m.displayContent}</p>
                          )}
                        </div>
                        {isMe && !m.deleted && (
                          <div className="text-[10px] text-muted-foreground mt-1 mr-1 flex items-center gap-1">
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

                        {/* Context menu */}
                        {contextMenuMessageId === m.id && isMe && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
                            <div
                              className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px]"
                              style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
                            >
                              {!m.voiceData && !m.imageData && (
                                <button
                                  onClick={() => startEditing(m)}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                              )}
                              <button
                                onClick={() => deleteMessage(m.id)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted text-red-500 flex items-center gap-2"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {otherUserTyping && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{otherUsername} is typing</span>
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-border bg-background p-4">
              <input type="file" ref={imageInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={inputDisabled}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Send image"
                >
                  {sendingImage ? (
                    <svg className="h-4 w-4 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>

                {/* Mic button */}
                <button
                  onClick={recording ? stopRecordingAndSend : startRecording}
                  disabled={inputDisabled || sendingVoice}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    recording
                      ? "border-red-500 bg-red-500/20 text-red-500"
                      : "border-border bg-muted/30 hover:bg-muted text-muted-foreground"
                  }`}
                  title={recording ? "Stop & send" : "Record voice message"}
                >
                  {sendingVoice ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : recording ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>

                {recording ? (
                  <div className="flex-1 h-10 rounded-lg border border-red-500/30 bg-red-500/10 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-sm text-red-500 font-medium">
                        {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, "0")}
                      </span>
                      <span className="text-xs text-muted-foreground">Recording...</span>
                    </div>
                    <button
                      onClick={cancelRecording}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    className="flex-1 h-10 rounded-lg border border-border bg-muted/30 px-4 text-sm outline-none focus:ring-2 focus:ring-ring focus:bg-background transition-colors"
                    value={content}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder={inputDisabled ? "Waiting for encryption..." : e2eeEnabled ? "Type a message..." : "Type a message (unencrypted)..."}
                    disabled={inputDisabled}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  />
                )}

                {!recording && (
                  <Button
                    onClick={send}
                    disabled={inputDisabled || !content.trim()}
                    className="h-10 px-5"
                  >
                    Send
                  </Button>
                )}
              </div>
              
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {e2eeEnabled && e2eeReady ? (
                  <>
                    <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>End-to-end encrypted with {algInfo.name}</span>
                  </>
                ) : e2eeEnabled ? (
                  <>
                    <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Setting up encryption...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    <span>Messages are not encrypted</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </AppShell>
      </div>
      
      <BenchmarkPanel isOpen={showBenchmark} onClose={() => setShowBenchmark(false)} />
    </div>
  );
}
