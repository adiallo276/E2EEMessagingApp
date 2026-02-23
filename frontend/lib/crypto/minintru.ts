/**
 * MiniNTRU - Educational NTRU-like KEM implementation
 * 
 * WARNING: This is a simplified educational implementation.
 * NOT suitable for production use.
 */

export type MiniNtruPublicKey = {
  h: number[];  // Public polynomial
};

export type MiniNtruSecretKey = {
  f: number[];  // Secret polynomial
};

export type MiniNtruKeyPair = {
  pk: MiniNtruPublicKey;
  sk: MiniNtruSecretKey;
};

export type MiniNtruCiphertext = {
  c: number[];        // Ciphertext polynomial c = r * h
  encSeed: string;    // Encrypted seed (base64)
};

// Parameters
const N = 7;    // Polynomial degree
const Q = 128;  // Modulus

// Convert bytes to base64
function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

// Convert base64 to bytes  
function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    bytes[i] = s.charCodeAt(i);
  }
  return bytes;
}

// XOR bytes
function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const len = Math.max(a.length, b.length);
  const result = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = (a[i] || 0) ^ (b[i] || 0);
  }
  return result;
}

// Polynomial multiplication mod (x^N - 1, Q)
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

// Generate small random polynomial
function randomPoly(): number[] {
  const poly = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    const r = Math.floor(Math.random() * 3) - 1;
    poly[i] = r < 0 ? Q + r : r;
  }
  return poly;
}

// Hash polynomial to 32-byte key - DETERMINISTIC
async function hashPoly(poly: number[]): Promise<Uint8Array> {
  const bytes = new Uint8Array(N * 2);
  for (let i = 0; i < N; i++) {
    bytes[i * 2] = poly[i] & 0xFF;
    bytes[i * 2 + 1] = (poly[i] >> 8) & 0xFF;
  }
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(hash);
}

/**
 * NTRU Key Generation
 */
export async function miniNtruKeyGen(): Promise<MiniNtruKeyPair> {
  const f = randomPoly();
  if (f[0] === 0) f[0] = 1;
  
  const g = randomPoly();
  const h = polyMul(f, g);
  
  console.log("[NTRU KeyGen] Generated new keypair");
  console.log("  h:", h);
  console.log("  f:", f);
  
  return {
    pk: { h: [...h] },
    sk: { f: [...f] },
  };
}

/**
 * NTRU Encapsulation
 */
export async function miniNtruEncapsulate(
  pk: MiniNtruPublicKey
): Promise<{ ct: MiniNtruCiphertext; sharedSecret: Uint8Array }> {
  console.log("[NTRU Encap] Starting with pk.h:", pk.h);
  
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const r = randomPoly();
  const c = polyMul(r, pk.h);
  
  console.log("[NTRU Encap] Computed c:", c);
  
  const encKey = await hashPoly(c);
  const encSeed = xorBytes(seed, encKey);
  
  const sharedSecret = new Uint8Array(
    await crypto.subtle.digest("SHA-256", seed)
  );
  
  console.log("[NTRU Encap] Shared secret:", bytesToB64(sharedSecret));
  
  return {
    ct: { 
      c: [...c],
      encSeed: bytesToB64(encSeed)
    },
    sharedSecret,
  };
}

/**
 * NTRU Decapsulation
 */
export async function miniNtruDecapsulate(
  sk: MiniNtruSecretKey,
  ct: MiniNtruCiphertext
): Promise<Uint8Array> {
  console.log("[NTRU Decap] Starting with sk.f:", sk.f);
  console.log("[NTRU Decap] ct.c:", ct.c);
  console.log("[NTRU Decap] ct.encSeed:", ct.encSeed);
  
  // Ensure c is an array (might be an object after JSON parse)
  const c = Array.isArray(ct.c) ? ct.c : Object.values(ct.c) as number[];
  
  const encKey = await hashPoly(c);
  const encSeed = b64ToBytes(ct.encSeed);
  const seed = xorBytes(encSeed, encKey);
  
  const sharedSecret = new Uint8Array(
    await crypto.subtle.digest("SHA-256", seed)
  );
  
  console.log("[NTRU Decap] Shared secret:", bytesToB64(sharedSecret));
  
  return sharedSecret;
}
