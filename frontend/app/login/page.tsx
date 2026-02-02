"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const initialMode = useMemo(() => (sp.get("mode") === "register" ? "register" : "login"), [sp]);
  const [mode, setMode] = useState<"login" | "register">(initialMode);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setMode(initialMode), [initialMode]);

  async function handleLogin() {
    try {
      setBusy(true);
      setError(null);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Login failed");
      }

      const token = await res.text();

      // ✅ Save BOTH
      localStorage.setItem("token", token);
      localStorage.setItem("username", username);

      router.push("/conversations");
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    try {
      setBusy(true);
      setError(null);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Register failed");
      }

      setUsername("");
      setPassword("");

      setMode("login");
      setError("✅ Registered! Now log in.");
    } catch (e: any) {
      setError(e?.message || "Register failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground grid lg:grid-cols-2">
      {/* Left promo */}
      <div className="hidden lg:flex flex-col justify-between p-10 border-r border-border bg-card">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-primary/20 border border-border grid place-items-center">
              <span className="text-sm font-bold">Q</span>
            </div>
            <div className="font-semibold tracking-tight text-lg">Post-Quantum Cryptograpic Algorithms</div>
          </div>

          <h2 className="mt-10 text-3xl font-semibold leading-tight">
            PQC <span className="text-primary">+</span> E2EE toggle
          </h2>
          <p className="mt-3 text-muted-foreground max-w-md leading-relaxed">
            Messaging app that uses lattice-based post-quantum cryptographic algorithms to secure
            your conversations.
          </p>

          <div className="mt-8 grid gap-3">
            <div className="rounded-xl border border-border bg-background p-4 text-sm">
              <div className="font-medium">Realtime messaging</div>
              <div className="text-muted-foreground mt-1">WebSockets</div>
            </div>
            <div className="rounded-xl border border-border bg-background p-4 text-sm">
              <div className="font-medium">End-to-end encryption</div>
              <div className="text-muted-foreground mt-1">Per conversation</div>
            </div>
            <div className="rounded-xl border border-border bg-background p-4 text-sm">
              <div className="font-medium">PQC-ready architecture</div>
              <div className="text-muted-foreground mt-1">Mini-Kyber and Mini-Frodo</div>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Built by Abdoulahi Diallo
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">
              {mode === "login" ? "Sign in" : "Create account"}
            </h1>
            <Link href="/" className="text-xs text-muted-foreground hover:underline">
              Back
            </Link>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Welcome back. Log in to continue."
              : "Create an account to start chatting."}
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-border bg-background px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <div className="mt-5 space-y-3">
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            <Button
              className="w-full h-10"
              disabled={busy || !username || !password}
              onClick={mode === "login" ? handleLogin : handleRegister}
            >
              {busy ? "Please wait…" : mode === "login" ? "Login" : "Register"}
            </Button>

            <button
              className="w-full text-sm text-muted-foreground hover:text-foreground transition"
              onClick={() => {
                setError(null);
                setMode(mode === "login" ? "register" : "login");
              }}
              type="button"
            >
              {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
            </button>
          </div>

          <div className="mt-6 text-[11px] text-muted-foreground">
            This is a demo app for a project. Do not use real credentials.
          </div>
        </div>
      </div>
    </main>
  );
}