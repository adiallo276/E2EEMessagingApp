package com.mycompany.myapp.service.impl;

import com.mycompany.myapp.repository.ConversationRepository;
import com.mycompany.myapp.service.ConversationService;
import com.mycompany.myapp.service.dto.ConversationDTO;
import com.mycompany.myapp.service.mapper.ConversationMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Service Implementation for managing {@link com.mycompany.myapp.domain.Conversation}.
 */
@Service
@Transactional
public class ConversationServiceImpl implements ConversationService {

    private static final Logger LOG = LoggerFactory.getLogger(ConversationServiceImpl.class);

    private final ConversationRepository conversationRepository;

    private final ConversationMapper conversationMapper;

    public ConversationServiceImpl(ConversationRepository conversationRepository, ConversationMapper conversationMapper) {
        this.conversationRepository = conversationRepository;
        this.conversationMapper = conversationMapper;
    }

    @Override
    public Mono<ConversationDTO> save(ConversationDTO conversationDTO) {
        LOG.debug("Request to save Conversation : {}", conversationDTO);
        return conversationRepository.save(conversationMapper.toEntity(conversationDTO)).map(conversationMapper::toDto);
    }

    @Override
    public Mono<ConversationDTO> update(ConversationDTO conversationDTO) {
        LOG.debug("Request to update Conversation : {}", conversationDTO);
        return conversationRepository.save(conversationMapper.toEntity(conversationDTO)).map(conversationMapper::toDto);
    }

    @Override
    public Mono<ConversationDTO> partialUpdate(ConversationDTO conversationDTO) {
        LOG.debug("Request to partially update Conversation : {}", conversationDTO);

        return conversationRepository
            .findById(conversationDTO.getId())
            .map(existingConversation -> {
                conversationMapper.partialUpdate(existingConversation, conversationDTO);

                return existingConversation;
            })
            .flatMap(conversationRepository::save)
            .map(conversationMapper::toDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Flux<ConversationDTO> findAll() {
        LOG.debug("Request to get all Conversations");
        return conversationRepository.findAll().map(conversationMapper::toDto);
    }

    public Flux<ConversationDTO> findAllWithEagerRelationships(Pageable pageable) {
        return conversationRepository.findAllWithEagerRelationships(pageable).map(conversationMapper::toDto);
    }

    public Mono<Long> countAll() {
        return conversationRepository.count();
    }

    @Override
    @Transactional(readOnly = true)
    public Mono<ConversationDTO> findOne(Long id) {
        LOG.debug("Request to get Conversation : {}", id);
        return conversationRepository.findOneWithEagerRelationships(id).map(conversationMapper::toDto);
    }

    @Override
    public Mono<Void> delete(Long id) {
        LOG.debug("Request to delete Conversation : {}", id);
        return conversationRepository.deleteById(id);
    }
}
