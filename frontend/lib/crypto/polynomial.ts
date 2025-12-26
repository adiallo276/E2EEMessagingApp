export class Polynomial {
  static readonly N = 8;
  static readonly Q = 3329;

  private coeffs: number[];

  constructor(coeffs?: number[]) {
    if (!coeffs) {
      this.coeffs = new Array(Polynomial.N).fill(0);
      return;
    }
    if (coeffs.length !== Polynomial.N) {
      throw new Error(`Polynomial must have length ${Polynomial.N}`);
    }
    this.coeffs = coeffs.map(Polynomial.modQ);
  }

  getCoeffs(): number[] {
    return [...this.coeffs];
  }

  static modQ(x: number): number {
    let r = x % Polynomial.Q;
    if (r < 0) r += Polynomial.Q;
    return r;
  }

  add(other: Polynomial): Polynomial {
    const res = new Array(Polynomial.N);
    for (let i = 0; i < Polynomial.N; i++) {
      res[i] = Polynomial.modQ(this.coeffs[i] + other.coeffs[i]);
    }
    return new Polynomial(res);
  }

  sub(other: Polynomial): Polynomial {
    const res = new Array(Polynomial.N);
    for (let i = 0; i < Polynomial.N; i++) {
      res[i] = Polynomial.modQ(this.coeffs[i] - other.coeffs[i]);
    }
    return new Polynomial(res);
  }

  mul(other: Polynomial): Polynomial {
    const tmp = new Array(Polynomial.N).fill(0);

    for (let i = 0; i < Polynomial.N; i++) {
      for (let j = 0; j < Polynomial.N; j++) {
        const prod = this.coeffs[i] * other.coeffs[j];
        const k = i + j;
        if (k < Polynomial.N) {
          tmp[k] += prod;
        } else {
          tmp[k - Polynomial.N] -= prod;
        }
      }
    }

    for (let i = 0; i < Polynomial.N; i++) {
      tmp[i] = Polynomial.modQ(tmp[i]);
    }

    return new Polynomial(tmp);
  }

  static async randomUniform(): Promise<Polynomial> {
    const buf = new Uint16Array(Polynomial.N);
    crypto.getRandomValues(buf);
    const c = Array.from(buf, (x) => x % Polynomial.Q);
    return new Polynomial(c);
  }

  static async randomSmall(): Promise<Polynomial> {
    const buf = new Uint8Array(Polynomial.N);
    crypto.getRandomValues(buf);
    const c = Array.from(buf, (x) => (x % 3) - 1);
    return new Polynomial(c);
  }

  toBytes(): Uint8Array {
    const out = new Uint8Array(2 * Polynomial.N);
    for (let i = 0; i < Polynomial.N; i++) {
      const v = Polynomial.modQ(this.coeffs[i]);
      out[2 * i] = v & 0xff;
      out[2 * i + 1] = (v >>> 8) & 0xff;
    }
    return out;
  }
}