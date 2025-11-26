package com.mycompany.myapp.service;

import com.mycompany.myapp.service.dto.MessageDTO;
import org.springframework.data.domain.Pageable;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Service Interface for managing {@link com.mycompany.myapp.domain.Message}.
 */
public interface MessageService {
    /**
     * Save a message.
     *
     * @param messageDTO the entity to save.
     * @return the persisted entity.
     */
    Mono<MessageDTO> save(MessageDTO messageDTO);

    /**
     * Updates a message.
     *
     * @param messageDTO the entity to update.
     * @return the persisted entity.
     */
    Mono<MessageDTO> update(MessageDTO messageDTO);

    /**
     * Partially updates a message.
     *
     * @param messageDTO the entity to update partially.
     * @return the persisted entity.
     */
    Mono<MessageDTO> partialUpdate(MessageDTO messageDTO);

    /**
     * Get all the messages.
     *
     * @return the list of entities.
     */
    Flux<MessageDTO> findAll();

    /**
     * Get all the messages with eager load of many-to-many relationships.
     *
     * @param pageable the pagination information.
     * @return the list of entities.
     */
    Flux<MessageDTO> findAllWithEagerRelationships(Pageable pageable);

    /**
     * Returns the number of messages available.
     * @return the number of entities in the database.
     *
     */
    Mono<Long> countAll();

    /**
     * Get the "id" message.
     *
     * @param id the id of the entity.
     * @return the entity.
     */
    Mono<MessageDTO> findOne(Long id);

    /**
     * Delete the "id" message.
     *
     * @param id the id of the entity.
     * @return a Mono to signal the deletion
     */
    Mono<Void> delete(Long id);
}
