package com.messaging.backend.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
        name = "conversation_e2ee_keys",
        uniqueConstraints = @UniqueConstraint(columnNames = {"conversation_id", "owner_username", "algorithm"})
)
public class ConversationE2eeKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Conversation conversation;

    @Column(name = "owner_username", nullable = false)
    private String ownerUsername;

    @Column(name = "algorithm", nullable = false)
    private String algorithm;

    @Lob
    @Column(name = "public_key_json", nullable = false, columnDefinition = "TEXT")
    private String publicKeyJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public ConversationE2eeKey() {}

    public ConversationE2eeKey(Conversation conversation, String ownerUsername, String algorithm, String publicKeyJson) {
        this.conversation = conversation;
        this.ownerUsername = ownerUsername;
        this.algorithm = algorithm;
        this.publicKeyJson = publicKeyJson;
    }

    public Long getId() { return id; }
    public Conversation getConversation() { return conversation; }
    public String getOwnerUsername() { return ownerUsername; }
    public String getAlgorithm() { return algorithm; }
    public String getPublicKeyJson() { return publicKeyJson; }
    public Instant getCreatedAt() { return createdAt; }

    public void setPublicKeyJson(String publicKeyJson) { this.publicKeyJson = publicKeyJson; }
}