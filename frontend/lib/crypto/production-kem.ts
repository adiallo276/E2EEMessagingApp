/**
 * Production KEM — ML-KEM-768 (NIST FIPS 203)
 * =============================================
 * Wraps @noble/post-quantum's ML-KEM-768 implementation with the same
 * interface as the Mini KEM modules, enabling drop-in substitution in the
 * messaging application.
 *
 * WHY THIS MATTERS
 * ----------------
 * The Mini implementations (minikyber, minifrodo, minintru) use reduced
 * parameters for educational benchmarking. This module provides a
 * production-grade alternative for the Kyber/ML-KEM algorithm:
 *
 *   • Security level: Category 3 (≈ AES-192 / 184-bit classical, 128-bit quantum)
 *   • Parameters: n=256, k=3, q=3329 — the full CRYSTALS-Kyber specification
 *   • Key sizes: pk=1184 bytes, sk=2400 bytes, ct=1088 bytes
 *   • IND-CCA2 secure via Fujisaki-Okamoto transform (built into FIPS 203)
 *   • Constant-time: @noble/post-quantum is written to avoid timing branches
 *     in pure JavaScript (best-effort; true guarantees require native code)
 *   • Security audit: independently audited by cure53 (2024)
 *
 * This module is the "WebAssembly / production" comparison described in the
 * project report. It uses pure TypeScript/JavaScript rather than compiled WASM,
 * which is preferable in this context because:
 *   (a) Same JS engine → fair timing comparison with Mini implementations
 *   (b) No WASM instantiation overhead or CORS constraints
 *   (c) Smaller bundle size and simpler deployment
 *   (d) Security audit covers the full TypeScript source
 *
 * USAGE
 * -----
 * Install:  npm install @noble/post-quantum
 *
 * In the app, enable production mode by setting the algorithm to "mlkem768"
 * and using productionKemKeyGen / productionKemEncapsulate / productionKemDecapsulate
 * instead of the Mini equivalents.
 *
 * Reference: https://github.com/paulmillr/noble-post-quantum
 */

// ── Type aliases (same shape as Mini KEM types) ───────────────────────────────

export type ProductionKemPublicKey = {
  bytes: Uint8Array;
};

export type ProductionKemSecretKey = {
  bytes: Uint8Array;
};

export type ProductionKemKeyPair = {
  pk: ProductionKemPublicKey;
  sk: ProductionKemSecretKey;
};

export type ProductionKemCiphertext = {
  bytes: Uint8Array;
};

export type ProductionKemResult = {
  ct: ProductionKemCiphertext;
  sharedSecret: Uint8Array;
};

// ── Lazy-load @noble/post-quantum to avoid build errors if not installed ─────

let _mlKem768: any = null;
let _loadAttempted = false;

async function getMlKem768(): Promise<any> {
  if (_mlKem768) return _mlKem768;
  if (_loadAttempted) throw new Error("@noble/post-quantum is not available. Run: npm install @noble/post-quantum");

  _loadAttempted = true;
  try {
    // Dynamic import — works in Next.js and Node.js
    const mod = await import("@noble/post-quantum/ml-kem.js");
    _mlKem768 = mod.ml_kem768;
    return _mlKem768;
  } catch {
    throw new Error(
      "@noble/post-quantum not installed. Run: npm install @noble/post-quantum\n" +
      "This package provides NIST FIPS 203 ML-KEM-768 for production use."
    );
  }
}

// ── KEM operations ────────────────────────────────────────────────────────────

/**
 * ML-KEM-768 Key Generation (FIPS 203)
 * Produces a 1184-byte public key and 2400-byte secret key.
 */
export async function productionKemKeyGen(): Promise<ProductionKemKeyPair> {
  const kem = await getMlKem768();
  const { publicKey, secretKey } = kem.keygen();
  return {
    pk: { bytes: publicKey },
    sk: { bytes: secretKey },
  };
}

/**
 * ML-KEM-768 Encapsulation (FIPS 203)
 * Produces a 1088-byte ciphertext and 32-byte shared secret.
 */
export async function productionKemEncapsulate(
  pk: ProductionKemPublicKey
): Promise<ProductionKemResult> {
  const kem = await getMlKem768();
  const { cipherText, sharedSecret } = kem.encapsulate(pk.bytes);
  return {
    ct: { bytes: cipherText },
    sharedSecret,
  };
}

/**
 * ML-KEM-768 Decapsulation (FIPS 203)
 * Recovers the 32-byte shared secret from a ciphertext and secret key.
 */
export async function productionKemDecapsulate(
  sk: ProductionKemSecretKey,
  ct: ProductionKemCiphertext
): Promise<Uint8Array> {
  const kem = await getMlKem768();
  return kem.decapsulate(ct.bytes, sk.bytes);
}

// ── Key size constants (for report tables) ────────────────────────────────────

export const ML_KEM_768_SIZES = {
  publicKeyBytes: 1184,
  secretKeyBytes: 2400,
  ciphertextBytes: 1088,
  sharedSecretBytes: 32,
  securityLevel: "Category 3 (≈ AES-192)",
  standard: "NIST FIPS 203",
} as const;

// ── Availability check ────────────────────────────────────────────────────────

/**
 * Returns true if @noble/post-quantum is installed and ML-KEM-768 is available.
 * Use this to gate production-mode UI options.
 */
export async function isProductionKemAvailable(): Promise<boolean> {
  try {
    await getMlKem768();
    return true;
  } catch {
    return false;
  }
}
