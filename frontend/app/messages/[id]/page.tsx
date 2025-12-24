"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Client } from "@stomp/stompjs";

type Message = {
  id: number;
  content: string;
  sender?: { username?: string };
  timestamp?: string;
};

export default function MessagesPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<Client | null>(null);

  async function loadInitialMessages() {
    try {
      const data = await api(`/messages/${conversationId}`);
      setMessages(data);
    } catch (e: any) {
      setError(e.message || "Failed to load messages");
      if (String(e.message).includes("401")) router.push("/login");
    }
  }

  async function connectSocket() {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const client = new Client({
      brokerURL: `ws://localhost:8080/ws?token=${encodeURIComponent(token)}`,
      reconnectDelay: 2000,
    });

    client.onConnect = () => {
      setError(null);

      // ✅ THIS IS WHERE THE SUBSCRIBE GOES
      const sub = client.subscribe(`/topic/conversations/${conversationId}`, (msg) => {
        const incoming: Message = JSON.parse(msg.body);
        setMessages((prev) => [...prev, incoming]);
      });

      // store subscription if you want to unsubscribe manually later
      // (we’ll just deactivate the whole client on cleanup)
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

  async function send() {
    if (!content.trim()) return;

    const client = clientRef.current;
    if (!client || !client.connected) {
      setError("Not connected to chat server yet");
      return;
    }

    try {
      setError(null);

      // ✅ THIS IS WHERE THE PUBLISH GOES
      client.publish({
        destination: "/app/chat.send",
        body: JSON.stringify({
          conversationId: Number(conversationId),
          content,
        }),
      });

      setContent("");
    } catch (e: any) {
      setError(e.message || "Failed to send");
    }
  }

  useEffect(() => {
    if (!conversationId) return;

    loadInitialMessages();
    connectSocket();

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  return (
    <div className="p-6 flex flex-col h-screen">
      <h1 className="font-bold mb-4">Conversation {conversationId}</h1>

      {error && <div className="text-red-600 mb-2">{error}</div>}

      <div className="flex-1 border rounded p-3 mb-4 overflow-auto">
        {messages.map((m) => (
          <div key={m.id} className="mb-2">
            <b>{m.sender?.username ?? "Unknown"}: </b>
            {m.content}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="border rounded flex-1 p-2"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type a message..."
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