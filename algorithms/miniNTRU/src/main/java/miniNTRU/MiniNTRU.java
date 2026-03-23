/*
 * CREATED: 2025
 * LAST UPDATED: 2025
 * PURPOSE: Mini-NTRU Key Encapsulation Mechanism (KEM)
 * 
 * NTRU is one of the oldest lattice-based cryptosystems, introduced in 1996
 * by Hoffstein, Pipher, and Silverman. It operates in the polynomial ring
 * Z[x]/(x^N - 1), using cyclic convolution.
 * 
 * Key difference from Kyber:
 * - Kyber uses x^N + 1 (negacyclic): x^N = -1
 * - NTRU uses x^N - 1 (cyclic): x^N = 1
 * 
 * WARNING: This is a simplified educational implementation with reduced
 * parameters. NOT suitable for production use.
 */

package miniNTRU;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;

public class MiniNTRU {
    
    public static final int N = Polynomial.N;
    public static final int Q = Polynomial.Q;
    public static final int P = Polynomial.P;
    
    private static final SecureRandom rnd = new SecureRandom();
    
    /**
     * Ciphertext structure
     */
    public static final class Ciphertext {
        private final Polynomial c;
        
        public Ciphertext(Polynomial c) {
            this.c = c;
        }
        
        public Polynomial getC() {
            return c;
        }
        
        @Override
        public String toString() {
            return "Ciphertext{c=" + c + "}";
        }
    }
    
    /**
     * Encapsulation result containing ciphertext and shared secret
     */
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
    
    /**
     * Extended GCD for polynomial inversion
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
        a = ((a % m) + m) % m;
        int[] result = extendedGcd(a, m);
        if (result[0] != 1) return null;
        return ((result[1] % m) + m) % m;
    }
    
    /**
     * Polynomial inverse using extended Euclidean algorithm
     * Returns f^(-1) mod modulus in Z[x]/(x^N - 1)
     */
    private static Polynomial polyInverse(Polynomial f, int modulus) {
        int[] fCoeffs = f.getCoeffs();
        
        // Initialize for extended Euclidean algorithm
        // r0 = x^N - 1 (the ring modulus)
        int[] r0 = new int[N + 1];
        r0[N] = 1;
        r0[0] = modulus - 1;  // -1 mod modulus
        
        // r1 = f
        int[] r1 = new int[N + 1];
        for (int i = 0; i < N; i++) {
            r1[i] = ((fCoeffs[i] % modulus) + modulus) % modulus;
        }
        
        // s0 = 0, s1 = 1
        int[] s0 = new int[N];
        int[] s1 = new int[N];
        s1[0] = 1;
        
        while (true) {
            // Find degree of r1
            int deg1 = -1;
            for (int i = N; i >= 0; i--) {
                if (((r1[i] % modulus) + modulus) % modulus != 0) {
                    deg1 = i;
                    break;
                }
            }
            
            if (deg1 < 0) return null;  // Not invertible
            
            if (deg1 == 0) {
                // r1 is a constant, we're done
                Integer inv = modInverse(r1[0], modulus);
                if (inv == null) return null;
                
                int[] result = new int[N];
                for (int i = 0; i < N; i++) {
                    result[i] = ((s1[i] * inv) % modulus + modulus) % modulus;
                }
                return new Polynomial(result);
            }
            
            // Find degree of r0
            int deg0 = -1;
            for (int i = N; i >= 0; i--) {
                if (((r0[i] % modulus) + modulus) % modulus != 0) {
                    deg0 = i;
                    break;
                }
            }
            
            if (deg0 < deg1) {
                // Swap r0 <-> r1, s0 <-> s1
                int[] temp = r0; r0 = r1; r1 = temp;
                temp = s0; s0 = s1; s1 = temp;
                int t = deg0; deg0 = deg1; deg1 = t;
            }
            
            // Division step
            Integer leadInv = modInverse(r1[deg1], modulus);
            if (leadInv == null) return null;
            
            int shift = deg0 - deg1;
            int coef = ((r0[deg0] * leadInv) % modulus + modulus) % modulus;
            
            // r0 = r0 - coef * x^shift * r1
            for (int i = 0; i <= deg1; i++) {
                r0[i + shift] = ((r0[i + shift] - coef * r1[i]) % modulus + modulus) % modulus;
            }
            
            // s0 = s0 - coef * x^shift * s1 (mod x^N - 1)
            for (int i = 0; i < N; i++) {
                int j = (i + shift) % N;
                s0[j] = ((s0[j] - coef * s1[i]) % modulus + modulus) % modulus;
            }
        }
    }
    
