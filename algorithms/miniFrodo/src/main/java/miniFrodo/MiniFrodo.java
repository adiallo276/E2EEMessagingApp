package miniFrodo;
/*
* CREATED: 02/12/2025
* LAST UPDATED: 22/12/2025
* PURPOSE: MiniFrodo: a toy LWE-based KEM using small matrices over Z_q. Further notes below
*/

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Arrays;

/**
 * MiniFrodo: a toy LWE-based KEM using small matrices over Z_q.
 *
 * PARAMETERS (toy, NOT secure):
 *   - q = 257
 *   - n = 4 (dimension)
 *
 * Structure:
 *   - A: n x n uniform
 *   - S, E: n x 1 small
 *   - B = A*S + E   (public)
 *
 *   Encaps:
 *     r, e1: n x 1 small
 *     e2:    1 x 1 small
 *     U = A^T * r + e1        (n x 1)
 *     V = B^T * r + e2 + mEnc (1 x 1)
 *
 *   Decaps:
 *     W = V - S^T * U  ≈ mEnc + small_noise
 *     Decode bit from W, then derive shared secret via SHA-256(m, U, V).
 */
public class MiniFrodo {

    public static final int N = 4;
    public static final int Q = Matrix.Q;

    private static final SecureRandom rnd = new SecureRandom();

    // ---------- Data classes ----------

    public static final class Ciphertext {
        private final Matrix U;  // n x 1
        private final Matrix V;  // 1 x 1

        public Ciphertext(Matrix U, Matrix V) {
            this.U = U;
            this.V = V;
        }

        public Matrix getU() {
            return U;
        }

        public Matrix getV() {
            return V;
        }

        @Override
        public String toString() {
            return "Ciphertext{U=" + U + ", V=" + V + "}";
        }
    }

    public static final class EncapsulationResult {
        private final Ciphertext ciphertext;
        private final byte[] sharedSecret;

        public EncapsulationResult(Ciphertext ciphertext, byte[] sharedSecret) {
            this.ciphertext = ciphertext;
            this.sharedSecret = sharedSecret;
        }

        public Ciphertext getCiphertext() {
            return ciphertext;
        }

        public byte[] getSharedSecret() {
            return sharedSecret;
        }
    }

    // ---------- Key generation ----------

    public static MiniFrodoKeyPair keyGen() {
        // A: n x n uniform
        Matrix A = Matrix.randomUniform(N, N, rnd);

        // S, E: n x 1 small
        Matrix S = Matrix.randomSmall(N, 1, rnd);
        Matrix E = Matrix.randomSmall(N, 1, rnd);

        // B = A*S + E (all mod q)
        Matrix B = A.mul(S).add(E);

        return new MiniFrodoKeyPair(A, B, S);
    }

    // ---------- Encapsulation / decapsulation ----------

    public static EncapsulationResult encapsulate(MiniFrodoKeyPair keyPair) {
        Matrix A = keyPair.getA();
        Matrix B = keyPair.getB();

        // Ephemeral randomness
        Matrix r  = Matrix.randomSmall(N, 1, rnd);
        Matrix e1 = Matrix.randomSmall(N, 1, rnd);
        Matrix e2 = Matrix.randomSmall(1, 1, rnd);

        // One-bit message m
        int m = rnd.nextBoolean() ? 1 : 0;
        Matrix mEnc = encodeMessageBit(m); // 1 x 1

        // U = A^T * r + e1  (n x 1)
        Matrix AT = A.transpose();
        Matrix U = AT.mul(r).add(e1);

        // V = B^T * r + e2 + mEnc  (1 x 1)
        Matrix BT = B.transpose();
        Matrix V = BT.mul(r).add(e2).add(mEnc);

        Ciphertext ct = new Ciphertext(U, V);
        byte[] ss = deriveSharedSecret(m, ct);

        return new EncapsulationResult(ct, ss);
    }

    public static byte[] decapsulate(MiniFrodoKeyPair keyPair, Ciphertext ct) {
        Matrix S = keyPair.getS();
        Matrix U = ct.getU();
        Matrix V = ct.getV();

        // W = V - S^T * U ≈ mEnc + noise
        Matrix ST = S.transpose(); // 1 x n
        Matrix STU = ST.mul(U);    // 1 x 1
        Matrix W = V.sub(STU);     // 1 x 1

        int mRecovered = decodeMessageBit(W);
        return deriveSharedSecret(mRecovered, ct);
    }

    // ---------- Message encoding / decoding ----------

    /**
     * Encode a bit m into a 1x1 matrix:
     *   m = 0 -> [0]
     *   m = 1 -> [Q/2] (around middle of range)
     */
    private static Matrix encodeMessageBit(int m) {
        Matrix M = new Matrix(1, 1);
        if (m == 1) {
            int halfQ = Q / 2; // 128 for Q=257 (approx)
            M.set(0, 0, halfQ);
        } else {
            M.set(0, 0, 0);
        }
        return M;
    }

    /**
     * Decode a bit from a 1x1 matrix W by thresholding its entry.
     */
    private static int decodeMessageBit(Matrix W) {
        if (W.getRows() != 1 || W.getCols() != 1) {
            throw new IllegalArgumentException("W must be 1x1 to decode");
        }
        int v = W.get(0, 0) % Q;
        if (v < 0) v += Q;

        double threshold = Q / 4.0; // halfway between 0 and Q/2
        return (v > threshold) ? 1 : 0;
    }

    // ---------- Shared secret derivation ----------

    private static byte[] deriveSharedSecret(int m, Ciphertext ct) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update((byte) m);
            md.update(ct.getU().toBytes());
            md.update(ct.getV().toBytes());
            return md.digest();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}