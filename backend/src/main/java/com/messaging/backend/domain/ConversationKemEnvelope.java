package com.messaging.backend.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "conversation_kem_envelopes")
public class ConversationKemEnvelope {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Conversation conversation;

    @Column(name = "from_username", nullable = false)
    private String fromUsername;

    @Column(name = "to_username", nullable = false)
    private String toUsername;

    @Column(name = "algorithm", nullable = false)
    private String algorithm;

    @Lob
    @Column(name = "ciphertext_json", nullable = false, columnDefinition = "TEXT")
    private String ciphertextJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "delivered", nullable = false)
    private boolean delivered = false;

    public ConversationKemEnvelope() {}

    public ConversationKemEnvelope(Conversation conversation, String fromUsername, String toUsername, String algorithm, String ciphertextJson) {
        this.conversation = conversation;
        this.fromUsername = fromUsername;
        this.toUsername = toUsername;
        this.algorithm = algorithm;
        this.ciphertextJson = ciphertextJson;
    }

    public Long getId() { return id; }
    public Conversation getConversation() { return conversation; }
    public String getFromUsername() { return fromUsername; }
    public String getToUsername() { return toUsername; }
    public String getAlgorithm() { return algorithm; }
    public String getCiphertextJson() { return ciphertextJson; }
    public Instant getCreatedAt() { return createdAt; }
    public boolean isDelivered() { return delivered; }

    public void setDelivered(boolean delivered) { this.delivered = delivered; }
}