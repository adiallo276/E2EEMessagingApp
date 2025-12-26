import { Polynomial } from "./polynomial";

export type MiniKyberPublicKey = {
  a: number[];
  t: number[];
};

export type MiniKyberSecretKey = {
  s: number[];
};

export type MiniKyberKeyPair = {
  pk: MiniKyberPublicKey;
  sk: MiniKyberSecretKey;
};

export type MiniKyberCiphertext = {
  u: number[];
  v: number[];
};

export function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

export type MiniKyberEncapsulationResult = {
  ct: MiniKyberCiphertext;
  sharedSecret: Uint8Array;
};

function polyFrom(arr: number[]): Polynomial {
  return new Polynomial(arr);
}

function pkFromPolys(a: Polynomial, t: Polynomial): MiniKyberPublicKey {
  return { a: a.getCoeffs(), t: t.getCoeffs() };
}

function skFromPoly(s: Polynomial): MiniKyberSecretKey {
  return { s: s.getCoeffs() };
}

function ctFromPolys(u: Polynomial, v: Polynomial): MiniKyberCiphertext {
  return { u: u.getCoeffs(), v: v.getCoeffs() };
}

function encodeMessageBit(m: number): Polynomial {
  const N = Polynomial.N;
  const Q = Polynomial.Q;
  const c = new Array<number>(N);

  if (m === 1) {
    const halfQ = Math.floor(Q / 2);
    c.fill(halfQ);
  } else {
    c.fill(0);
  }

  return new Polynomial(c);
}

function decodeMessageBit(w: Polynomial): number {
  const Q = Polynomial.Q;
  const c = w.getCoeffs();
  let sum = 0;

  for (const x of c) {
    let v = x % Q;
    if (v < 0) v += Q;
    sum += v;
  }

  const avg = sum / c.length;
  const threshold = Q / 4.0;
  return avg > threshold ? 1 : 0;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(data));
  return new Uint8Array(digest);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((acc, p) => acc + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

async function deriveSharedSecret(m: number, ct: { u: Polynomial; v: Polynomial }): Promise<Uint8Array> {
  const mByte = new Uint8Array([m & 0xff]);
  const data = concatBytes(mByte, ct.u.toBytes(), ct.v.toBytes());
  return sha256(data);
}

export async function miniKyberKeyGen(): Promise<MiniKyberKeyPair> {
  const a = await Polynomial.randomUniform();
  const s = await Polynomial.randomSmall();
  const e = await Polynomial.randomSmall();

  const t = a.mul(s).add(e);

  return {
    pk: pkFromPolys(a, t),
    sk: skFromPoly(s),
  };
}

export async function miniKyberEncapsulate(pk: MiniKyberPublicKey): Promise<MiniKyberEncapsulationResult> {
  const a = polyFrom(pk.a);
  const t = polyFrom(pk.t);

  const r = await Polynomial.randomSmall();
  const e1 = await Polynomial.randomSmall();
  const e2 = await Polynomial.randomSmall();

  const m = (crypto.getRandomValues(new Uint8Array(1))[0] & 1) ? 1 : 0;
  const mPoly = encodeMessageBit(m);

  const u = a.mul(r).add(e1);
  const v = t.mul(r).add(e2).add(mPoly);

  const sharedSecret = await deriveSharedSecret(m, { u, v });

  return {
    ct: ctFromPolys(u, v),
    sharedSecret,
  };
}

export async function miniKyberDecapsulate(sk: MiniKyberSecretKey, ct: MiniKyberCiphertext): Promise<Uint8Array> {
  const s = polyFrom(sk.s);
  const u = polyFrom(ct.u);
  const v = polyFrom(ct.v);

  const w = v.sub(u.mul(s));
  const mRecovered = decodeMessageBit(w);

  return deriveSharedSecret(mRecovered, { u, v });
}