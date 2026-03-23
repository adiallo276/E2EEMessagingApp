/**
 * PQC Correctness Test Suite
 * ============================================================
 * Validates the functional correctness of all three Mini KEM
 * implementations (Kyber, Frodo, NTRU) used in the FYP secure
 * messaging application.
 *
 * Tests confirm:
 *  1. Key generation produces structurally valid keypairs.
 *  2. Encapsulation + decapsulation yields matching shared secrets
 *     (the core KEM correctness property).
 *  3. Correctness holds across 100 independent key-exchange cycles.
 *  4. Shared secrets are non-trivial (not all-zero bytes).
 *  5. Different keypairs produce independent shared secrets.
 *
 * Run with:  npm test
 * Coverage:  npm run test:coverage
 */

import {
  miniKyberKeyGen,
  miniKyberEncapsulate,
  miniKyberDecapsulate,
  MiniKyberKeyPair,
} from "../lib/crypto/minikyber";

import {
  miniFrodoKeyGen,
  miniFrodoEncapsulate,
  miniFrodoDecapsulate,
  MiniFrodoKeyPair,
} from "../lib/crypto/minifrodo";

import {
  miniNtruKeyGen,
  miniNtruEncapsulate,
  miniNtruDecapsulate,
  MiniNtruKeyPair,
} from "../lib/crypto/minintru";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toHex(u8: Uint8Array): string {
  return Buffer.from(u8).toString("hex");
}

