"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ui/theme-toggle";
import { Shield, Zap, Lock, Bot, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Gradient background overlay */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/2 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Top navigation */}
      <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/25">
            <Shield className="h-5 w-5" />
          </div>
          <div className="font-semibold tracking-tight text-lg">
            Q-Messaging
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              Login
            </Button>
          </Link>
          <Link href="/login?mode=register">
            <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
              Get started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        {/* Left */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Quantum-Safe Encryption
          </div>

          <h1 className="mt-6 text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight tracking-tight">
            Secure messaging for the{" "}
            <span className="gradient-text">post-quantum era</span>
          </h1>

          <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl">
            Experience end-to-end encrypted messaging with cutting-edge post-quantum cryptography. 
            Choose from Mini-Kyber, Mini-Frodo, Mini-NTRU, or classic ECDH encryption.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/login?mode=register">
              <Button size="lg" className="h-12 px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 text-base font-medium">
                Start chatting securely
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="h-12 px-8 border-primary/20 hover:bg-primary/5 text-base font-medium">
                I have an account
              </Button>
            </Link>
          </div>

          {/* Feature cards */}
          <div className="mt-12 grid grid-cols-2 gap-4">
            <div className="group rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-5 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Lock className="h-5 w-5" />
              </div>
              <div className="font-semibold">Four Encryption Options</div>
              <div className="text-sm text-muted-foreground mt-1">
                Mini-Kyber, Mini-Frodo, Mini-NTRU + Classic ECDH
              </div>
            </div>
            
            <div className="group rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-5 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Zap className="h-5 w-5" />
              </div>
              <div className="font-semibold">Real-time Benchmarks</div>
              <div className="text-sm text-muted-foreground mt-1">
                Compare PQC algorithms against classical encryption
              </div>
            </div>
            
            <div className="group rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-5 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Shield className="h-5 w-5" />
              </div>
              <div className="font-semibold">True E2EE</div>
              <div className="text-sm text-muted-foreground mt-1">
                All encryption happens client-side in your browser
              </div>
            </div>
            
            <div className="group rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-5 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Bot className="h-5 w-5" />
              </div>
              <div className="font-semibold">AI Integration</div>
              <div className="text-sm text-muted-foreground mt-1">
                Chat with ChatGPT using quantum-safe encryption
              </div>
            </div>
          </div>
        </div>

        {/* Right preview card */}
        <div className="relative">
          {/* Glow effect behind card */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-3xl blur-2xl -z-10 scale-95" />
          
          <div className="rounded-3xl border border-border bg-card/80 backdrop-blur-xl overflow-hidden shadow-2xl">
            {/* Chat header */}
            <div className="p-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 text-primary grid place-items-center">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">Alice</div>
                    <div className="text-xs text-primary flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Mini-Kyber Encrypted
                    </div>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  E2EE Active
                </div>
              </div>
            </div>

            {/* Chat messages */}
            <div className="p-5 space-y-4 min-h-[280px]">
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Alice • 2m ago</div>
                  <div className="rounded-2xl rounded-tl-md bg-muted px-4 py-2.5 text-sm max-w-[85%]">
                    Hey! This conversation is protected with post-quantum encryption 🔐
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <div className="max-w-[85%]">
                  <div className="text-right text-xs text-muted-foreground mb-1">You • 1m ago</div>
                  <div className="rounded-2xl rounded-tr-md bg-primary text-primary-foreground px-4 py-2.5 text-sm">
                    That&apos;s amazing! Let&apos;s run a benchmark to see how fast it is 🚀
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Alice • now</div>
                  <div className="rounded-2xl rounded-tl-md bg-muted px-4 py-2.5 text-sm max-w-[85%]">
                    Sure! Mini-Kyber is actually faster than traditional ECDH by 1.2% ⚡
                  </div>
                </div>
              </div>
            </div>

            {/* Chat input */}
            <div className="p-4 border-t border-border bg-muted/30">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  disabled
                />
                <Button size="sm" className="h-8 px-4 bg-primary hover:bg-primary/90">
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mx-auto max-w-6xl px-6 py-8 border-t border-border">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>Built by Abdoulahi Diallo • 2025-26</div>
          <div className="flex items-center gap-1">
            <Shield className="h-4 w-4 text-primary" />
            Post-Quantum Cryptography
          </div>
        </div>
      </div>
    </main>
  );
}
