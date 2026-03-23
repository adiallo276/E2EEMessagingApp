package com.messaging.backend.websocket.dto;

public class ChatMessageRequest {
    public long conversationId;
    public String content;

    public boolean e2ee;
    public String ivB64;
    public String ciphertextB64;
}