package com.messaging.backend.pqc.dto;

public class KyberDtos {

    public static class KyberKeyGenResponse {
        public int[] a;
        public int[] t;
        public int[] s;
    }

    public static class KyberEncapsRequest {
        public int[] a;
        public int[] t;
    }

    public static class KyberEncapsResponse {
        public int[] u;
        public int[] v;
        public String sharedSecretB64;
    }

    public static class KyberDecapsRequest {
        public int[] s;
        public int[] u;
        public int[] v;
    }

    public static class KyberDecapsResponse {
        public String sharedSecretB64;
    }
}