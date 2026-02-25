package com.messaging.backend.algorithms;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Arrays;

/**
 * MiniKyber - Educational Ring-LWE based Key Encapsulation Mechanism
 * 
 * WARNING: This is a simplified educational implementation with reduced parameters.
 * NOT suitable for production use. Real Kyber uses much larger parameters.
 * 
 * Based on the Learning With Errors problem over polynomial rings.
 */
public class MiniKyber {
    
    // Simplified parameters for educational purposes
    private static final int N = 4;           // Polynomial degree
    private static final int Q = 97;          // Prime modulus
    private static final int K = 2;           // Module rank
    private static final int ETA = 2;         // Noise parameter
    
    private static final SecureRandom random = new SecureRandom();
    
    /**
     * Public Key structure
     */
    public static class PublicKey {
        public final int[][] t;      // Public matrix t = As + e
        public final byte[] rho;     // Seed for matrix A
        
        public PublicKey(int[][] t, byte[] rho) {
            this.t = t;
            this.rho = rho;
        }
    }
    
    /**
     * Secret Key structure
     */
    public static class SecretKey {
        public final int[][] s;      // Secret vector
        
        public SecretKey(int[][] s) {
            this.s = s;
        }
    }
    
    /**
     * Key Pair structure
     */
    public static class KeyPair {
        public final PublicKey pk;
        public final SecretKey sk;
        
        public KeyPair(PublicKey pk, SecretKey sk) {
            this.pk = pk;
            this.sk = sk;
        }
    }
    
    /**
     * Ciphertext structure
     */
    public static class Ciphertext {
        public final int[][] u;      // u = A^T * r + e1
        public final int[] v;        // v = t^T * r + e2 + m * (q/2)
        
        public Ciphertext(int[][] u, int[] v) {
            this.u = u;
            this.v = v;
        }
    }
    
    /**
     * Encapsulation result
     */
    public static class EncapResult {
        public final Ciphertext ct;
        public final byte[] sharedSecret;
        
        public EncapResult(Ciphertext ct, byte[] sharedSecret) {
            this.ct = ct;
            this.sharedSecret = sharedSecret;
        }
    }
    
    // Polynomial operations
    
    private static int mod(int x, int m) {
        return ((x % m) + m) % m;
    }
    
    private static int[] polyAdd(int[] a, int[] b) {
        int[] result = new int[N];
        for (int i = 0; i < N; i++) {
            result[i] = mod(a[i] + b[i], Q);
        }
        return result;
    }
    
    private static int[] polySub(int[] a, int[] b) {
        int[] result = new int[N];
        for (int i = 0; i < N; i++) {
            result[i] = mod(a[i] - b[i], Q);
        }
        return result;
    }
    
    private static int[] polyMul(int[] a, int[] b) {
        int[] result = new int[N];
        for (int i = 0; i < N; i++) {
            for (int j = 0; j < N; j++) {
                int idx = i + j;
                int sign = 1;
                if (idx >= N) {
                    idx -= N;
                    sign = -1;  // x^N = -1 in the ring
                }
                result[idx] = mod(result[idx] + sign * a[i] * b[j], Q);
            }
        }
        return result;
    }
    
    private static int[] polyScalar(int[] a, int s) {
        int[] result = new int[N];
        for (int i = 0; i < N; i++) {
            result[i] = mod(a[i] * s, Q);
        }
        return result;
    }
    
    // Vector operations
    
    private static int[][] matrixVecMul(int[][][] A, int[][] s) {
        int[][] result = new int[K][N];
        for (int i = 0; i < K; i++) {
            result[i] = new int[N];
            for (int j = 0; j < K; j++) {
                result[i] = polyAdd(result[i], polyMul(A[i][j], s[j]));
            }
        }
        return result;
    }
    
    private static int[] vectorDot(int[][] a, int[][] b) {
        int[] result = new int[N];
        for (int i = 0; i < K; i++) {
            result = polyAdd(result, polyMul(a[i], b[i]));
        }
        return result;
    }
    
    // Sampling functions
    
