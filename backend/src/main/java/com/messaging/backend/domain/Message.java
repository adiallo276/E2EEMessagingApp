package com.messaging.backend.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String content;

    @Lob
    private String ciphertext;

    private Instant timestamp = Instant.now();

    @ManyToOne
    @JoinColumn(name = "conversation_id")
    private Conversation conversation;

    @ManyToOne
    @JoinColumn(name = "sender_id")
    private User sender;

    @Column(nullable = false)
    private String senderUsername;

    @Column(columnDefinition = "TEXT")
    private String ivB64;

    @Column(columnDefinition = "TEXT")
    private String ciphertextB64;

    public Message() {}

    public Message(String content, Conversation conversation, User sender) {
        this.content = content;
        this.conversation = conversation;
        this.sender = sender;
        this.timestamp = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getContent() {
        return content;
    }

    public String getCiphertext() {
        return ciphertext;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public Conversation getConversation() {
        return conversation;
    }

    public User getSender() {
        return sender;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public void setCiphertext(String ciphertext) {
        this.ciphertext = ciphertext;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public void setConversation(Conversation conversation) {
        this.conversation = conversation;
    }

    public void setSender(User sender) {
        this.sender = sender;
    }
}