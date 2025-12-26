package com.messaging.backend.pqc.dto;

public class FrodoDtos {

    public static class FrodoKeyGenResponse {
        public int[][] A;
        public int[][] B;
        public int[][] S;
    }

    public static class FrodoEncapsRequest {
        public int[][] A;
        public int[][] B;
    }

    public static class FrodoEncapsResponse {
        public int[][] U;
        public int[][] V;
        public String sharedSecretB64;
    }

    public static class FrodoDecapsRequest {
        public int[][] S;
        public int[][] U;
        public int[][] V;
    }

    public static class FrodoDecapsResponse {
        public String sharedSecretB64;
    }
}