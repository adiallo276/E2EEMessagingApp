/*
 * CREATED: 08/11/2025
 * LAST UPDATED: 11/11/2025
 * PURPOSE: 
 */


package crypto;

public class MiniKyberKeyPair {
    public final Polynomial a; // This will be the public parameeter (random polynomial A)
    public final Polynomial t; // Public key Component 
    public final Polynomial s; // Private key 

    public MiniKyberKeyPair(Polynomial a, Polynomial t, Polynomial s){
        this.a = a;
        this.t = t;
        this.s = s;
    }
}
