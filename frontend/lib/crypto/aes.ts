export function b64(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

export function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  // If the Uint8Array already has its own buffer with no offset and same length,
  // we can use it directly to avoid creating a copy
  if (u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength) {
    return u8.buffer;
  }
  // Otherwise create a copy
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

export function unb64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importHkdfKey(sharedSecret: Uint8Array) {
  return crypto.subtle.importKey("raw", toArrayBuffer(sharedSecret), "HKDF", false, ["deriveKey"]);
}

export async function deriveAesKey(sharedSecret: Uint8Array, salt: Uint8Array, info: Uint8Array) {
  const hkdfKey = await importHkdfKey(sharedSecret);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: toArrayBuffer(salt), info: toArrayBuffer(info) },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function aesGcmEncrypt(plaintext: string, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(plaintext);
  const ctBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, toArrayBuffer(pt));
  return { ivB64: b64(iv), ciphertextB64: b64(new Uint8Array(ctBuf)) };
}

export async function aesGcmDecrypt(ivB64: string, ciphertextB64: string, key: CryptoKey) {
  const iv = unb64(ivB64);
  const ct = unb64(ciphertextB64);
  const ptBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, toArrayBuffer(ct));
  return new TextDecoder().decode(ptBuf);
}