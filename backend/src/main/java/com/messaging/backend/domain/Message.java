package com.messaging.backend.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "messages")
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Conversation conversation;

    @ManyToOne(optional = false)
    private User sender;

    @Column(columnDefinition = "TEXT")
    private String content;

    private boolean e2ee;

    @Column(columnDefinition = "TEXT")
    private String ivB64;

    @Column(columnDefinition = "TEXT")
    private String ciphertextB64;

    private Instant timestamp = Instant.now();

    public Message() {}

    public Message(Conversation conversation, User sender, String content) {
        this.conversation = conversation;
        this.sender = sender;
        this.content = content;
        this.e2ee = false;
    }

    public Message(Conversation conversation, User sender, String ivB64, String ciphertextB64) {
        this.conversation = conversation;
        this.sender = sender;
        this.ivB64 = ivB64;
        this.ciphertextB64 = ciphertextB64;
        this.e2ee = true;
    }

    public Long getId() { return id; }
    public Conversation getConversation() { return conversation; }
    public User getSender() { return sender; }
    public String getContent() { return content; }
    public boolean isE2ee() { return e2ee; }
    public String getIvB64() { return ivB64; }
    public String getCiphertextB64() { return ciphertextB64; }
    public Instant getTimestamp() { return timestamp; }
}