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

function encodeMessage(m: number): Polynomial {
  const N = Polynomial.N;
  const Q = Polynomial.Q;
  const halfQ = Math.floor(Q / 2);
  const c = new Array<number>(N);

  for (let i = 0; i < N; i++) {
    c[i] = ((m >> i) & 1) === 1 ? halfQ : 0;
  }

  return new Polynomial(c);
}

function decodeMessage(w: Polynomial): number {
  const Q = Polynomial.Q;
  const c = w.getCoeffs();
  let m = 0;

  for (let i = 0; i < c.length; i++) {
    let v = c[i] % Q;
    if (v < 0) v += Q;
    // coefficient in [Q/4, 3Q/4) → bit is 1
    if (v > Q / 4 && v < (3 * Q) / 4) {
      m |= (1 << i);
    }
  }

  return m;
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

  const m = crypto.getRandomValues(new Uint8Array(1))[0];
  const mPoly = encodeMessage(m);

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
  const mRecovered = decodeMessage(w);

  return deriveSharedSecret(mRecovered, { u, v });
}