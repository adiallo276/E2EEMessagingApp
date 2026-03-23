package com.messaging.backend.pqc;

import miniKyber.MiniKyber;
import miniKyber.MiniKyberKeyPair;
import miniKyber.Polynomial;
import miniFrodo.Matrix;
import miniFrodo.MiniFrodo;
import miniFrodo.MiniFrodoKeyPair;
import org.springframework.stereotype.Service;

import java.util.Base64;

import static com.messaging.backend.pqc.dto.KyberDtos.*;
import static com.messaging.backend.pqc.dto.FrodoDtos.*;

@Service
public class PqcService {

    public KyberKeyGenResponse kyberKeyGen() {
        MiniKyberKeyPair kp = MiniKyber.keyGen();

        KyberKeyGenResponse res = new KyberKeyGenResponse();
        res.a = kp.getA().getCoeffs();
        res.t = kp.getT().getCoeffs();
        res.s = kp.getS().getCoeffs();
        return res;
    }

    public KyberEncapsResponse kyberEncaps(KyberEncapsRequest req) {
        MiniKyberKeyPair kp = new MiniKyberKeyPair(
                new Polynomial(req.a),
                new Polynomial(req.t),
                new Polynomial(new int[Polynomial.N])
        );

        MiniKyber.EncapsulationResult enc = MiniKyber.encapsulate(kp);

        KyberEncapsResponse res = new KyberEncapsResponse();
        res.u = enc.getCiphertext().getU().getCoeffs();
        res.v = enc.getCiphertext().getV().getCoeffs();
        res.sharedSecretB64 = Base64.getEncoder().encodeToString(enc.getSharedSecret());
        return res;
    }

    public KyberDecapsResponse kyberDecaps(KyberDecapsRequest req) {
        MiniKyberKeyPair kp = new MiniKyberKeyPair(
                new Polynomial(new int[Polynomial.N]),
                new Polynomial(new int[Polynomial.N]),
                new Polynomial(req.s)
        );

        MiniKyber.Ciphertext ct = new MiniKyber.Ciphertext(
                new Polynomial(req.u),
                new Polynomial(req.v)
        );

        byte[] ss = MiniKyber.decapsulate(kp, ct);

        KyberDecapsResponse res = new KyberDecapsResponse();
        res.sharedSecretB64 = Base64.getEncoder().encodeToString(ss);
        return res;
    }

    public FrodoKeyGenResponse frodoKeyGen() {
        MiniFrodoKeyPair kp = MiniFrodo.keyGen();

        FrodoKeyGenResponse res = new FrodoKeyGenResponse();
        res.A = matrixToArray(kp.getA());
        res.B = matrixToArray(kp.getB());
        res.S = matrixToArray(kp.getS());
        return res;
    }

    public FrodoEncapsResponse frodoEncaps(FrodoEncapsRequest req) {
        MiniFrodoKeyPair kp = new MiniFrodoKeyPair(
                arrayToMatrix(req.A),
                arrayToMatrix(req.B),
                new Matrix(MiniFrodo.N, 1)
        );

        MiniFrodo.EncapsulationResult enc = MiniFrodo.encapsulate(kp);

        FrodoEncapsResponse res = new FrodoEncapsResponse();
        res.U = matrixToArray(enc.getCiphertext().getU());
        res.V = matrixToArray(enc.getCiphertext().getV());
        res.sharedSecretB64 = Base64.getEncoder().encodeToString(enc.getSharedSecret());
        return res;
    }

    public FrodoDecapsResponse frodoDecaps(FrodoDecapsRequest req) {
        MiniFrodoKeyPair kp = new MiniFrodoKeyPair(
                new Matrix(MiniFrodo.N, MiniFrodo.N),
                new Matrix(MiniFrodo.N, 1),
                arrayToMatrix(req.S)
        );

        MiniFrodo.Ciphertext ct = new MiniFrodo.Ciphertext(
                arrayToMatrix(req.U),
                arrayToMatrix(req.V)
        );

        byte[] ss = MiniFrodo.decapsulate(kp, ct);

        FrodoDecapsResponse res = new FrodoDecapsResponse();
        res.sharedSecretB64 = Base64.getEncoder().encodeToString(ss);
        return res;
    }

    private static int[][] matrixToArray(Matrix m) {
        int[][] out = new int[m.getRows()][m.getCols()];
        for (int r = 0; r < m.getRows(); r++) {
            for (int c = 0; c < m.getCols(); c++) {
                out[r][c] = m.get(r, c);
            }
        }
        return out;
    }

    private static Matrix arrayToMatrix(int[][] a) {
        return new Matrix(a);
    }
}