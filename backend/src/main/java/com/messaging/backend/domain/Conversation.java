package com.messaging.backend.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user1_id")
    private User user1;

    @ManyToOne
    @JoinColumn(name = "user2_id")
    private User user2;

    private Instant createdAt = Instant.now();

    public Conversation() {}

    public Conversation(User user1, User user2) {
        this.user1 = user1;
        this.user2 = user2;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public User getUser1() {
        return user1;
    }

    public User getUser2() {
        return user2;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setUser1(User user1) {
        this.user1 = user1;
    }

    public void setUser2(User user2) {
        this.user2 = user2;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}