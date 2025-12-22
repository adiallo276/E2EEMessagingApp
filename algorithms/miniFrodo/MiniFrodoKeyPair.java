/*
 * CREATED: 02/12/2025
 * LAST UPDATED: 22/12/2025
 * PURPOSE: Key pair for MiniFrodo.
 */

package miniFrodo;
import java.security.SecureRandom;
import java.util.Arrays;

/**
 * Small integer matrix over Z_q with q = 257.
 * This is a toy helper class for MiniFrodo.
 */
public class Matrix {

    public static final int Q = 257;

    private final int rows;
    private final int cols;
    private final int[][] data;

    public Matrix(int rows, int cols) {
        this.rows = rows;
        this.cols = cols;
        this.data = new int[rows][cols];
    }

    public Matrix(int[][] data) {
        this.rows = data.length;
        this.cols = data[0].length;
        this.data = new int[rows][cols];
        for (int i = 0; i < rows; i++) {
            if (data[i].length != cols) {
                throw new IllegalArgumentException("Jagged matrix not allowed");
            }
            System.arraycopy(data[i], 0, this.data[i], 0, cols);
        }
    }

    public int getRows() {
        return rows;
    }

    public int getCols() {
        return cols;
    }

    public int get(int r, int c) {
        return data[r][c];
    }

    public void set(int r, int c, int value) {
        data[r][c] = modQ(value);
    }

    private static int modQ(int x) {
        int r = x % Q;
        return r < 0 ? r + Q : r;
    }

    public Matrix add(Matrix other) {
        if (rows != other.rows || cols != other.cols) {
            throw new IllegalArgumentException("Dimension mismatch in add");
        }
        Matrix res = new Matrix(rows, cols);
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                res.data[i][j] = modQ(this.data[i][j] + other.data[i][j]);
            }
        }
        return res;
    }

    public Matrix sub(Matrix other) {
        if (rows != other.rows || cols != other.cols) {
            throw new IllegalArgumentException("Dimension mismatch in sub");
        }
        Matrix res = new Matrix(rows, cols);
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                res.data[i][j] = modQ(this.data[i][j] - other.data[i][j]);
            }
        }
        return res;
    }

    public Matrix mul(Matrix other) {
        if (this.cols != other.rows) {
            throw new IllegalArgumentException("Dimension mismatch in mul");
        }
        Matrix res = new Matrix(this.rows, other.cols);
        for (int i = 0; i < this.rows; i++) {
            for (int j = 0; j < other.cols; j++) {
                long sum = 0;
                for (int k = 0; k < this.cols; k++) {
                    sum += (long) this.data[i][k] * other.data[k][j];
                }
                res.data[i][j] = modQ((int) sum);
            }
        }
        return res;
    }

    public Matrix transpose() {
        Matrix res = new Matrix(cols, rows);
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                res.data[j][i] = this.data[i][j];
            }
        }
        return res;
    }

    /**
     * Sample a matrix with entries uniform in [0, Q).
     */
    public static Matrix randomUniform(int rows, int cols, SecureRandom rnd) {
        Matrix m = new Matrix(rows, cols);
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                m.data[i][j] = rnd.nextInt(Q);
            }
        }
        return m;
    }

    /**
     * Sample a "small" matrix with entries from {-1, 0, 1}.
     */
    public static Matrix randomSmall(int rows, int cols, SecureRandom rnd) {
        Matrix m = new Matrix(rows, cols);
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                int r = rnd.nextInt(3) - 1; // -1, 0, 1
                m.data[i][j] = modQ(r);
            }
        }
        return m;
    }

    /**
     * Serialize entries in row-major order, 2 bytes per entry (little-endian).
     * Only used for hashing to derive shared secrets.
     */
    public byte[] toBytes() {
        byte[] out = new byte[rows * cols * 2];
        int idx = 0;
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                int v = modQ(data[i][j]);
                out[idx++] = (byte) (v & 0xFF);
                out[idx++] = (byte) ((v >>> 8) & 0xFF);
            }
        }
        return out;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < rows; i++) {
            if (i > 0) sb.append(" ; ");
            sb.append(Arrays.toString(data[i]));
        }
        sb.append("]");
        return sb.toString();
    }
}