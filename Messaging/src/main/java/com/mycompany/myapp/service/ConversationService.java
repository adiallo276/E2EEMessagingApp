package com.mycompany.myapp.service;

import com.mycompany.myapp.service.dto.ConversationDTO;
import org.springframework.data.domain.Pageable;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Service Interface for managing {@link com.mycompany.myapp.domain.Conversation}.
 */
public interface ConversationService {
    /**
     * Save a conversation.
     *
     * @param conversationDTO the entity to save.
     * @return the persisted entity.
     */
    Mono<ConversationDTO> save(ConversationDTO conversationDTO);

    /**
     * Updates a conversation.
     *
     * @param conversationDTO the entity to update.
     * @return the persisted entity.
     */
    Mono<ConversationDTO> update(ConversationDTO conversationDTO);

    /**
     * Partially updates a conversation.
     *
     * @param conversationDTO the entity to update partially.
     * @return the persisted entity.
     */
    Mono<ConversationDTO> partialUpdate(ConversationDTO conversationDTO);

    /**
     * Get all the conversations.
     *
     * @return the list of entities.
     */
    Flux<ConversationDTO> findAll();

    /**
     * Get all the conversations with eager load of many-to-many relationships.
     *
     * @param pageable the pagination information.
     * @return the list of entities.
     */
    Flux<ConversationDTO> findAllWithEagerRelationships(Pageable pageable);

    /**
     * Returns the number of conversations available.
     * @return the number of entities in the database.
     *
     */
    Mono<Long> countAll();

    /**
     * Get the "id" conversation.
     *
     * @param id the id of the entity.
     * @return the entity.
     */
    Mono<ConversationDTO> findOne(Long id);

    /**
     * Delete the "id" conversation.
     *
     * @param id the id of the entity.
     * @return a Mono to signal the deletion
     */
    Mono<Void> delete(Long id);
}
