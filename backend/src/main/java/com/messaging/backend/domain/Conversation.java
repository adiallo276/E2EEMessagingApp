package com.messaging.backend.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "conversations")
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private User user1;

    @ManyToOne(optional = false)
    private User user2;

    @Enumerated(EnumType.STRING)
    private E2eeState e2eeState = E2eeState.OFF;

    private String e2eeRequestedBy;

    private String e2eeAlgorithm;

    @Column(columnDefinition = "TEXT")
    private String e2eeCtUJson;

    @Column(columnDefinition = "TEXT")
    private String e2eeCtVJson;

    private String e2eeSaltB64;

    public Conversation() {}

    public Conversation(User user1, User user2) {
        this.user1 = user1;
        this.user2 = user2;
    }

    public Long getId() { return id; }

    public User getUser1() { return user1; }
    public User getUser2() { return user2; }

    public E2eeState getE2eeState() { return e2eeState; }
    public void setE2eeState(E2eeState e2eeState) { this.e2eeState = e2eeState; }

    public String getE2eeRequestedBy() { return e2eeRequestedBy; }
    public void setE2eeRequestedBy(String e2eeRequestedBy) { this.e2eeRequestedBy = e2eeRequestedBy; }

    public String getE2eeAlgorithm() { return e2eeAlgorithm; }
    public void setE2eeAlgorithm(String e2eeAlgorithm) { this.e2eeAlgorithm = e2eeAlgorithm; }

    public String getE2eeCtUJson() { return e2eeCtUJson; }
    public void setE2eeCtUJson(String e2eeCtUJson) { this.e2eeCtUJson = e2eeCtUJson; }

    public String getE2eeCtVJson() { return e2eeCtVJson; }
    public void setE2eeCtVJson(String e2eeCtVJson) { this.e2eeCtVJson = e2eeCtVJson; }

    public String getE2eeSaltB64() { return e2eeSaltB64; }
    public void setE2eeSaltB64(String e2eeSaltB64) { this.e2eeSaltB64 = e2eeSaltB64; }

    public boolean hasParticipant(String username) {
        return user1 != null && user1.getUsername().equals(username)
            || user2 != null && user2.getUsername().equals(username);
    }

    public String otherParticipant(String username) {
        if (user1 != null && user1.getUsername().equals(username)) return user2.getUsername();
        return user1.getUsername();
    }
}