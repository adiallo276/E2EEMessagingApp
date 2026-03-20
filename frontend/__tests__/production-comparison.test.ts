/**
 * Production ML-KEM-768 Comparison Benchmark
 * ============================================================
 * Compares Mini-Kyber (this project's educational implementation)
 * against @noble/post-quantum's production ML-KEM-768, which
 * implements NIST FIPS 203 with full NTT-based polynomial arithmetic.
 *
 * This provides the quantitative bridge between the Mini implementation
 * results reported in the FYP and production-scale behaviour.
 *
 * Install dependency first:
 *   npm install @noble/post-quantum
 *
 * Run with:  npm test -- production-comparison
 */

// NOTE: @noble/post-quantum must be installed first (`npm install`)
// If not installed, this test suite will be skipped gracefully.
let ml_kem768: any;
let nobleAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const noble = require("@noble/post-quantum/ml-kem.js");
  ml_kem768 = noble.ml_kem768;
  nobleAvailable = true;
} catch {
  nobleAvailable = false;
}

import {
  miniKyberKeyGen,
  miniKyberEncapsulate,
  miniKyberDecapsulate,
} from "../lib/crypto/minikyber";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

function ci95(arr: number[]): { lower: number; upper: number } {
  const m = mean(arr);
  const margin = 1.96 * (stdDev(arr) / Math.sqrt(arr.length));
  return { lower: m - margin, upper: m + margin };
}

const ITERS = 200; // enough for stable means without taking too long in CI

// ═══════════════════════════════════════════════════════════════════════════════
// Production ML-KEM-768 correctness
// ═══════════════════════════════════════════════════════════════════════════════

const maybeDescribe = nobleAvailable ? describe : describe.skip;

