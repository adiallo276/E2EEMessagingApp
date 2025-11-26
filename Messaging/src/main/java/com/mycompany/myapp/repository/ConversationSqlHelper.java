package com.mycompany.myapp.repository;

import java.util.ArrayList;
import java.util.List;
import org.springframework.data.relational.core.sql.Column;
import org.springframework.data.relational.core.sql.Expression;
import org.springframework.data.relational.core.sql.Table;

public class ConversationSqlHelper {

    public static List<Expression> getColumns(Table table, String columnPrefix) {
        List<Expression> columns = new ArrayList<>();
        columns.add(Column.aliased("id", table, columnPrefix + "_id"));
        columns.add(Column.aliased("created_at", table, columnPrefix + "_created_at"));

        columns.add(Column.aliased("user1_id", table, columnPrefix + "_user1_id"));
        columns.add(Column.aliased("user2_id", table, columnPrefix + "_user2_id"));
        return columns;
    }
}
