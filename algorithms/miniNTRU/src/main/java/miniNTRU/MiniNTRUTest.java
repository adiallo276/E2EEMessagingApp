/*
 * CREATED: 2025
 * PURPOSE: Test class for Mini-NTRU KEM implementation
 */

package miniNTRU;

import java.util.Arrays;

public class MiniNTRUTest {
    
    public static void main(String[] args) {
        System.out.println("=== Mini-NTRU KEM Test ===\n");
        
        // Test parameters
        System.out.println("Parameters:");
        System.out.println("  N (polynomial degree): " + MiniNTRU.N);
        System.out.println("  Q (large modulus): " + MiniNTRU.Q);
        System.out.println("  P (small modulus): " + MiniNTRU.P);
        System.out.println();
        
        // Key generation
        System.out.println("1. Key Generation");
        long startTime = System.nanoTime();
        MiniNTRUKeyPair keyPair = MiniNTRU.keyGen();
        long keyGenTime = System.nanoTime() - startTime;
        
        System.out.println("  Public key h: " + keyPair.getH());
        System.out.println("  Secret key f: " + keyPair.getF());
        System.out.println("  KeyGen time: " + (keyGenTime / 1000.0) + " µs");
        System.out.println();
        
        // Encapsulation
        System.out.println("2. Encapsulation");
        startTime = System.nanoTime();
        MiniNTRU.EncapsulationResult encResult = MiniNTRU.encapsulate(keyPair);
        long encapTime = System.nanoTime() - startTime;
        
        System.out.println("  Ciphertext: " + encResult.getCiphertext());
        System.out.println("  Shared secret (sender): " + bytesToHex(encResult.getSharedSecret()));
        System.out.println("  Encap time: " + (encapTime / 1000.0) + " µs");
        System.out.println();
        
        // Decapsulation
        System.out.println("3. Decapsulation");
        startTime = System.nanoTime();
        byte[] decapSecret = MiniNTRU.decapsulate(keyPair, encResult.getCiphertext());
        long decapTime = System.nanoTime() - startTime;
        
        System.out.println("  Shared secret (receiver): " + bytesToHex(decapSecret));
        System.out.println("  Decap time: " + (decapTime / 1000.0) + " µs");
        System.out.println();
        
        // Verification
        boolean match = Arrays.equals(encResult.getSharedSecret(), decapSecret);
        System.out.println("4. Verification");
        System.out.println("  Secrets match: " + (match ? "✓ YES" : "✗ NO"));
        System.out.println();
        
        // Performance test
        System.out.println("5. Performance Test (100 iterations)");
        int iterations = 100;
        long totalKeyGen = 0, totalEncap = 0, totalDecap = 0;
        int failures = 0;
        
        for (int i = 0; i < iterations; i++) {
            long t1 = System.nanoTime();
            MiniNTRUKeyPair kp = MiniNTRU.keyGen();
            long t2 = System.nanoTime();
            MiniNTRU.EncapsulationResult enc = MiniNTRU.encapsulate(kp);
            long t3 = System.nanoTime();
            byte[] dec = MiniNTRU.decapsulate(kp, enc.getCiphertext());
            long t4 = System.nanoTime();
            
            totalKeyGen += (t2 - t1);
            totalEncap += (t3 - t2);
            totalDecap += (t4 - t3);
            
            if (!Arrays.equals(enc.getSharedSecret(), dec)) {
                failures++;
            }
        }
        
        System.out.println("  Avg KeyGen: " + String.format("%.2f", totalKeyGen / iterations / 1000.0) + " µs");
        System.out.println("  Avg Encap:  " + String.format("%.2f", totalEncap / iterations / 1000.0) + " µs");
        System.out.println("  Avg Decap:  " + String.format("%.2f", totalDecap / iterations / 1000.0) + " µs");
        System.out.println("  Failures:   " + failures + "/" + iterations);
        System.out.println();
        
        System.out.println("=== Test Complete ===");
    }
    
    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < Math.min(8, bytes.length); i++) {
            sb.append(String.format("%02x", bytes[i]));
        }
        if (bytes.length > 8) {
            sb.append("...");
        }
        return sb.toString();
    }
}
