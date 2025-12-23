"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Message = {
  id: number;
  content: string;
  sender?: { username?: string };
};

export default function MessagesPage() {
  const params = useParams();
  const router = useRouter();

  const conversationId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api(`/messages/${conversationId}`);
      setMessages(data);
    } catch (e: any) {
      setError(e.message || "Failed to load messages");
      if (String(e.message).includes("401")) router.push("/login");
    }
  }

  async function send() {
    if (!content.trim()) return;

    try {
      setError(null);
      await api(
        `/messages?conversationId=${conversationId}&content=${encodeURIComponent(
          content
        )}`,
        { method: "POST" }
      );
      setContent("");
      load();
    } catch (e: any) {
      setError(e.message || "Failed to send message");
    }
  }

  useEffect(() => {
    if (conversationId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  return (
    <div className="p-6 flex flex-col h-screen">
      <h1 className="font-bold mb-4">Conversation {conversationId}</h1>

      {error && <div className="text-red-600 mb-2">{error}</div>}

      <div className="flex-1 border rounded p-3 mb-4 overflow-auto">
        {messages.map(m => (
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
          onChange={e => setContent(e.target.value)}
          placeholder="Type a message..."
        />
        <button className="bg-blue-600 text-white px-4 rounded" onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}