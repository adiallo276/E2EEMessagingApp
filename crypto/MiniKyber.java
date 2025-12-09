/*
 * CREATED: 08/11/2025
 * LAST UPDATED: 09/12/2025
 * PURPOSE: Core algorithm, generates the keys, encrypts and decrypts data 
 */

package crypto;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Arrays;

/**
 * A very simplified "MiniKyber" KEM over R_q = Z_q[x]/(x^N + 1)
 * with N=8, q=3329 and k=1 (single polynomial).
 */
public class MiniKyber {

    public static final int N = Polynomial.N;
    public static final int Q = Polynomial.Q;

    private static final SecureRandom rnd = new SecureRandom();

    // ---------- Data classes ----------

    public static final class Ciphertext {
        private final Polynomial u;
        private final Polynomial v;

        public Ciphertext(Polynomial u, Polynomial v) {
            this.u = u;
            this.v = v;
        }

        public Polynomial getU() {
            return u;
        }

        public Polynomial getV() {
            return v;
        }

        @Override
        public String toString() {
            return "Ciphertext{u=" + u + ", v=" + v + "}";
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

    // Key generation

    public static MiniKyberKeyPair keyGen() {
        Polynomial a = Polynomial.randomUniform(rnd);
        Polynomial s = Polynomial.randomSmall(rnd);
        Polynomial e = Polynomial.randomSmall(rnd);

        Polynomial t = a.mul(s).add(e);

        return new MiniKyberKeyPair(a, s, t);
    }

    // ---------- Encapsulation / decapsulation ----------

    public static EncapsulationResult encapsulate(MiniKyberKeyPair keyPair) {
        Polynomial a = keyPair.getA();
        Polynomial t = keyPair.getT();

        // Ephemeral randomness
        Polynomial r  = Polynomial.randomSmall(rnd);
        Polynomial e1 = Polynomial.randomSmall(rnd);
        Polynomial e2 = Polynomial.randomSmall(rnd);

        // Random one-bit message m in {0,1}
        int m = rnd.nextBoolean() ? 1 : 0;
        Polynomial mPoly = encodeMessageBit(m);

        // u = a*r + e1
        Polynomial u = a.mul(r).add(e1);

        // v = t*r + e2 + mPoly
        Polynomial v = t.mul(r).add(e2).add(mPoly);

        Ciphertext ct = new Ciphertext(u, v);
        byte[] ss = deriveSharedSecret(m, ct);

        return new EncapsulationResult(ct, ss);
    }

    public static byte[] decapsulate(MiniKyberKeyPair keyPair, Ciphertext ct) {
        Polynomial s = keyPair.getS();

        // w = v - u*s ≈ mPoly + noise
        Polynomial w = ct.getV().sub(ct.getU().mul(s));

        int mRecovered = decodeMessageBit(w);
        return deriveSharedSecret(mRecovered, ct);
    }

    // Message encoding and decoding

    /**
     * Encode a bit m into a polynomial:
     *   m = 0 -> all 0
     *   m = 1 -> all around Q/2
     */
    private static Polynomial encodeMessageBit(int m) {
        int[] c = new int[N];
        if (m == 1) {
            int halfQ = Q / 2; // 1664 for 3329 (approx)
            Arrays.fill(c, halfQ);
        } else {
            Arrays.fill(c, 0);
        }
        return new Polynomial(c);
    }

    /**
     * Decode a bit from polynomial w by thresholding the average coefficient.
     */
    private static int decodeMessageBit(Polynomial w) {
        int[] c = w.getCoeffs();
        long sum = 0;
        for (int x : c) {
            int v = x % Q;
            if (v < 0) v += Q;
            sum += v;
        }
        double avg = sum / (double) N;

        /* Simple threshold halfway between 0 and Q/2
        *  avg ~ 0           => bit 0
        avg ~ Q/2 (~1664) => bit 1*/
        double threshold = Q / 4.0;
        return (avg > threshold) ? 1 : 0;

    }

    // Shared secret derivation

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