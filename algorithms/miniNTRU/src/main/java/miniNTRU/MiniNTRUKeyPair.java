/*
 * CREATED: 2025
 * PURPOSE: Key pair structure for Mini-NTRU algorithm
 */

package miniNTRU;

public class MiniNTRUKeyPair {
    
    private final Polynomial h;     // Public key: h = p * f^(-1) * g mod q
    private final Polynomial f;     // Secret key: f
    private final Polynomial fp;    // f^(-1) mod p (for decryption)
    private final Polynomial g;     // Random polynomial g (kept for verification)
    
    public MiniNTRUKeyPair(Polynomial h, Polynomial f, Polynomial fp, Polynomial g) {
        this.h = h;
        this.f = f;
        this.fp = fp;
        this.g = g;
    }
    
    // Public key accessor
    public Polynomial getH() {
        return h;
    }
    
    // Secret key accessors
    public Polynomial getF() {
        return f;
    }
    
    public Polynomial getFp() {
        return fp;
    }
    
    public Polynomial getG() {
        return g;
    }
    
    @Override
    public String toString() {
        return "MiniNTRUKeyPair{h=" + h + ", f=" + f + "}";
    }
}
