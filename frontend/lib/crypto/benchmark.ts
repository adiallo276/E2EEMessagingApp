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
  miniNtruKeyGen,
  miniNtruEncapsulate,
  miniNtruDecapsulate,
  MiniNtruKeyPair,
  MiniNtruPublicKey,
  MiniNtruCiphertext,
} from "@/lib/crypto/minintru";

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
  } else if (alg === "ntru") {
    kp = await miniNtruKeyGen();
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
  } else if (hello.alg === "ntru") {
    const enc = await miniNtruEncapsulate(hello.pk as MiniNtruPublicKey);
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
  } else if (keyMsg.alg === "ntru") {
    const kp = (await benchmarkedGetOrCreateKeyPair(myUsername, "ntru")) as MiniNtruKeyPair;
    sharedSecret = await miniNtruDecapsulate(kp.sk, keyMsg.ct as MiniNtruCiphertext);
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

// ============ KEM Benchmark Runner ============

export type TimingStats = {
  avg: number;
  min: number;
  max: number;
  stdDev: number;
  samples: number[];
};

export type AlgorithmResults = {
  keyGen: TimingStats;
  encapsulate: TimingStats;
  decapsulate: TimingStats;
  sizes: {
    publicKey: number;
    secretKey: number;
    ciphertext: number;
    sharedSecret: number;
  };
};

export type BenchmarkResults = {
  iterations: number;
  timestamp: number;
  kyber: AlgorithmResults;
  frodo: AlgorithmResults;
};

function calculateStats(samples: number[]): TimingStats {
  const n = samples.length;
  if (n === 0) return { avg: 0, min: 0, max: 0, stdDev: 0, samples: [] };
  
  const avg = samples.reduce((a, b) => a + b, 0) / n;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const variance = samples.reduce((sum, x) => sum + Math.pow(x - avg, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  return { avg, min, max, stdDev, samples };
}

export type BenchmarkProgress = {
  phase: string;
  current: number;
  total: number;
};

// Batch size for timing - run multiple ops in one measurement for accuracy
const BATCH_SIZE = 10;

export async function runKemBenchmark(
  iterations: number = 10,
  onProgress?: (progress: BenchmarkProgress) => void
): Promise<BenchmarkResults> {
  const kyberKeyGenTimes: number[] = [];
  const kyberEncapTimes: number[] = [];
  const kyberDecapTimes: number[] = [];
  
  const frodoKeyGenTimes: number[] = [];
  const frodoEncapTimes: number[] = [];
  const frodoDecapTimes: number[] = [];
  
  let kyberSizes = { publicKey: 0, secretKey: 0, ciphertext: 0, sharedSecret: 0 };
  let frodoSizes = { publicKey: 0, secretKey: 0, ciphertext: 0, sharedSecret: 0 };
  
  const warmupIterations = Math.min(50, Math.floor(iterations / 5) || 10);
  
  // Warmup phase - let JIT compiler optimize
  onProgress?.({ phase: "Warming up JIT...", current: 0, total: warmupIterations });
  for (let i = 0; i < warmupIterations; i++) {
    const kp1 = await miniKyberKeyGen();
    const enc1 = await miniKyberEncapsulate(kp1.pk);
    await miniKyberDecapsulate(kp1.sk, enc1.ct);
    const kp2 = await miniFrodoKeyGen();
    const enc2 = await miniFrodoEncapsulate(kp2.pk);
    await miniFrodoDecapsulate(kp2.sk, enc2.ct);
    if (i % 10 === 0) {
      onProgress?.({ phase: "Warming up JIT...", current: i, total: warmupIterations });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  // Small delay to let GC run
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Calculate number of batches
  const numBatches = Math.ceil(iterations / BATCH_SIZE);
  
  // Run Kyber benchmarks with batching
  for (let batch = 0; batch < numBatches; batch++) {
    const batchIterations = Math.min(BATCH_SIZE, iterations - batch * BATCH_SIZE);
    onProgress?.({ phase: "Benchmarking Kyber", current: batch * BATCH_SIZE, total: iterations });
    
    // Batch KeyGen
    const kgStart = performance.now();
    const keyPairs: any[] = [];
    for (let i = 0; i < batchIterations; i++) {
      keyPairs.push(await miniKyberKeyGen());
    }
    const kgEnd = performance.now();
    const kgTimePerOp = (kgEnd - kgStart) / batchIterations;
    for (let i = 0; i < batchIterations; i++) {
      kyberKeyGenTimes.push(kgTimePerOp);
    }
    
    if (batch === 0) {
      kyberSizes.publicKey = JSON.stringify(keyPairs[0].pk).length;
      kyberSizes.secretKey = JSON.stringify(keyPairs[0].sk).length;
    }
    
    // Batch Encapsulate
    const encStart = performance.now();
    const encResults: any[] = [];
    for (let i = 0; i < batchIterations; i++) {
      encResults.push(await miniKyberEncapsulate(keyPairs[i].pk));
    }
    const encEnd = performance.now();
    const encTimePerOp = (encEnd - encStart) / batchIterations;
    for (let i = 0; i < batchIterations; i++) {
      kyberEncapTimes.push(encTimePerOp);
    }
    
    if (batch === 0) {
      kyberSizes.ciphertext = JSON.stringify(encResults[0].ct).length;
      kyberSizes.sharedSecret = encResults[0].sharedSecret.length;
    }
    
    // Batch Decapsulate
    const decStart = performance.now();
    for (let i = 0; i < batchIterations; i++) {
      await miniKyberDecapsulate(keyPairs[i].sk, encResults[i].ct);
    }
    const decEnd = performance.now();
    const decTimePerOp = (decEnd - decStart) / batchIterations;
    for (let i = 0; i < batchIterations; i++) {
      kyberDecapTimes.push(decTimePerOp);
    }
    
    // Yield to UI
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  // Small delay between algorithms
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Run Frodo benchmarks with batching
  for (let batch = 0; batch < numBatches; batch++) {
    const batchIterations = Math.min(BATCH_SIZE, iterations - batch * BATCH_SIZE);
    onProgress?.({ phase: "Benchmarking Frodo", current: batch * BATCH_SIZE, total: iterations });
    
    // Batch KeyGen
    const kgStart = performance.now();
    const keyPairs: any[] = [];
    for (let i = 0; i < batchIterations; i++) {
      keyPairs.push(await miniFrodoKeyGen());
    }
    const kgEnd = performance.now();
    const kgTimePerOp = (kgEnd - kgStart) / batchIterations;
    for (let i = 0; i < batchIterations; i++) {
      frodoKeyGenTimes.push(kgTimePerOp);
    }
    
    if (batch === 0) {
      frodoSizes.publicKey = JSON.stringify(keyPairs[0].pk).length;
      frodoSizes.secretKey = JSON.stringify(keyPairs[0].sk).length;
    }
    
    // Batch Encapsulate
    const encStart = performance.now();
    const encResults: any[] = [];
    for (let i = 0; i < batchIterations; i++) {
      encResults.push(await miniFrodoEncapsulate(keyPairs[i].pk));
    }
    const encEnd = performance.now();
    const encTimePerOp = (encEnd - encStart) / batchIterations;
    for (let i = 0; i < batchIterations; i++) {
      frodoEncapTimes.push(encTimePerOp);
    }
    
    if (batch === 0) {
      frodoSizes.ciphertext = JSON.stringify(encResults[0].ct).length;
      frodoSizes.sharedSecret = encResults[0].sharedSecret.length;
    }
    
    // Batch Decapsulate
    const decStart = performance.now();
    for (let i = 0; i < batchIterations; i++) {
      await miniFrodoDecapsulate(keyPairs[i].sk, encResults[i].ct);
    }
    const decEnd = performance.now();
    const decTimePerOp = (decEnd - decStart) / batchIterations;
    for (let i = 0; i < batchIterations; i++) {
      frodoDecapTimes.push(decTimePerOp);
    }
    
    // Yield to UI
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  onProgress?.({ phase: "Complete", current: iterations, total: iterations });
  
  return {
    iterations,
    timestamp: Date.now(),
    kyber: {
      keyGen: calculateStats(kyberKeyGenTimes),
      encapsulate: calculateStats(kyberEncapTimes),
      decapsulate: calculateStats(kyberDecapTimes),
      sizes: kyberSizes,
    },
    frodo: {
      keyGen: calculateStats(frodoKeyGenTimes),
      encapsulate: calculateStats(frodoEncapTimes),
      decapsulate: calculateStats(frodoDecapTimes),
      sizes: frodoSizes,
    },
  };
}

// ============ Throughput Comparison Benchmark ============

export type ThroughputResults = {
  iterations: number;
  messagesPerSession: number;
  messageSize: number; // bytes
  timestamp: number;
  kyber: {
    keyExchange: TimingStats;
    messageEncrypt: TimingStats;
    messageDecrypt: TimingStats;
    totalSession: TimingStats; // key exchange + all messages
  };
  frodo: {
    keyExchange: TimingStats;
    messageEncrypt: TimingStats;
    messageDecrypt: TimingStats;
    totalSession: TimingStats;
  };
  ecdh: {
    keyExchange: TimingStats;
    messageEncrypt: TimingStats;
    messageDecrypt: TimingStats;
    totalSession: TimingStats;
  };
  summary: {
    kyberVsEcdhPercent: number; // overhead vs ECDH
    frodoVsEcdhPercent: number;
    kyberVsFrodoPercent: number; // how much faster/slower is Kyber vs Frodo
  };
};

// ECDH Key Exchange using Web Crypto API
async function ecdhKeyExchange(): Promise<{ sharedSecret: Uint8Array; publicKey: ArrayBuffer; privateKey: CryptoKey }> {
  // Generate ECDH key pair (P-256 curve)
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  
  // Export public key for transmission
  const publicKey = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  
  // Simulate receiving the same public key (in real scenario, this would be from peer)
  // For benchmarking, we do a full key agreement with ourselves
  const importedPeerKey = await crypto.subtle.importKey(
    "raw",
    publicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  
  // Derive shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: importedPeerKey },
    keyPair.privateKey,
    256 // 32 bytes
  );
  
  return {
    sharedSecret: new Uint8Array(sharedBits),
    publicKey,
    privateKey: keyPair.privateKey,
  };
}

export async function runThroughputBenchmark(
  iterations: number = 50,
  messagesPerSession: number = 10,
  messageSizeKB: number = 1,
  onProgress?: (progress: BenchmarkProgress) => void
): Promise<ThroughputResults> {
  const messageSize = messageSizeKB * 1024;
  const testMessage = "A".repeat(messageSize); // Generate test message
  
  const kyberKeyExchangeTimes: number[] = [];
  const kyberEncryptTimes: number[] = [];
  const kyberDecryptTimes: number[] = [];
  const kyberTotalTimes: number[] = [];
  
  const frodoKeyExchangeTimes: number[] = [];
  const frodoEncryptTimes: number[] = [];
  const frodoDecryptTimes: number[] = [];
  const frodoTotalTimes: number[] = [];
  
  const ecdhKeyExchangeTimes: number[] = [];
  const ecdhEncryptTimes: number[] = [];
  const ecdhDecryptTimes: number[] = [];
  const ecdhTotalTimes: number[] = [];
  
  // Warmup
  onProgress?.({ phase: "Warming up...", current: 0, total: 10 });
  for (let i = 0; i < 10; i++) {
    const kp = await miniKyberKeyGen();
    const enc = await miniKyberEncapsulate(kp.pk);
    await miniKyberDecapsulate(kp.sk, enc.ct);
    
    // Derive a test key for AES warmup
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode("warmup");
    const aesKey = await deriveAesKey(enc.sharedSecret, salt, info);
    const encrypted = await aesGcmEncrypt(testMessage.slice(0, 100), aesKey);
    await aesGcmDecrypt(encrypted.ivB64, encrypted.ciphertextB64, aesKey);
  }
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const totalOps = iterations * 3; // Kyber, Frodo, AES-only
  let completedOps = 0;
  
  // Benchmark Kyber sessions
  for (let i = 0; i < iterations; i++) {
    onProgress?.({ phase: "Benchmarking Kyber sessions", current: completedOps, total: totalOps });
    
    const sessionStart = performance.now();
    
    // Key Exchange (KeyGen + Encapsulate + Decapsulate)
    const kexStart = performance.now();
    const kp = await miniKyberKeyGen();
    const { ct, sharedSecret: ss1 } = await miniKyberEncapsulate(kp.pk);
    const ss2 = await miniKyberDecapsulate(kp.sk, ct);
    const kexEnd = performance.now();
    kyberKeyExchangeTimes.push(kexEnd - kexStart);
    
    // Derive AES key from shared secret
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode("kyber-benchmark");
    const aesKey = await deriveAesKey(ss1, salt, info);
    
    // Send N messages (encrypt + decrypt each)
    let encryptTotal = 0;
    let decryptTotal = 0;
    for (let m = 0; m < messagesPerSession; m++) {
      const encStart = performance.now();
      const encrypted = await aesGcmEncrypt(testMessage, aesKey);
      encryptTotal += performance.now() - encStart;
      
      const decStart = performance.now();
      await aesGcmDecrypt(encrypted.ivB64, encrypted.ciphertextB64, aesKey);
      decryptTotal += performance.now() - decStart;
    }
    kyberEncryptTimes.push(encryptTotal / messagesPerSession);
    kyberDecryptTimes.push(decryptTotal / messagesPerSession);
    
    const sessionEnd = performance.now();
    kyberTotalTimes.push(sessionEnd - sessionStart);
    
    completedOps++;
    if (i % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Benchmark Frodo sessions
  for (let i = 0; i < iterations; i++) {
    onProgress?.({ phase: "Benchmarking Frodo sessions", current: completedOps, total: totalOps });
    
    const sessionStart = performance.now();
    
    // Key Exchange
    const kexStart = performance.now();
    const kp = await miniFrodoKeyGen();
    const { ct, sharedSecret: ss1 } = await miniFrodoEncapsulate(kp.pk);
    const ss2 = await miniFrodoDecapsulate(kp.sk, ct);
    const kexEnd = performance.now();
    frodoKeyExchangeTimes.push(kexEnd - kexStart);
    
    // Derive AES key
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode("frodo-benchmark");
    const aesKey = await deriveAesKey(ss1, salt, info);
    
    // Send N messages
    let encryptTotal = 0;
    let decryptTotal = 0;
    for (let m = 0; m < messagesPerSession; m++) {
      const encStart = performance.now();
      const encrypted = await aesGcmEncrypt(testMessage, aesKey);
      encryptTotal += performance.now() - encStart;
      
      const decStart = performance.now();
      await aesGcmDecrypt(encrypted.ivB64, encrypted.ciphertextB64, aesKey);
      decryptTotal += performance.now() - decStart;
    }
    frodoEncryptTimes.push(encryptTotal / messagesPerSession);
    frodoDecryptTimes.push(decryptTotal / messagesPerSession);
    
    const sessionEnd = performance.now();
    frodoTotalTimes.push(sessionEnd - sessionStart);
    
    completedOps++;
    if (i % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Benchmark ECDH sessions (traditional key exchange)
  for (let i = 0; i < iterations; i++) {
    onProgress?.({ phase: "Benchmarking ECDH sessions", current: completedOps, total: totalOps });
    
    const sessionStart = performance.now();
    
    // Key Exchange (ECDH)
    const kexStart = performance.now();
    const { sharedSecret } = await ecdhKeyExchange();
    const kexEnd = performance.now();
    ecdhKeyExchangeTimes.push(kexEnd - kexStart);
    
    // Derive AES key from shared secret (same as PQC methods)
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode("ecdh-benchmark");
    const aesKey = await deriveAesKey(sharedSecret, salt, info);
    
    // Send N messages (encrypt + decrypt each)
    let encryptTotal = 0;
    let decryptTotal = 0;
    for (let m = 0; m < messagesPerSession; m++) {
      const encStart = performance.now();
      const encrypted = await aesGcmEncrypt(testMessage, aesKey);
      encryptTotal += performance.now() - encStart;
      
      const decStart = performance.now();
      await aesGcmDecrypt(encrypted.ivB64, encrypted.ciphertextB64, aesKey);
      decryptTotal += performance.now() - decStart;
    }
    ecdhEncryptTimes.push(encryptTotal / messagesPerSession);
    ecdhDecryptTimes.push(decryptTotal / messagesPerSession);
    
    const sessionEnd = performance.now();
    ecdhTotalTimes.push(sessionEnd - sessionStart);
    
    completedOps++;
    if (i % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  onProgress?.({ phase: "Complete", current: totalOps, total: totalOps });
  
  // Calculate stats
  const kyberKeyExchange = calculateStats(kyberKeyExchangeTimes);
  const kyberEncrypt = calculateStats(kyberEncryptTimes);
  const kyberDecrypt = calculateStats(kyberDecryptTimes);
  const kyberTotal = calculateStats(kyberTotalTimes);
  
  const frodoKeyExchange = calculateStats(frodoKeyExchangeTimes);
  const frodoEncrypt = calculateStats(frodoEncryptTimes);
  const frodoDecrypt = calculateStats(frodoDecryptTimes);
  const frodoTotal = calculateStats(frodoTotalTimes);
  
  const ecdhKeyExchange = calculateStats(ecdhKeyExchangeTimes);
  const ecdhEncrypt = calculateStats(ecdhEncryptTimes);
  const ecdhDecrypt = calculateStats(ecdhDecryptTimes);
  const ecdhTotal = calculateStats(ecdhTotalTimes);
  
  return {
    iterations,
    messagesPerSession,
    messageSize,
    timestamp: Date.now(),
    kyber: {
      keyExchange: kyberKeyExchange,
      messageEncrypt: kyberEncrypt,
      messageDecrypt: kyberDecrypt,
      totalSession: kyberTotal,
    },
    frodo: {
      keyExchange: frodoKeyExchange,
      messageEncrypt: frodoEncrypt,
      messageDecrypt: frodoDecrypt,
      totalSession: frodoTotal,
    },
    ecdh: {
      keyExchange: ecdhKeyExchange,
      messageEncrypt: ecdhEncrypt,
      messageDecrypt: ecdhDecrypt,
      totalSession: ecdhTotal,
    },
    summary: {
      kyberVsEcdhPercent: ((kyberTotal.avg - ecdhTotal.avg) / ecdhTotal.avg) * 100,
      frodoVsEcdhPercent: ((frodoTotal.avg - ecdhTotal.avg) / ecdhTotal.avg) * 100,
      kyberVsFrodoPercent: ((frodoTotal.avg - kyberTotal.avg) / kyberTotal.avg) * 100,
    },
  };
}

// ============ CSV Export ============

export function exportBenchmarksToCSV(
  events: BenchmarkEvent[],
  benchmarkResults: BenchmarkResults | null,
  throughputResults: ThroughputResults | null = null
): string {
  const lines: string[] = [];
  
  // Header info
  lines.push("# PQC Benchmark Export");
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`);
  lines.push("");
  
  // KEM Comparison Results (if available)
  if (benchmarkResults) {
    lines.push("# ============ KEM COMPARISON BENCHMARK ============");
    lines.push(`# Iterations: ${benchmarkResults.iterations}`);
    lines.push("");
    
    lines.push("Algorithm,Operation,Average (ms),Std Dev (ms),Min (ms),Max (ms)");
    lines.push(`Kyber,KeyGen,${benchmarkResults.kyber.keyGen.avg.toFixed(4)},${benchmarkResults.kyber.keyGen.stdDev.toFixed(4)},${benchmarkResults.kyber.keyGen.min.toFixed(4)},${benchmarkResults.kyber.keyGen.max.toFixed(4)}`);
    lines.push(`Kyber,Encapsulate,${benchmarkResults.kyber.encapsulate.avg.toFixed(4)},${benchmarkResults.kyber.encapsulate.stdDev.toFixed(4)},${benchmarkResults.kyber.encapsulate.min.toFixed(4)},${benchmarkResults.kyber.encapsulate.max.toFixed(4)}`);
    lines.push(`Kyber,Decapsulate,${benchmarkResults.kyber.decapsulate.avg.toFixed(4)},${benchmarkResults.kyber.decapsulate.stdDev.toFixed(4)},${benchmarkResults.kyber.decapsulate.min.toFixed(4)},${benchmarkResults.kyber.decapsulate.max.toFixed(4)}`);
    lines.push(`Frodo,KeyGen,${benchmarkResults.frodo.keyGen.avg.toFixed(4)},${benchmarkResults.frodo.keyGen.stdDev.toFixed(4)},${benchmarkResults.frodo.keyGen.min.toFixed(4)},${benchmarkResults.frodo.keyGen.max.toFixed(4)}`);
    lines.push(`Frodo,Encapsulate,${benchmarkResults.frodo.encapsulate.avg.toFixed(4)},${benchmarkResults.frodo.encapsulate.stdDev.toFixed(4)},${benchmarkResults.frodo.encapsulate.min.toFixed(4)},${benchmarkResults.frodo.encapsulate.max.toFixed(4)}`);
    lines.push(`Frodo,Decapsulate,${benchmarkResults.frodo.decapsulate.avg.toFixed(4)},${benchmarkResults.frodo.decapsulate.stdDev.toFixed(4)},${benchmarkResults.frodo.decapsulate.min.toFixed(4)},${benchmarkResults.frodo.decapsulate.max.toFixed(4)}`);
    lines.push("");
    
    lines.push("Algorithm,Public Key (bytes),Secret Key (bytes),Ciphertext (bytes),Shared Secret (bytes)");
    lines.push(`Kyber,${benchmarkResults.kyber.sizes.publicKey},${benchmarkResults.kyber.sizes.secretKey},${benchmarkResults.kyber.sizes.ciphertext},${benchmarkResults.kyber.sizes.sharedSecret}`);
    lines.push(`Frodo,${benchmarkResults.frodo.sizes.publicKey},${benchmarkResults.frodo.sizes.secretKey},${benchmarkResults.frodo.sizes.ciphertext},${benchmarkResults.frodo.sizes.sharedSecret}`);
    lines.push("");
    
    // Raw samples for statistical analysis
    lines.push("# Raw timing samples (ms)");
    lines.push("Algorithm,Operation,Sample Index,Time (ms)");
    benchmarkResults.kyber.keyGen.samples.forEach((t, i) => lines.push(`Kyber,KeyGen,${i + 1},${t.toFixed(4)}`));
    benchmarkResults.kyber.encapsulate.samples.forEach((t, i) => lines.push(`Kyber,Encapsulate,${i + 1},${t.toFixed(4)}`));
    benchmarkResults.kyber.decapsulate.samples.forEach((t, i) => lines.push(`Kyber,Decapsulate,${i + 1},${t.toFixed(4)}`));
    benchmarkResults.frodo.keyGen.samples.forEach((t, i) => lines.push(`Frodo,KeyGen,${i + 1},${t.toFixed(4)}`));
    benchmarkResults.frodo.encapsulate.samples.forEach((t, i) => lines.push(`Frodo,Encapsulate,${i + 1},${t.toFixed(4)}`));
    benchmarkResults.frodo.decapsulate.samples.forEach((t, i) => lines.push(`Frodo,Decapsulate,${i + 1},${t.toFixed(4)}`));
    lines.push("");
  }
  
  // Throughput Results (if available)
  if (throughputResults) {
    lines.push("# ============ THROUGHPUT COMPARISON BENCHMARK ============");
    lines.push(`# Iterations: ${throughputResults.iterations}`);
    lines.push(`# Messages per session: ${throughputResults.messagesPerSession}`);
    lines.push(`# Message size: ${throughputResults.messageSize} bytes`);
    lines.push("");
    
    lines.push("Scenario,Metric,Average (ms),Std Dev (ms),Min (ms),Max (ms)");
    lines.push(`Kyber,Key Exchange,${throughputResults.kyber.keyExchange.avg.toFixed(4)},${throughputResults.kyber.keyExchange.stdDev.toFixed(4)},${throughputResults.kyber.keyExchange.min.toFixed(4)},${throughputResults.kyber.keyExchange.max.toFixed(4)}`);
    lines.push(`Kyber,Message Encrypt,${throughputResults.kyber.messageEncrypt.avg.toFixed(4)},${throughputResults.kyber.messageEncrypt.stdDev.toFixed(4)},${throughputResults.kyber.messageEncrypt.min.toFixed(4)},${throughputResults.kyber.messageEncrypt.max.toFixed(4)}`);
    lines.push(`Kyber,Message Decrypt,${throughputResults.kyber.messageDecrypt.avg.toFixed(4)},${throughputResults.kyber.messageDecrypt.stdDev.toFixed(4)},${throughputResults.kyber.messageDecrypt.min.toFixed(4)},${throughputResults.kyber.messageDecrypt.max.toFixed(4)}`);
    lines.push(`Kyber,Total Session,${throughputResults.kyber.totalSession.avg.toFixed(4)},${throughputResults.kyber.totalSession.stdDev.toFixed(4)},${throughputResults.kyber.totalSession.min.toFixed(4)},${throughputResults.kyber.totalSession.max.toFixed(4)}`);
    lines.push(`Frodo,Key Exchange,${throughputResults.frodo.keyExchange.avg.toFixed(4)},${throughputResults.frodo.keyExchange.stdDev.toFixed(4)},${throughputResults.frodo.keyExchange.min.toFixed(4)},${throughputResults.frodo.keyExchange.max.toFixed(4)}`);
    lines.push(`Frodo,Message Encrypt,${throughputResults.frodo.messageEncrypt.avg.toFixed(4)},${throughputResults.frodo.messageEncrypt.stdDev.toFixed(4)},${throughputResults.frodo.messageEncrypt.min.toFixed(4)},${throughputResults.frodo.messageEncrypt.max.toFixed(4)}`);
    lines.push(`Frodo,Message Decrypt,${throughputResults.frodo.messageDecrypt.avg.toFixed(4)},${throughputResults.frodo.messageDecrypt.stdDev.toFixed(4)},${throughputResults.frodo.messageDecrypt.min.toFixed(4)},${throughputResults.frodo.messageDecrypt.max.toFixed(4)}`);
    lines.push(`Frodo,Total Session,${throughputResults.frodo.totalSession.avg.toFixed(4)},${throughputResults.frodo.totalSession.stdDev.toFixed(4)},${throughputResults.frodo.totalSession.min.toFixed(4)},${throughputResults.frodo.totalSession.max.toFixed(4)}`);
    lines.push(`ECDH,Key Exchange,${throughputResults.ecdh.keyExchange.avg.toFixed(4)},${throughputResults.ecdh.keyExchange.stdDev.toFixed(4)},${throughputResults.ecdh.keyExchange.min.toFixed(4)},${throughputResults.ecdh.keyExchange.max.toFixed(4)}`);
    lines.push(`ECDH,Message Encrypt,${throughputResults.ecdh.messageEncrypt.avg.toFixed(4)},${throughputResults.ecdh.messageEncrypt.stdDev.toFixed(4)},${throughputResults.ecdh.messageEncrypt.min.toFixed(4)},${throughputResults.ecdh.messageEncrypt.max.toFixed(4)}`);
    lines.push(`ECDH,Message Decrypt,${throughputResults.ecdh.messageDecrypt.avg.toFixed(4)},${throughputResults.ecdh.messageDecrypt.stdDev.toFixed(4)},${throughputResults.ecdh.messageDecrypt.min.toFixed(4)},${throughputResults.ecdh.messageDecrypt.max.toFixed(4)}`);
    lines.push(`ECDH,Total Session,${throughputResults.ecdh.totalSession.avg.toFixed(4)},${throughputResults.ecdh.totalSession.stdDev.toFixed(4)},${throughputResults.ecdh.totalSession.min.toFixed(4)},${throughputResults.ecdh.totalSession.max.toFixed(4)}`);
    lines.push("");
    
    lines.push("# Overhead Summary (PQC vs Traditional ECDH)");
    lines.push("Metric,Value (%)");
    lines.push(`Kyber overhead vs ECDH,${throughputResults.summary.kyberVsEcdhPercent.toFixed(2)}`);
    lines.push(`Frodo overhead vs ECDH,${throughputResults.summary.frodoVsEcdhPercent.toFixed(2)}`);
    lines.push(`Frodo vs Kyber (positive = Frodo slower),${throughputResults.summary.kyberVsFrodoPercent.toFixed(2)}`);
    lines.push("");
  }
  
  // Real-time events
  if (events.length > 0) {
    lines.push("# ============ REAL-TIME EVENTS ============");
    lines.push("Timestamp,Type,Algorithm,Operation,Duration (ms),Input Size (bytes),Output Size (bytes)");
    
    events.forEach(event => {
      lines.push([
        new Date(event.timestamp).toISOString(),
        event.type,
        event.algorithm,
        `"${event.operation}"`,
        event.durationMs.toFixed(4),
        event.inputSize ?? "",
        event.outputSize ?? "",
      ].join(","));
    });
    lines.push("");
    
    // Summary statistics from events
    const summary = getBenchmarkSummary();
    lines.push("# ============ EVENT SUMMARY ============");
    lines.push("Metric,Value");
    lines.push(`Total Events,${events.length}`);
    lines.push(`Key Generations,${summary.keygenEvents.length}`);
    lines.push(`Encapsulations,${summary.encapsulateEvents.length}`);
    lines.push(`Decapsulations,${summary.decapsulateEvents.length}`);
    lines.push(`AES Encryptions,${summary.aesEncryptEvents.length}`);
    lines.push(`AES Decryptions,${summary.aesDecryptEvents.length}`);
    lines.push(`Handshakes,${summary.handshakeEvents.length}`);
    
    if (summary.averages.kyberKeygen) lines.push(`Kyber KeyGen Avg (ms),${summary.averages.kyberKeygen.toFixed(4)}`);
    if (summary.averages.kyberEncapsulate) lines.push(`Kyber Encap Avg (ms),${summary.averages.kyberEncapsulate.toFixed(4)}`);
    if (summary.averages.kyberDecapsulate) lines.push(`Kyber Decap Avg (ms),${summary.averages.kyberDecapsulate.toFixed(4)}`);
    if (summary.averages.frodoKeygen) lines.push(`Frodo KeyGen Avg (ms),${summary.averages.frodoKeygen.toFixed(4)}`);
    if (summary.averages.frodoEncapsulate) lines.push(`Frodo Encap Avg (ms),${summary.averages.frodoEncapsulate.toFixed(4)}`);
    if (summary.averages.frodoDecapsulate) lines.push(`Frodo Decap Avg (ms),${summary.averages.frodoDecapsulate.toFixed(4)}`);
    if (summary.averages.aesEncrypt) lines.push(`AES Encrypt Avg (ms),${summary.averages.aesEncrypt.toFixed(4)}`);
    if (summary.averages.aesDecrypt) lines.push(`AES Decrypt Avg (ms),${summary.averages.aesDecrypt.toFixed(4)}`);
  }
  
  return lines.join("\n");
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
    ntruKeygen?: number;
    kyberEncapsulate?: number;
    frodoEncapsulate?: number;
    ntruEncapsulate?: number;
    kyberDecapsulate?: number;
    frodoDecapsulate?: number;
    ntruDecapsulate?: number;
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
      ntruKeygen: avg(keygenEvents.filter(e => e.algorithm === "ntru").map(e => e.durationMs)),
      kyberEncapsulate: avg(encapsulateEvents.filter(e => e.algorithm === "kyber").map(e => e.durationMs)),
      frodoEncapsulate: avg(encapsulateEvents.filter(e => e.algorithm === "frodo").map(e => e.durationMs)),
      ntruEncapsulate: avg(encapsulateEvents.filter(e => e.algorithm === "ntru").map(e => e.durationMs)),
      kyberDecapsulate: avg(decapsulateEvents.filter(e => e.algorithm === "kyber").map(e => e.durationMs)),
      frodoDecapsulate: avg(decapsulateEvents.filter(e => e.algorithm === "frodo").map(e => e.durationMs)),
      ntruDecapsulate: avg(decapsulateEvents.filter(e => e.algorithm === "ntru").map(e => e.durationMs)),
      aesEncrypt: avg(aesEncryptEvents.map(e => e.durationMs)),
      aesDecrypt: avg(aesDecryptEvents.map(e => e.durationMs)),
    },
  };
}
