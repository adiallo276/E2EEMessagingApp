package com.messaging.backend.websocket.dto;

import java.time.Instant;

public class ReadReceipt {
    public Long conversationId;
    public Long messageId;
    public String username;
    public Instant readAt;
}
