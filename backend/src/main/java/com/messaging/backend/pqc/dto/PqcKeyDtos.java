package com.messaging.backend.pqc.dto;

public class PqcKeyDtos {

    public static class PublishKyberPublicKeyRequest {
        public String aJson;
        public String tJson;
    }

    public static class PublishFrodoPublicKeyRequest {
        public String aJson;
        public String bJson;
    }

    public static class KyberPublicKeyResponse {
        public String username;
        public String aJson;
        public String tJson;
    }

    public static class FrodoPublicKeyResponse {
        public String username;
        public String aJson;
        public String bJson;
    }
}