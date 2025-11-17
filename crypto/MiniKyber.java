/*
 * CREATED: 08/11/2025
 * LAST UPDATED: 11/11/2025
 * PURPOSE: Core algorithm, generates the keys, encrypts and decrypts data 
 */

package crypto;

import java.util.Random;

public class MiniKyber {
    private static final int N = 8;
    private static final int Q = 3329;
    private static final Random random = new Random();

    private static Polynomial smallPoly() {
        int[] coeffs = new int[N];
        for (int i = 0; i < N; i++) {
            coeffs[i] = random.nextInt(3) - 1;
        }
        return new Polynomial(coeffs);
    }

    private static Polynomial randomPoly() {
        int[] coeffs = new int[N];
        for (int i = 0; i < N; i++) {
            coeffs[i] = random.nextInt(Q);
        }
        return new Polynomial(coeffs);
    }

    public static MiniKyberKeyPair keyGen() {
        Polynomial a = randomPoly();
        Polynomial s = smallPoly();
        Polynomial e = smallPoly();
        Polynomial t = a.mul(s).add(e); // t = a*s + e mod q
        return new MiniKyberKeyPair(a, t, s);
    }

    public static class Ciphertext {
    public final Polynomial u;
    public final Polynomial v;
    public Ciphertext(Polynomial u, Polynomial v) {
        this.u = u;
        this.v = v;
    }
}

    public static Ciphertext encrypt(int m, Polynomial a, Polynomial t) {
        Polynomial r = smallPoly();
        Polynomial e1 = smallPoly();
        Polynomial e2 = smallPoly();

        Polynomial u = a.mul(r).add(e1);
        Polynomial v = t.mul(r).add(e2).add(Polynomial.constant(m * (Q / 2)));

        return new Ciphertext(u, v);
    }

    public static int decrypt(Ciphertext c, Polynomial s) {
        Polynomial x = c.v.sub(c.u.mul(s)); 
        int avg = 0;
        for (int coeff : x.getCoeffs()) {
            avg += coeff;
        }
        avg /= x.getCoeffs().length;
        int diff0 = Math.abs(avg - 0);
        int diff1 = Math.abs(avg - Q / 2);
        return (diff1 < diff0) ? 1 : 0;
    }
}
