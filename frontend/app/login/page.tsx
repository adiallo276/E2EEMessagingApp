"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Zap, Bot, ArrowLeft, User, KeyRound } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const initialMode = useMemo(() => (sp.get("mode") === "register" ? "register" : "login"), [sp]);
  const [mode, setMode] = useState<"login" | "register">(initialMode);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
      setSuccess("Account created! You can now log in.");
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Register failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground grid lg:grid-cols-2">
      {/* Gradient background for mobile */}
      <div className="fixed inset-0 -z-10 overflow-hidden lg:hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Left promo panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-10">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/25">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <div className="font-bold text-xl tracking-tight">Q-Messaging</div>
              <div className="text-sm text-muted-foreground">Post-Quantum Secure</div>
            </div>
          </div>

          <h2 className="mt-12 text-4xl font-bold leading-tight tracking-tight">
            Secure messaging for the{" "}
            <span className="gradient-text">quantum age</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-md leading-relaxed text-lg">
            Experience end-to-end encrypted messaging with post-quantum cryptographic algorithms.
          </p>

          <div className="mt-10 space-y-4">
            <div className="group flex items-start gap-4 rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-5 hover:border-primary/30 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">End-to-End Encryption</div>
                <div className="text-sm text-muted-foreground mt-0.5">All cryptography runs in your browser</div>
              </div>
            </div>
            
            <div className="group flex items-start gap-4 rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-5 hover:border-primary/30 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">PQC Algorithms</div>
                <div className="text-sm text-muted-foreground mt-0.5">Mini-Kyber, Mini-Frodo, Mini-NTRU</div>
              </div>
            </div>
            
            <div className="group flex items-start gap-4 rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-5 hover:border-primary/30 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">AI Integration</div>
                <div className="text-sm text-muted-foreground mt-0.5">Chat with ChatGPT using quantum-safe encryption</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/25">
              <Shield className="h-5 w-5" />
            </div>
            <div className="font-bold text-lg tracking-tight">Q-Messaging</div>
          </div>

          <div className="rounded-3xl border border-border bg-card/80 backdrop-blur-xl p-8 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {mode === "login" ? "Welcome back" : "Create account"}
              </h1>
              <Link 
                href="/" 
                className="lg:hidden text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back
              </Link>
            </div>

            <p className="text-muted-foreground">
              {mode === "login"
                ? "Enter your credentials to continue"
                : "Get started with secure messaging"}
            </p>

            {error && (
              <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                {success}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  className="w-full rounded-xl border border-border bg-background pl-11 pr-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && username && password && !busy) {
                      e.preventDefault();
                      mode === "login" ? handleLogin() : handleRegister();
                    }
                  }}
                />
              </div>
              
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  className="w-full rounded-xl border border-border bg-background pl-11 pr-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && username && password && !busy) {
                      e.preventDefault();
                      mode === "login" ? handleLogin() : handleRegister();
                    }
                  }}
                />
              </div>

              <Button
                className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                disabled={busy || !username || !password}
                onClick={mode === "login" ? handleLogin : handleRegister}
              >
                {busy ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Please wait...
                  </div>
                ) : mode === "login" ? (
                  "Sign in"
                ) : (
                  "Create account"
                )}
              </Button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <button
                className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setMode(mode === "login" ? "register" : "login");
                }}
                type="button"
              >
                {mode === "login" ? (
                  <>Don&apos;t have an account? <span className="text-primary font-medium">Sign up</span></>
                ) : (
                  <>Already have an account? <span className="text-primary font-medium">Sign in</span></>
                )}
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Lock className="inline h-3 w-3 mr-1" />
            Your messages are end-to-end encrypted
          </div>
        </div>
      </div>
    </main>
  );
}
