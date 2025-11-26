package com.mycompany.myapp.service.impl;

import com.mycompany.myapp.repository.MessageRepository;
import com.mycompany.myapp.service.MessageService;
import com.mycompany.myapp.service.dto.MessageDTO;
import com.mycompany.myapp.service.mapper.MessageMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Service Implementation for managing {@link com.mycompany.myapp.domain.Message}.
 */
@Service
@Transactional
public class MessageServiceImpl implements MessageService {

    private static final Logger LOG = LoggerFactory.getLogger(MessageServiceImpl.class);

    private final MessageRepository messageRepository;

    private final MessageMapper messageMapper;

    public MessageServiceImpl(MessageRepository messageRepository, MessageMapper messageMapper) {
        this.messageRepository = messageRepository;
        this.messageMapper = messageMapper;
    }

    @Override
    public Mono<MessageDTO> save(MessageDTO messageDTO) {
        LOG.debug("Request to save Message : {}", messageDTO);
        return messageRepository.save(messageMapper.toEntity(messageDTO)).map(messageMapper::toDto);
    }

    @Override
    public Mono<MessageDTO> update(MessageDTO messageDTO) {
        LOG.debug("Request to update Message : {}", messageDTO);
        return messageRepository.save(messageMapper.toEntity(messageDTO)).map(messageMapper::toDto);
    }

    @Override
    public Mono<MessageDTO> partialUpdate(MessageDTO messageDTO) {
        LOG.debug("Request to partially update Message : {}", messageDTO);

        return messageRepository
            .findById(messageDTO.getId())
            .map(existingMessage -> {
                messageMapper.partialUpdate(existingMessage, messageDTO);

                return existingMessage;
            })
            .flatMap(messageRepository::save)
            .map(messageMapper::toDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Flux<MessageDTO> findAll() {
        LOG.debug("Request to get all Messages");
        return messageRepository.findAll().map(messageMapper::toDto);
    }

    public Flux<MessageDTO> findAllWithEagerRelationships(Pageable pageable) {
        return messageRepository.findAllWithEagerRelationships(pageable).map(messageMapper::toDto);
    }

    public Mono<Long> countAll() {
        return messageRepository.count();
    }

    @Override
    @Transactional(readOnly = true)
    public Mono<MessageDTO> findOne(Long id) {
        LOG.debug("Request to get Message : {}", id);
        return messageRepository.findOneWithEagerRelationships(id).map(messageMapper::toDto);
    }

    @Override
    public Mono<Void> delete(Long id) {
        LOG.debug("Request to delete Message : {}", id);
        return messageRepository.deleteById(id);
    }
}
