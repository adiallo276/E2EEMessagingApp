/**
 * Benchmarked E2EE functions
 * These wrap the original e2ee functions and capture timing metrics
 */

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
  saveSessionFromSharedSecret,
  loadAesKey,
  makeHello,
  makeKeyReply,
} from "@/lib/crypto/e2ee";

import type {
  MetricEntry,
  HandshakeMetrics,
  MessageMetrics,
} from "@/lib/benchmark-context";

// Callback types for reporting metrics
type MetricCallback = (entry: Omit<MetricEntry, "id" | "timestamp">) => void;
type HandshakeMetricCallback = (metrics: HandshakeMetrics) => void;
type MessageMetricCallback = (metrics: MessageMetrics) => void;

function b64(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function jsonToContent(obj: unknown): string {
  return JSON.stringify(obj);
}

function estimateJsonSize(obj: any): number {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

const KEYPAIR_PREFIX = "e2ee_kp_v1:";

function kpStorageKey(username: string, alg: KemAlg) {
  return `${KEYPAIR_PREFIX}${alg}:${username}`;
}

/**
 * Get or create keypair with benchmarking
 */
export async function getOrCreateKeyPairBenchmarked(
  username: string,
  alg: KemAlg,
  onMetric?: MetricCallback
): Promise<{ kp: any; keyGenTimeMs: number; publicKeySize: number }> {
  const storageKey = kpStorageKey(username, alg);
  const existing = localStorage.getItem(storageKey);
  
  if (existing) {
    const kp = JSON.parse(existing);
    const publicKeySize = estimateJsonSize(kp.pk);
    return { kp, keyGenTimeMs: 0, publicKeySize }; // Already existed, no keygen time
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

  const keyGenTimeMs = performance.now() - start;
  const publicKeySize = estimateJsonSize(kp.pk);

  localStorage.setItem(storageKey, JSON.stringify(kp));

  onMetric?.({
    operation: `Key Generation (${alg === "kyber" ? "Kyber" : "Frodo"})`,
    algorithm: alg,
    phase: "keygen",
    durationMs: keyGenTimeMs,
    outputSize: publicKeySize,
  });

  return { kp, keyGenTimeMs, publicKeySize };
}

/**
 * Handle E2EE_HELLO and create key reply with benchmarking (recipient side)
 */
export async function handleHelloAndCreateKeyReplyBenchmarked(
  conversationId: string,
  myUsername: string,
  hello: E2eeHello,
  onMetric?: MetricCallback,
  onHandshake?: HandshakeMetricCallback
): Promise<{ replyContent: string } | null> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const info = new TextEncoder().encode(`messaging-e2ee-v1:${hello.alg}:conv:${conversationId}`);

  const handshakeStart = performance.now();
  let encapsulateTimeMs = 0;
  let ciphertextSize = 0;
  let sharedSecretSize = 0;
  const publicKeySize = estimateJsonSize(hello.pk);

  if (hello.alg === "kyber") {
    const encStart = performance.now();
    const enc = await miniKyberEncapsulate(hello.pk as MiniKyberPublicKey);
    encapsulateTimeMs = performance.now() - encStart;
    
    ciphertextSize = estimateJsonSize(enc.ct);
    sharedSecretSize = enc.sharedSecret.length;

    await saveSessionFromSharedSecret(conversationId, "kyber", enc.sharedSecret, salt, info);

    onMetric?.({
      operation: "Encapsulation (Kyber)",
      algorithm: "kyber",
      phase: "encapsulate",
      durationMs: encapsulateTimeMs,
      inputSize: publicKeySize,
      outputSize: ciphertextSize,
      details: {
        sharedSecretSize,
      },
    });

    const totalTimeMs = performance.now() - handshakeStart;

    onHandshake?.({
      algorithm: "kyber",
      keyGenTimeMs: 0, // Recipient doesn't do keygen
      encapsulateTimeMs,
      decapsulateTimeMs: 0, // Recipient does encapsulation, not decapsulation
      totalTimeMs,
      publicKeySize,
      ciphertextSize,
      sharedSecretSize,
    });

    return { replyContent: makeKeyReply("kyber", enc.ct as MiniKyberCiphertext, salt, info) };
  }

  if (hello.alg === "frodo") {
    const encStart = performance.now();
    const enc = await miniFrodoEncapsulate(hello.pk as MiniFrodoPublicKey);
    encapsulateTimeMs = performance.now() - encStart;
    
    ciphertextSize = estimateJsonSize(enc.ct);
    sharedSecretSize = enc.sharedSecret.length;

    await saveSessionFromSharedSecret(conversationId, "frodo", enc.sharedSecret, salt, info);

    onMetric?.({
      operation: "Encapsulation (Frodo)",
      algorithm: "frodo",
      phase: "encapsulate",
      durationMs: encapsulateTimeMs,
      inputSize: publicKeySize,
      outputSize: ciphertextSize,
      details: {
        sharedSecretSize,
      },
    });

    const totalTimeMs = performance.now() - handshakeStart;

    onHandshake?.({
      algorithm: "frodo",
      keyGenTimeMs: 0,
      encapsulateTimeMs,
      decapsulateTimeMs: 0,
      totalTimeMs,
      publicKeySize,
      ciphertextSize,
      sharedSecretSize,
    });

    return { replyContent: makeKeyReply("frodo", enc.ct as MiniFrodoCiphertext, salt, info) };
  }

  return null;
}

/**
 * Handle E2EE_KEY and store session with benchmarking (initiator side)
 */
export async function handleKeyAndStoreSessionBenchmarked(
  conversationId: string,
  myUsername: string,
  keyMsg: E2eeKey,
  keyGenTimeMs: number, // Pass in the keygen time from earlier
  publicKeySize: number,
  onMetric?: MetricCallback,
  onHandshake?: HandshakeMetricCallback
): Promise<void> {
  const salt = unb64(keyMsg.saltB64);
  const info = unb64(keyMsg.infoB64);
  const ciphertextSize = estimateJsonSize(keyMsg.ct);

  const handshakeStart = performance.now();

  if (keyMsg.alg === "kyber") {
    const kp = JSON.parse(localStorage.getItem(kpStorageKey(myUsername, "kyber")) || "{}") as MiniKyberKeyPair;
    
    const decStart = performance.now();
    const ss = await miniKyberDecapsulate(kp.sk, keyMsg.ct as MiniKyberCiphertext);
    const decapsulateTimeMs = performance.now() - decStart;

    await saveSessionFromSharedSecret(conversationId, "kyber", ss, salt, info);

    onMetric?.({
      operation: "Decapsulation (Kyber)",
      algorithm: "kyber",
      phase: "decapsulate",
      durationMs: decapsulateTimeMs,
      inputSize: ciphertextSize,
      outputSize: ss.length,
    });

    const totalTimeMs = keyGenTimeMs + decapsulateTimeMs;

    onHandshake?.({
      algorithm: "kyber",
      keyGenTimeMs,
      encapsulateTimeMs: 0, // Initiator doesn't do encapsulation
      decapsulateTimeMs,
      totalTimeMs,
      publicKeySize,
      ciphertextSize,
      sharedSecretSize: ss.length,
    });

    return;
  }

  if (keyMsg.alg === "frodo") {
    const kp = JSON.parse(localStorage.getItem(kpStorageKey(myUsername, "frodo")) || "{}") as MiniFrodoKeyPair;
    
    const decStart = performance.now();
    const ss = await miniFrodoDecapsulate(kp.sk, keyMsg.ct as MiniFrodoCiphertext);
    const decapsulateTimeMs = performance.now() - decStart;

    await saveSessionFromSharedSecret(conversationId, "frodo", ss, salt, info);

    onMetric?.({
      operation: "Decapsulation (Frodo)",
      algorithm: "frodo",
      phase: "decapsulate",
      durationMs: decapsulateTimeMs,
      inputSize: ciphertextSize,
      outputSize: ss.length,
    });

    const totalTimeMs = keyGenTimeMs + decapsulateTimeMs;

    onHandshake?.({
      algorithm: "frodo",
      keyGenTimeMs,
      encapsulateTimeMs: 0,
      decapsulateTimeMs,
      totalTimeMs,
      publicKeySize,
      ciphertextSize,
      sharedSecretSize: ss.length,
    });

    return;
  }

  throw new Error("Unknown KEM alg");
}

/**
 * Encrypt chat message with benchmarking
 */
export async function encryptChatMessageBenchmarked(
  conversationId: string,
  plaintext: string,
  alg: KemAlg,
  onMetric?: MetricCallback,
  onMessage?: MessageMetricCallback
): Promise<string> {
  const key = await loadAesKey(conversationId);
  if (!key) throw new Error("E2EE not ready yet (no session key)");

  const plaintextSize = new TextEncoder().encode(plaintext).length;

  const start = performance.now();
  const { ivB64, ciphertextB64 } = await aesGcmEncrypt(plaintext, key);
  const aesTimeMs = performance.now() - start;

  const env: E2eeMsg = { type: "E2EE_MSG", v: 1, ivB64, ciphertextB64 };
  const output = jsonToContent(env);
  const ciphertextSize = new TextEncoder().encode(output).length;

  const overhead = ((ciphertextSize - plaintextSize) / plaintextSize) * 100;

  onMetric?.({
    operation: "AES-GCM Encrypt",
    algorithm: alg,
    phase: "aes-encrypt",
    durationMs: aesTimeMs,
    inputSize: plaintextSize,
    outputSize: ciphertextSize,
    details: {
      ciphertext: output,
    },
  });

  onMessage?.({
    algorithm: alg,
    direction: "encrypt",
    aesTimeMs,
    plaintextSize,
    ciphertextSize,
    overhead,
  });

  return output;
}

/**
 * Decrypt chat message with benchmarking
 */
export async function decryptChatMessageBenchmarked(
  conversationId: string,
  msg: E2eeMsg,
  alg: KemAlg,
  onMetric?: MetricCallback,
  onMessage?: MessageMetricCallback
): Promise<string> {
  const key = await loadAesKey(conversationId);
  if (!key) return "Encrypted message (no session key)";

  const ciphertextSize = new TextEncoder().encode(JSON.stringify(msg)).length;

  const start = performance.now();
  const plaintext = await aesGcmDecrypt(msg.ivB64, msg.ciphertextB64, key);
  const aesTimeMs = performance.now() - start;

  const plaintextSize = new TextEncoder().encode(plaintext).length;
  const overhead = ((ciphertextSize - plaintextSize) / plaintextSize) * 100;

  onMetric?.({
    operation: "AES-GCM Decrypt",
    algorithm: alg,
    phase: "aes-decrypt",
    durationMs: aesTimeMs,
    inputSize: ciphertextSize,
    outputSize: plaintextSize,
  });

  onMessage?.({
    algorithm: alg,
    direction: "decrypt",
    aesTimeMs,
    plaintextSize,
    ciphertextSize,
    overhead,
  });

  return plaintext;
}