    private static int[] samplePoly() {
        int[] poly = new int[N];
        for (int i = 0; i < N; i++) {
            poly[i] = mod(random.nextInt(Q), Q);
        }
        return poly;
    }
    
    private static int[] sampleNoise() {
        int[] poly = new int[N];
        for (int i = 0; i < N; i++) {
            int sum = 0;
            for (int j = 0; j < ETA; j++) {
                sum += random.nextInt(2) - random.nextInt(2);
            }
            poly[i] = mod(sum, Q);
        }
        return poly;
    }
    
    private static int[][] sampleNoiseVector() {
        int[][] vec = new int[K][N];
        for (int i = 0; i < K; i++) {
            vec[i] = sampleNoise();
        }
        return vec;
    }
    
    private static int[][][] expandMatrix(byte[] rho) {
        int[][][] A = new int[K][K][N];
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            for (int i = 0; i < K; i++) {
                for (int j = 0; j < K; j++) {
                    md.reset();
                    md.update(rho);
                    md.update((byte) i);
                    md.update((byte) j);
                    byte[] hash = md.digest();
                    
                    for (int k = 0; k < N; k++) {
                        A[i][j][k] = mod(hash[k % hash.length] & 0xFF, Q);
                    }
                }
            }
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
        return A;
    }
    
    /**
     * Key Generation
     */
    public static KeyPair keyGen() {
        // Generate random seed for matrix A
        byte[] rho = new byte[32];
        random.nextBytes(rho);
        
        // Expand seed to matrix A
        int[][][] A = expandMatrix(rho);
        
        // Sample secret and error vectors
        int[][] s = sampleNoiseVector();
        int[][] e = sampleNoiseVector();
        
        // Compute t = As + e
        int[][] t = matrixVecMul(A, s);
        for (int i = 0; i < K; i++) {
            t[i] = polyAdd(t[i], e[i]);
        }
        
        return new KeyPair(new PublicKey(t, rho), new SecretKey(s));
    }
    
    /**
     * Encapsulation
     */
    public static EncapResult encapsulate(PublicKey pk) {
        // Expand matrix A from seed
        int[][][] A = expandMatrix(pk.rho);
        
        // Sample randomness and noise
        int[][] r = sampleNoiseVector();
        int[][] e1 = sampleNoiseVector();
        int[] e2 = sampleNoise();
        
        // Generate random message
        int[] m = new int[N];
        for (int i = 0; i < N; i++) {
            m[i] = random.nextInt(2);
        }
        
        // Compute u = A^T * r + e1
        int[][] u = new int[K][N];
        for (int i = 0; i < K; i++) {
            u[i] = new int[N];
            for (int j = 0; j < K; j++) {
                u[i] = polyAdd(u[i], polyMul(A[j][i], r[j]));
            }
            u[i] = polyAdd(u[i], e1[i]);
        }
        
        // Compute v = t^T * r + e2 + m * (q/2)
        int[] v = vectorDot(pk.t, r);
        v = polyAdd(v, e2);
        int halfQ = Q / 2;
        for (int i = 0; i < N; i++) {
            v[i] = mod(v[i] + m[i] * halfQ, Q);
        }
        
        // Derive shared secret from message
        byte[] sharedSecret = deriveSecret(m);
        
        return new EncapResult(new Ciphertext(u, v), sharedSecret);
    }
    
    /**
     * Decapsulation
     */
    public static byte[] decapsulate(SecretKey sk, Ciphertext ct) {
        // Compute m' = v - s^T * u
        int[] su = vectorDot(sk.s, ct.u);
        int[] mPrime = polySub(ct.v, su);
        
        // Decode message (threshold at q/2)
        int[] m = new int[N];
        int threshold = Q / 4;
        for (int i = 0; i < N; i++) {
            int val = mPrime[i];
            if (val > Q / 2) val -= Q;
            m[i] = (Math.abs(val - Q / 2) < threshold) ? 1 : 0;
        }
        
        // Derive shared secret from message
        return deriveSecret(m);
    }
    
    private static byte[] deriveSecret(int[] m) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            for (int i = 0; i < N; i++) {
                md.update((byte) m[i]);
            }
            return md.digest();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
