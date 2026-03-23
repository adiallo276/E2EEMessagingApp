import { api } from "@/lib/api";
import { kvGet, kvSet } from "@/lib/storage/keys";

export type KyberPublicKey = { a: number[]; t: number[] };
export type KyberPrivateKey = { s: number[] };

export async function ensurePublishedKyberPublicKey() {
  const already = await kvGet<boolean>("kyber_pub_uploaded");
  if (already) return;

  const pub = await kvGet<KyberPublicKey>("kyber_public");
  if (!pub) throw new Error("No Kyber public key found locally");

  await api("/pqc/kyber/public-key", {
    method: "POST",
    body: JSON.stringify({
      aJson: JSON.stringify(pub.a),
      tJson: JSON.stringify(pub.t),
    }),
  });

  await kvSet("kyber_pub_uploaded", true);
}

export async function fetchKyberPublicKey(username: string): Promise<KyberPublicKey> {
  const res = await api(`/pqc/kyber/public-key/${encodeURIComponent(username)}`);
  const a = JSON.parse(res.aJson);
  const t = JSON.parse(res.tJson);
  return { a, t };
}