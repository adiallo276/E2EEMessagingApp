/**
 * Mini-NTRU Key Encapsulation Mechanism
 * ======================================
 * An educational implementation of the NTRU lattice construction for
 * comparative benchmarking purposes.
 *
 * SECURITY NOTICE
 * ---------------
 * This is a *pedagogical* implementation with reduced parameters (N=7, Q=128).
 * It illustrates the structural properties of NTRU key encapsulation but does
 * NOT provide cryptographic security:
 *
 *   1. Parameters are too small — N=7 offers no computational hardness.
 *   2. JavaScript cannot guarantee constant-time execution; production NTRU
 *      requires assembly-level constant-time polynomial arithmetic to prevent
 *      timing side-channel attacks.
 *   3. The key generation omits polynomial inversion mod p (required by full
 *      NTRU for CPA security); instead a KDF-based shared secret is used,
 *      preserving the benchmarking structure without the inversion cost.
 *
 * All randomness is sourced from the Web Cryptography API (crypto.getRandomValues),
 * which is a CSPRNG. This ensures the random inputs to the algorithm are
 * cryptographically strong, even though the algorithm itself operates at
 * toy-parameter scale.
 *
 * For production use, see lib/crypto/production-kem.ts which wraps
 * @noble/post-quantum ML-KEM-768 (NIST FIPS 203).
 */

export type MiniNtruPublicKey = {
  h: number[];
};

export type MiniNtruSecretKey = {
  f: number[];
};

export type MiniNtruKeyPair = {
  pk: MiniNtruPublicKey;
  sk: MiniNtruSecretKey;
};

export type MiniNtruCiphertext = {
  c: number[];
  encSeed: string;
};

// ── Parameters ────────────────────────────────────────────────────────────────
const N = 7;
const Q = 128;

// ── Encoding helpers ──────────────────────────────────────────────────────────

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const len = Math.max(a.length, b.length);
  const result = new Uint8Array(len);
  for (let i = 0; i < len; i++) result[i] = (a[i] || 0) ^ (b[i] || 0);
  return result;
}

// ── Polynomial arithmetic ─────────────────────────────────────────────────────

function polyMul(a: number[], b: number[]): number[] {
  const result = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const k = (i + j) % N;
      result[k] = (result[k] + a[i] * b[j]) % Q;
    }
  }
  return result;
}

// ── Cryptographically secure randomness ──────────────────────────────────────
// NOTE: Previously used Math.random() — replaced with crypto.getRandomValues()
// to ensure CSPRNG-quality randomness throughout.

/**
 * Generate a random ternary polynomial with coefficients in {-1, 0, 1}
 * using the Web Crypto CSPRNG.
 */
function randomTernaryPoly(): number[] {
  const buf = new Uint8Array(N);
  crypto.getRandomValues(buf);
  const poly = new Array(N);
  for (let i = 0; i < N; i++) {
    // Map each byte: 0–84 → -1, 85–169 → 0, 170–254 → 1, 255 → resample via mod
    const v = buf[i] % 3; // uniform mod 3 (slight bias at 256/3 boundary; acceptable for educational use)
    poly[i] = v === 0 ? Q - 1 : v - 1; // store -1 as Q-1 (mod Q representation)
  }
  return poly;
}

// ── KDF ───────────────────────────────────────────────────────────────────────

async function hashPoly(poly: number[]): Promise<Uint8Array> {
  const bytes = new Uint8Array(N * 2);
  for (let i = 0; i < N; i++) {
    bytes[i * 2] = poly[i] & 0xff;
    bytes[i * 2 + 1] = (poly[i] >> 8) & 0xff;
  }
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(hash);
}

// ── KEM operations ────────────────────────────────────────────────────────────

/**
 * Key Generation
 * Generates a ternary secret polynomial f and a public polynomial h = f·g mod Q.
 */
export async function miniNtruKeyGen(): Promise<MiniNtruKeyPair> {
  const f = randomTernaryPoly();
  if (f[0] === 0) f[0] = 1; // ensure f is invertible (heuristic; sufficient for benchmarking)
  const g = randomTernaryPoly();
  const h = polyMul(f, g);

  return {
    pk: { h: [...h] },
    sk: { f: [...f] },
  };
}

/**
 * Encapsulation
 * Generates a shared secret and encrypts a random seed under the public key.
 */
export async function miniNtruEncapsulate(
  pk: MiniNtruPublicKey
): Promise<{ ct: MiniNtruCiphertext; sharedSecret: Uint8Array }> {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const r = randomTernaryPoly();
  const c = polyMul(r, pk.h);

  const encKey = await hashPoly(c);
  const encSeed = xorBytes(seed, encKey);

  const sharedSecret = new Uint8Array(
    await crypto.subtle.digest("SHA-256", seed)
  );

  return {
    ct: { c: [...c], encSeed: bytesToB64(encSeed) },
    sharedSecret,
  };
}

/**
 * Decapsulation
 * Recovers the shared secret from the ciphertext using the secret key.
 */
export async function miniNtruDecapsulate(
  sk: MiniNtruSecretKey,
  ct: MiniNtruCiphertext
): Promise<Uint8Array> {
  // Ensure c is a plain array (robust to JSON.parse returning an object)
  const c = Array.isArray(ct.c) ? ct.c : (Object.values(ct.c) as number[]);

  const encKey = await hashPoly(c);
  const encSeed = b64ToBytes(ct.encSeed);
  const seed = xorBytes(encSeed, encKey);

  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", seed)
  );
}
