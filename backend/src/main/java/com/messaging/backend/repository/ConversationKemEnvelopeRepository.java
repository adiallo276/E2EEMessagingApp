package com.messaging.backend.repository;

import com.messaging.backend.domain.ConversationKemEnvelope;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ConversationKemEnvelopeRepository extends JpaRepository<ConversationKemEnvelope, Long> {
    List<ConversationKemEnvelope> findByConversationIdAndToUsernameAndDeliveredFalse(Long conversationId, String toUsername);
}