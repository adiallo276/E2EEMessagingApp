"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type Conversation = {
  id: number;
  user1?: { username?: string };
  user2?: { username?: string };
};

export default function ConversationsPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newUser, setNewUser] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setMounted(true);

    const token = localStorage.getItem("token");
    const u = localStorage.getItem("username") || "";

    if (!token) {
      router.replace("/login");
      return;
    }

    setUsername(u);

    (async () => {
      try {
        const data = await api("/conversations/me");
        setConversations(data);
      } catch (e: any) {
        setError(e?.message || "Failed to load conversations");
        if (String(e?.message).includes("401")) router.replace("/login");
      }
    })();
  }, [router]);

  if (!mounted) return null;

  function otherUser(c: Conversation) {
    const u1 = c.user1?.username || "";
    const u2 = c.user2?.username || "";
    if (!username) return u1 || u2 || "Unknown";
    return u1 === username ? u2 : u1;
  }

  async function createConversation() {
    const u = newUser.trim();
    if (!u) return;

    setCreating(true);
    setError(null);

    try {
      const created = await api(`/conversations?user2=${encodeURIComponent(u)}`, {
        method: "POST",
      });

      setNewUser("");
      const updated = await api("/conversations/me");
      setConversations(updated);

      router.push(`/messages/${created.id}`);
    } catch (e: any) {
      setError(e?.message || "Failed to start conversation");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/20 border border-border grid place-items-center">
            <span className="text-sm font-bold">Q</span>
          </div>
          <div>
            <div className="font-semibold tracking-tight leading-tight">Q-Messaging</div>
            <div className="text-xs text-muted-foreground">
              {username ? `Signed in as ${username}` : "Secure chat • Optional E2EE • PQC-ready"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="outline"
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("username");
              router.replace("/login");
            }}
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 pb-12">
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Left card: conversations */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="font-medium">Conversations</div>
              <div className="text-xs text-muted-foreground">Click one to open</div>
            </div>

            <div className="p-3 space-y-2">
              {conversations.length === 0 ? (
                <div className="text-sm text-muted-foreground px-2 py-6">
                  No conversations yet. Start one on the right:
                </div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => router.push(`/messages/${c.id}`)}
                    className="w-full text-left rounded-xl border border-border bg-background/40 hover:bg-background px-3 py-3 transition"
                  >
                    <div className="text-sm font-medium">{otherUser(c)}</div>
                    <div className="text-xs text-muted-foreground">Conversation #{c.id}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right card: new conversation */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="font-medium">Start a new conversation</div>
              <div className="text-xs text-muted-foreground">
                Enter the other user’s exact username (must already be registered)
              </div>
            </div>

            <div className="p-4 space-y-3">
              <input
                className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. admin"
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createConversation();
                }}
              />

              <div className="flex gap-2">
                <Button onClick={createConversation} disabled={creating}>
                  {creating ? "Creating..." : "Create & open"}
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      setError(null);
                      const updated = await api("/conversations/me");
                      setConversations(updated);
                    } catch (e: any) {
                      setError(e?.message || "Failed to refresh");
                    }
                  }}
                >
                  Refresh
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
                Designed by Abdoulahi Diallo, for final year project purposes. 
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}