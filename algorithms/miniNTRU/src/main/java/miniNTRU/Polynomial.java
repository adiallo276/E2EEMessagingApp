/*
 * CREATED: 2025
 * PURPOSE: Polynomial operations for NTRU in the ring Z[x]/(x^N - 1)
 * 
 * Unlike Kyber which uses negacyclic convolution (x^N + 1), NTRU uses
 * cyclic convolution (x^N - 1), meaning x^N = 1 instead of x^N = -1.
 */

package miniNTRU;

import java.security.SecureRandom;
import java.util.Arrays;

public class Polynomial {
    
    // NTRU parameters (reduced for educational purposes)
    public static final int N = 7;      // Polynomial degree (prime for NTRU)
    public static final int Q = 128;    // Large modulus (power of 2)
    public static final int P = 3;      // Small modulus for message encoding
    
    private final int[] coeffs;
    
    public Polynomial(int[] coeffs) {
        this.coeffs = new int[N];
        for (int i = 0; i < N && i < coeffs.length; i++) {
            this.coeffs[i] = mod(coeffs[i], Q);
        }
    }
    
    public int[] getCoeffs() {
        return coeffs.clone();
    }
    
    /**
     * Proper modulo operation (always returns non-negative)
     */
    private static int mod(int x, int m) {
        return ((x % m) + m) % m;
    }
    
    /**
     * Center-lift: maps values to range (-m/2, m/2]
     */
    public static int centerMod(int x, int m) {
        int r = mod(x, m);
        return r > m / 2 ? r - m : r;
    }
    
    /**
     * Cyclic convolution multiplication in Z[x]/(x^N - 1)
     * In this ring, x^N = 1 (cyclic, not negacyclic)
     */
    public Polynomial mul(Polynomial other) {
        int[] result = new int[N];
        for (int i = 0; i < N; i++) {
            for (int j = 0; j < N; j++) {
                int k = (i + j) % N;  // Cyclic: x^N = 1
                result[k] = mod(result[k] + this.coeffs[i] * other.coeffs[j], Q);
            }
        }
        return new Polynomial(result);
    }
    
    /**
     * Multiplication mod p (for decryption)
     */
    public Polynomial mulModP(Polynomial other) {
        int[] result = new int[N];
        for (int i = 0; i < N; i++) {
            for (int j = 0; j < N; j++) {
                int k = (i + j) % N;
                result[k] = mod(result[k] + this.coeffs[i] * other.coeffs[j], P);
            }
        }
        // Store as mod P values
        int[] finalResult = new int[N];
        for (int i = 0; i < N; i++) {
            finalResult[i] = mod(result[i], P);
        }
        return new Polynomial(finalResult);
    }
    
    /**
     * Addition mod Q
     */
    public Polynomial add(Polynomial other) {
        int[] result = new int[N];
        for (int i = 0; i < N; i++) {
            result[i] = mod(this.coeffs[i] + other.coeffs[i], Q);
        }
        return new Polynomial(result);
    }
    
    /**
     * Scalar multiplication mod Q
     */
    public Polynomial scalarMul(int scalar) {
        int[] result = new int[N];
        for (int i = 0; i < N; i++) {
            result[i] = mod(this.coeffs[i] * scalar, Q);
        }
        return new Polynomial(result);
    }
    
    /**
     * Generate random ternary polynomial with d1 ones and d2 negative ones
     */
    public static Polynomial randomTernary(SecureRandom rnd, int d1, int d2) {
        int[] coeffs = new int[N];
        
        // Create list of positions and shuffle
        Integer[] positions = new Integer[N];
        for (int i = 0; i < N; i++) {
            positions[i] = i;
        }
        
        // Fisher-Yates shuffle
        for (int i = N - 1; i > 0; i--) {
            int j = rnd.nextInt(i + 1);
            Integer temp = positions[i];
            positions[i] = positions[j];
            positions[j] = temp;
        }
        
        // Place d1 ones
        for (int i = 0; i < d1 && i < N; i++) {
            coeffs[positions[i]] = 1;
        }
        
        // Place d2 negative ones (stored as Q-1 in mod Q)
        for (int i = d1; i < d1 + d2 && i < N; i++) {
            coeffs[positions[i]] = Q - 1;  // -1 mod Q
        }
        
        return new Polynomial(coeffs);
    }
    
    /**
     * Generate random uniform polynomial mod Q
     */
    public static Polynomial randomUniform(SecureRandom rnd) {
        int[] coeffs = new int[N];
        for (int i = 0; i < N; i++) {
            coeffs[i] = rnd.nextInt(Q);
        }
        return new Polynomial(coeffs);
    }
    
    /**
     * Center-lift all coefficients
     */
    public int[] centerLift() {
        int[] result = new int[N];
        for (int i = 0; i < N; i++) {
            result[i] = centerMod(this.coeffs[i], Q);
        }
        return result;
    }
    
    /**
     * Reduce coefficients mod p
     */
    public Polynomial modP() {
        int[] result = new int[N];
        for (int i = 0; i < N; i++) {
            result[i] = mod(centerMod(this.coeffs[i], Q), P);
        }
        return new Polynomial(result);
    }
    
    /**
     * Convert to byte array for hashing
     */
    public byte[] toBytes() {
        byte[] result = new byte[N];
        for (int i = 0; i < N; i++) {
            result[i] = (byte) mod(coeffs[i], 256);
        }
        return result;
    }
    
    @Override
    public String toString() {
        return "Polynomial" + Arrays.toString(coeffs);
    }
    
    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (!(obj instanceof Polynomial)) return false;
        Polynomial other = (Polynomial) obj;
        return Arrays.equals(this.coeffs, other.coeffs);
    }
    
    @Override
    public int hashCode() {
        return Arrays.hashCode(coeffs);
    }
}
