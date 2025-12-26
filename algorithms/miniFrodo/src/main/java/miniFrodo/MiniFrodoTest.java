package miniFrodo;
/*
* CREATED: 02/12/2025
* LAST UPDATED: 26/12/2025
* PURPOSE: Testing for the algorithm MiniFrodo
*/


import java.util.Arrays;

public class MiniFrodoTest {

    public static void main(String[] args) {
        System.out.println("=== MiniFrodo matrix sanity check ===");
        Matrix A = Matrix.randomUniform(MiniFrodo.N, MiniFrodo.N, new java.security.SecureRandom());
        Matrix S = Matrix.randomSmall(MiniFrodo.N, 1, new java.security.SecureRandom());
        Matrix E = Matrix.randomSmall(MiniFrodo.N, 1, new java.security.SecureRandom());

        Matrix B = A.mul(S).add(E);

        System.out.println("A = " + A);
        System.out.println("S = " + S);
        System.out.println("E = " + E);
        System.out.println("B = A*S + E = " + B);

        System.out.println("\n=== MiniFrodo KEM test ===");
        MiniFrodoKeyPair kp = MiniFrodo.keyGen();
        MiniFrodo.EncapsulationResult enc = MiniFrodo.encapsulate(kp);
        byte[] ssDec = MiniFrodo.decapsulate(kp, enc.getCiphertext());

        System.out.println("Ciphertext U: " + enc.getCiphertext().getU());
        System.out.println("Ciphertext V: " + enc.getCiphertext().getV());

        System.out.println("Shared secret (encaps): " + bytesToHex(enc.getSharedSecret()));
        System.out.println("Shared secret (decaps): " + bytesToHex(ssDec));
        System.out.println("Match? " + Arrays.equals(enc.getSharedSecret(), ssDec));
    }

    private static String bytesToHex(byte[] in) {
        StringBuilder sb = new StringBuilder();
        for (byte b : in) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}