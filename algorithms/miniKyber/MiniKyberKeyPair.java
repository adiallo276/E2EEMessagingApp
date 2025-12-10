/*
 * CREATED: 08/11/2025
 * LAST UPDATED: 09/12/2025
 * PURPOSE: 
 */


package miniKyber;

/*
 * MiniKyber Key Pair holding public (a,t) and private keys (s).
 */

public class MiniKyberKeyPair {
    public final Polynomial a; // This will be the public parameeter (random polynomial A)
    public final Polynomial t; // Public key Component 
    public final Polynomial s; // Private key 

    public MiniKyberKeyPair(Polynomial a, Polynomial t, Polynomial s){
        this.a = a;
        this.t = t;
        this.s = s;
    }

    public Polynomial getA() {
        return a;
    }

    public Polynomial getT() {
        return t;
    }

    public Polynomial getS() {
        return s;
    }
}
