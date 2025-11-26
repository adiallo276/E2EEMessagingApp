package com.mycompany.myapp.repository.rowmapper;

import com.mycompany.myapp.domain.Conversation;
import io.r2dbc.spi.Row;
import java.time.Instant;
import java.util.function.BiFunction;
import org.springframework.stereotype.Service;

/**
 * Converter between {@link Row} to {@link Conversation}, with proper type conversions.
 */
@Service
public class ConversationRowMapper implements BiFunction<Row, String, Conversation> {

    private final ColumnConverter converter;

    public ConversationRowMapper(ColumnConverter converter) {
        this.converter = converter;
    }

    /**
     * Take a {@link Row} and a column prefix, and extract all the fields.
     * @return the {@link Conversation} stored in the database.
     */
    @Override
    public Conversation apply(Row row, String prefix) {
        Conversation entity = new Conversation();
        entity.setId(converter.fromRow(row, prefix + "_id", Long.class));
        entity.setCreatedAt(converter.fromRow(row, prefix + "_created_at", Instant.class));
        entity.setUser1Id(converter.fromRow(row, prefix + "_user1_id", Long.class));
        entity.setUser2Id(converter.fromRow(row, prefix + "_user2_id", Long.class));
        return entity;
    }
}
