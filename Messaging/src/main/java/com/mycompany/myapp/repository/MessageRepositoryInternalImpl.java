package com.mycompany.myapp.repository;

import com.mycompany.myapp.domain.Message;
import com.mycompany.myapp.repository.rowmapper.ConversationRowMapper;
import com.mycompany.myapp.repository.rowmapper.MessageRowMapper;
import com.mycompany.myapp.repository.rowmapper.UserRowMapper;
import io.r2dbc.spi.Row;
import io.r2dbc.spi.RowMetadata;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.r2dbc.convert.R2dbcConverter;
import org.springframework.data.r2dbc.core.R2dbcEntityOperations;
import org.springframework.data.r2dbc.core.R2dbcEntityTemplate;
import org.springframework.data.r2dbc.repository.support.SimpleR2dbcRepository;
import org.springframework.data.relational.core.sql.Column;
import org.springframework.data.relational.core.sql.Comparison;
import org.springframework.data.relational.core.sql.Condition;
import org.springframework.data.relational.core.sql.Conditions;
import org.springframework.data.relational.core.sql.Expression;
import org.springframework.data.relational.core.sql.Select;
import org.springframework.data.relational.core.sql.SelectBuilder.SelectFromAndJoinCondition;
import org.springframework.data.relational.core.sql.Table;
import org.springframework.data.relational.repository.support.MappingRelationalEntityInformation;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.r2dbc.core.RowsFetchSpec;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Spring Data R2DBC custom repository implementation for the Message entity.
 */
@SuppressWarnings("unused")
class MessageRepositoryInternalImpl extends SimpleR2dbcRepository<Message, Long> implements MessageRepositoryInternal {

    private final DatabaseClient db;
    private final R2dbcEntityTemplate r2dbcEntityTemplate;
    private final EntityManager entityManager;

    private final ConversationRowMapper conversationMapper;
    private final UserRowMapper userMapper;
    private final MessageRowMapper messageMapper;

    private static final Table entityTable = Table.aliased("message", EntityManager.ENTITY_ALIAS);
    private static final Table conversationTable = Table.aliased("conversation", "conversation");
    private static final Table senderTable = Table.aliased("jhi_user", "sender");

    public MessageRepositoryInternalImpl(
        R2dbcEntityTemplate template,
        EntityManager entityManager,
        ConversationRowMapper conversationMapper,
        UserRowMapper userMapper,
        MessageRowMapper messageMapper,
        R2dbcEntityOperations entityOperations,
        R2dbcConverter converter
    ) {
        super(
            new MappingRelationalEntityInformation(converter.getMappingContext().getRequiredPersistentEntity(Message.class)),
            entityOperations,
            converter
        );
        this.db = template.getDatabaseClient();
        this.r2dbcEntityTemplate = template;
        this.entityManager = entityManager;
        this.conversationMapper = conversationMapper;
        this.userMapper = userMapper;
        this.messageMapper = messageMapper;
    }

    @Override
    public Flux<Message> findAllBy(Pageable pageable) {
        return createQuery(pageable, null).all();
    }

    RowsFetchSpec<Message> createQuery(Pageable pageable, Condition whereClause) {
        List<Expression> columns = MessageSqlHelper.getColumns(entityTable, EntityManager.ENTITY_ALIAS);
        columns.addAll(ConversationSqlHelper.getColumns(conversationTable, "conversation"));
        columns.addAll(UserSqlHelper.getColumns(senderTable, "sender"));
        SelectFromAndJoinCondition selectFrom = Select.builder()
            .select(columns)
            .from(entityTable)
            .leftOuterJoin(conversationTable)
            .on(Column.create("conversation_id", entityTable))
            .equals(Column.create("id", conversationTable))
            .leftOuterJoin(senderTable)
            .on(Column.create("sender_id", entityTable))
            .equals(Column.create("id", senderTable));
        // we do not support Criteria here for now as of https://github.com/jhipster/generator-jhipster/issues/18269
        String select = entityManager.createSelect(selectFrom, Message.class, pageable, whereClause);
        return db.sql(select).map(this::process);
    }

    @Override
    public Flux<Message> findAll() {
        return findAllBy(null);
    }

    @Override
    public Mono<Message> findById(Long id) {
        Comparison whereClause = Conditions.isEqual(entityTable.column("id"), Conditions.just(id.toString()));
        return createQuery(null, whereClause).one();
    }

    @Override
    public Mono<Message> findOneWithEagerRelationships(Long id) {
        return findById(id);
    }

    @Override
    public Flux<Message> findAllWithEagerRelationships() {
        return findAll();
    }

    @Override
    public Flux<Message> findAllWithEagerRelationships(Pageable page) {
        return findAllBy(page);
    }

    private Message process(Row row, RowMetadata metadata) {
        Message entity = messageMapper.apply(row, "e");
        entity.setConversation(conversationMapper.apply(row, "conversation"));
        entity.setSender(userMapper.apply(row, "sender"));
        return entity;
    }

    @Override
    public <S extends Message> Mono<S> save(S entity) {
        return super.save(entity);
    }
}
