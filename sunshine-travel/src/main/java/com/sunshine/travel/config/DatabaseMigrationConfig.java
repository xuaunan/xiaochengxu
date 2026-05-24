package com.sunshine.travel.config;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class DatabaseMigrationConfig implements ApplicationRunner {

    private final DataSource dataSource;

    public DatabaseMigrationConfig(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) {
        ensureSystemNoticeDisplayTimeRange();
    }

    private void ensureSystemNoticeDisplayTimeRange() {
        try (Connection connection = dataSource.getConnection()) {
            boolean hasDisplayTimeRange = hasColumn(connection, "t_system_notice", "display_time_range");
            try (Statement statement = connection.createStatement()) {
                if (!hasDisplayTimeRange) {
                    statement.executeUpdate("ALTER TABLE t_system_notice ADD COLUMN display_time_range VARCHAR(20) DEFAULT NULL COMMENT '每日展示时段 HH:mm-HH:mm' AFTER target_role");
                }
                statement.executeUpdate("UPDATE t_system_notice SET display_time_range = '23:00-06:00' WHERE (display_time_range IS NULL OR display_time_range = '') AND title LIKE '%夜间%'");
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to migrate t_system_notice display_time_range", ex);
        }
    }

    private boolean hasColumn(Connection connection, String tableName, String columnName) throws SQLException {
        DatabaseMetaData metaData = connection.getMetaData();
        try (ResultSet columns = metaData.getColumns(connection.getCatalog(), null, tableName, columnName)) {
            if (columns.next()) {
                return true;
            }
        }
        try (ResultSet columns = metaData.getColumns(connection.getCatalog(), null, tableName.toUpperCase(), columnName.toUpperCase())) {
            return columns.next();
        }
    }
}
