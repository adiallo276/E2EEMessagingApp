"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Conversation = {
  id: number;
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [user2, setUser2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await api("/conversations/me");
    setConversations(data);
  }

  useEffect(() => {
    load().catch((e: any) => {
      setError(e.message || "Failed to load conversations");
      if (String(e.message).includes("401")) window.location.href = "/login";
    });
  }, []);

  async function createConversation() {
    if (!user2.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const created = await api(`/conversations?user2=${encodeURIComponent(user2)}`, {
        method: "POST",
      });

      setUser2("");
      await load();

      window.location.href = `/messages/${created.id}`;
    } catch (e: any) {
      setError(e.message || "Failed to create conversation");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Your Conversations</h1>
        <button onClick={logout} className="text-sm underline">
          Logout
        </button>
      </div>

      <div className="border rounded p-3 mb-4">
        <div className="font-semibold mb-2">Start a new chat</div>
        <div className="flex gap-2">
          <input
            className="border rounded flex-1 p-2"
            placeholder="Enter username (e.g. someone123)"
            value={user2}
            onChange={e => setUser2(e.target.value)}
          />
          <button
            className="bg-blue-600 text-white px-4 rounded disabled:opacity-60"
            onClick={createConversation}
            disabled={loading}
          >
            Start
          </button>
        </div>
      </div>

      {error && <div className="text-red-600 mb-3">{error}</div>}

      {conversations.length === 0 ? (
        <div className="text-gray-600">No conversations yet. Start one above.</div>
      ) : (
        <div className="space-y-2">
          {conversations.map(c => (
            <div
              key={c.id}
              className="border p-3 rounded cursor-pointer hover:bg-slate-100"
              onClick={() => (window.location.href = `/messages/${c.id}`)}
            >
              Conversation #{c.id}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}