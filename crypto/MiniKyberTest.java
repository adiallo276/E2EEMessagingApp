/*
 * CREATED: 08/11/2025
 * LAST UPDATED 11/11/2025
 * PURPOSE: Used for testing for the algorithms 
 */

package crypto;

public class MiniKyberTest {
        public static void main(String[] args) {
        Polynomial a = Polynomial.randomSmall(8, 3);
        Polynomial b = Polynomial.randomSmall(8, 3);

        System.out.println("a = " + a);
        System.out.println("b = " + b);
        System.out.println("a + b = " + a.add(b));
        System.out.println("a - b = " + a.sub(b));
        System.out.println("a * b = " + a.mul(b));
        MiniKyberKeyPair keyPair = MiniKyber.keyGen();

        System.out.println("=== MiniKyber Key Generation ===");
        System.out.println("Public parameter a: " + keyPair.a);
        System.out.println("Public key t: " + keyPair.t);
        System.out.println("Private key s: " + keyPair.s);
        }
}
