
export type MiniFrodoPublicKey = {
  A: number[][];
  B: number[][];
};

export type MiniFrodoSecretKey = {
  S: number[][];
};

export type MiniFrodoKeyPair = {
  pk: MiniFrodoPublicKey;
  sk: MiniFrodoSecretKey;
};

export type MiniFrodoCiphertext = {
  U: number[][];
  V: number[][];
};

export type MiniFrodoEncapsulationResult = {
  ct: MiniFrodoCiphertext;
  sharedSecret: Uint8Array;
};

const Q = 257;
const N = 4;

function modQ(x: number): number {
  const r = x % Q;
  return r < 0 ? r + Q : r;
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

function b64(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function fromB64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(data));
  return new Uint8Array(digest);
}

function randomInt(maxExclusive: number): number {
  const u = crypto.getRandomValues(new Uint32Array(1))[0];
  return u % maxExclusive;
}

function randomBool(): boolean {
  return (crypto.getRandomValues(new Uint8Array(1))[0] & 1) === 1;
}

class MatrixTS {
  rows: number;
  cols: number;
  data: number[][];

  constructor(rows: number, cols: number, data?: number[][]) {
    this.rows = rows;
    this.cols = cols;
    if (data) {
      if (data.length !== rows) throw new Error("Bad matrix rows");
      if (data[0].length !== cols) throw new Error("Bad matrix cols");
      this.data = data.map((r) => r.map((v) => modQ(v)));
    } else {
      this.data = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
    }
  }

  get(r: number, c: number): number {
    return this.data[r][c];
  }

  set(r: number, c: number, v: number) {
    this.data[r][c] = modQ(v);
  }

  add(other: MatrixTS): MatrixTS {
    if (this.rows !== other.rows || this.cols !== other.cols) throw new Error("Dimension mismatch in add");
    const out = new MatrixTS(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        out.data[i][j] = modQ(this.data[i][j] + other.data[i][j]);
      }
    }
    return out;
  }

  sub(other: MatrixTS): MatrixTS {
    if (this.rows !== other.rows || this.cols !== other.cols) throw new Error("Dimension mismatch in sub");
    const out = new MatrixTS(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        out.data[i][j] = modQ(this.data[i][j] - other.data[i][j]);
      }
    }
    return out;
  }

  mul(other: MatrixTS): MatrixTS {
    if (this.cols !== other.rows) throw new Error("Dimension mismatch in mul");
    const out = new MatrixTS(this.rows, other.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < other.cols; j++) {
        let sum = 0;
        for (let k = 0; k < this.cols; k++) {
          sum += this.data[i][k] * other.data[k][j];
        }
        out.data[i][j] = modQ(sum);
      }
    }
    return out;
  }

  transpose(): MatrixTS {
    const out = new MatrixTS(this.cols, this.rows);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        out.data[j][i] = this.data[i][j];
      }
    }
    return out;
  }

  toBytes(): Uint8Array {
    const out = new Uint8Array(this.rows * this.cols * 2);
    let idx = 0;
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const v = modQ(this.data[i][j]);
        out[idx++] = v & 0xff;
        out[idx++] = (v >>> 8) & 0xff;
      }
    }
    return out;
  }

  static randomUniform(rows: number, cols: number): MatrixTS {
    const out = new MatrixTS(rows, cols);
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) out.data[i][j] = randomInt(Q);
    }
    return out;
  }

  static randomSmall(rows: number, cols: number): MatrixTS {
    const out = new MatrixTS(rows, cols);
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const r = randomInt(3) - 1; // -1,0,1
        out.data[i][j] = modQ(r);
      }
    }
    return out;
  }
}

function encodeMessageBit(m: number): MatrixTS {
  const M = new MatrixTS(1, 1);
  if (m === 1) M.set(0, 0, Math.floor(Q / 2));
  else M.set(0, 0, 0);
  return M;
}

function decodeMessageBit(W: MatrixTS): number {
  if (W.rows !== 1 || W.cols !== 1) throw new Error("W must be 1x1");
  let v = W.get(0, 0) % Q;
  if (v < 0) v += Q;
  // v in [Q/4, 3Q/4) → closer to Q/2 → message bit is 1
  return (v > Q / 4 && v < (3 * Q) / 4) ? 1 : 0;
}

async function deriveSharedSecret(m: number, U: MatrixTS, V: MatrixTS): Promise<Uint8Array> {
  const mByte = new Uint8Array([m & 0xff]);
  const data = concatBytes(mByte, U.toBytes(), V.toBytes());
  return sha256(data);
}

function pkFrom(A: MatrixTS, B: MatrixTS): MiniFrodoPublicKey {
  return { A: A.data.map((r) => [...r]), B: B.data.map((r) => [...r]) };
}

function skFrom(S: MatrixTS): MiniFrodoSecretKey {
  return { S: S.data.map((r) => [...r]) };
}

function ctFrom(U: MatrixTS, V: MatrixTS): MiniFrodoCiphertext {
  return { U: U.data.map((r) => [...r]), V: V.data.map((r) => [...r]) };
}

function matFrom(a: number[][]): MatrixTS {
  return new MatrixTS(a.length, a[0].length, a);
}

export async function miniFrodoKeyGen(): Promise<MiniFrodoKeyPair> {
  const A = MatrixTS.randomUniform(N, N);
  const S = MatrixTS.randomSmall(N, 1);
  const E = MatrixTS.randomSmall(N, 1);
  const B = A.mul(S).add(E);

  return {
    pk: pkFrom(A, B),
    sk: skFrom(S),
  };
}

export async function miniFrodoEncapsulate(pk: MiniFrodoPublicKey): Promise<MiniFrodoEncapsulationResult> {
  const A = matFrom(pk.A);
  const B = matFrom(pk.B);

  const r = MatrixTS.randomSmall(N, 1);
  const e1 = MatrixTS.randomSmall(N, 1);
  const e2 = MatrixTS.randomSmall(1, 1);

  const m = randomBool() ? 1 : 0;
  const mEnc = encodeMessageBit(m);

  const U = A.transpose().mul(r).add(e1);
  const V = B.transpose().mul(r).add(e2).add(mEnc);

  const sharedSecret = await deriveSharedSecret(m, U, V);

  return {
    ct: ctFrom(U, V),
    sharedSecret,
  };
}

export async function miniFrodoDecapsulate(sk: MiniFrodoSecretKey, ct: MiniFrodoCiphertext): Promise<Uint8Array> {
  const S = matFrom(sk.S);
  const U = matFrom(ct.U);
  const V = matFrom(ct.V);

  const W = V.sub(S.transpose().mul(U));
  const mRecovered = decodeMessageBit(W);

  return deriveSharedSecret(mRecovered, U, V);
}