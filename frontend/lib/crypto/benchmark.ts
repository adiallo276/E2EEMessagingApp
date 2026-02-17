import { aesGcmEncrypt, aesGcmDecrypt, deriveAesKey, unb64 } from "@/lib/crypto/aes";
import {
  miniKyberKeyGen,
  miniKyberEncapsulate,
  miniKyberDecapsulate,
  MiniKyberKeyPair,
  MiniKyberPublicKey,
  MiniKyberCiphertext,
} from "@/lib/crypto/minikyber";

import {
  miniFrodoKeyGen,
  miniFrodoEncapsulate,
  miniFrodoDecapsulate,
  MiniFrodoKeyPair,
  MiniFrodoPublicKey,
  MiniFrodoCiphertext,
} from "@/lib/crypto/minifrodo";

import {
  KemAlg,
  E2eeHello,
  E2eeKey,
  E2eeMsg,
  hasSession,
} from "@/lib/crypto/e2ee";

// ============ Benchmark Types ============

export type BenchmarkEvent = {
  id: string;
  timestamp: number;
  type: "keygen" | "encapsulate" | "decapsulate" | "aes_encrypt" | "aes_decrypt" | "key_derive" | "handshake_complete";
  algorithm: KemAlg | "AES-GCM" | "HKDF";
  operation: string;
  durationMs: number;
  inputSize?: number;
  outputSize?: number;
  details?: Record<string, any>;
};

export type BenchmarkStats = {
  events: BenchmarkEvent[];
  totalHandshakeTimeMs?: number;
  lastMessageEncryptTimeMs?: number;
  lastMessageDecryptTimeMs?: number;
};

// Global benchmark state
let benchmarkEvents: BenchmarkEvent[] = [];
let benchmarkListeners: ((events: BenchmarkEvent[]) => void)[] = [];

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function addBenchmarkEvent(event: Omit<BenchmarkEvent, "id" | "timestamp">) {
  const fullEvent: BenchmarkEvent = {
    ...event,
    id: generateId(),
    timestamp: Date.now(),
  };
  benchmarkEvents.push(fullEvent);
  
  // Keep only last 100 events
  if (benchmarkEvents.length > 100) {
    benchmarkEvents = benchmarkEvents.slice(-100);
  }
  
  // Notify listeners
  benchmarkListeners.forEach(listener => listener([...benchmarkEvents]));
}

export function subscribeToBenchmarks(listener: (events: BenchmarkEvent[]) => void): () => void {
  benchmarkListeners.push(listener);
  // Send current events immediately
  listener([...benchmarkEvents]);
  
  // Return unsubscribe function
  return () => {
    benchmarkListeners = benchmarkListeners.filter(l => l !== listener);
  };
}

export function clearBenchmarks() {
  benchmarkEvents = [];
  benchmarkListeners.forEach(listener => listener([]));
}

export function getBenchmarkEvents(): BenchmarkEvent[] {
  return [...benchmarkEvents];
}

// ============ Benchmarked Crypto Functions ============

const KEYPAIR_PREFIX = "e2ee_kp_v1:";
const SESSION_PREFIX = "e2ee_session_v1:";

