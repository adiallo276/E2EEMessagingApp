package miniFrodo;

/**
 * Key pair for MiniFrodo:
 *  - A: public matrix (n x n)
 *  - B: public matrix (n x 1)
 *  - S: secret matrix (n x 1)
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