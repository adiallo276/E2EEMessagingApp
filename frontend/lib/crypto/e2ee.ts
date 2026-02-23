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

// Algorithm types: kyber, frodo, ntru are post-quantum, ecdh is classical
export type KemAlg = "kyber" | "frodo" | "ntru" | "ecdh";

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

// ============ ECDH Implementation ============

export type EcdhPublicKey = {
  raw: string; // Base64 encoded raw public key
};

export type EcdhSecretKey = {
  jwk: JsonWebKey; // JWK format for private key
};

export type EcdhKeyPair = {
  pk: EcdhPublicKey;
  sk: EcdhSecretKey;
};

export type EcdhCiphertext = {
  ephemeralPk: string; // Base64 encoded ephemeral public key
};

async function ecdhKeyGen(): Promise<EcdhKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  
  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  
  return {
    pk: { raw: b64(new Uint8Array(publicKeyRaw)) },
    sk: { jwk: privateKeyJwk },
  };
}

async function ecdhEncapsulate(pk: EcdhPublicKey): Promise<{ ct: EcdhCiphertext; sharedSecret: Uint8Array }> {
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  
  const ephemeralPkRaw = await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey);
  const recipientPkBytes = unb64(pk.raw);
  const recipientPk = await crypto.subtle.importKey(
    "raw",
    recipientPkBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: recipientPk },
    ephemeralKeyPair.privateKey,
    256
  );
  
  const sharedSecret = new Uint8Array(
    await crypto.subtle.digest("SHA-256", sharedBits)
  );
  
  return {
    ct: { ephemeralPk: b64(new Uint8Array(ephemeralPkRaw)) },
    sharedSecret,
  };
}

async function ecdhDecapsulate(sk: EcdhSecretKey, ct: EcdhCiphertext): Promise<Uint8Array> {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    sk.jwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"]
  );
  
  const ephemeralPkBytes = unb64(ct.ephemeralPk);
  const ephemeralPk = await crypto.subtle.importKey(
    "raw",
    ephemeralPkBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: ephemeralPk },
    privateKey,
    256
  );
  
  const sharedSecret = new Uint8Array(
    await crypto.subtle.digest("SHA-256", sharedBits)
  );
  
  return sharedSecret;
}

// ============ Key Management ============

export async function getOrCreateKeyPair(username: string, alg: KemAlg): Promise<any> {
  const storageKey = kpStorageKey(username, alg);
  const existing = localStorage.getItem(storageKey);
  if (existing) return JSON.parse(existing);

  let kp: any;
  
  if (alg === "kyber") {
    kp = await miniKyberKeyGen();
  } else if (alg === "frodo") {
    kp = await miniFrodoKeyGen();
  } else if (alg === "ntru") {
    kp = await miniNtruKeyGen();
  } else if (alg === "ecdh") {
    kp = await ecdhKeyGen();
  } else {
    throw new Error("Unknown KEM alg");
  }
  
  localStorage.setItem(storageKey, JSON.stringify(kp));
  return kp;
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

  let sharedSecret: Uint8Array;
  let ct: any;

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
  } else if (hello.alg === "ecdh") {
    const enc = await ecdhEncapsulate(hello.pk as EcdhPublicKey);
    sharedSecret = enc.sharedSecret;
    ct = enc.ct;
  } else {
    return null;
  }

  await saveSessionFromSharedSecret(conversationId, hello.alg, sharedSecret, salt, info);
  return { replyContent: makeKeyReply(hello.alg, ct, salt, info) };
}

export async function handleKeyAndStoreSession(conversationId: string, myUsername: string, keyMsg: E2eeKey) {
  const salt = unb64(keyMsg.saltB64);
  const info = unb64(keyMsg.infoB64);

  let sharedSecret: Uint8Array;

  if (keyMsg.alg === "kyber") {
    const kp = (await getOrCreateKeyPair(myUsername, "kyber")) as MiniKyberKeyPair;
    sharedSecret = await miniKyberDecapsulate(kp.sk, keyMsg.ct as MiniKyberCiphertext);
  } else if (keyMsg.alg === "frodo") {
    const kp = (await getOrCreateKeyPair(myUsername, "frodo")) as MiniFrodoKeyPair;
    sharedSecret = await miniFrodoDecapsulate(kp.sk, keyMsg.ct as MiniFrodoCiphertext);
  } else if (keyMsg.alg === "ntru") {
    const kp = (await getOrCreateKeyPair(myUsername, "ntru")) as MiniNtruKeyPair;
    sharedSecret = await miniNtruDecapsulate(kp.sk, keyMsg.ct as MiniNtruCiphertext);
  } else if (keyMsg.alg === "ecdh") {
    const kp = (await getOrCreateKeyPair(myUsername, "ecdh")) as EcdhKeyPair;
    sharedSecret = await ecdhDecapsulate(kp.sk, keyMsg.ct as EcdhCiphertext);
  } else {
    throw new Error("Unknown KEM alg");
  }

  await saveSessionFromSharedSecret(conversationId, keyMsg.alg, sharedSecret, salt, info);
}

// ============ Encrypt / decrypt chat messages ============

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
