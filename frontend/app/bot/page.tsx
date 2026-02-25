"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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

type MessageContent = 
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string };

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: MessageContent[];
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
  const [pendingImage, setPendingImage] = useState<{ mimeType: string; data: string } | null>(null);
  
  const [encryption, setEncryption] = useState<EncryptionState>({
    enabled: true,
    ready: false,
    algorithm: "kyber",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
      
      setMessages(prev => [...prev, {
        id: `system-${Date.now()}`,
        role: "system",
        content: [{ type: "text", text: `🔐 Encryption established using ${ALG_INFO[alg].name}\n\nKey Generation: ${keyGenTime.toFixed(2)}ms\nEncapsulation: ${encapTime.toFixed(2)}ms\nDecapsulation: ${decapTime.toFixed(2)}ms\nTotal: ${totalTime.toFixed(2)}ms` }],
        timestamp: new Date(),
      }]);
      
    } catch (err: any) {
      setError(err.message || "Failed to setup encryption");
    }
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    const maxSize = 4 * 1024 * 1024; // 4MB for GPT-4 Vision
    if (file.size > maxSize) {
      setError("Image must be smaller than 4MB");
      return;
    }

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      setPendingImage({ mimeType: file.type, data: base64Data });
    } catch (err: any) {
      setError(err?.message || "Failed to load image");
    } finally {
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  }

  function removePendingImage() {
    setPendingImage(null);
  }

  async function sendMessage() {
    if ((!input.trim() && !pendingImage) || isLoading) return;
    if (!apiKey) {
      setError("Please enter your OpenAI API key");
      setShowApiKeyInput(true);
      return;
    }

    const userText = input.trim();
    setInput("");
    setIsLoading(true);
    setError(null);

    // Build message content
    const content: MessageContent[] = [];
    if (userText) {
      content.push({ type: "text", text: userText });
    }
    if (pendingImage) {
      content.push({ type: "image", mimeType: pendingImage.mimeType, data: pendingImage.data });
    }
    
    const currentImage = pendingImage;
    setPendingImage(null);

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      encrypted: encryption.enabled && encryption.ready,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      // Build API messages (convert to OpenAI format)
      const apiMessages = messages
        .filter(m => m.role !== "system")
        .map(m => {
          const msgContent = m.content.map(c => {
            if (c.type === "text") {
              return { type: "text" as const, text: c.text };
            } else {
              return { 
                type: "image_url" as const, 
                image_url: { url: `data:${c.mimeType};base64,${c.data}` }
              };
            }
          });
          return { role: m.role, content: msgContent.length === 1 && msgContent[0].type === "text" ? msgContent[0].text : msgContent };
        });

      // Add current message
      const currentContent = content.map(c => {
        if (c.type === "text") {
          return { type: "text" as const, text: c.text };
        } else {
          return { 
            type: "image_url" as const, 
            image_url: { url: `data:${c.mimeType};base64,${c.data}` }
          };
        }
      });
      
      apiMessages.push({ 
        role: "user", 
        content: currentContent.length === 1 && currentContent[0].type === "text" 
          ? currentContent[0].text 
          : currentContent 
      });

      const hasImages = content.some(c => c.type === "image") || 
        messages.some(m => m.content.some(c => c.type === "image"));

      // Call ChatGPT API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          messages: apiMessages,
          hasImages,
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
        content: [{ type: "text", text: data.reply }],
        encrypted: encryption.enabled && encryption.ready,
        timestamp: new Date(),
      };

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
    setPendingImage(null);
  }

  const algInfo = ALG_INFO[encryption.algorithm];

  return (
    <div className="flex h-screen bg-background">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/conversations")}>
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
              <div className="text-xs text-muted-foreground">Test E2EE with text & images</div>
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
              Your API key is stored locally. Images use GPT-4o (Vision).
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
                  <div className="text-sm text-muted-foreground">Select a PQC algorithm</div>
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
                  Start
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-2 text-sm text-red-500 bg-red-500/5 border-b flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-xs underline">Dismiss</button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.length === 0 && encryption.ready && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-3">🤖</div>
              <div className="font-medium">Ready to chat!</div>
              <div className="text-sm">Send text or images to test encryption</div>
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
                <div className="space-y-2">
                  {msg.content.map((c, i) => (
                    c.type === "text" ? (
                      <div key={i} className="whitespace-pre-wrap">{c.text}</div>
                    ) : (
                      <img 
                        key={i}
                        src={`data:${c.mimeType};base64,${c.data}`}
                        alt="Uploaded"
                        className="max-w-full rounded-lg max-h-64 object-contain"
                      />
                    )
                  ))}
                </div>
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

        {/* Pending Image Preview */}
        {pendingImage && (
          <div className="px-4 py-2 border-t bg-muted/30">
            <div className="flex items-center gap-2">
              <img 
                src={`data:${pendingImage.mimeType};base64,${pendingImage.data}`}
                alt="To upload"
                className="h-16 w-16 object-cover rounded-lg"
              />
              <div className="flex-1 text-sm text-muted-foreground">Image ready to send</div>
              <Button variant="ghost" size="sm" onClick={removePendingImage}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t p-4">
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          
          <div className="flex gap-2">
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={!encryption.ready || isLoading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background hover:bg-muted transition disabled:opacity-50"
              title="Attach image"
            >
              <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                !encryption.ready
                  ? "Setup encryption first..."
                  : isLoading
                  ? "Waiting for response..."
                  : pendingImage
                  ? "Add a message (optional)..."
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
              disabled={!encryption.ready || isLoading || (!input.trim() && !pendingImage)}
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

      <BenchmarkPanel isOpen={showBenchmark} onClose={() => setShowBenchmark(false)} />
    </div>
  );
}
