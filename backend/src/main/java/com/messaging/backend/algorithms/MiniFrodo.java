package com.messaging.backend.algorithms;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;

/**
 * MiniFrodo - Educational Standard LWE based Key Encapsulation Mechanism
 * 
 * WARNING: This is a simplified educational implementation with reduced parameters.
 * NOT suitable for production use. Real FrodoKEM uses much larger parameters.
 * 
 * Based on the plain Learning With Errors problem (not ring-based).
 */
public class MiniFrodo {
    
    // Simplified parameters for educational purposes
    private static final int N = 8;           // Matrix dimension
    private static final int N_BAR = 2;       // Number of columns in B
    private static final int Q = 97;          // Prime modulus
    private static final int LOG_Q = 7;       // Bits for Q
    private static final double SIGMA = 1.5;  // Noise standard deviation
    
    private static final SecureRandom random = new SecureRandom();
    
    /**
     * Public Key structure
     */
    public static class PublicKey {
        public final byte[] seedA;   // Seed for matrix A
        public final int[][] B;      // Public matrix B = AS + E
        
        public PublicKey(byte[] seedA, int[][] B) {
            this.seedA = seedA;
            this.B = B;
        }
    }
    
    /**
     * Secret Key structure
     */
    public static class SecretKey {
        public final int[][] S;      // Secret matrix
        
        public SecretKey(int[][] S) {
            this.S = S;
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
        public final int[][] C1;     // C1 = S' * A + E'
        public final int[][] C2;     // C2 = S' * B + E'' + encode(mu)
        
        public Ciphertext(int[][] C1, int[][] C2) {
            this.C1 = C1;
            this.C2 = C2;
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
    
    // Helper functions
    
    private static int mod(int x, int m) {
        return ((x % m) + m) % m;
    }
    
    private static int[][] expandA(byte[] seedA) {
        int[][] A = new int[N][N];
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            for (int i = 0; i < N; i++) {
                for (int j = 0; j < N; j++) {
                    md.reset();
                    md.update(seedA);
                    md.update((byte) i);
                    md.update((byte) j);
                    byte[] hash = md.digest();
                    A[i][j] = mod(hash[0] & 0xFF, Q);
                }
            }
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
        return A;
    }
    
    private static int sampleNoise() {
        // Sample from discrete Gaussian (simplified)
        double u1 = random.nextDouble();
        double u2 = random.nextDouble();
        double z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return (int) Math.round(z * SIGMA);
    }
    
    private static int[][] sampleNoiseMatrix(int rows, int cols) {
        int[][] E = new int[rows][cols];
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                E[i][j] = mod(sampleNoise(), Q);
            }
        }
        return E;
    }
    
    private static int[][] matrixMul(int[][] A, int[][] B, int aRows, int aCols, int bCols) {
        int[][] C = new int[aRows][bCols];
        for (int i = 0; i < aRows; i++) {
            for (int j = 0; j < bCols; j++) {
                int sum = 0;
                for (int k = 0; k < aCols; k++) {
                    sum += A[i][k] * B[k][j];
                }
                C[i][j] = mod(sum, Q);
            }
        }
        return C;
    }
    
    private static int[][] matrixAdd(int[][] A, int[][] B, int rows, int cols) {
        int[][] C = new int[rows][cols];
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                C[i][j] = mod(A[i][j] + B[i][j], Q);
            }
        }
        return C;
    }
    
    private static int[][] matrixSub(int[][] A, int[][] B, int rows, int cols) {
        int[][] C = new int[rows][cols];
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                C[i][j] = mod(A[i][j] - B[i][j], Q);
            }
        }
        return C;
    }
    
    /**
     * Key Generation
     */
    public static KeyPair keyGen() {
        // Generate random seed for A
        byte[] seedA = new byte[16];
        random.nextBytes(seedA);
        
        // Expand A from seed
        int[][] A = expandA(seedA);
        
        // Sample secret matrix S
        int[][] S = sampleNoiseMatrix(N, N_BAR);
        
        // Sample error matrix E
        int[][] E = sampleNoiseMatrix(N, N_BAR);
        
        // Compute B = A * S + E
        int[][] AS = matrixMul(A, S, N, N, N_BAR);
        int[][] B = matrixAdd(AS, E, N, N_BAR);
        
        return new KeyPair(new PublicKey(seedA, B), new SecretKey(S));
    }
    
    /**
     * Encapsulation
     */
    public static EncapResult encapsulate(PublicKey pk) {
        // Expand A from seed
        int[][] A = expandA(pk.seedA);
        
        // Sample S', E', E''
        int[][] Sp = sampleNoiseMatrix(N_BAR, N);
        int[][] Ep = sampleNoiseMatrix(N_BAR, N);
        int[][] Epp = sampleNoiseMatrix(N_BAR, N_BAR);
        
        // Generate random message
        int[][] mu = new int[N_BAR][N_BAR];
        for (int i = 0; i < N_BAR; i++) {
            for (int j = 0; j < N_BAR; j++) {
                mu[i][j] = random.nextInt(2);
            }
        }
        
        // Encode message: scale by q/2
        int[][] encodedMu = new int[N_BAR][N_BAR];
        int halfQ = Q / 2;
        for (int i = 0; i < N_BAR; i++) {
            for (int j = 0; j < N_BAR; j++) {
                encodedMu[i][j] = mu[i][j] * halfQ;
            }
        }
        
        // C1 = S' * A + E'
        int[][] SpA = matrixMul(Sp, A, N_BAR, N, N);
        int[][] C1 = matrixAdd(SpA, Ep, N_BAR, N);
        
        // C2 = S' * B + E'' + encode(mu)
        int[][] SpB = matrixMul(Sp, pk.B, N_BAR, N, N_BAR);
        int[][] temp = matrixAdd(SpB, Epp, N_BAR, N_BAR);
        int[][] C2 = matrixAdd(temp, encodedMu, N_BAR, N_BAR);
        
        // Derive shared secret from message
        byte[] sharedSecret = deriveSecret(mu);
        
        return new EncapResult(new Ciphertext(C1, C2), sharedSecret);
    }
    
    /**
     * Decapsulation
     */
    public static byte[] decapsulate(SecretKey sk, Ciphertext ct) {
        // Compute M = C2 - C1 * S
        int[][] C1S = matrixMul(ct.C1, sk.S, N_BAR, N, N_BAR);
        int[][] M = matrixSub(ct.C2, C1S, N_BAR, N_BAR);
        
        // Decode message
        int[][] mu = new int[N_BAR][N_BAR];
        int threshold = Q / 4;
        for (int i = 0; i < N_BAR; i++) {
            for (int j = 0; j < N_BAR; j++) {
                int val = M[i][j];
                if (val > Q / 2) val -= Q;
                mu[i][j] = (Math.abs(val) > threshold) ? 1 : 0;
            }
        }
        
        // Derive shared secret from message
        return deriveSecret(mu);
    }
    
    private static byte[] deriveSecret(int[][] mu) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            for (int i = 0; i < N_BAR; i++) {
                for (int j = 0; j < N_BAR; j++) {
                    md.update((byte) mu[i][j]);
                }
            }
            return md.digest();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
