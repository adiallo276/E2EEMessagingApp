/* 
* CREATED 08/11/2025
* LAST UPDATED 09/12/2025
* PURPOSE: Performs operations like addition, subtraction, and multiplications of polynomials. Mathematical foundation for Kyber
*/
package miniKyber;
import java.security.SecureRandom;
import java.util.Arrays;

/*
 * Polynomial in R_q = Z_q[x]/(x^N + 1) with N=8, q=3329.
 * Coefficients stored as ints; arithmetic is always done mod q.
 */
public class Polynomial {

    public static final int N = 8;
    public static final int Q = 3329;

    private final int[] coeffs; // length N

    public Polynomial() {
        this.coeffs = new int[N];
    }

    public Polynomial(int[] coeffs) {
        if (coeffs.length != N) {
            throw new IllegalArgumentException("Polynomial must have length " + N);
        }
        this.coeffs = new int[N];
        for (int i = 0; i < N; i++) {
            this.coeffs[i] = modQ(coeffs[i]);
        }
    }

    public int[] getCoeffs() {
        return Arrays.copyOf(coeffs, N);
    }

    private static int modQ(int x) {
        int r = x % Q;
        if (r < 0) r += Q;
        return r;
    }

    public Polynomial add(Polynomial other) {
        Polynomial res = new Polynomial();
        for (int i = 0; i < N; i++) {
            res.coeffs[i] = modQ(this.coeffs[i] + other.coeffs[i]);
        }
        return res;
    }

    public Polynomial sub(Polynomial other) {
        Polynomial res = new Polynomial();
        for (int i = 0; i < N; i++) {
            res.coeffs[i] = modQ(this.coeffs[i] - other.coeffs[i]);
        }
        return res;
    }

    /**
     * Multiplication in R_q = Z_q[x]/(x^N + 1).
     * Using schoolbook multiplaction with the rule x^N = -1.
     */
    public Polynomial mul(Polynomial other) {
        int[] tmp = new int[N];

        for (int i = 0; i < N; i++) {
            for (int j = 0; j < N; j++) {
                int prod = this.coeffs[i] * other.coeffs[j];
                int k = i + j;
                if (k < N) {
                    tmp[k] += prod;
                } else {
                    // x^(N + t) = -x^t
                    tmp[k - N] -= prod;
                }
            }
        }

        for (int i = 0; i < N; i++) {
            tmp[i] = modQ(tmp[i]);
        }

        return new Polynomial(tmp);
    }

    /**
     * Uniform random polynomial with coefficients in [0, Q).
     */
    public static Polynomial randomUniform(SecureRandom rnd) {
        int[] c = new int[N];
        for (int i = 0; i < N; i++) {
            // naive uniform sampling; fine for a mini demo
            c[i] = rnd.nextInt(Q);
        }
        return new Polynomial(c);
    }

    /**
     * Small-noise polynomial with coefficients in {-1, 0, 1}.
     */
    public static Polynomial randomSmall(SecureRandom rnd) {
        int[] c = new int[N];
        for (int i = 0; i < N; i++) {
            int r = rnd.nextInt(3) - 1; // -1, 0, or 1
            c[i] = r;
        }
        return new Polynomial(c);
    }

    /**
     * Encode polynomial to 2*N bytes (little-endian 16-bit per coeff).
     */
    public byte[] toBytes() {
        byte[] out = new byte[2 * N];
        for (int i = 0; i < N; i++) {
            int v = modQ(coeffs[i]);
            out[2 * i]     = (byte) (v & 0xFF);
            out[2 * i + 1] = (byte) ((v >>> 8) & 0xFF);
        }
        return out;
    }

    @Override
    public String toString() {
        return Arrays.toString(coeffs);
    }
}