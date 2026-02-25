"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ui/theme-toggle";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Top navigation */}
      <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/20 border border-border grid place-items-center">
            <span className="text-sm font-bold">Q</span>
          </div>
          <div className="font-semibold tracking-tight">
            Post-Quantum Cryptographic Algorithms
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="outline">Login</Button>
          </Link>
          <Link href="/login?mode=register">
            <Button>Get started</Button>
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="mx-auto max-w-6xl px-6 pt-10 pb-16 grid lg:grid-cols-2 gap-10 items-center">
        {/* Left */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Secure chat • End-to-End Encryption available • Post Quantum Cryptography
          </div>

          <h1 className="mt-4 text-4xl lg:text-5xl font-semibold leading-tight">
            A messaging app built{" "}
            <span className="text-primary">with PQC as the encryption method.</span>
          </h1>

          <p className="mt-4 text-muted-foreground leading-relaxed max-w-xl">
            Start with standard messaging, then you can enable end-to-end encryption per
            conversation.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login?mode=register">
              <Button className="h-11 px-6">Create account</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="h-11 px-6">
                I already have an account
              </Button>
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="font-medium">Four encryption options</div>
              <div className="text-muted-foreground mt-1">
                Kyber, Frodo, NTRU (PQC) + Classic
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="font-medium">WebSockets</div>
              <div className="text-muted-foreground mt-1">
                Realtime messaging
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="font-medium">E2EE Toggle</div>
              <div className="text-muted-foreground mt-1">
                Per conversation
              </div>
            </div>
          </div>
        </div>

        {/* Right preview card */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Preview</div>
              <div className="text-xs text-muted-foreground">
                What the app feels like
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Dark mode</div>
          </div>

          <div className="p-5 space-y-3">
            <div className="flex gap-3">
              <div className="h-9 w-9 rounded-full bg-muted" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">
                  friend • 2m
                </div>
                <div className="mt-1 rounded-2xl bg-muted px-3 py-2 text-sm">
                  Welcome, try Mini-Kyber on this chat!
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <div className="max-w-[70%]">
                <div className="text-right text-xs text-muted-foreground">
                  you • now
                </div>
                <div className="mt-1 rounded-2xl bg-primary text-primary-foreground px-3 py-2 text-sm">
                  Sure. Let’s also make it end-to-end encrypted!
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
              Enter message...
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}