function b64(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function jsonToContent(obj: unknown): string {
  return JSON.stringify(obj);
}

function kpStorageKey(username: string, alg: KemAlg) {
  return `${KEYPAIR_PREFIX}${alg}:${username}`;
}

function sessionStorageKey(conversationId: string) {
  return `${SESSION_PREFIX}${conversationId}`;
}

// Benchmarked key generation
export async function benchmarkedGetOrCreateKeyPair(username: string, alg: KemAlg): Promise<any> {
  const storageKey = kpStorageKey(username, alg);
  const existing = localStorage.getItem(storageKey);
  
  if (existing) {
    return JSON.parse(existing);
  }

  const start = performance.now();
  let kp: any;

  if (alg === "kyber") {
    kp = await miniKyberKeyGen();
  } else if (alg === "frodo") {
    kp = await miniFrodoKeyGen();
  } else {
    throw new Error("Unknown KEM alg");
  }

  const duration = performance.now() - start;
  
  // Calculate key sizes
  const pkSize = JSON.stringify(kp.pk).length;
  const skSize = JSON.stringify(kp.sk).length;

  addBenchmarkEvent({
    type: "keygen",
    algorithm: alg,
    operation: `${alg.toUpperCase()} Key Generation`,
    durationMs: duration,
    outputSize: pkSize + skSize,
    details: {
      publicKeySize: pkSize,
      secretKeySize: skSize,
    },
  });

  localStorage.setItem(storageKey, JSON.stringify(kp));
  return kp;
}

// Benchmarked encapsulation (for responder)
export async function benchmarkedHandleHelloAndCreateKeyReply(
  conversationId: string,
  myUsername: string,
  hello: E2eeHello
): Promise<{ replyContent: string; benchmarks: { encapsulateMs: number; keyDeriveMs: number } } | null> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const info = new TextEncoder().encode(`messaging-e2ee-v1:${hello.alg}:conv:${conversationId}`);

  let encapsulateMs = 0;
  let keyDeriveMs = 0;
  let sharedSecret: Uint8Array;
  let ct: any;
  let ctSize = 0;

  // Encapsulation
  const encStart = performance.now();
  if (hello.alg === "kyber") {
    const enc = await miniKyberEncapsulate(hello.pk as MiniKyberPublicKey);
    sharedSecret = enc.sharedSecret;
    ct = enc.ct;
  } else if (hello.alg === "frodo") {
    const enc = await miniFrodoEncapsulate(hello.pk as MiniFrodoPublicKey);
    sharedSecret = enc.sharedSecret;
    ct = enc.ct;
  } else {
    return null;
  }
  encapsulateMs = performance.now() - encStart;
  ctSize = JSON.stringify(ct).length;

  addBenchmarkEvent({
    type: "encapsulate",
    algorithm: hello.alg,
    operation: `${hello.alg.toUpperCase()} Encapsulation`,
    durationMs: encapsulateMs,
    outputSize: ctSize,
    details: {
      ciphertextSize: ctSize,
      sharedSecretSize: sharedSecret.length,
    },
  });

  // Key derivation
  const deriveStart = performance.now();
  const keyMaterial = {
    alg: hello.alg,
    sharedSecretB64: b64(sharedSecret),
    saltB64: b64(salt),
    infoB64: b64(info),
  };
  localStorage.setItem(sessionStorageKey(conversationId), JSON.stringify(keyMaterial));
  keyDeriveMs = performance.now() - deriveStart;

  addBenchmarkEvent({
    type: "key_derive",
    algorithm: "HKDF",
    operation: "Session Key Derivation (HKDF)",
    durationMs: keyDeriveMs,
    details: {
      saltSize: salt.length,
      infoSize: info.length,
    },
  });

  const replyContent = makeKeyReply(hello.alg, ct, salt, info);

  addBenchmarkEvent({
    type: "handshake_complete",
    algorithm: hello.alg,
    operation: "Handshake Complete (Responder)",
    durationMs: encapsulateMs + keyDeriveMs,
    details: {
      role: "responder",
      totalEncapsulateMs: encapsulateMs,
      totalKeyDeriveMs: keyDeriveMs,
    },
  });

  return { 
    replyContent, 
    benchmarks: { encapsulateMs, keyDeriveMs } 
  };
}

function makeKeyReply(alg: KemAlg, ct: any, salt: Uint8Array, info: Uint8Array): string {
  const env: E2eeKey = { type: "E2EE_KEY", v: 1, alg, ct, saltB64: b64(salt), infoB64: b64(info) };
  return jsonToContent(env);
}

