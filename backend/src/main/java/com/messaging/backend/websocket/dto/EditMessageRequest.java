package com.messaging.backend.websocket.dto;

public class EditMessageRequest {
    public long messageId;
    public long conversationId;
    public String content;
}
