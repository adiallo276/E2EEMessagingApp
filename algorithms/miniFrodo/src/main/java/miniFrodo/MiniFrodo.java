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
 * Parameters:
 *   - q = 257
 *   - n = 4 (dimension)
 *
 * Structure:
 *   - A: n x n uniform
 *   - S, E: n x 1 small
 *   - B = A*S + E   (public)
 *
 *   Encapsulation:
 *     r, e1: n x 1 small
 *     e2:    1 x 1 small
 *     U = A^T * r + e1        (n x 1)
 *     V = B^T * r + e2 + mEnc (1 x 1)
 *
 *   Decapsulation:
 *     W = V - S^T * U  ≈ mEnc + small_noise
 *     Decode bit from W, then derive shared secret via SHA-256(m, U, V).
 */
public class MiniFrodo {

    public static final int N = 4;
    public static final int Q = Matrix.Q;

    private static final SecureRandom rnd = new SecureRandom();

    public static final class Ciphertext {
        private final Matrix U; 
        private final Matrix V; 

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


    public static EncapsulationResult encapsulate(MiniFrodoKeyPair keyPair) {
        Matrix A = keyPair.getA();
        Matrix B = keyPair.getB();

        Matrix r  = Matrix.randomSmall(N, 1, rnd);
        Matrix e1 = Matrix.randomSmall(N, 1, rnd);
        Matrix e2 = Matrix.randomSmall(1, 1, rnd);

        int m = rnd.nextBoolean() ? 1 : 0;
        Matrix mEnc = encodeMessageBit(m); 

        Matrix AT = A.transpose();
        Matrix U = AT.mul(r).add(e1);

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

        Matrix ST = S.transpose();
        Matrix STU = ST.mul(U);  
        Matrix W = V.sub(STU);  

        int mRecovered = decodeMessageBit(W);
        return deriveSharedSecret(mRecovered, ct);
    }

    private static Matrix encodeMessageBit(int m) {
        Matrix M = new Matrix(1, 1);
        if (m == 1) {
            int halfQ = Q / 2;
            M.set(0, 0, halfQ);
        } else {
            M.set(0, 0, 0);
        }
        return M;
    }

    private static int decodeMessageBit(Matrix W) {
        if (W.getRows() != 1 || W.getCols() != 1) {
            throw new IllegalArgumentException("W must be 1x1 to decode");
        }
        int v = W.get(0, 0) % Q;
        if (v < 0) v += Q;

        double threshold = Q / 4.0; 
        return (v > threshold) ? 1 : 0;
    }

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