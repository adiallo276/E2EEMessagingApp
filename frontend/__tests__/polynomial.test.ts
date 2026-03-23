/**
 * Unit tests for the Polynomial class used in Ring-LWE (Kyber) KEM.
 * Tests arithmetic operations, modular reduction, serialization, and random generation.
 */
import { Polynomial } from '../lib/crypto/polynomial';

describe('Polynomial Class', () => {
  describe('Constructor and basic properties', () => {
    test('should create zero polynomial with no arguments', () => {
      const p = new Polynomial();
      const coeffs = p.getCoeffs();
      expect(coeffs.length).toBe(Polynomial.N);
      expect(coeffs.every((c) => c === 0)).toBe(true);
    });

    test('should create polynomial from coefficients', () => {
      const input = [1, 2, 3, 4, 5, 6, 7, 8];
      const p = new Polynomial(input);
      expect(p.getCoeffs()).toEqual(input);
    });

    test('should reduce coefficients mod Q on construction', () => {
      const input = [Polynomial.Q + 1, -1, 0, Polynomial.Q, 2 * Polynomial.Q + 5, 3, 7, 100];
      const p = new Polynomial(input);
      const coeffs = p.getCoeffs();
      expect(coeffs[0]).toBe(1);
      expect(coeffs[1]).toBe(Polynomial.Q - 1);
      expect(coeffs[2]).toBe(0);
      expect(coeffs[3]).toBe(0);
      expect(coeffs[4]).toBe(5);
    });

    test('should throw if wrong number of coefficients', () => {
      expect(() => new Polynomial([1, 2, 3])).toThrow();
      expect(() => new Polynomial([1, 2, 3, 4, 5, 6, 7, 8, 9])).toThrow();
    });

    test('getCoeffs should return a copy', () => {
      const p = new Polynomial([1, 2, 3, 4, 5, 6, 7, 8]);
      const c1 = p.getCoeffs();
      c1[0] = 9999;
      expect(p.getCoeffs()[0]).toBe(1);
    });
  });

  describe('modQ static method', () => {
    test('should handle positive values within range', () => {
      expect(Polynomial.modQ(0)).toBe(0);
      expect(Polynomial.modQ(1)).toBe(1);
      expect(Polynomial.modQ(Polynomial.Q - 1)).toBe(Polynomial.Q - 1);
    });

    test('should reduce values >= Q', () => {
      expect(Polynomial.modQ(Polynomial.Q)).toBe(0);
      expect(Polynomial.modQ(Polynomial.Q + 1)).toBe(1);
      expect(Polynomial.modQ(2 * Polynomial.Q)).toBe(0);
    });

    test('should handle negative values', () => {
      expect(Polynomial.modQ(-1)).toBe(Polynomial.Q - 1);
      // -Q % Q gives -0 in JS; adding +0 normalizes it
      expect(Polynomial.modQ(-Polynomial.Q) + 0).toBe(0);
      expect(Polynomial.modQ(-Polynomial.Q - 1)).toBe(Polynomial.Q - 1);
    });
  });

  describe('Arithmetic operations', () => {
    test('add should produce correct element-wise sum mod Q', () => {
      const a = new Polynomial([1, 2, 3, 4, 5, 6, 7, 8]);
      const b = new Polynomial([10, 20, 30, 40, 50, 60, 70, 80]);
      const sum = a.add(b);
      expect(sum.getCoeffs()).toEqual([11, 22, 33, 44, 55, 66, 77, 88]);
    });

    test('add should wrap mod Q', () => {
      const a = new Polynomial([Polynomial.Q - 1, 0, 0, 0, 0, 0, 0, 0]);
      const b = new Polynomial([2, 0, 0, 0, 0, 0, 0, 0]);
      const sum = a.add(b);
      expect(sum.getCoeffs()[0]).toBe(1);
    });

    test('sub should produce correct element-wise difference mod Q', () => {
      const a = new Polynomial([10, 20, 30, 40, 50, 60, 70, 80]);
      const b = new Polynomial([1, 2, 3, 4, 5, 6, 7, 8]);
      const diff = a.sub(b);
      expect(diff.getCoeffs()).toEqual([9, 18, 27, 36, 45, 54, 63, 72]);
    });

    test('sub should wrap mod Q for negative results', () => {
      const a = new Polynomial([0, 0, 0, 0, 0, 0, 0, 0]);
      const b = new Polynomial([1, 0, 0, 0, 0, 0, 0, 0]);
      const diff = a.sub(b);
      expect(diff.getCoeffs()[0]).toBe(Polynomial.Q - 1);
    });

    test('add then sub should return original', () => {
      const a = new Polynomial([100, 200, 300, 400, 500, 600, 700, 800]);
      const b = new Polynomial([50, 60, 70, 80, 90, 100, 110, 120]);
      const result = a.add(b).sub(b);
      expect(result.getCoeffs()).toEqual(a.getCoeffs());
    });

    test('mul should produce correct negacyclic convolution', () => {
      // Multiply by identity-like polynomial [1, 0, 0, ..., 0]
      const a = new Polynomial([5, 10, 15, 20, 25, 30, 35, 40]);
      const identity = new Polynomial([1, 0, 0, 0, 0, 0, 0, 0]);
      const result = a.mul(identity);
      expect(result.getCoeffs()).toEqual(a.getCoeffs());
    });

    test('mul should be commutative', () => {
      const a = new Polynomial([1, 2, 3, 4, 5, 6, 7, 8]);
      const b = new Polynomial([8, 7, 6, 5, 4, 3, 2, 1]);
      const ab = a.mul(b);
      const ba = b.mul(a);
      expect(ab.getCoeffs()).toEqual(ba.getCoeffs());
    });

    test('mul by zero polynomial should give zero', () => {
      const a = new Polynomial([1, 2, 3, 4, 5, 6, 7, 8]);
      const zero = new Polynomial();
      const result = a.mul(zero);
      expect(result.getCoeffs().every((c) => c === 0)).toBe(true);
    });
  });

  describe('Serialization', () => {
    test('toBytes should produce 2*N bytes', () => {
      const p = new Polynomial([1, 2, 3, 4, 5, 6, 7, 8]);
      const bytes = p.toBytes();
      expect(bytes.length).toBe(2 * Polynomial.N);
    });

    test('toBytes should encode in little-endian', () => {
      const p = new Polynomial([0x0102, 0, 0, 0, 0, 0, 0, 0]);
      const bytes = p.toBytes();
      expect(bytes[0]).toBe(0x02); // low byte
      expect(bytes[1]).toBe(0x01); // high byte
    });

    test('toBytes should be deterministic', () => {
      const p = new Polynomial([100, 200, 300, 400, 500, 600, 700, 800]);
      const b1 = p.toBytes();
      const b2 = p.toBytes();
      expect(Array.from(b1)).toEqual(Array.from(b2));
    });
  });

  describe('Random generation', () => {
    test('randomUniform should produce polynomial with all coeffs < Q', async () => {
      const p = await Polynomial.randomUniform();
      const coeffs = p.getCoeffs();
      expect(coeffs.length).toBe(Polynomial.N);
      for (const c of coeffs) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(Polynomial.Q);
      }
    });

    test('randomSmall should produce polynomial with coeffs in {-1, 0, 1} mapped to mod Q', async () => {
      const p = await Polynomial.randomSmall();
      const coeffs = p.getCoeffs();
      expect(coeffs.length).toBe(Polynomial.N);
      for (const c of coeffs) {
        // After modQ, -1 maps to Q-1, 0 stays 0, 1 stays 1
        expect([0, 1, Polynomial.Q - 1]).toContain(c);
      }
    });

    test('randomUniform should produce different polynomials', async () => {
      const p1 = await Polynomial.randomUniform();
      const p2 = await Polynomial.randomUniform();
      // Statistically extremely unlikely to be equal
      const same = p1.getCoeffs().every((c, i) => c === p2.getCoeffs()[i]);
      expect(same).toBe(false);
    });
  });
});
