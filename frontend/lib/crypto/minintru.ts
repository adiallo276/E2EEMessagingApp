/**
 * MiniNTRU - Educational NTRU-like KEM implementation
 * 
 * WARNING: This is a simplified educational implementation with reduced parameters.
 * NOT suitable for production use. Real NTRU uses much larger parameters.
 * 
 * NTRU is based on the hardness of finding short vectors in certain lattices.
 * Unlike Ring-LWE (Kyber), NTRU uses polynomial multiplication in a quotient ring.
 */

// Simplified parameters for educational purposes
// Real NTRU-HPS-2048-509 uses n=509, q=2048
const MINI_NTRU_N = 11;      // Polynomial degree (should be prime)
const MINI_NTRU_Q = 32;      // Large modulus
const MINI_NTRU_P = 3;       // Small modulus for message encoding

export type MiniNtruPublicKey = {
  h: number[];  // Public polynomial h = p * f_inv * g mod q
};

export type MiniNtruSecretKey = {
  f: number[];  // Secret polynomial f
  fp: number[]; // Inverse of f mod p
};

export type MiniNtruKeyPair = {
  pk: MiniNtruPublicKey;
  sk: MiniNtruSecretKey;
};

export type MiniNtruCiphertext = {
  c: number[];  // Ciphertext polynomial
};

// Reduce modulo q with centered representation
function modQ(x: number): number {
  const r = ((x % MINI_NTRU_Q) + MINI_NTRU_Q) % MINI_NTRU_Q;
  return r > MINI_NTRU_Q / 2 ? r - MINI_NTRU_Q : r;
}

// Reduce modulo p with centered representation
function modP(x: number): number {
  const r = ((x % MINI_NTRU_P) + MINI_NTRU_P) % MINI_NTRU_P;
  return r > MINI_NTRU_P / 2 ? r - MINI_NTRU_P : r;
}

// Polynomial multiplication in Z[x]/(x^n - 1) mod q
function polyMulModQ(a: number[], b: number[]): number[] {
  const result = new Array(MINI_NTRU_N).fill(0);
  for (let i = 0; i < MINI_NTRU_N; i++) {
    for (let j = 0; j < MINI_NTRU_N; j++) {
      const idx = (i + j) % MINI_NTRU_N;
      result[idx] = modQ(result[idx] + a[i] * b[j]);
    }
  }
  return result;
}

// Polynomial multiplication mod p
function polyMulModP(a: number[], b: number[]): number[] {
  const result = new Array(MINI_NTRU_N).fill(0);
  for (let i = 0; i < MINI_NTRU_N; i++) {
    for (let j = 0; j < MINI_NTRU_N; j++) {
      const idx = (i + j) % MINI_NTRU_N;
      result[idx] = modP(result[idx] + a[i] * b[j]);
    }
  }
  return result;
}

// Polynomial addition mod q
function polyAddModQ(a: number[], b: number[]): number[] {
  return a.map((v, i) => modQ(v + b[i]));
}

// Scalar multiplication mod q
function polyScalarMulModQ(a: number[], s: number): number[] {
  return a.map(v => modQ(v * s));
}

// Generate a random ternary polynomial with specified number of +1s and -1s
function randomTernary(numOnes: number, numNegOnes: number): number[] {
  const poly = new Array(MINI_NTRU_N).fill(0);
  const positions = Array.from({ length: MINI_NTRU_N }, (_, i) => i);
  
  // Shuffle positions
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  
  // Place +1s
  for (let i = 0; i < numOnes; i++) {
    poly[positions[i]] = 1;
  }
  
  // Place -1s
  for (let i = numOnes; i < numOnes + numNegOnes; i++) {
    poly[positions[i]] = -1;
  }
  
  return poly;
}

// Extended Euclidean algorithm for polynomials (simplified)
// Returns inverse of polynomial mod q if it exists, null otherwise
function tryPolyInverseModQ(a: number[]): number[] | null {
  // Simplified approach: try to find inverse iteratively
  // This is a basic implementation - real NTRU uses proper polynomial GCD
  
  let inverse = new Array(MINI_NTRU_N).fill(0);
  inverse[0] = 1;
  
  // Newton's method approximation (simplified)
  for (let iter = 0; iter < 10; iter++) {
    const product = polyMulModQ(a, inverse);
    const twoMinusProduct = new Array(MINI_NTRU_N).fill(0);
    twoMinusProduct[0] = 2;
    for (let i = 0; i < MINI_NTRU_N; i++) {
      twoMinusProduct[i] = modQ(twoMinusProduct[i] - product[i]);
    }
    inverse = polyMulModQ(inverse, twoMinusProduct);
  }
  
  // Verify
  const check = polyMulModQ(a, inverse);
  const isIdentity = check[0] === 1 && check.slice(1).every(v => v === 0);
  
  return isIdentity ? inverse : null;
}

