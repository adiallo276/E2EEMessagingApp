package com.messaging.backend.websocket.dto;

public class TypingEvent {
    public Long conversationId;
    public String username;
    public boolean isTyping;
}