// Benchmarked decapsulation (for initiator)
export async function benchmarkedHandleKeyAndStoreSession(
  conversationId: string, 
  myUsername: string, 
  keyMsg: E2eeKey
): Promise<{ benchmarks: { decapsulateMs: number; keyDeriveMs: number } }> {
  const salt = unb64(keyMsg.saltB64);
  const info = unb64(keyMsg.infoB64);

  let decapsulateMs = 0;
  let keyDeriveMs = 0;
  let sharedSecret: Uint8Array;

  // Decapsulation
  const decapStart = performance.now();
  if (keyMsg.alg === "kyber") {
    const kp = (await benchmarkedGetOrCreateKeyPair(myUsername, "kyber")) as MiniKyberKeyPair;
    sharedSecret = await miniKyberDecapsulate(kp.sk, keyMsg.ct as MiniKyberCiphertext);
  } else if (keyMsg.alg === "frodo") {
    const kp = (await benchmarkedGetOrCreateKeyPair(myUsername, "frodo")) as MiniFrodoKeyPair;
    sharedSecret = await miniFrodoDecapsulate(kp.sk, keyMsg.ct as MiniFrodoCiphertext);
  } else {
    throw new Error("Unknown KEM alg");
  }
  decapsulateMs = performance.now() - decapStart;

  addBenchmarkEvent({
    type: "decapsulate",
    algorithm: keyMsg.alg,
    operation: `${keyMsg.alg.toUpperCase()} Decapsulation`,
    durationMs: decapsulateMs,
    details: {
      sharedSecretSize: sharedSecret.length,
    },
  });

  // Key derivation
  const deriveStart = performance.now();
  const keyMaterial = {
    alg: keyMsg.alg,
    sharedSecretB64: b64(sharedSecret),
    saltB64: b64(salt),
    infoB64: b64(info),
  };
  localStorage.setItem(sessionStorageKey(conversationId), JSON.stringify(keyMaterial));
  keyDeriveMs = performance.now() - deriveStart;

  addBenchmarkEvent({
    type: "key_derive",
    algorithm: "HKDF",
    operation: "Session Key Derivation (HKDF)",
    durationMs: keyDeriveMs,
    details: {
      saltSize: salt.length,
      infoSize: info.length,
    },
  });

  addBenchmarkEvent({
    type: "handshake_complete",
    algorithm: keyMsg.alg,
    operation: "Handshake Complete (Initiator)",
    durationMs: decapsulateMs + keyDeriveMs,
    details: {
      role: "initiator",
      totalDecapsulateMs: decapsulateMs,
      totalKeyDeriveMs: keyDeriveMs,
    },
  });

  return { benchmarks: { decapsulateMs, keyDeriveMs } };
}

// Benchmarked message encryption
export async function benchmarkedEncryptChatMessage(
  conversationId: string, 
  plaintext: string
): Promise<{ ciphertext: string; benchmarks: { aesEncryptMs: number; keyDeriveMs: number } }> {
  // Detect if this is an image message
  const isImage = plaintext.startsWith("IMG:");
  const inputBytes = new TextEncoder().encode(plaintext).length;
  
  // Load and derive AES key
  const keyDeriveStart = performance.now();
  const raw = localStorage.getItem(sessionStorageKey(conversationId));
  if (!raw) throw new Error("E2EE not ready yet (no session key)");
  
  const obj = JSON.parse(raw) as { alg: KemAlg; sharedSecretB64: string; saltB64: string; infoB64: string };
  const shared = unb64(obj.sharedSecretB64);
  const salt = unb64(obj.saltB64);
  const info = unb64(obj.infoB64);
  const key = await deriveAesKey(shared, salt, info);
  const keyDeriveMs = performance.now() - keyDeriveStart;

  // AES encryption
  const aesStart = performance.now();
  const { ivB64, ciphertextB64 } = await aesGcmEncrypt(plaintext, key);
  const aesEncryptMs = performance.now() - aesStart;

  const env: E2eeMsg = { type: "E2EE_MSG", v: 1, ivB64, ciphertextB64 };
  const ciphertext = jsonToContent(env);

  addBenchmarkEvent({
    type: "aes_encrypt",
    algorithm: "AES-GCM",
    operation: isImage ? "AES-GCM Image Encryption" : "AES-GCM Text Encryption",
    durationMs: aesEncryptMs,
    inputSize: inputBytes,
    outputSize: ciphertext.length,
    details: {
      contentType: isImage ? "image" : "text",
      plaintextBytes: inputBytes,
      ciphertextBytes: ciphertextB64.length,
      ivLength: ivB64.length,
      keyDeriveMs,
      kemAlgorithm: obj.alg,
      throughputKBps: inputBytes > 0 ? ((inputBytes / 1024) / (aesEncryptMs / 1000)).toFixed(2) : "0",
    },
  });

  return { 
    ciphertext, 
    benchmarks: { aesEncryptMs, keyDeriveMs } 
  };
}