// Try to find inverse mod p (simpler due to small modulus)
function tryPolyInverseModP(a: number[]): number[] | null {
  // For mod 3, we can use a simpler approach
  let inverse = new Array(MINI_NTRU_N).fill(0);
  inverse[0] = 1;
  
  for (let iter = 0; iter < 20; iter++) {
    const product = polyMulModP(a, inverse);
    const twoMinusProduct = new Array(MINI_NTRU_N).fill(0);
    twoMinusProduct[0] = 2;
    for (let i = 0; i < MINI_NTRU_N; i++) {
      twoMinusProduct[i] = modP(twoMinusProduct[i] - product[i]);
    }
    inverse = polyMulModP(inverse, twoMinusProduct);
  }
  
  // Verify
  const check = polyMulModP(a, inverse);
  const isIdentity = check[0] === 1 && check.slice(1).every(v => v === 0);
  
  return isIdentity ? inverse : null;
}

/**
 * NTRU Key Generation
 * 
 * 1. Generate random ternary polynomials f and g
 * 2. Compute f_inv = f^(-1) mod q
 * 3. Compute fp = f^(-1) mod p
 * 4. Compute h = p * f_inv * g mod q
 * 5. Public key: h, Secret key: (f, fp)
 */
export async function miniNtruKeyGen(): Promise<MiniNtruKeyPair> {
  let f: number[];
  let fInvQ: number[] | null = null;
  let fInvP: number[] | null = null;
  
  // Keep trying until we find an invertible f
  for (let attempt = 0; attempt < 100; attempt++) {
    // f should have form 1 + p*F where F is ternary
    // For simplicity, we use a ternary polynomial with specific structure
    f = randomTernary(3, 3);
    f[0] = modQ(f[0] + 1); // Ensure constant term helps invertibility
    
    fInvQ = tryPolyInverseModQ(f);
    fInvP = tryPolyInverseModP(f);
    
    if (fInvQ && fInvP) break;
  }
  
  if (!fInvQ || !fInvP) {
    throw new Error("Failed to generate invertible f");
  }
  
  // Generate g (ternary)
  const g = randomTernary(3, 3);
  
  // h = p * f_inv * g mod q
  const pFInv = polyScalarMulModQ(fInvQ, MINI_NTRU_P);
  const h = polyMulModQ(pFInv, g);
  
  return {
    pk: { h },
    sk: { f: f!, fp: fInvP },
  };
}

/**
 * NTRU Encapsulation
 * 
 * 1. Generate random ternary polynomial r (the "blinding" polynomial)
 * 2. Generate random message polynomial m with small coefficients
 * 3. Compute c = r * h + m mod q
 * 4. Derive shared secret from m
 */
export async function miniNtruEncapsulate(
  pk: MiniNtruPublicKey
): Promise<{ ct: MiniNtruCiphertext; sharedSecret: Uint8Array }> {
  // Random blinding polynomial
  const r = randomTernary(3, 3);
  
  // Random message (ternary)
  const m = randomTernary(2, 2);
  
  // c = r * h + m mod q
  const rh = polyMulModQ(r, pk.h);
  const c = polyAddModQ(rh, m);
  
  // Derive shared secret from m
  const mBytes = new Uint8Array(m.map(v => ((v % 256) + 256) % 256));
  const hash = await crypto.subtle.digest("SHA-256", mBytes);
  
  return {
    ct: { c },
    sharedSecret: new Uint8Array(hash),
  };
}

/**
 * NTRU Decapsulation
 * 
 * 1. Compute a = f * c mod q
 * 2. Lift a to centered representation
 * 3. Compute m = fp * a mod p
 * 4. Derive shared secret from m
 */
export async function miniNtruDecapsulate(
  sk: MiniNtruSecretKey,
  ct: MiniNtruCiphertext
): Promise<Uint8Array> {
  // a = f * c mod q
  const a = polyMulModQ(sk.f, ct.c);
  
  // m = fp * a mod p
  const aModP = a.map(v => modP(v));
  const m = polyMulModP(sk.fp, aModP);
  
  // Derive shared secret from m
  const mBytes = new Uint8Array(m.map(v => ((v % 256) + 256) % 256));
  const hash = await crypto.subtle.digest("SHA-256", mBytes);
  
  return new Uint8Array(hash);
}
