package com.mycompany.myapp.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.*;
import java.io.Serializable;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

/**
 * A Message.
 */
@Table("message")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Message implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @Column("id")
    private Long id;

    @NotNull(message = "must not be null")
    @Size(min = 1)
    @Column("content")
    private String content;

    @Column("ciphertext")
    private String ciphertext;

    @NotNull(message = "must not be null")
    @Column("timestamp")
    private Instant timestamp;

    @org.springframework.data.annotation.Transient
    @JsonIgnoreProperties(value = { "user1", "user2" }, allowSetters = true)
    private Conversation conversation;

    @org.springframework.data.annotation.Transient
    private User sender;

    @Column("conversation_id")
    private Long conversationId;

    @Column("sender_id")
    private Long senderId;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public Message id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getContent() {
        return this.content;
    }

    public Message content(String content) {
        this.setContent(content);
        return this;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getCiphertext() {
        return this.ciphertext;
    }

    public Message ciphertext(String ciphertext) {
        this.setCiphertext(ciphertext);
        return this;
    }

    public void setCiphertext(String ciphertext) {
        this.ciphertext = ciphertext;
    }

    public Instant getTimestamp() {
        return this.timestamp;
    }

    public Message timestamp(Instant timestamp) {
        this.setTimestamp(timestamp);
        return this;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public Conversation getConversation() {
        return this.conversation;
    }

    public void setConversation(Conversation conversation) {
        this.conversation = conversation;
        this.conversationId = conversation != null ? conversation.getId() : null;
    }

    public Message conversation(Conversation conversation) {
        this.setConversation(conversation);
        return this;
    }

    public User getSender() {
        return this.sender;
    }

    public void setSender(User user) {
        this.sender = user;
        this.senderId = user != null ? user.getId() : null;
    }

    public Message sender(User user) {
        this.setSender(user);
        return this;
    }

    public Long getConversationId() {
        return this.conversationId;
    }

    public void setConversationId(Long conversation) {
        this.conversationId = conversation;
    }

    public Long getSenderId() {
        return this.senderId;
    }

    public void setSenderId(Long user) {
        this.senderId = user;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Message)) {
            return false;
        }
        return getId() != null && getId().equals(((Message) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Message{" +
            "id=" + getId() +
            ", content='" + getContent() + "'" +
            ", ciphertext='" + getCiphertext() + "'" +
            ", timestamp='" + getTimestamp() + "'" +
            "}";
    }
}
