package com.messaging.backend.pqc.dto;

import java.util.Map;

public class E2eeDtos {

    public static class PublishKeyRequest {
        public String algorithm;
        public Map<String, Object> publicKey;
    }

    public static class PublishKeyResponse {
        public String status;
    }

    public static class GetKeysResponse {
        public String algorithm;
        public Map<String, Map<String, Object>> keysByUser;
    }

    public static class SendKemRequest {
        public String algorithm;
        public String toUsername;
        public Map<String, Object> ciphertext;
    }

    public static class SendKemResponse {
        public String status;
    }

    public static class PendingKemItem {
        public Long id;
        public String algorithm;
        public String fromUsername;
        public Map<String, Object> ciphertext;
    }

    public static class PendingKemResponse {
        public String algorithm;
        public java.util.List<PendingKemItem> pending;
    }
}