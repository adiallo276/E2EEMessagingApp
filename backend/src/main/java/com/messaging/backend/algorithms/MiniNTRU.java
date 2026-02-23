package com.messaging.backend.algorithms;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * MiniNTRU - Educational NTRU-like Key Encapsulation Mechanism
 * 
 * WARNING: This is a simplified educational implementation with reduced parameters.
 * NOT suitable for production use. Real NTRU uses much larger parameters.
 * 
 * NTRU is based on the hardness of finding short vectors in certain lattices,
 * using polynomial multiplication in a quotient ring Z[x]/(x^n - 1).
 */
public class MiniNTRU {
    
    // Simplified parameters for educational purposes
    private static final int N = 7;           // Polynomial degree (prime)
    private static final int Q = 128;         // Large modulus (power of 2)
    private static final int P = 3;           // Small modulus for message encoding
    
    private static final SecureRandom random = new SecureRandom();
    
    /**
     * Public Key structure
     */
    public static class PublicKey {
        public final int[] h;    // Public polynomial h = p * f_inv * g mod q
        
        public PublicKey(int[] h) {
            this.h = h;
        }
    }
    
    /**
     * Secret Key structure
     */
    public static class SecretKey {
        public final int[] f;    // Secret polynomial f
        public final int[] fp;   // Inverse of f mod p
        public final int[] fq;   // Inverse of f mod q
        
