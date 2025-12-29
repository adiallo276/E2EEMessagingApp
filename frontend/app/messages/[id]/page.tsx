"use client";

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
    <div className="p-6 flex flex-col h-screen">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-bold">Conversation {conversationId}</h1>

        <div className="flex items-center gap-3">
          <select
            className="border rounded px-3 py-1"
            value={alg}
            disabled={e2eeEnabled}
            onChange={(e) => {
              const v = normAlg(e.target.value);
              setAlg(v);
              localStorage.setItem(`e2ee_alg_v1:${conversationId}`, v);
            }}
          >
            <option value="kyber">Kyber</option>
            <option value="frodo">Frodo</option>
          </select>

          <button
            className="border rounded px-3 py-1"
            onClick={async () => {
              const next = !e2eeEnabled;
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
          >
            {e2eeEnabled ? "E2EE: ON" : "E2EE: OFF"}
          </button>

          {e2eeEnabled && (
            <button
              className="border rounded px-3 py-1"
              onClick={() => {
                clearSession(conversationId);
                setE2eeReady(false);
                setError("E2EE session cleared. Toggle ON to re-handshake.");
              }}
            >
              Reset E2EE
            </button>
          )}

          {e2eeEnabled && (
            <span className="text-sm">{e2eeReady ? "✅ Secure" : "⏳ Handshaking"}</span>
          )}
        </div>
      </div>

      {error && <div className="text-red-600 mb-2">{error}</div>}

      <div className="flex-1 border rounded p-3 mb-4 overflow-auto">
        {messages.map((m) => (
          <div key={m.id} className="mb-2">
            <b>{m.senderUsername ?? "Unknown"}: </b>
            {m.displayContent}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="border rounded flex-1 p-2"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            e2eeEnabled
              ? e2eeReady
                ? "Type a secure message..."
                : "Handshake in progress..."
              : "Type a message..."
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button className="bg-blue-600 text-white px-4 rounded" onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}