function isAllZero(u8: Uint8Array): boolean {
  return u8.every((b) => b === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mini-Kyber Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mini-Kyber KEM", () => {
  let kp: MiniKyberKeyPair;

  beforeAll(async () => {
    kp = await miniKyberKeyGen();
  });

  // ── 1. Key generation structure ──────────────────────────────────────────────
  test("key generation produces a valid public key (a, t arrays)", () => {
    expect(Array.isArray(kp.pk.a)).toBe(true);
    expect(Array.isArray(kp.pk.t)).toBe(true);
    expect(kp.pk.a.length).toBeGreaterThan(0);
    expect(kp.pk.t.length).toBeGreaterThan(0);
    expect(kp.pk.a.length).toBe(kp.pk.t.length);
  });

  test("key generation produces a valid secret key (s array)", () => {
    expect(Array.isArray(kp.sk.s)).toBe(true);
    expect(kp.sk.s.length).toBeGreaterThan(0);
  });

  test("public key coefficients are integers in valid range [0, Q)", () => {
    const Q = 3329; // Mini-Kyber modulus
    kp.pk.a.forEach((c) => {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(Q);
    });
  });

  // ── 2. Single encapsulation / decapsulation ──────────────────────────────────
  test("encapsulate returns a ciphertext and a 32-byte shared secret", async () => {
    const { ct, sharedSecret } = await miniKyberEncapsulate(kp.pk);
    expect(Array.isArray(ct.u)).toBe(true);
    expect(Array.isArray(ct.v)).toBe(true);
    expect(sharedSecret).toBeInstanceOf(Uint8Array);
    expect(sharedSecret.length).toBe(32);
  });

  test("decapsulate recovers the same shared secret (KEM correctness)", async () => {
    const { ct, sharedSecret: ss1 } = await miniKyberEncapsulate(kp.pk);
    const ss2 = await miniKyberDecapsulate(kp.sk, ct);
    expect(toHex(ss1)).toBe(toHex(ss2));
  });

  test("shared secret is non-trivial (not all-zero)", async () => {
    const { ct, sharedSecret: ss1 } = await miniKyberEncapsulate(kp.pk);
    expect(isAllZero(ss1)).toBe(false);
    const ss2 = await miniKyberDecapsulate(kp.sk, ct);
    expect(isAllZero(ss2)).toBe(false);
  });

  // ── 3. 100-iteration correctness sweep ───────────────────────────────────────
  test("correctness holds across 100 independent key-exchange cycles", async () => {
    let failures = 0;
    for (let i = 0; i < 100; i++) {
      const localKp = await miniKyberKeyGen();
      const { ct, sharedSecret: ss1 } = await miniKyberEncapsulate(localKp.pk);
      const ss2 = await miniKyberDecapsulate(localKp.sk, ct);
      if (toHex(ss1) !== toHex(ss2)) failures++;
    }
    expect(failures).toBe(0);
  }, 60000);

  // ── 4. Independence ───────────────────────────────────────────────────────────
  test("two independent key exchanges produce independent shared secrets", async () => {
    const { sharedSecret: ss1 } = await miniKyberEncapsulate(kp.pk);
    const { sharedSecret: ss2 } = await miniKyberEncapsulate(kp.pk);
    // With overwhelming probability these will differ; deterministic collision = bug
    expect(toHex(ss1)).not.toBe(toHex(ss2));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Mini-Frodo Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mini-Frodo KEM", () => {
  let kp: MiniFrodoKeyPair;

  beforeAll(async () => {
    kp = await miniFrodoKeyGen();
  });

  // ── 1. Key generation structure ──────────────────────────────────────────────
  test("key generation produces valid public key (A, B matrices)", () => {
    expect(Array.isArray(kp.pk.A)).toBe(true);
    expect(Array.isArray(kp.pk.B)).toBe(true);
    expect(kp.pk.A.length).toBeGreaterThan(0);
    expect(kp.pk.B.length).toBeGreaterThan(0);
  });

  test("key generation produces valid secret key (S matrix)", () => {
    expect(Array.isArray(kp.sk.S)).toBe(true);
    expect(kp.sk.S.length).toBeGreaterThan(0);
  });

  test("public matrix A is square (N×N)", () => {
    const N = kp.pk.A.length;
    kp.pk.A.forEach((row) => expect(row.length).toBe(N));
  });

  test("public matrix coefficients are integers in valid range [0, Q)", () => {
    const Q = 257; // Mini-Frodo modulus
    kp.pk.A.forEach((row) =>
      row.forEach((c) => {
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(Q);
      })
    );
  });

  // ── 2. Single encapsulation / decapsulation ──────────────────────────────────
  test("encapsulate returns a ciphertext and a 32-byte shared secret", async () => {
    const { ct, sharedSecret } = await miniFrodoEncapsulate(kp.pk);
    expect(Array.isArray(ct.U)).toBe(true);
    expect(Array.isArray(ct.V)).toBe(true);
    expect(sharedSecret).toBeInstanceOf(Uint8Array);
    expect(sharedSecret.length).toBe(32);
  });

  test("decapsulate recovers the same shared secret (KEM correctness)", async () => {
    const { ct, sharedSecret: ss1 } = await miniFrodoEncapsulate(kp.pk);
    const ss2 = await miniFrodoDecapsulate(kp.sk, ct);
    expect(toHex(ss1)).toBe(toHex(ss2));
  });

  test("shared secret is non-trivial (not all-zero)", async () => {
    const { ct, sharedSecret: ss1 } = await miniFrodoEncapsulate(kp.pk);
    expect(isAllZero(ss1)).toBe(false);
    const ss2 = await miniFrodoDecapsulate(kp.sk, ct);
    expect(isAllZero(ss2)).toBe(false);
  });

  // ── 3. 100-iteration correctness sweep ───────────────────────────────────────
  test("correctness holds across 100 independent key-exchange cycles", async () => {
    let failures = 0;
    for (let i = 0; i < 100; i++) {
      const localKp = await miniFrodoKeyGen();
      const { ct, sharedSecret: ss1 } = await miniFrodoEncapsulate(localKp.pk);
      const ss2 = await miniFrodoDecapsulate(localKp.sk, ct);
      if (toHex(ss1) !== toHex(ss2)) failures++;
    }
    expect(failures).toBe(0);
  }, 60000);

  // ── 4. Independence ───────────────────────────────────────────────────────────
  test("two independent key exchanges produce independent shared secrets", async () => {
    const { sharedSecret: ss1 } = await miniFrodoEncapsulate(kp.pk);
    const { sharedSecret: ss2 } = await miniFrodoEncapsulate(kp.pk);
    expect(toHex(ss1)).not.toBe(toHex(ss2));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Mini-NTRU Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mini-NTRU KEM", () => {
  let kp: MiniNtruKeyPair;

  beforeAll(async () => {
    kp = await miniNtruKeyGen();
  });

  // ── 1. Key generation structure ──────────────────────────────────────────────
  test("key generation produces valid public key (h polynomial)", () => {
    expect(Array.isArray(kp.pk.h)).toBe(true);
    expect(kp.pk.h.length).toBeGreaterThan(0);
  });

  test("key generation produces valid secret key (f polynomial)", () => {
    expect(Array.isArray(kp.sk.f)).toBe(true);
    expect(kp.sk.f.length).toBeGreaterThan(0);
  });

  test("public key h has the same ring dimension as secret key f", () => {
    expect(kp.pk.h.length).toBe(kp.sk.f.length);
  });

  test("public key coefficients are integers in valid range [0, Q)", () => {
    const Q = 128; // Mini-NTRU modulus
    kp.pk.h.forEach((c) => {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(Q);
    });
  });

  // ── 2. Single encapsulation / decapsulation ──────────────────────────────────
  test("encapsulate returns a ciphertext (c array + encSeed) and a 32-byte shared secret", async () => {
    const { ct, sharedSecret } = await miniNtruEncapsulate(kp.pk);
    expect(Array.isArray(ct.c)).toBe(true);
    expect(typeof ct.encSeed).toBe("string");
    expect(sharedSecret).toBeInstanceOf(Uint8Array);
    expect(sharedSecret.length).toBe(32);
  });

  test("decapsulate recovers the same shared secret (KEM correctness)", async () => {
    const { ct, sharedSecret: ss1 } = await miniNtruEncapsulate(kp.pk);
    const ss2 = await miniNtruDecapsulate(kp.sk, ct);
    expect(toHex(ss1)).toBe(toHex(ss2));
  });

  test("shared secret is non-trivial (not all-zero)", async () => {
    const { ct, sharedSecret: ss1 } = await miniNtruEncapsulate(kp.pk);
    expect(isAllZero(ss1)).toBe(false);
    const ss2 = await miniNtruDecapsulate(kp.sk, ct);
    expect(isAllZero(ss2)).toBe(false);
  });

  // ── 3. 100-iteration correctness sweep ───────────────────────────────────────
  test("correctness holds across 100 independent key-exchange cycles", async () => {
    let failures = 0;
    for (let i = 0; i < 100; i++) {
      const localKp = await miniNtruKeyGen();
      const { ct, sharedSecret: ss1 } = await miniNtruEncapsulate(localKp.pk);
      const ss2 = await miniNtruDecapsulate(localKp.sk, ct);
      if (toHex(ss1) !== toHex(ss2)) failures++;
    }
    expect(failures).toBe(0);
  }, 60000);

  // ── 4. Independence ───────────────────────────────────────────────────────────
  test("two independent key exchanges produce independent shared secrets", async () => {
    const { sharedSecret: ss1 } = await miniNtruEncapsulate(kp.pk);
    const { sharedSecret: ss2 } = await miniNtruEncapsulate(kp.pk);
    expect(toHex(ss1)).not.toBe(toHex(ss2));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cross-Algorithm Properties
// ═══════════════════════════════════════════════════════════════════════════════

describe("Cross-algorithm properties", () => {
  test("all three algorithms produce 32-byte shared secrets (uniform output length)", async () => {
    const kyberKp = await miniKyberKeyGen();
    const frodoKp = await miniFrodoKeyGen();
    const ntruKp  = await miniNtruKeyGen();

    const { sharedSecret: kSs } = await miniKyberEncapsulate(kyberKp.pk);
    const { sharedSecret: fSs } = await miniFrodoEncapsulate(frodoKp.pk);
    const { sharedSecret: nSs } = await miniNtruEncapsulate(ntruKp.pk);

    expect(kSs.length).toBe(32);
    expect(fSs.length).toBe(32);
    expect(nSs.length).toBe(32);
  });

  test("shared secrets from different algorithms are independent", async () => {
    const kyberKp = await miniKyberKeyGen();
    const frodoKp = await miniFrodoKeyGen();

    const { sharedSecret: kSs } = await miniKyberEncapsulate(kyberKp.pk);
    const { sharedSecret: fSs } = await miniFrodoEncapsulate(frodoKp.pk);

    expect(toHex(kSs)).not.toBe(toHex(fSs));
  });

  test("mismatched keypair does not produce matching shared secret (wrong-key resistance)", async () => {
    // Kyber: encapsulate to kp1 but attempt decap with kp2's secret key
    const kp1 = await miniKyberKeyGen();
    const kp2 = await miniKyberKeyGen();
    const { ct, sharedSecret: ss1 } = await miniKyberEncapsulate(kp1.pk);
    const ss2 = await miniKyberDecapsulate(kp2.sk, ct); // wrong key
    expect(toHex(ss1)).not.toBe(toHex(ss2));
  });
});