maybeDescribe("Production ML-KEM-768 (@noble/post-quantum — FIPS 203)", () => {
  test("key generation returns correct byte lengths (ML-KEM-768 spec)", () => {
    const { publicKey, secretKey } = ml_kem768.keygen();
    // FIPS 203 ML-KEM-768: pk = 1184 bytes, sk = 2400 bytes
    expect(publicKey.length).toBe(1184);
    expect(secretKey.length).toBe(2400);
  });

  test("encapsulation + decapsulation produces matching shared secrets", () => {
    const { publicKey, secretKey } = ml_kem768.keygen();
    const { cipherText, sharedSecret: ss1 } = ml_kem768.encapsulate(publicKey);
    const ss2 = ml_kem768.decapsulate(cipherText, secretKey);
    expect(Buffer.from(ss1).toString("hex")).toBe(Buffer.from(ss2).toString("hex"));
  });

  test("ciphertext is 1088 bytes (ML-KEM-768 spec)", () => {
    const { publicKey } = ml_kem768.keygen();
    const { cipherText } = ml_kem768.encapsulate(publicKey);
    expect(cipherText.length).toBe(1088);
  });

  test(`correctness holds across ${ITERS} independent key-exchange cycles`, () => {
    let failures = 0;
    for (let i = 0; i < ITERS; i++) {
      const { publicKey, secretKey } = ml_kem768.keygen();
      const { cipherText, sharedSecret: ss1 } = ml_kem768.encapsulate(publicKey);
      const ss2 = ml_kem768.decapsulate(cipherText, secretKey);
      if (Buffer.from(ss1).toString("hex") !== Buffer.from(ss2).toString("hex")) {
        failures++;
      }
    }
    expect(failures).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Performance comparison: Mini-Kyber vs Production ML-KEM-768
// ═══════════════════════════════════════════════════════════════════════════════

maybeDescribe("Performance: Mini-Kyber vs Production ML-KEM-768", () => {
  // Warmup both implementations before timing
  beforeAll(async () => {
    for (let i = 0; i < 20; i++) {
      const kp = await miniKyberKeyGen();
      const { ct } = await miniKyberEncapsulate(kp.pk);
      await miniKyberDecapsulate(kp.sk, ct);

      const { publicKey, secretKey } = ml_kem768.keygen();
      const { cipherText } = ml_kem768.encapsulate(publicKey);
      ml_kem768.decapsulate(cipherText, secretKey);
    }
  }, 30000);

  test(`Mini-Kyber ${ITERS}-iteration timing (records mean ± stddev in ms)`, async () => {
    const kgTimes: number[] = [];
    const encTimes: number[] = [];
    const decTimes: number[] = [];

    for (let i = 0; i < ITERS; i++) {
      const t0 = performance.now();
      const kp = await miniKyberKeyGen();
      kgTimes.push(performance.now() - t0);

      const t1 = performance.now();
      const { ct } = await miniKyberEncapsulate(kp.pk);
      encTimes.push(performance.now() - t1);

      const t2 = performance.now();
      await miniKyberDecapsulate(kp.sk, ct);
      decTimes.push(performance.now() - t2);
    }

    const kgMean = mean(kgTimes);
    const encMean = mean(encTimes);
    const decMean = mean(decTimes);

    // Log results so they appear in the test output
    console.log("\n── Mini-Kyber ──────────────────────────");
    console.log(`KeyGen:  ${(kgMean * 1000).toFixed(2)} μs  ±${(stdDev(kgTimes) * 1000).toFixed(2)} μs  (95% CI: ${(ci95(kgTimes).lower * 1000).toFixed(2)}–${(ci95(kgTimes).upper * 1000).toFixed(2)} μs)`);
    console.log(`Encap:   ${(encMean * 1000).toFixed(2)} μs  ±${(stdDev(encTimes) * 1000).toFixed(2)} μs`);
    console.log(`Decap:   ${(decMean * 1000).toFixed(2)} μs  ±${(stdDev(decTimes) * 1000).toFixed(2)} μs`);
    console.log(`Total:   ${((kgMean + encMean + decMean) * 1000).toFixed(2)} μs`);

    // Sanity: operations should complete in under 5 seconds each on any modern machine
    expect(kgMean).toBeLessThan(5000);
    expect(encMean).toBeLessThan(5000);
    expect(decMean).toBeLessThan(5000);
  }, 120000);

  test(`Production ML-KEM-768 ${ITERS}-iteration timing (records mean ± stddev in ms)`, () => {
    const kgTimes: number[] = [];
    const encTimes: number[] = [];
    const decTimes: number[] = [];

    for (let i = 0; i < ITERS; i++) {
      const t0 = performance.now();
      const { publicKey, secretKey } = ml_kem768.keygen();
      kgTimes.push(performance.now() - t0);

      const t1 = performance.now();
      const { cipherText } = ml_kem768.encapsulate(publicKey);
      encTimes.push(performance.now() - t1);

      const t2 = performance.now();
      ml_kem768.decapsulate(cipherText, secretKey);
      decTimes.push(performance.now() - t2);
    }

    const kgMean = mean(kgTimes);
    const encMean = mean(encTimes);
    const decMean = mean(decTimes);

    console.log("\n── Production ML-KEM-768 ───────────────");
    console.log(`KeyGen:  ${(kgMean * 1000).toFixed(2)} μs  ±${(stdDev(kgTimes) * 1000).toFixed(2)} μs  (95% CI: ${(ci95(kgTimes).lower * 1000).toFixed(2)}–${(ci95(kgTimes).upper * 1000).toFixed(2)} μs)`);
    console.log(`Encap:   ${(encMean * 1000).toFixed(2)} μs  ±${(stdDev(encTimes) * 1000).toFixed(2)} μs`);
    console.log(`Decap:   ${(decMean * 1000).toFixed(2)} μs  ±${(stdDev(decTimes) * 1000).toFixed(2)} μs`);
    console.log(`Total:   ${((kgMean + encMean + decMean) * 1000).toFixed(2)} μs`);

    expect(kgMean).toBeLessThan(5000);
    expect(encMean).toBeLessThan(5000);
    expect(decMean).toBeLessThan(5000);
  });

  test("reports Mini vs Production overhead ratio for report table", async () => {
    // Quick 50-iteration run to get the ratio for the report
    const QUICK = 50;
    const miniTotals: number[] = [];
    const prodTotals: number[] = [];

    for (let i = 0; i < QUICK; i++) {
      const t0 = performance.now();
      const kp = await miniKyberKeyGen();
      const { ct } = await miniKyberEncapsulate(kp.pk);
      await miniKyberDecapsulate(kp.sk, ct);
      miniTotals.push(performance.now() - t0);
    }

    for (let i = 0; i < QUICK; i++) {
      const t0 = performance.now();
      const { publicKey, secretKey } = ml_kem768.keygen();
      const { cipherText } = ml_kem768.encapsulate(publicKey);
      ml_kem768.decapsulate(cipherText, secretKey);
      prodTotals.push(performance.now() - t0);
    }

    const miniMean = mean(miniTotals) * 1000; // μs
    const prodMean = mean(prodTotals) * 1000;  // μs
    const ratio = miniMean / prodMean;

    console.log("\n── Overhead Ratio ──────────────────────");
    console.log(`Mini-Kyber total: ${miniMean.toFixed(2)} μs`);
    console.log(`ML-KEM-768 total: ${prodMean.toFixed(2)} μs`);
    console.log(`Ratio (Mini / Production): ${ratio.toFixed(2)}×`);
    console.log("(< 1 = Mini is faster due to reduced parameters)");

    // Mini should be plausibly related in order of magnitude (within 1000×)
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(1000);
  }, 60000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Graceful skip if @noble/post-quantum not yet installed
// ═══════════════════════════════════════════════════════════════════════════════

if (!nobleAvailable) {
  describe("Production ML-KEM-768 tests (SKIPPED)", () => {
    test("@noble/post-quantum not installed — run: npm install @noble/post-quantum", () => {
      console.warn(
        "\n⚠️  @noble/post-quantum not installed. Run:\n" +
          "   npm install @noble/post-quantum\n" +
          "   then re-run: npm test -- production-comparison\n"
      );
      // Not a failure — graceful skip
      expect(true).toBe(true);
    });
  });
}