// Benchmarked message decryption
export async function benchmarkedDecryptChatMessage(
  conversationId: string, 
  msg: E2eeMsg
): Promise<{ plaintext: string; benchmarks: { aesDecryptMs: number; keyDeriveMs: number } }> {
  // Load and derive AES key
  const keyDeriveStart = performance.now();
  const raw = localStorage.getItem(sessionStorageKey(conversationId));
  if (!raw) throw new Error("E2EE not ready yet (no session key)");
  
  const obj = JSON.parse(raw) as { alg: KemAlg; sharedSecretB64: string; saltB64: string; infoB64: string };
  const shared = unb64(obj.sharedSecretB64);
  const salt = unb64(obj.saltB64);
  const info = unb64(obj.infoB64);
  const key = await deriveAesKey(shared, salt, info);
  const keyDeriveMs = performance.now() - keyDeriveStart;

  // AES decryption
  const aesStart = performance.now();
  const plaintext = await aesGcmDecrypt(msg.ivB64, msg.ciphertextB64, key);
  const aesDecryptMs = performance.now() - aesStart;

  // Detect if this is an image message
  const isImage = plaintext.startsWith("IMG:");
  const outputBytes = new TextEncoder().encode(plaintext).length;

  addBenchmarkEvent({
    type: "aes_decrypt",
    algorithm: "AES-GCM",
    operation: isImage ? "AES-GCM Image Decryption" : "AES-GCM Text Decryption",
    durationMs: aesDecryptMs,
    inputSize: msg.ciphertextB64.length,
    outputSize: outputBytes,
    details: {
      contentType: isImage ? "image" : "text",
      ciphertextBytes: msg.ciphertextB64.length,
      plaintextBytes: outputBytes,
      keyDeriveMs,
      kemAlgorithm: obj.alg,
      throughputKBps: outputBytes > 0 ? ((outputBytes / 1024) / (aesDecryptMs / 1000)).toFixed(2) : "0",
    },
  });

  return { 
    plaintext, 
    benchmarks: { aesDecryptMs, keyDeriveMs } 
  };
}

// Get summary statistics
export function getBenchmarkSummary(): {
  keygenEvents: BenchmarkEvent[];
  encapsulateEvents: BenchmarkEvent[];
  decapsulateEvents: BenchmarkEvent[];
  aesEncryptEvents: BenchmarkEvent[];
  aesDecryptEvents: BenchmarkEvent[];
  handshakeEvents: BenchmarkEvent[];
  averages: {
    kyberKeygen?: number;
    frodoKeygen?: number;
    kyberEncapsulate?: number;
    frodoEncapsulate?: number;
    kyberDecapsulate?: number;
    frodoDecapsulate?: number;
    aesEncrypt?: number;
    aesDecrypt?: number;
  };
} {
  const events = getBenchmarkEvents();
  
  const keygenEvents = events.filter(e => e.type === "keygen");
  const encapsulateEvents = events.filter(e => e.type === "encapsulate");
  const decapsulateEvents = events.filter(e => e.type === "decapsulate");
  const aesEncryptEvents = events.filter(e => e.type === "aes_encrypt");
  const aesDecryptEvents = events.filter(e => e.type === "aes_decrypt");
  const handshakeEvents = events.filter(e => e.type === "handshake_complete");

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : undefined;

  return {
    keygenEvents,
    encapsulateEvents,
    decapsulateEvents,
    aesEncryptEvents,
    aesDecryptEvents,
    handshakeEvents,
    averages: {
      kyberKeygen: avg(keygenEvents.filter(e => e.algorithm === "kyber").map(e => e.durationMs)),
      frodoKeygen: avg(keygenEvents.filter(e => e.algorithm === "frodo").map(e => e.durationMs)),
      kyberEncapsulate: avg(encapsulateEvents.filter(e => e.algorithm === "kyber").map(e => e.durationMs)),
      frodoEncapsulate: avg(encapsulateEvents.filter(e => e.algorithm === "frodo").map(e => e.durationMs)),
      kyberDecapsulate: avg(decapsulateEvents.filter(e => e.algorithm === "kyber").map(e => e.durationMs)),
      frodoDecapsulate: avg(decapsulateEvents.filter(e => e.algorithm === "frodo").map(e => e.durationMs)),
      aesEncrypt: avg(aesEncryptEvents.map(e => e.durationMs)),
      aesDecrypt: avg(aesDecryptEvents.map(e => e.durationMs)),
    },
  };
}
