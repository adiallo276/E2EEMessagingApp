"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";

type Message = {
  id: number;
  conversationId?: number;
  content: string;
  senderUsername?: string;
  timestamp?: string;
};

export default function MessagesPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = String((params as any).id);

  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<Client | null>(null);
  const subRef = useRef<StompSubscription | null>(null);

  async function loadInitialMessages() {
    try {
      const data = await api(`/messages/${conversationId}`);
      setMessages(data);
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
      subRef.current = client.subscribe(`/topic/conversations/${conversationId}`, (msg: IMessage) => {
        const incoming: Message = JSON.parse(msg.body);
        setMessages(prev => [...prev, incoming]);
      });
    };

    client.onStompError = frame => {
      setError(frame.headers["message"] || "WebSocket error");
    };

    client.onWebSocketError = () => {
      setError("WebSocket connection error");
    };

    client.onDisconnect = () => {};

    client.activate();
    clientRef.current = client;
  }

  function send() {
    if (!content.trim()) return;

    const client = clientRef.current;
    if (!client || !client.connected) {
      setError("Not connected to chat server yet");
      return;
    }

    client.publish({
      destination: "/app/chat.send",
      body: JSON.stringify({
        conversationId: Number(conversationId),
        content,
      }),
    });

    setContent("");
  }

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
  }, [conversationId]);

  return (
    <div className="p-6 flex flex-col h-screen">
      <h1 className="font-bold mb-4">Conversation {conversationId}</h1>

      {error && <div className="text-red-600 mb-2">{error}</div>}

      <div className="flex-1 border rounded p-3 mb-4 overflow-auto">
        {messages.map(m => (
          <div key={m.id} className="mb-2">
            <b>{m.senderUsername ?? (m as any).sender?.username ?? "Unknown"}: </b>
            {m.content}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="border rounded flex-1 p-2"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={e => {
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