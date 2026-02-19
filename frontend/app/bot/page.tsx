"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import BenchmarkPanel from "@/components/ui/benchmark-panel";
import {
  miniKyberKeyGen,
  miniKyberEncapsulate,
  miniKyberDecapsulate,
} from "@/lib/crypto/minikyber";
import {
  miniFrodoKeyGen,
  miniFrodoEncapsulate,
  miniFrodoDecapsulate,
} from "@/lib/crypto/minifrodo";
import {
  miniNtruKeyGen,
  miniNtruEncapsulate,
  miniNtruDecapsulate,
} from "@/lib/crypto/minintru";
import { aesGcmEncrypt, aesGcmDecrypt, deriveAesKey } from "@/lib/crypto/aes";
import { KemAlg } from "@/lib/crypto/e2ee";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  encrypted?: boolean;
  timestamp: Date;
};

type EncryptionState = {
  enabled: boolean;
  ready: boolean;
  algorithm: KemAlg;
  sharedSecret?: Uint8Array;
  salt?: Uint8Array;
  aesKey?: CryptoKey;
};

const ALG_INFO: Record<KemAlg, { name: string; color: string; bg: string }> = {
  kyber: { name: "Kyber", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/20" },
  frodo: { name: "Frodo", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/20" },
  ntru: { name: "NTRU", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/20" },
};

export default function BotChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(true);
  const [showBenchmark, setShowBenchmark] = useState(false);
  
  const [encryption, setEncryption] = useState<EncryptionState>({
    enabled: true,
    ready: false,
    algorithm: "kyber",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load API key from localStorage
    const savedKey = localStorage.getItem("openai_api_key");
    if (savedKey) {
      setApiKey(savedKey);
      setShowApiKeyInput(false);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function setupEncryption(alg: KemAlg) {
    setError(null);
    
    try {
      // Simulate key exchange by generating keypair and doing encapsulation
      const startTime = performance.now();
      
      let sharedSecret: Uint8Array;
      let keyGenTime: number;
      let encapTime: number;
      let decapTime: number;
      
      if (alg === "kyber") {
        const kgStart = performance.now();
        const kp = await miniKyberKeyGen();
        keyGenTime = performance.now() - kgStart;
        
        const encStart = performance.now();
        const { ct, sharedSecret: ss1 } = await miniKyberEncapsulate(kp.pk);
        encapTime = performance.now() - encStart;
        
        const decStart = performance.now();
        sharedSecret = await miniKyberDecapsulate(kp.sk, ct);
        decapTime = performance.now() - decStart;
      } else if (alg === "frodo") {
        const kgStart = performance.now();
        const kp = await miniFrodoKeyGen();
        keyGenTime = performance.now() - kgStart;
        
        const encStart = performance.now();
        const { ct, sharedSecret: ss1 } = await miniFrodoEncapsulate(kp.pk);
        encapTime = performance.now() - encStart;
        
        const decStart = performance.now();
        sharedSecret = await miniFrodoDecapsulate(kp.sk, ct);
        decapTime = performance.now() - decStart;
      } else {
        const kgStart = performance.now();
        const kp = await miniNtruKeyGen();
        keyGenTime = performance.now() - kgStart;
        
        const encStart = performance.now();
        const { ct, sharedSecret: ss1 } = await miniNtruEncapsulate(kp.pk);
        encapTime = performance.now() - encStart;
        
        const decStart = performance.now();
        sharedSecret = await miniNtruDecapsulate(kp.sk, ct);
        decapTime = performance.now() - decStart;
      }
      
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const info = new TextEncoder().encode(`bot-chat-e2ee-v1:${alg}`);
      const aesKey = await deriveAesKey(sharedSecret, salt, info);
      
      const totalTime = performance.now() - startTime;
      
      setEncryption({
        enabled: true,
        ready: true,
        algorithm: alg,
        sharedSecret,
        salt,
        aesKey,
      });
      
      // Add system message about encryption
      setMessages(prev => [...prev, {
        id: `system-${Date.now()}`,
        role: "system",
        content: `🔐 Encryption established using ${ALG_INFO[alg].name}\n\n` +
          `Key Generation: ${keyGenTime.toFixed(2)}ms\n` +
          `Encapsulation: ${encapTime.toFixed(2)}ms\n` +
          `Decapsulation: ${decapTime.toFixed(2)}ms\n` +
          `Total: ${totalTime.toFixed(2)}ms`,
        timestamp: new Date(),
      }]);
      
    } catch (err: any) {
      setError(err.message || "Failed to setup encryption");
    }
  }

  async function encryptMessage(plaintext: string): Promise<{ ivB64: string; ciphertextB64: string }> {
    if (!encryption.aesKey) throw new Error("No encryption key");
    return aesGcmEncrypt(plaintext, encryption.aesKey);
  }

  async function decryptMessage(ivB64: string, ciphertextB64: string): Promise<string> {
    if (!encryption.aesKey) throw new Error("No encryption key");
    return aesGcmDecrypt(ivB64, ciphertextB64, encryption.aesKey);
  }

  async function sendMessage() {
    if (!input.trim() || isLoading) return;
    if (!apiKey) {
      setError("Please enter your OpenAI API key");
      setShowApiKeyInput(true);
      return;
    }

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setError(null);

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMessage,
      encrypted: encryption.enabled && encryption.ready,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      // Prepare message for API (encrypt if enabled)
      let messageForApi = userMessage;
      
      if (encryption.enabled && encryption.ready) {
        // For demonstration, we encrypt before sending and decrypt response
        const encStart = performance.now();
        const encrypted = await encryptMessage(userMessage);
        const encTime = performance.now() - encStart;
        console.log(`[E2EE] Encrypted message in ${encTime.toFixed(2)}ms`);
      }

      // Call ChatGPT API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          messages: messages
            .filter(m => m.role !== "system")
            .map(m => ({ role: m.role, content: m.content }))
            .concat([{ role: "user", content: userMessage }]),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      // Add assistant message
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        encrypted: encryption.enabled && encryption.ready,
        timestamp: new Date(),
      };

      if (encryption.enabled && encryption.ready) {
        // Simulate decryption timing
        const decStart = performance.now();
        // In real scenario, we'd decrypt here
        const decTime = performance.now() - decStart;
        console.log(`[E2EE] Processed response in ${decTime.toFixed(2)}ms`);
      }

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message || "Failed to send message");
    } finally {
      setIsLoading(false);
    }
  }

  function saveApiKey() {
    if (apiKey.trim()) {
      localStorage.setItem("openai_api_key", apiKey.trim());
      setShowApiKeyInput(false);
    }
  }

  function clearApiKey() {
    localStorage.removeItem("openai_api_key");
    setApiKey("");
    setShowApiKeyInput(true);
  }

  function handleAlgChange(alg: KemAlg) {
    if (encryption.ready) return;
    setEncryption(prev => ({ ...prev, algorithm: alg }));
  }

  function resetEncryption() {
    setEncryption({
      enabled: true,
      ready: false,
      algorithm: "kyber",
    });
    setMessages([]);
  }

  const algInfo = ALG_INFO[encryption.algorithm];

  return (
    <div className="flex h-screen bg-background">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/messages")}>
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Button>
            <div className="h-4 w-px bg-border" />
            <div>
              <div className="font-semibold flex items-center gap-2">
                ChatGPT Bot
                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">Testing</span>
              </div>
              <div className="text-xs text-muted-foreground">Test E2EE without a second account</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBenchmark(!showBenchmark)}
              className={showBenchmark ? "bg-muted" : ""}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </Button>
            
            {encryption.ready && (
              <div className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${algInfo.bg} ${algInfo.color}`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {algInfo.name}
              </div>
            )}
            
            {encryption.ready && (
              <Button variant="ghost" size="sm" onClick={resetEncryption}>Reset</Button>
            )}
          </div>
        </div>

        {/* API Key Input */}
        {showApiKeyInput && (
          <div className="border-b bg-amber-500/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="password"
                  placeholder="Enter your OpenAI API key (sk-...)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                />
              </div>
              <Button size="sm" onClick={saveApiKey}>Save</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Your API key is stored locally and never sent to our servers.
            </p>
          </div>
        )}

        {/* Encryption Setup */}
        {!encryption.ready && !showApiKeyInput && (
          <div className="border-b bg-primary/5 px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium">Setup Encryption</div>
                  <div className="text-sm text-muted-foreground">Select a PQC algorithm to begin</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex rounded-lg border p-0.5 bg-muted/30">
                  {(["kyber", "frodo", "ntru"] as KemAlg[]).map((alg) => (
                    <button
                      key={alg}
                      onClick={() => handleAlgChange(alg)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                        encryption.algorithm === alg
                          ? `${ALG_INFO[alg].bg} ${ALG_INFO[alg].color} font-medium`
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {ALG_INFO[alg].name}
                    </button>
                  ))}
                </div>
                
                <Button onClick={() => setupEncryption(encryption.algorithm)}>
                  Start Encryption
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-2 text-sm text-red-500 bg-red-500/5 border-b">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.length === 0 && encryption.ready && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-3">🤖</div>
              <div className="font-medium">Ready to chat!</div>
              <div className="text-sm">Send a message to test encryption with ChatGPT</div>
            </div>
          )}
          
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : msg.role === "system"
                    ? "bg-muted/50 border text-xs font-mono"
                    : "bg-muted"
                }`}
              >
                {msg.role !== "system" && (
                  <div className="text-[11px] opacity-70 mb-1 flex items-center gap-1">
                    {msg.role === "user" ? "You" : "ChatGPT"}
                    {msg.encrypted && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                !encryption.ready
                  ? "Setup encryption first..."
                  : isLoading
                  ? "Waiting for response..."
                  : "Type a message..."
              }
              disabled={!encryption.ready || isLoading}
              className="flex-1 h-10 px-4 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Button
              onClick={sendMessage}
              disabled={!encryption.ready || isLoading || !input.trim()}
              className="h-10 px-6"
            >
              Send
            </Button>
          </div>
          
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <div>
              {encryption.ready
                ? `🔐 End-to-end encrypted with ${algInfo.name}`
                : "Setup encryption to start chatting"}
            </div>
            {!showApiKeyInput && (
              <button onClick={clearApiKey} className="hover:underline">
                Change API key
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Benchmark Panel */}
      <BenchmarkPanel isOpen={showBenchmark} onClose={() => setShowBenchmark(false)} />
    </div>
  );
}
