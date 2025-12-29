package com.messaging.backend.websocket.dto;

import java.time.Instant;

public class MessageDto {
    public Long id;
    public Long conversationId;
    public String senderUsername;
    public String content;
    public boolean e2ee;
    public String ivB64;
    public String ciphertextB64;
    public Instant timestamp;
}