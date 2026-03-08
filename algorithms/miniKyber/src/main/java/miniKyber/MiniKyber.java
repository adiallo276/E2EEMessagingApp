/*
 * CREATED: 08/11/2025
 * LAST UPDATED: 09/12/2025
 * PURPOSE: Core algorithm, generates the keys, encrypts and decrypts data 
 */

package miniKyber;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Arrays;

public class MiniKyber {

    public static final int N = Polynomial.N;
    public static final int Q = Polynomial.Q;

    private static final SecureRandom rnd = new SecureRandom();

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


    public static EncapsulationResult encapsulate(MiniKyberKeyPair keyPair) {
        Polynomial a = keyPair.getA();
        Polynomial t = keyPair.getT();

        Polynomial r  = Polynomial.randomSmall(rnd);
        Polynomial e1 = Polynomial.randomSmall(rnd);
        Polynomial e2 = Polynomial.randomSmall(rnd);

        int m = rnd.nextBoolean() ? 1 : 0;
        Polynomial mPoly = encodeMessageBit(m);

        Polynomial u = a.mul(r).add(e1);

        Polynomial v = t.mul(r).add(e2).add(mPoly);

        Ciphertext ct = new Ciphertext(u, v);
        byte[] ss = deriveSharedSecret(m, ct);

        return new EncapsulationResult(ct, ss);
    }

    public static byte[] decapsulate(MiniKyberKeyPair keyPair, Ciphertext ct) {
        Polynomial s = keyPair.getS();

        Polynomial w = ct.getV().sub(ct.getU().mul(s));

        int mRecovered = decodeMessageBit(w);
        return deriveSharedSecret(mRecovered, ct);
    }

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

    private static int decodeMessageBit(Polynomial w) {
        int[] c = w.getCoeffs();
        long sum = 0;
        for (int x : c) {
            int v = x % Q;
            if (v < 0) v += Q;
            sum += v;
        }
        double avg = sum / (double) N;

        double threshold = Q / 4.0;
        return (avg > threshold) ? 1 : 0;

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