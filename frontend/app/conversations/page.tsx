"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { api, apiUpload, profilePictureUrl } from "@/lib/api";
import { resizeImage } from "@/lib/image-utils";
import BenchmarkPanel from "@/components/ui/benchmark-panel";

type Conversation = {
  id: number;
  user1?: { username?: string };
  user2?: { username?: string };
};

type ConversationWithPreview = Conversation & {
  lastMessage?: string;
  lastMessageTime?: string;
};

export default function ConversationsPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState<string>("");
  const [conversations, setConversations] = useState<ConversationWithPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [newUser, setNewUser] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedAlg, setSelectedAlg] = useState<"kyber" | "frodo" | "ntru" | "ecdh">("kyber");

  const [searchResults, setSearchResults] = useState<{ id: number; username: string; hasProfilePicture?: boolean }[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Profile picture state
  const [avatarKey, setAvatarKey] = useState(0); // bump to force re-render after upload
  const [uploadingPic, setUploadingPic] = useState(false);
  const picInputRef = useRef<HTMLInputElement>(null);

  // Benchmark panel state
  const [showBenchmark, setShowBenchmark] = useState(false);

  function handleSearchInput(value: string) {
    setNewUser(value);
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length === 0) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api(`/users/search?q=${encodeURIComponent(value.trim())}`);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function selectUser(uname: string) {
    setNewUser(uname);
    setShowDropdown(false);
    setSearchResults([]);
  }

  async function handleProfilePicUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    setUploadingPic(true);
    setError(null);

    try {
      const resized = await resizeImage(file, 256);
      await apiUpload("/users/me/profile-picture", resized);
      setAvatarKey((k) => k + 1); // force avatar image refresh
    } catch (err: any) {
      setError(err?.message || "Failed to upload profile picture");
    } finally {
      setUploadingPic(false);
      if (picInputRef.current) picInputRef.current.value = "";
    }
  }

  function formatLastMessage(msg: any, myUsername: string): string {
    if (!msg || !msg.content) return "";
    
    const prefix = msg.senderUsername === myUsername ? "You: " : "";
    
    try {
      const env = JSON.parse(msg.content);
      if (env.type === "E2EE_HELLO") return "🔐 Encryption requested";
      if (env.type === "E2EE_KEY") return "✓ Encryption established";
      if (env.type === "E2EE_MSG") return prefix + "🔒 Encrypted";
    } catch {
      if (msg.content.startsWith("IMG:")) {
        return prefix + "📷 Image";
      }
      if (msg.content.startsWith("VOICE:")) {
        return prefix + "🎤 Voice message";
      }
      const text = msg.content.length > 35 
        ? msg.content.substring(0, 35) + "..." 
        : msg.content;
      return prefix + text;
    }
    
    return "";
  }

  function formatTime(timestamp: string): string {
    if (!timestamp) return "";
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }

  async function loadConversations() {
    setLoading(true);
    try {
      const myUsername = localStorage.getItem("username") || "";
      const data: Conversation[] = await api("/conversations/me");
      
      const conversationsWithPreviews = await Promise.all(
        data.map(async (c) => {
          let lastMessage = "";
          let lastMessageTime = "";
          
          try {
            const lastMsg = await api(`/messages/${c.id}/last`);
            if (lastMsg) {
              lastMessage = formatLastMessage(lastMsg, myUsername);
              lastMessageTime = lastMsg.timestamp || "";
            }
          } catch {
            // No messages yet
          }
          
          return { ...c, lastMessage, lastMessageTime };
        })
      );
      
      conversationsWithPreviews.sort((a, b) => {
        if (!a.lastMessageTime && !b.lastMessageTime) return 0;
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });
      
      setConversations(conversationsWithPreviews);
    } catch (e: any) {
      setError(e?.message || "Failed to load conversations");
      if (String(e?.message).includes("401")) router.replace("/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMounted(true);

    const token = localStorage.getItem("token");
    const u = localStorage.getItem("username") || "";

    if (!token) {
      router.replace("/login");
      return;
    }

    setUsername(u);
    loadConversations();
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

      // Store the selected algorithm for this conversation
      localStorage.setItem(`e2ee_alg_locked:${created.id}`, selectedAlg);
      
      setNewUser("");
      await loadConversations();

      router.push(`/messages/${created.id}`);
    } catch (e: any) {
      setError(e?.message || "Failed to start conversation");
    } finally {
      setCreating(false);
    }
  }

  const algConfig = {
    kyber: { 
      bg: "bg-indigo-500/20", 
      text: "text-indigo-600 dark:text-indigo-400",
      name: "Kyber",
      desc: "Post-quantum (Ring-LWE)",
      badge: "PQC"
    },
    frodo: { 
      bg: "bg-orange-500/20", 
      text: "text-orange-600 dark:text-orange-400",
      name: "Frodo",
      desc: "Post-quantum (LWE)",
      badge: "PQC"
    },
    ntru: { 
      bg: "bg-purple-500/20", 
      text: "text-purple-600 dark:text-purple-400",
      name: "NTRU",
      desc: "Post-quantum (Lattice)",
      badge: "PQC"
    },
    ecdh: { 
      bg: "bg-emerald-500/20", 
      text: "text-emerald-600 dark:text-emerald-400",
      name: "Classic",
      desc: "Traditional (ECDH P-256)",
      badge: "Standard"
    },
  };

  return (
    <div className="flex h-screen">
    <main className="flex-1 overflow-auto bg-background text-foreground">
      {/* Hidden file input for profile picture */}
      <input
        type="file"
        ref={picInputRef}
        onChange={handleProfilePicUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Header */}
      <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => picInputRef.current?.click()}
            disabled={uploadingPic}
            className="relative group"
            title="Change profile picture"
          >
            <Avatar className="h-10 w-10 border border-border">
              {username && (
                <AvatarImage
                  key={avatarKey}
                  src={profilePictureUrl(username)}
                  alt={username}
                />
              )}
              <AvatarFallback className="bg-primary/20 text-sm font-bold">
                {username ? username.charAt(0).toUpperCase() : "Q"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploadingPic ? (
                <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </div>
          </button>
          <div>
            <div className="font-semibold tracking-tight leading-tight">Post-Quantum Messaging Service</div>
            <div className="text-xs text-muted-foreground">
              {username ? `Signed in as ${username}` : "Secure chat • E2EE • PQC-ready"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBenchmark(!showBenchmark)}
            className={`h-8 px-3 gap-1.5 ${showBenchmark ? "bg-muted" : ""}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-xs">Benchmarks</span>
          </Button>
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

        {/* ChatGPT Bot Card */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/bot')}
            className="w-full rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-transparent p-4 hover:from-emerald-500/20 transition text-left flex items-center gap-4"
          >
            <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-semibold flex items-center gap-2">
                ChatGPT API
                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600">Testing</span>
              </div>
              <div className="text-sm text-muted-foreground">Start a chat with ChatGPT!</div>
            </div>
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Left card: conversations */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="font-medium">Conversations</div>
                <div className="text-xs text-muted-foreground">Click one to open</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadConversations}
                disabled={loading}
                className="h-8"
              >
                {loading ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </Button>
            </div>

            <div className="p-3 space-y-2 max-h-[500px] overflow-auto">
              {loading && conversations.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="h-6 w-6 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-sm text-muted-foreground px-2 py-6 text-center">
                  No conversations yet. Start one →
                </div>
              ) : (
                conversations.map((c) => {
                  const other = otherUser(c);
                  return (
                    <button
                      key={c.id}
                      onClick={() => router.push(`/messages/${c.id}`)}
                      className="w-full text-left rounded-xl border border-border bg-background/40 hover:bg-background px-3 py-3 transition group"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 shrink-0 border border-border">
                          <AvatarImage src={profilePictureUrl(other)} alt={other} />
                          <AvatarFallback className="bg-primary/10 text-xs font-medium">
                            {other.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">{other}</div>
                            {c.lastMessageTime && (
                              <div className="text-[10px] text-muted-foreground">
                                {formatTime(c.lastMessageTime)}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {c.lastMessage || "No messages yet"}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right card: new conversation */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden h-fit">
            <div className="p-4 border-b border-border">
              <div className="font-medium">Start a new conversation</div>
              <div className="text-xs text-muted-foreground">
                Search for a user by username
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Username</label>
                <div className="relative">
                  <input
                    className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Search for a user..."
                    value={newUser}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newUser.trim()) createConversation();
                    }}
                  />

                  {showDropdown && newUser.trim().length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                      {searching ? (
                        <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                          Searching...
                        </div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((user) => (
                          <button
                            key={user.id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectUser(user.username)}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 transition flex items-center gap-2 border-b border-border last:border-0"
                          >
                            <Avatar className="h-7 w-7 shrink-0 border border-border">
                              {user.hasProfilePicture && (
                                <AvatarImage src={profilePictureUrl(user.username)} alt={user.username} />
                              )}
                              <AvatarFallback className="bg-primary/10 text-xs font-medium">
                                {user.username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{user.username}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                          No users found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Select encryption algorithm</label>
                <div className="flex rounded-xl border border-border p-1 bg-muted/30">
                  {(["kyber", "frodo", "ntru", "ecdh"] as const).map((alg) => {
                    const config = algConfig[alg];
                    const isSelected = selectedAlg === alg;
                    return (
                      <button
                        key={alg}
                        onClick={() => setSelectedAlg(alg)}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg transition-all ${
                          isSelected
                            ? `${config.bg} ${config.text} font-medium`
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {config.name}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {algConfig[selectedAlg].desc}
                </div>
              </div>

              <Button onClick={createConversation} disabled={creating || !newUser.trim()} className="w-full h-11">
                {creating ? "Creating..." : "Create & open"}
              </Button>

              <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <div className="font-medium mb-1">About the algorithms:</div>
                <ul className="space-y-1 text-[11px]">
                  <li><span className="text-indigo-600 dark:text-indigo-400 font-medium">Kyber</span> — Post-quantum (Ring-LWE), fastest PQC option</li>
                  <li><span className="text-orange-600 dark:text-orange-400 font-medium">Frodo</span> — Post-quantum (LWE), more conservative security</li>
                  <li><span className="text-purple-600 dark:text-purple-400 font-medium">NTRU</span> — Post-quantum (Lattice), one of the oldest PQC schemes</li>
                  <li><span className="text-emerald-600 dark:text-emerald-400 font-medium">Classic</span> — Traditional ECDH (P-256), widely deployed standard</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          Created by Abdoulahi Diallo for Final Year Project
        </div>
      </div>
    </main>
    <BenchmarkPanel isOpen={showBenchmark} onClose={() => setShowBenchmark(false)} />
    </div>
  );
}
