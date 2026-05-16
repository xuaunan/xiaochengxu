-- 2026-05-13 order/payment/trace/complaint synchronization patch.
-- Apply this to the active sunshine_travel database after deploying the backend.

START TRANSACTION;

CREATE TABLE IF NOT EXISTS t_travel_trace (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    driver_id BIGINT DEFAULT NULL COMMENT '司机ID',
    biz_role VARCHAR(20) NOT NULL COMMENT '上报角色',
    longitude VARCHAR(30) NOT NULL COMMENT '经度',
    latitude VARCHAR(30) NOT NULL COMMENT '纬度',
    waiting_red_light TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否红灯等待',
    wait_seconds BIGINT DEFAULT 0 COMMENT '累计等待秒数',
    current_wait_seconds BIGINT DEFAULT 0 COMMENT '当前等待秒数',
    traffic_text VARCHAR(120) DEFAULT NULL COMMENT '路况文案',
    waiting_text VARCHAR(120) DEFAULT NULL COMMENT '等待文案',
    speed_kmh DECIMAL(10,2) DEFAULT NULL COMMENT '小程序上报速度',
    heading DECIMAL(10,2) DEFAULT NULL COMMENT '小程序上报方向',
    remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
    reported_at DATETIME NOT NULL COMMENT '上报时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    KEY idx_travel_trace_order_time (order_id, reported_at)
) COMMENT='行程轨迹表';

DROP PROCEDURE IF EXISTS add_trace_column_if_missing;
DELIMITER //
CREATE PROCEDURE add_trace_column_if_missing(
    IN column_name_value VARCHAR(64),
    IN column_definition_value VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 't_travel_trace'
          AND column_name = column_name_value
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE t_travel_trace ADD COLUMN ', column_definition_value);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

CALL add_trace_column_if_missing('waiting_red_light', 'waiting_red_light TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''是否红灯等待'' AFTER latitude');
CALL add_trace_column_if_missing('wait_seconds', 'wait_seconds BIGINT DEFAULT 0 COMMENT ''累计等待秒数'' AFTER waiting_red_light');
CALL add_trace_column_if_missing('current_wait_seconds', 'current_wait_seconds BIGINT DEFAULT 0 COMMENT ''当前等待秒数'' AFTER wait_seconds');
CALL add_trace_column_if_missing('traffic_text', 'traffic_text VARCHAR(120) DEFAULT NULL COMMENT ''路况文案'' AFTER current_wait_seconds');
CALL add_trace_column_if_missing('waiting_text', 'waiting_text VARCHAR(120) DEFAULT NULL COMMENT ''等待文案'' AFTER traffic_text');
CALL add_trace_column_if_missing('speed_kmh', 'speed_kmh DECIMAL(10,2) DEFAULT NULL COMMENT ''小程序上报速度'' AFTER waiting_text');
CALL add_trace_column_if_missing('heading', 'heading DECIMAL(10,2) DEFAULT NULL COMMENT ''小程序上报方向'' AFTER speed_kmh');
DROP PROCEDURE IF EXISTS add_trace_column_if_missing;

UPDATE t_ride_order o
JOIN (
    SELECT
        order_id,
        MAX(COALESCE(paid_at, created_at)) AS paid_at
    FROM t_payment_record
    WHERE pay_status = 'PAID'
    GROUP BY order_id
) p ON p.order_id = o.id
LEFT JOIN (
    SELECT order_id
    FROM t_payment_record
    WHERE pay_status = 'REFUNDED'
    GROUP BY order_id
) r ON r.order_id = o.id
SET
    o.pay_status = 'PAID',
    o.paid_at = COALESCE(o.paid_at, p.paid_at),
    o.settlement_status = CASE
        WHEN o.order_status = 'FINISHED' THEN 'DONE'
        ELSE o.settlement_status
    END,
    o.updated_at = CURRENT_TIMESTAMP
WHERE r.order_id IS NULL
  AND o.pay_status <> 'PAID';

UPDATE t_ride_order o
JOIN (
    SELECT
        order_id,
        MAX(COALESCE(refunded_at, updated_at, created_at)) AS refunded_at,
        MAX(refund_amount) AS refund_amount,
        SUBSTRING_INDEX(GROUP_CONCAT(refund_reason ORDER BY id DESC SEPARATOR '||'), '||', 1) AS refund_reason
    FROM t_payment_record
    WHERE pay_status = 'REFUNDED'
    GROUP BY order_id
) r ON r.order_id = o.id
SET
    o.pay_status = 'REFUNDED',
    o.refunded_at = COALESCE(o.refunded_at, r.refunded_at),
    o.refund_amount = COALESCE(o.refund_amount, r.refund_amount),
    o.refund_reason = COALESCE(NULLIF(o.refund_reason, ''), NULLIF(r.refund_reason, '')),
    o.settlement_status = 'REFUNDED',
    o.updated_at = CURRENT_TIMESTAMP
WHERE o.pay_status <> 'REFUNDED';

INSERT INTO t_payment_record (
    order_id,
    pay_no,
    pay_channel,
    pay_status,
    pay_amount,
    currency_code,
    mock_transaction_no,
    paid_at,
    created_at,
    updated_at
)
SELECT
    o.id,
    CONCAT('PAY-SYNC-', o.order_no),
    'WECHAT_SYNC',
    'PAID',
    COALESCE(NULLIF(o.payable_amount, 0), o.actual_amount, o.estimated_amount, 0),
    COALESCE(o.currency_code, 'CNY'),
    CONCAT('SYNC-', o.order_no),
    COALESCE(o.paid_at, o.finished_at, o.updated_at, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM t_ride_order o
WHERE o.order_no LIKE 'ORD%'
  AND o.order_status = 'FINISHED'
  AND o.pay_status = 'UNPAID'
  AND COALESCE(o.payable_amount, o.actual_amount, o.estimated_amount, 0) > 0
  AND NOT EXISTS (
      SELECT 1 FROM t_payment_record p
      WHERE p.order_id = o.id
  );

UPDATE t_ride_order o
JOIN (
    SELECT
        order_id,
        MAX(COALESCE(paid_at, created_at)) AS paid_at
    FROM t_payment_record
    WHERE pay_status = 'PAID'
    GROUP BY order_id
) p ON p.order_id = o.id
SET
    o.pay_status = 'PAID',
    o.paid_at = COALESCE(o.paid_at, p.paid_at),
    o.settlement_status = CASE
        WHEN o.order_status = 'FINISHED' THEN 'DONE'
        ELSE o.settlement_status
    END,
    o.updated_at = CURRENT_TIMESTAMP
WHERE o.order_status = 'FINISHED'
  AND o.pay_status = 'UNPAID';

UPDATE t_ride_order o
SET
    o.complaint_status = CASE
        WHEN EXISTS (
            SELECT 1 FROM t_complaint c
            WHERE c.order_id = o.id AND c.handle_status <> 'DONE'
        ) THEN 'PENDING'
        WHEN EXISTS (
            SELECT 1 FROM t_complaint c
            WHERE c.order_id = o.id
        ) THEN 'DONE'
        ELSE 'NONE'
    END,
    o.updated_at = CURRENT_TIMESTAMP;

COMMIT;
