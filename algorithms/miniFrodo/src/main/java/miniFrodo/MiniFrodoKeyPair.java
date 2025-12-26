package miniFrodo;
/*
 * CREATED: 02/12/2025
 * LAST UPDATED: 26/12/2025
 * PURPOSE: Stores MiniFrodo Key Pair (public and private keys)
 */
public class MiniFrodoKeyPair {

    private final Matrix A;
    private final Matrix B;
    private final Matrix S;

    public MiniFrodoKeyPair(Matrix A, Matrix B, Matrix S) {
        this.A = A;
        this.B = B;
        this.S = S;
    }

    public Matrix getA() {
        return A;
    }

    public Matrix getB() {
        return B;
    }

    public Matrix getS() {
        return S;
    }
}