/* 
* CREATED 08/11/2025
* LAST UPDATED 11/11/2025
* PURPOSE: Performs operations like addition, subtraction, and multiplications of polynomials. Mathematical foundation for Kyber
*/
package crypto;

import java.util.Arrays;
import java.util.Random;

public class Polynomial {
    private static final int Q = 3329; 
    private final int n;               
    private final int[] coeffs;        

    public Polynomial(int n) {
        this.n = n;
        this.coeffs = new int[n];
    }
    
    public static Polynomial constant(int c) {
    int[] coeffs = new int[8];
    for (int i = 0; i < 8; i++) coeffs[i] = c;
    return new Polynomial(coeffs);
}

    public Polynomial(int[] coeffs) {
        this.n = coeffs.length;
        this.coeffs = Arrays.copyOf(coeffs, coeffs.length);
    }

    public static Polynomial randomSmall(int n, int bound) {
        Random rand = new Random();
        int[] coeffs = new int[n];
        for (int i = 0; i < n; i++) {
            coeffs[i] = rand.nextInt(2 * bound + 1) - bound; 
        }
        return new Polynomial(coeffs);
    }

    public Polynomial add(Polynomial other) {
        int[] result = new int[n];
        for (int i = 0; i < n; i++) {
            result[i] = mod(coeffs[i] + other.coeffs[i]);
        }
        return new Polynomial(result);
    }

    public Polynomial sub(Polynomial other) {
        int[] result = new int[n];
        for (int i = 0; i < n; i++) {
            result[i] = mod(coeffs[i] - other.coeffs[i]);
        }
        return new Polynomial(result);
    }

    public Polynomial mul(Polynomial other) {
        int[] result = new int[n];
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                int index = (i + j) % n; 
                result[index] = mod(result[index] + coeffs[i] * other.coeffs[j]);
            }
        }
        return new Polynomial(result);
    }

    private int mod(int x) {
        int r = x % Q;
        return (r < 0) ? r + Q : r;
    }

    @Override
    public String toString() {
        return Arrays.toString(coeffs);
    }

    public int[] getCoeffs() {
        return coeffs;
    }

    public static int getModulus() {
        return Q;
    }
}
