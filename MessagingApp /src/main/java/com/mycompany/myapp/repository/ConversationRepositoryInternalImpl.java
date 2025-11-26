package com.mycompany.myapp.repository;

import com.mycompany.myapp.domain.Conversation;
import com.mycompany.myapp.repository.rowmapper.ConversationRowMapper;
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
 * Spring Data R2DBC custom repository implementation for the Conversation entity.
 */
@SuppressWarnings("unused")
class ConversationRepositoryInternalImpl extends SimpleR2dbcRepository<Conversation, Long> implements ConversationRepositoryInternal {

    private final DatabaseClient db;
    private final R2dbcEntityTemplate r2dbcEntityTemplate;
    private final EntityManager entityManager;

    private final UserRowMapper userMapper;
    private final ConversationRowMapper conversationMapper;

    private static final Table entityTable = Table.aliased("conversation", EntityManager.ENTITY_ALIAS);
    private static final Table user1Table = Table.aliased("jhi_user", "user1");
    private static final Table user2Table = Table.aliased("jhi_user", "user2");

    public ConversationRepositoryInternalImpl(
        R2dbcEntityTemplate template,
        EntityManager entityManager,
        UserRowMapper userMapper,
        ConversationRowMapper conversationMapper,
        R2dbcEntityOperations entityOperations,
        R2dbcConverter converter
    ) {
        super(
            new MappingRelationalEntityInformation(converter.getMappingContext().getRequiredPersistentEntity(Conversation.class)),
            entityOperations,
            converter
        );
        this.db = template.getDatabaseClient();
        this.r2dbcEntityTemplate = template;
        this.entityManager = entityManager;
        this.userMapper = userMapper;
        this.conversationMapper = conversationMapper;
    }

    @Override
    public Flux<Conversation> findAllBy(Pageable pageable) {
        return createQuery(pageable, null).all();
    }

    RowsFetchSpec<Conversation> createQuery(Pageable pageable, Condition whereClause) {
        List<Expression> columns = ConversationSqlHelper.getColumns(entityTable, EntityManager.ENTITY_ALIAS);
        columns.addAll(UserSqlHelper.getColumns(user1Table, "user1"));
        columns.addAll(UserSqlHelper.getColumns(user2Table, "user2"));
        SelectFromAndJoinCondition selectFrom = Select.builder()
            .select(columns)
            .from(entityTable)
            .leftOuterJoin(user1Table)
            .on(Column.create("user1_id", entityTable))
            .equals(Column.create("id", user1Table))
            .leftOuterJoin(user2Table)
            .on(Column.create("user2_id", entityTable))
            .equals(Column.create("id", user2Table));
        // we do not support Criteria here for now as of https://github.com/jhipster/generator-jhipster/issues/18269
        String select = entityManager.createSelect(selectFrom, Conversation.class, pageable, whereClause);
        return db.sql(select).map(this::process);
    }

    @Override
    public Flux<Conversation> findAll() {
        return findAllBy(null);
    }

    @Override
    public Mono<Conversation> findById(Long id) {
        Comparison whereClause = Conditions.isEqual(entityTable.column("id"), Conditions.just(id.toString()));
        return createQuery(null, whereClause).one();
    }

    @Override
    public Mono<Conversation> findOneWithEagerRelationships(Long id) {
        return findById(id);
    }

    @Override
    public Flux<Conversation> findAllWithEagerRelationships() {
        return findAll();
    }

    @Override
    public Flux<Conversation> findAllWithEagerRelationships(Pageable page) {
        return findAllBy(page);
    }

    private Conversation process(Row row, RowMetadata metadata) {
        Conversation entity = conversationMapper.apply(row, "e");
        entity.setUser1(userMapper.apply(row, "user1"));
        entity.setUser2(userMapper.apply(row, "user2"));
        return entity;
    }

    @Override
    public <S extends Conversation> Mono<S> save(S entity) {
        return super.save(entity);
    }
}
