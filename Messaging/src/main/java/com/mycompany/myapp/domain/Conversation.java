package com.mycompany.myapp.domain;

import jakarta.validation.constraints.*;
import java.io.Serializable;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

/**
 * A Conversation.
 */
@Table("conversation")
@SuppressWarnings("common-java:DuplicatedBlocks")
public class Conversation implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @Column("id")
    private Long id;

    @NotNull(message = "must not be null")
    @Column("created_at")
    private Instant createdAt;

    @org.springframework.data.annotation.Transient
    private User user1;

    @org.springframework.data.annotation.Transient
    private User user2;

    @Column("user1_id")
    private Long user1Id;

    @Column("user2_id")
    private Long user2Id;

    // jhipster-needle-entity-add-field - JHipster will add fields here

    public Long getId() {
        return this.id;
    }

    public Conversation id(Long id) {
        this.setId(id);
        return this;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Instant getCreatedAt() {
        return this.createdAt;
    }

    public Conversation createdAt(Instant createdAt) {
        this.setCreatedAt(createdAt);
        return this;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public User getUser1() {
        return this.user1;
    }

    public void setUser1(User user) {
        this.user1 = user;
        this.user1Id = user != null ? user.getId() : null;
    }

    public Conversation user1(User user) {
        this.setUser1(user);
        return this;
    }

    public User getUser2() {
        return this.user2;
    }

    public void setUser2(User user) {
        this.user2 = user;
        this.user2Id = user != null ? user.getId() : null;
    }

    public Conversation user2(User user) {
        this.setUser2(user);
        return this;
    }

    public Long getUser1Id() {
        return this.user1Id;
    }

    public void setUser1Id(Long user) {
        this.user1Id = user;
    }

    public Long getUser2Id() {
        return this.user2Id;
    }

    public void setUser2Id(Long user) {
        this.user2Id = user;
    }

    // jhipster-needle-entity-add-getters-setters - JHipster will add getters and setters here

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Conversation)) {
            return false;
        }
        return getId() != null && getId().equals(((Conversation) o).getId());
    }

    @Override
    public int hashCode() {
        // see https://vladmihalcea.com/how-to-implement-equals-and-hashcode-using-the-jpa-entity-identifier/
        return getClass().hashCode();
    }

    // prettier-ignore
    @Override
    public String toString() {
        return "Conversation{" +
            "id=" + getId() +
            ", createdAt='" + getCreatedAt() + "'" +
            "}";
    }
}
