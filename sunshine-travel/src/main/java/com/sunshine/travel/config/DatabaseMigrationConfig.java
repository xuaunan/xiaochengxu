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
        ensurePlatformUserMemberColumns();
        ensureSupportTables();
        ensureSystemConfigValueText();
        ensureSystemNoticeDisplayTimeRange();
        ensureMessageReadColumns();
    }

    private void ensurePlatformUserMemberColumns() {
        try (Connection connection = dataSource.getConnection()) {
            boolean hasMemberStatus = hasColumn(connection, "t_platform_user", "member_status");
            boolean hasMemberLevel = hasColumn(connection, "t_platform_user", "member_level");
            boolean hasMemberOpenedAt = hasColumn(connection, "t_platform_user", "member_opened_at");
            boolean hasMemberExpireAt = hasColumn(connection, "t_platform_user", "member_expire_at");
            boolean hasMemberLastCouponWeek = hasColumn(connection, "t_platform_user", "member_last_coupon_week");
            try (Statement statement = connection.createStatement()) {
                if (!hasMemberStatus) {
                    statement.executeUpdate("ALTER TABLE t_platform_user ADD COLUMN member_status VARCHAR(20) NOT NULL DEFAULT 'NONE' COMMENT 'member status' AFTER wallet_balance");
                }
                if (!hasMemberLevel) {
                    statement.executeUpdate("ALTER TABLE t_platform_user ADD COLUMN member_level VARCHAR(30) DEFAULT '普通用户' COMMENT 'member level' AFTER member_status");
                }
                if (!hasMemberOpenedAt) {
                    statement.executeUpdate("ALTER TABLE t_platform_user ADD COLUMN member_opened_at DATETIME DEFAULT NULL COMMENT 'member opened time' AFTER member_level");
                }
                if (!hasMemberExpireAt) {
                    statement.executeUpdate("ALTER TABLE t_platform_user ADD COLUMN member_expire_at DATETIME DEFAULT NULL COMMENT 'member expire time' AFTER member_opened_at");
                }
                if (!hasMemberLastCouponWeek) {
                    statement.executeUpdate("ALTER TABLE t_platform_user ADD COLUMN member_last_coupon_week VARCHAR(20) DEFAULT NULL COMMENT 'last weekly coupon code' AFTER member_expire_at");
                }
                statement.executeUpdate("UPDATE t_platform_user SET member_status = 'NONE' WHERE role_code <> 'USER'");
                statement.executeUpdate("UPDATE t_platform_user SET member_level = '普通用户' WHERE role_code <> 'USER' OR member_level IS NULL OR member_level = ''");
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to migrate t_platform_user member columns", ex);
        }
    }

    private void ensureSupportTables() {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.executeUpdate("""
                    CREATE TABLE IF NOT EXISTS t_support_conversation (
                        id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'primary id',
                        user_id BIGINT NOT NULL COMMENT 'user id',
                        user_role VARCHAR(20) NOT NULL COMMENT 'user role',
                        status VARCHAR(20) NOT NULL DEFAULT 'OPEN' COMMENT 'conversation status',
                        last_message VARCHAR(500) DEFAULT NULL COMMENT 'last message',
                        last_message_at DATETIME DEFAULT NULL COMMENT 'last message time',
                        unread_for_admin INT NOT NULL DEFAULT 0 COMMENT 'admin unread count',
                        unread_for_user INT NOT NULL DEFAULT 0 COMMENT 'user unread count',
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'created time',
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'updated time',
                        UNIQUE KEY uk_support_conversation_user_role (user_id, user_role),
                        KEY idx_support_conversation_status (status),
                        KEY idx_support_conversation_last (last_message_at)
                    ) COMMENT='support conversation table'
                    """);
            statement.executeUpdate("""
                    CREATE TABLE IF NOT EXISTS t_support_message (
                        id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'primary id',
                        conversation_id BIGINT NOT NULL COMMENT 'support conversation id',
                        sender_id BIGINT DEFAULT NULL COMMENT 'sender id',
                        sender_role VARCHAR(20) NOT NULL COMMENT 'sender role',
                        content VARCHAR(500) NOT NULL COMMENT 'message content',
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'created time',
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'updated time',
                        KEY idx_support_message_conversation (conversation_id, id)
                    ) COMMENT='support message table'
                    """);
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to migrate support tables", ex);
        }
    }

    private void ensureSystemNoticeDisplayTimeRange() {
        try (Connection connection = dataSource.getConnection()) {
            boolean hasDisplayTimeRange = hasColumn(connection, "t_system_notice", "display_time_range");
            try (Statement statement = connection.createStatement()) {
                if (!hasDisplayTimeRange) {
                    statement.executeUpdate("ALTER TABLE t_system_notice ADD COLUMN display_time_range VARCHAR(20) DEFAULT NULL COMMENT 'daily display time range HH:mm-HH:mm' AFTER target_role");
                }
                statement.executeUpdate("UPDATE t_system_notice SET display_time_range = '23:00-06:00' WHERE (display_time_range IS NULL OR display_time_range = '') AND title LIKE '%夜间%'");
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to migrate t_system_notice display_time_range", ex);
        }
    }

    private void ensureSystemConfigValueText() {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.executeUpdate("ALTER TABLE t_system_config MODIFY COLUMN config_value TEXT NOT NULL COMMENT 'config value'");
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to migrate t_system_config config_value", ex);
        }
    }

    private void ensureMessageReadColumns() {
        try (Connection connection = dataSource.getConnection()) {
            boolean hasReadStatus = hasColumn(connection, "t_message_record", "read_status");
            boolean hasReadAt = hasColumn(connection, "t_message_record", "read_at");
            try (Statement statement = connection.createStatement()) {
                if (!hasReadStatus) {
                    statement.executeUpdate("ALTER TABLE t_message_record ADD COLUMN read_status VARCHAR(20) NOT NULL DEFAULT 'UNREAD' COMMENT 'read status' AFTER send_status");
                }
                if (!hasReadAt) {
                    statement.executeUpdate("ALTER TABLE t_message_record ADD COLUMN read_at DATETIME DEFAULT NULL COMMENT 'read time' AFTER read_status");
                }
                statement.executeUpdate("UPDATE t_message_record SET read_status = 'UNREAD' WHERE read_status IS NULL OR read_status = ''");
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to migrate t_message_record read columns", ex);
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