    /**
     * Known invertible polynomials (fallback for key generation)
     */
    private static final int[][] KNOWN_INVERTIBLE = {
        {1, 1, 0, 0, 0, 0, 0},
        {1, 0, 1, 0, 0, 0, 0},
        {1, 0, 0, 1, 0, 0, 0},
        {1, 0, 0, 0, 1, 0, 0},
        {1, 0, 0, 0, 0, 1, 0},
        {1, 1, 1, 0, 0, 0, 0},
    };
    
    /**
     * Key Generation
     * 
     * 1. Generate random ternary f with f(1) != 0 mod q and f invertible mod q and p
     * 2. Generate random ternary g
     * 3. Compute h = p * f^(-1) * g mod q
     */
    public static MiniNTRUKeyPair keyGen() {
        Polynomial f = null;
        Polynomial fq = null;  // f^(-1) mod q
        Polynomial fp = null;  // f^(-1) mod p
        
        // Try random ternary polynomials
        for (int attempt = 0; attempt < 100; attempt++) {
            // Generate ternary with some +1s and -1s
            Polynomial candidate = Polynomial.randomTernary(rnd, 2, 2);
            
            // Ensure constant term is 1 for better invertibility
            int[] coeffs = candidate.getCoeffs();
            coeffs[0] = (coeffs[0] + 1) % Q;
            candidate = new Polynomial(coeffs);
            
            Polynomial invQ = polyInverse(candidate, Q);
            Polynomial invP = polyInverse(candidate, P);
            
            if (invQ != null && invP != null) {
                f = candidate;
                fq = invQ;
                fp = invP;
                break;
            }
        }
        
        // Fallback to known invertible polynomials
        if (f == null) {
            for (int[] coeffs : KNOWN_INVERTIBLE) {
                Polynomial candidate = new Polynomial(coeffs);
                Polynomial invQ = polyInverse(candidate, Q);
                Polynomial invP = polyInverse(candidate, P);
                
                if (invQ != null && invP != null) {
                    f = candidate;
                    fq = invQ;
                    fp = invP;
                    break;
                }
            }
        }
        
        if (f == null) {
            throw new RuntimeException("Failed to generate invertible f");
        }
        
        // Generate random ternary g
        Polynomial g = Polynomial.randomTernary(rnd, 2, 2);
        
        // h = p * fq * g mod q
        Polynomial pFq = fq.scalarMul(P);
        Polynomial h = pFq.mul(g);
        
        return new MiniNTRUKeyPair(h, f, fp, g);
    }
    
    /**
     * Encapsulation
     * 
     * 1. Generate random blinding polynomial r
     * 2. Generate random message polynomial m (ternary)
     * 3. Compute c = r * h + m mod q
     * 4. Shared secret = H(m)
     */
    public static EncapsulationResult encapsulate(MiniNTRUKeyPair keyPair) {
        Polynomial h = keyPair.getH();
        
        // Random blinding polynomial r
        Polynomial r = Polynomial.randomTernary(rnd, 2, 2);
        
        // Random message polynomial m (ternary)
        Polynomial m = Polynomial.randomTernary(rnd, 2, 2);
        
        // c = r * h + m mod q
        Polynomial rh = r.mul(h);
        Polynomial c = rh.add(m);
        
        // Shared secret = H(m)
        byte[] sharedSecret = deriveSharedSecret(m);
        
        return new EncapsulationResult(new Ciphertext(c), sharedSecret);
    }
    
    /**
     * Decapsulation
     * 
     * 1. Compute a = f * c mod q
     * 2. Center-lift a and reduce mod p
     * 3. Compute m' = fp * a mod p
     * 4. Shared secret = H(m')
     */
    public static byte[] decapsulate(MiniNTRUKeyPair keyPair, Ciphertext ct) {
        Polynomial f = keyPair.getF();
        Polynomial fp = keyPair.getFp();
        
        // a = f * c mod q
        Polynomial a = f.mul(ct.getC());
        
        // Center-lift a and reduce mod p
        int[] aCentered = a.centerLift();
        int[] aModP = new int[N];
        for (int i = 0; i < N; i++) {
            aModP[i] = ((aCentered[i] % P) + P) % P;
        }
        Polynomial aP = new Polynomial(aModP);
        
        // m' = fp * a mod p
        Polynomial mPrime = fp.mulModP(aP);
        
        // Center-lift m' to get coefficients in {-1, 0, 1}
        int[] mCoeffs = new int[N];
        for (int i = 0; i < N; i++) {
            mCoeffs[i] = Polynomial.centerMod(mPrime.getCoeffs()[i], P);
        }
        Polynomial m = new Polynomial(mCoeffs);
        
        // Shared secret = H(m')
        return deriveSharedSecret(m);
    }
    
    /**
     * Derive shared secret using SHA-256
     */
    private static byte[] deriveSharedSecret(Polynomial m) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(m.toBytes());
            return md.digest();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
