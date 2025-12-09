/*
 * CREATED: 09/12/2025
 * LAST UPDATED: 
 * PURPOSE: Used for testing for the algorithms 
 */

package crypto;

import java.util.Arrays;

public class MiniKyberTest {

    public static void main(String[] args) {
        // ---- 1. Polynomial sanity test (like you had before) ----
        int[] aCoeffs = {-1, 3, -3, -2, -3, 3, 3, -3};
        int[] bCoeffs = { 1, 3,  0, -2, -2, 3, 0, -3};

        Polynomial a = new Polynomial(aCoeffs);
        Polynomial b = new Polynomial(bCoeffs);

        Polynomial sum = a.add(b);
        Polynomial diff = a.sub(b);
        Polynomial prod = a.mul(b);

        System.out.println("a = " + Arrays.toString(a.getCoeffs()));
        System.out.println("b = " + Arrays.toString(b.getCoeffs()));
        System.out.println("a + b = " + Arrays.toString(sum.getCoeffs()));
        System.out.println("a - b = " + Arrays.toString(diff.getCoeffs()));
        System.out.println("a * b = " + Arrays.toString(prod.getCoeffs()));

        // ---- 2. MiniKyber KEM test ----
        System.out.println("\n=== MiniKyber KEM test ===");

        MiniKyberKeyPair keyPair = MiniKyber.keyGen();
        MiniKyber.EncapsulationResult enc = MiniKyber.encapsulate(keyPair);
        byte[] sharedEnc = enc.getSharedSecret();

        byte[] sharedDec = MiniKyber.decapsulate(keyPair, enc.getCiphertext());

        System.out.println("Ciphertext u: " + enc.getCiphertext().getU());
        System.out.println("Ciphertext v: " + enc.getCiphertext().getV());
        System.out.println("Shared secret (encaps): " + bytesToHex(sharedEnc));
        System.out.println("Shared secret (decaps): " + bytesToHex(sharedDec));
        System.out.println("Match? " + Arrays.equals(sharedEnc, sharedDec));
    }

    private static String bytesToHex(byte[] data) {
        StringBuilder sb = new StringBuilder();
        for (byte b : data) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
