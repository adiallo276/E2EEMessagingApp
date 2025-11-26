package com.mycompany.myapp.repository;

import com.mycompany.myapp.domain.Conversation;
import org.springframework.data.domain.Pageable;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Spring Data R2DBC repository for the Conversation entity.
 */
@SuppressWarnings("unused")
@Repository
public interface ConversationRepository extends ReactiveCrudRepository<Conversation, Long>, ConversationRepositoryInternal {
    Flux<Conversation> findAllBy(Pageable pageable);

    @Override
    Mono<Conversation> findOneWithEagerRelationships(Long id);

    @Override
    Flux<Conversation> findAllWithEagerRelationships();

    @Override
    Flux<Conversation> findAllWithEagerRelationships(Pageable page);

    @Query("SELECT * FROM conversation entity WHERE entity.user1_id = :id")
    Flux<Conversation> findByUser1(Long id);

    @Query("SELECT * FROM conversation entity WHERE entity.user1_id IS NULL")
    Flux<Conversation> findAllWhereUser1IsNull();

    @Query("SELECT * FROM conversation entity WHERE entity.user2_id = :id")
    Flux<Conversation> findByUser2(Long id);

    @Query("SELECT * FROM conversation entity WHERE entity.user2_id IS NULL")
    Flux<Conversation> findAllWhereUser2IsNull();

    @Override
    <S extends Conversation> Mono<S> save(S entity);

    @Override
    Flux<Conversation> findAll();

    @Override
    Mono<Conversation> findById(Long id);

    @Override
    Mono<Void> deleteById(Long id);
}

interface ConversationRepositoryInternal {
    <S extends Conversation> Mono<S> save(S entity);

    Flux<Conversation> findAllBy(Pageable pageable);

    Flux<Conversation> findAll();

    Mono<Conversation> findById(Long id);
    // this is not supported at the moment because of https://github.com/jhipster/generator-jhipster/issues/18269
    // Flux<Conversation> findAllBy(Pageable pageable, Criteria criteria);

    Mono<Conversation> findOneWithEagerRelationships(Long id);

    Flux<Conversation> findAllWithEagerRelationships();

    Flux<Conversation> findAllWithEagerRelationships(Pageable page);

    Mono<Void> deleteById(Long id);
}
