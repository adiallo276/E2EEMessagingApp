package com.messaging.backend.repository;

import com.messaging.backend.domain.ConversationE2eeKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationE2eeKeyRepository extends JpaRepository<ConversationE2eeKey, Long> {
    List<ConversationE2eeKey> findByConversationId(Long conversationId);
    Optional<ConversationE2eeKey> findByConversationIdAndOwnerUsernameAndAlgorithm(Long conversationId, String ownerUsername, String algorithm);
}