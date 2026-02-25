import { miniKyberKeyGen, miniKyberDecapsulate, miniKyberEncapsulate, MiniKyberKeyPair, MiniKyberPublicKey } from "@/lib/crypto/minikyber";
import { deriveAesKey, unb64, b64 } from "@/lib/crypto/aes";
import { api } from "@/lib/api";

const SK_KEY = "e2ee_mk_sk";
const PK_KEY = "e2ee_mk_pk";

export function loadKeyPair(): MiniKyberKeyPair | null {
  const pk = localStorage.getItem(PK_KEY);
  const sk = localStorage.getItem(SK_KEY);
  if (!pk || !sk) return null;
  return { pk: JSON.parse(pk), sk: JSON.parse(sk) };
}

export async function ensureKeyPair(): Promise<MiniKyberKeyPair> {
  const existing = loadKeyPair();
  if (existing) return existing;

  const kp = await miniKyberKeyGen();
  localStorage.setItem(PK_KEY, JSON.stringify(kp.pk));
  localStorage.setItem(SK_KEY, JSON.stringify(kp.sk));
  return kp;
}

export async function publishMyPublicKey() {
  const kp = await ensureKeyPair();
  await api(`/e2ee/public-key`, {
    method: "POST",
    body: JSON.stringify({ algorithm: "MINIKYBER", a: kp.pk.a, t: kp.pk.t }),
  });
}

export async function fetchUserPublicKey(username: string): Promise<MiniKyberPublicKey> {
  const res = await api(`/e2ee/public-key/${encodeURIComponent(username)}`);
  return { a: res.a, t: res.t };
}

export async function requestE2ee(conversationId: string, recipientUsername: string) {
  await publishMyPublicKey();
  const recipientPk = await fetchUserPublicKey(recipientUsername);

  const enc = await miniKyberEncapsulate(recipientPk);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = b64(salt);

  await api(`/conversations/${conversationId}/e2ee/request`, {
    method: "POST",
    body: JSON.stringify({
      algorithm: "MINIKYBER",
      ctU: enc.ct.u,
      ctV: enc.ct.v,
      saltB64,
    }),
  });

  const info = new TextEncoder().encode(`conv:${conversationId}`);
  const aesKey = await deriveAesKey(enc.sharedSecret, salt, info);
  return { aesKey };
}

export async function acceptE2ee(conversationId: string) {
  const kp = await ensureKeyPair();
  await publishMyPublicKey();

  const e2ee = await api(`/conversations/${conversationId}/e2ee`);
  const salt = unb64(e2ee.saltB64);

  const sharedSecret = await miniKyberDecapsulate(kp.sk, { u: e2ee.ctU, v: e2ee.ctV });

  const info = new TextEncoder().encode(`conv:${conversationId}`);
  const aesKey = await deriveAesKey(sharedSecret, salt, info);

  await api(`/conversations/${conversationId}/e2ee/accept`, { method: "POST" });

  return { aesKey };
}