        public SecretKey(int[] f, int[] fp, int[] fq) {
            this.f = f;
            this.fp = fp;
            this.fq = fq;
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
        public final int[] c;    // Ciphertext polynomial
        
        public Ciphertext(int[] c) {
            this.c = c;
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
    
    private static int centerMod(int x, int m) {
        int r = mod(x, m);
        return r > m / 2 ? r - m : r;
    }
    
    /**
     * Convolution multiplication in Z[x]/(x^n - 1) mod m
     */
    private static int[] polyConvMul(int[] a, int[] b, int modulus) {
        int[] result = new int[N];
        for (int i = 0; i < N; i++) {
            for (int j = 0; j < N; j++) {
                int k = (i + j) % N;
                result[k] = mod(result[k] + a[i] * b[j], modulus);
            }
        }
        return result;
    }
    
    /**
     * Polynomial addition mod m
     */
    private static int[] polyAdd(int[] a, int[] b, int modulus) {
        int[] result = new int[N];
        for (int i = 0; i < N; i++) {
            result[i] = mod(a[i] + b[i], modulus);
        }
        return result;
    }
    
    /**
     * Scalar multiplication mod m
     */
    private static int[] polyScalarMul(int[] a, int s, int modulus) {
        int[] result = new int[N];
        for (int i = 0; i < N; i++) {
            result[i] = mod(a[i] * s, modulus);
        }
        return result;
    }
    
    /**
     * Extended GCD for integers
     */
    private static int[] extendedGcd(int a, int b) {
        if (b == 0) {
            return new int[]{a, 1, 0};
        }
        int[] result = extendedGcd(b, a % b);
        int gcd = result[0];
        int x = result[2];
        int y = result[1] - (a / b) * result[2];
        return new int[]{gcd, x, y};
    }
    
    /**
     * Modular inverse for integers
     */
    private static Integer modInverse(int a, int m) {
        int[] result = extendedGcd(mod(a, m), m);
        if (result[0] != 1) return null;
        return mod(result[1], m);
    }
    
    /**
     * Polynomial inverse using extended Euclidean algorithm
     */
    private static int[] polyInverse(int[] f, int modulus) {
        // Initialize for extended Euclidean algorithm
        int[] r0 = new int[N + 1];
        r0[N] = 1;
        r0[0] = mod(-1, modulus);  // x^n - 1
        
        int[] r1 = new int[N + 1];
        System.arraycopy(f, 0, r1, 0, N);
        
        int[] s0 = new int[N];
        int[] s1 = new int[N];
        s1[0] = 1;
        
        while (true) {
            // Find degree of r1
            int deg1 = -1;
            for (int i = N; i >= 0; i--) {
                if (mod(r1[i], modulus) != 0) {
                    deg1 = i;
                    break;
                }
            }
            
            if (deg1 < 0) return null;  // Not invertible
            
            if (deg1 == 0) {
                // r1 is a constant
                Integer inv = modInverse(r1[0], modulus);
                if (inv == null) return null;
                
                int[] result = new int[N];
                for (int i = 0; i < N; i++) {
                    result[i] = mod(s1[i] * inv, modulus);
                }
                return result;
            }
            
            // Find degree of r0
            int deg0 = -1;
            for (int i = N; i >= 0; i--) {
                if (mod(r0[i], modulus) != 0) {
                    deg0 = i;
                    break;
                }
            }
            
            if (deg0 < deg1) {
                // Swap
                int[] temp = r0; r0 = r1; r1 = temp;
                temp = s0; s0 = s1; s1 = temp;
                int t = deg0; deg0 = deg1; deg1 = t;
            }
            
            // Division step
            Integer leadInv = modInverse(r1[deg1], modulus);
            if (leadInv == null) return null;
            
            int shift = deg0 - deg1;
            int coef = mod(r0[deg0] * leadInv, modulus);
            
            // r0 = r0 - coef * x^shift * r1
            for (int i = 0; i <= deg1; i++) {
                r0[i + shift] = mod(r0[i + shift] - coef * r1[i], modulus);
            }
            
            // s0 = s0 - coef * x^shift * s1
            for (int i = 0; i < N; i++) {
                int j = (i + shift) % N;
                s0[j] = mod(s0[j] - coef * s1[i], modulus);
            }
        }
    }
    
    /**
     * Generate random ternary polynomial with specified number of +1s and -1s
     */
    private static int[] randomTernary(int numOnes, int numNegOnes) {
        int[] poly = new int[N];
        List<Integer> positions = new ArrayList<>();
        for (int i = 0; i < N; i++) {
            positions.add(i);
        }
        Collections.shuffle(positions, random);
        
        for (int i = 0; i < numOnes && i < N; i++) {
            poly[positions.get(i)] = 1;
        }
        for (int i = numOnes; i < numOnes + numNegOnes && i < N; i++) {
            poly[positions.get(i)] = mod(-1, Q);
        }
        
        return poly;
    }
    
    // Pre-verified invertible f polynomials
    private static final int[][] KNOWN_GOOD_F = {
        {1, 1, 0, 0, 0, 0, 0},
        {1, 0, 1, 0, 0, 0, 0},
        {1, 0, 0, 1, 0, 0, 0},
        {1, 0, 0, 0, 1, 0, 0},
        {1, 0, 0, 0, 0, 1, 0},
        {1, 0, 0, 0, 0, 0, 1},
        {1, 1, 1, 0, 0, 0, 0},
        {1, 1, 0, 1, 0, 0, 0},
    };
    
    /**
     * Key Generation
     */
    public static KeyPair keyGen() {
        int[] f = null;
        int[] fq = null;
        int[] fp = null;
        
        // Try random polynomials first
        for (int attempt = 0; attempt < 100; attempt++) {
            int[] candidate = randomTernary(2, 2);
            candidate[0] = mod(candidate[0] + 1, Q);  // Ensure f(0) = 1 mod q
            
            int[] invQ = polyInverse(candidate, Q);
            int[] invP = polyInverse(candidate, P);
            
            if (invQ != null && invP != null) {
                f = candidate;
                fq = invQ;
                fp = invP;
                break;
            }
        }
        
        // Fall back to known good polynomials
        if (f == null) {
            for (int[] candidate : KNOWN_GOOD_F) {
                int[] invQ = polyInverse(candidate, Q);
                int[] invP = polyInverse(candidate, P);
                
                if (invQ != null && invP != null) {
                    f = candidate.clone();
                    fq = invQ;
                    fp = invP;
                    break;
                }
            }
        }
        
        if (f == null) {
            throw new RuntimeException("Failed to generate invertible f");
        }
        
        // Generate small random g
        int[] g = randomTernary(2, 2);
        
        // h = p * fq * g mod q
        int[] pFq = polyScalarMul(fq, P, Q);
        int[] h = polyConvMul(pFq, g, Q);
        
        return new KeyPair(new PublicKey(h), new SecretKey(f, fp, fq));
    }
    
    /**
     * Encapsulation
     */
    public static EncapResult encapsulate(PublicKey pk) {
        // Random blinding polynomial r
        int[] r = randomTernary(2, 2);
        
        // Random message polynomial m (coefficients in {-1, 0, 1})
        int[] m = randomTernary(2, 2);
        
        // c = r * h + m mod q
        int[] rh = polyConvMul(r, pk.h, Q);
        int[] c = polyAdd(rh, m, Q);
        
        // Shared secret = H(m)
        byte[] sharedSecret = deriveSecret(m);
        
        return new EncapResult(new Ciphertext(c), sharedSecret);
    }
    
    /**
     * Decapsulation
     */
    public static byte[] decapsulate(SecretKey sk, Ciphertext ct) {
        // a = f * c mod q
        int[] a = polyConvMul(sk.f, ct.c, Q);
        
        // Center a to get values in range (-q/2, q/2]
        int[] aCentered = new int[N];
        for (int i = 0; i < N; i++) {
            aCentered[i] = centerMod(a[i], Q);
        }
        
        // Reduce mod p
        int[] aModP = new int[N];
        for (int i = 0; i < N; i++) {
            aModP[i] = mod(aCentered[i], P);
        }
        
        // m' = fp * a mod p
        int[] mPrime = polyConvMul(sk.fp, aModP, P);
        
        // Center m' to get coefficients in {-1, 0, 1}
        int[] m = new int[N];
        for (int i = 0; i < N; i++) {
            m[i] = centerMod(mPrime[i], P);
        }
        
        // Shared secret = H(m')
        return deriveSecret(m);
    }
    
    private static byte[] deriveSecret(int[] m) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            for (int i = 0; i < N; i++) {
                md.update((byte) mod(m[i] + 128, 256));
            }
            return md.digest();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
