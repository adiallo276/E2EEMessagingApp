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

export type KemAlg = "kyber" | "frodo";

export type E2eeHello = {
  type: "E2EE_HELLO";
  v: 1;
  alg: KemAlg;
  pk: any;
};

export type E2eeKey = {
  type: "E2EE_KEY";
  v: 1;
  alg: KemAlg;
  ct: any;
  saltB64: string;
  infoB64: string;
};

export type E2eeMsg = {
  type: "E2EE_MSG";
  v: 1;
  ivB64: string;
  ciphertextB64: string;
};

export type E2eeEnvelope = E2eeHello | E2eeKey | E2eeMsg;

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

export function tryParseEnvelope(content: string): E2eeEnvelope | null {
  if (!content || !content.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(content);
    if (!parsed?.type) return null;
    if (parsed.type === "E2EE_HELLO" || parsed.type === "E2EE_KEY" || parsed.type === "E2EE_MSG") {
      return parsed as E2eeEnvelope;
    }
    return null;
  } catch {
    return null;
  }
}

function kpStorageKey(username: string, alg: KemAlg) {
  return `${KEYPAIR_PREFIX}${alg}:${username}`;
}

function sessionStorageKey(conversationId: string) {
  return `${SESSION_PREFIX}${conversationId}`;
}

export function hasSession(conversationId: string): boolean {
  return !!localStorage.getItem(sessionStorageKey(conversationId));
}

export function clearSession(conversationId: string) {
  localStorage.removeItem(sessionStorageKey(conversationId));
}

export async function saveSessionFromSharedSecret(
  conversationId: string,
  alg: KemAlg,
  sharedSecret: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array
) {
  const keyMaterial = {
    alg,
    sharedSecretB64: b64(sharedSecret),
    saltB64: b64(salt),
    infoB64: b64(info),
  };
  localStorage.setItem(sessionStorageKey(conversationId), JSON.stringify(keyMaterial));
}

export async function loadAesKey(conversationId: string): Promise<CryptoKey | null> {
  const raw = localStorage.getItem(sessionStorageKey(conversationId));
  if (!raw) return null;
  const obj = JSON.parse(raw) as { sharedSecretB64: string; saltB64: string; infoB64: string };
  const shared = unb64(obj.sharedSecretB64);
  const salt = unb64(obj.saltB64);
  const info = unb64(obj.infoB64);
  return deriveAesKey(shared, salt, info);
}


export async function getOrCreateKeyPair(username: string, alg: KemAlg): Promise<any> {
  const storageKey = kpStorageKey(username, alg);
  const existing = localStorage.getItem(storageKey);
  if (existing) return JSON.parse(existing);

  if (alg === "kyber") {
    const kp = await miniKyberKeyGen();
    localStorage.setItem(storageKey, JSON.stringify(kp));
    return kp;
  }

  if (alg === "frodo") {
    const kp = await miniFrodoKeyGen();
    localStorage.setItem(storageKey, JSON.stringify(kp));
    return kp;
  }

  throw new Error("Unknown KEM alg");
}

export function makeHello(alg: KemAlg, pk: any): string {
  const env: E2eeHello = { type: "E2EE_HELLO", v: 1, alg, pk };
  return jsonToContent(env);
}

export function makeKeyReply(alg: KemAlg, ct: any, salt: Uint8Array, info: Uint8Array): string {
  const env: E2eeKey = { type: "E2EE_KEY", v: 1, alg, ct, saltB64: b64(salt), infoB64: b64(info) };
  return jsonToContent(env);
}

export async function handleHelloAndCreateKeyReply(
  conversationId: string,
  myUsername: string,
  hello: E2eeHello
): Promise<{ replyContent: string } | null> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const info = new TextEncoder().encode(`messaging-e2ee-v1:${hello.alg}:conv:${conversationId}`);

  if (hello.alg === "kyber") {
    const enc = await miniKyberEncapsulate(hello.pk as MiniKyberPublicKey);
    await saveSessionFromSharedSecret(conversationId, "kyber", enc.sharedSecret, salt, info);
    return { replyContent: makeKeyReply("kyber", enc.ct as MiniKyberCiphertext, salt, info) };
  }

  if (hello.alg === "frodo") {
    const enc = await miniFrodoEncapsulate(hello.pk as MiniFrodoPublicKey);
    await saveSessionFromSharedSecret(conversationId, "frodo", enc.sharedSecret, salt, info);
    return { replyContent: makeKeyReply("frodo", enc.ct as MiniFrodoCiphertext, salt, info) };
  }

  return null;
}

export async function handleKeyAndStoreSession(conversationId: string, myUsername: string, keyMsg: E2eeKey) {
  const salt = unb64(keyMsg.saltB64);
  const info = unb64(keyMsg.infoB64);

  if (keyMsg.alg === "kyber") {
    const kp = (await getOrCreateKeyPair(myUsername, "kyber")) as MiniKyberKeyPair;
    const ss = await miniKyberDecapsulate(kp.sk, keyMsg.ct as MiniKyberCiphertext);
    await saveSessionFromSharedSecret(conversationId, "kyber", ss, salt, info);
    return;
  }

  if (keyMsg.alg === "frodo") {
    const kp = (await getOrCreateKeyPair(myUsername, "frodo")) as MiniFrodoKeyPair;
    const ss = await miniFrodoDecapsulate(kp.sk, keyMsg.ct as MiniFrodoCiphertext);
    await saveSessionFromSharedSecret(conversationId, "frodo", ss, salt, info);
    return;
  }

  throw new Error("Unknown KEM alg");
}

// ---------- Encrypt / decrypt chat messages ----------

export async function encryptChatMessage(conversationId: string, plaintext: string): Promise<string> {
  const key = await loadAesKey(conversationId);
  if (!key) throw new Error("E2EE not ready yet (no session key)");

  const { ivB64, ciphertextB64 } = await aesGcmEncrypt(plaintext, key);
  const env: E2eeMsg = { type: "E2EE_MSG", v: 1, ivB64, ciphertextB64 };
  return jsonToContent(env);
}

export async function decryptChatMessage(conversationId: string, msg: E2eeMsg): Promise<string> {
  const key = await loadAesKey(conversationId);
  if (!key) return "🔒 Encrypted message (enable E2EE + complete handshake)";
  return aesGcmDecrypt(msg.ivB64, msg.ciphertextB64, key);
}