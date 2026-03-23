package com.messaging.backend.websocket.dto;

public class EditMessageRequest {
    public long conversationId;
    public long messageId;
    public String content;
}
