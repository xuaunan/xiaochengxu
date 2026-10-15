-- 阳光出行 测试用户清理 2026-10-08
-- 保留: admin(id=1), 司机 7,8,9,10,11,16,20,23,24,28, 乘客 2,3,4,5,6,12,13,14,15,17
-- 删除: 司机 30,31,34,35,38,44 + 乘客 18,19,21,22,25,26,27,29,32,33,36,37,39,40,41,42,43,45,46
SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;

-- 1. 圈出涉及被删用户的订单
CREATE TEMPORARY TABLE del_orders (id BIGINT PRIMARY KEY);
INSERT INTO del_orders
SELECT id FROM t_ride_order
WHERE user_id IN (18,19,21,22,25,26,27,29,32,33,36,37,39,40,41,42,43,45,46)
   OR driver_id IN (30,31,34,35,38,44);

-- 2. 订单子表
DELETE FROM t_order_track        WHERE order_id IN (SELECT id FROM del_orders);
DELETE FROM t_payment_record     WHERE order_id IN (SELECT id FROM del_orders);
DELETE FROM t_travel_trace       WHERE order_id IN (SELECT id FROM del_orders)
    OR user_id IN (18,19,21,22,25,26,27,29,32,33,36,37,39,40,41,42,43,45,46)
    OR driver_id IN (30,31,34,35,38,44);
DELETE FROM t_coupon_operation_log WHERE order_id IN (SELECT id FROM del_orders)
    OR user_id IN (18,19,21,22,25,26,27,29,32,33,36,37,39,40,41,42,43,45,46);
DELETE FROM t_complaint          WHERE order_id IN (SELECT id FROM del_orders)
    OR user_id IN (18,19,21,22,25,26,27,29,32,33,36,37,39,40,41,42,43,45,46);
DELETE FROM t_finance_flow       WHERE order_id IN (SELECT id FROM del_orders)
    OR user_id IN (18,19,21,22,25,26,27,29,32,33,36,37,39,40,41,42,43,45,46)
    OR driver_id IN (30,31,34,35,38,44);

-- 3. 用户维度数据
DELETE FROM t_user_coupon          WHERE user_id IN (18,19,21,22,25,26,27,29,32,33,36,37,39,40,41,42,43,45,46)
    OR bind_order_id IN (SELECT id FROM del_orders);
DELETE FROM t_message_record       WHERE user_id IN (18,19,21,22,25,26,27,29,32,33,36,37,39,40,41,42,43,45,46);
DELETE FROM t_support_message      WHERE sender_id IN (18,19,21,22,25,26,27,29,32,33,36,37,39,40,41,42,43,45,46)
    OR conversation_id IN (SELECT id FROM t_support_conversation WHERE user_id IN (18,19,21,22,25,26,27,29,32,33,36,37,39,40,41,42,43,45,46));
DELETE FROM t_support_conversation WHERE user_id IN (18,19,21,22,25,26,27,29,32,33,36,37,39,40,41,42,43,45,46);
DELETE FROM t_withdraw_application WHERE driver_id IN (30,31,34,35,38,44);
DELETE FROM t_carpool_application  WHERE passenger_user_id IN (18,19,21,22,25,26,27,29,32,33,36,37,39,40,41,42,43,45,46)
    OR trip_id IN (SELECT id FROM t_carpool_trip WHERE owner_user_id IN (18,19,21,22,25,26,27,29,32,33,36,37,39,40,41,42,43,45,46));
DELETE FROM t_carpool_ride_request WHERE passenger_user_id IN (18,19,21,22,25,26,27,29,32,33,36,37,39,40,41,42,43,45,46);
DELETE FROM t_carpool_trip         WHERE owner_user_id IN (18,19,21,22,25,26,27,29,32,33,36,37,39,40,41,42,43,45,46);
DELETE FROM t_driver_profile       WHERE user_id IN (30,31,34,35,38,44);
DELETE FROM t_vehicle              WHERE driver_id IN (30,31,34,35,38,44);
DELETE FROM t_operation_log        WHERE operator_id IN (18,19,21,22,25,26,27,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46);

-- 4. 订单 + 用户本体
DELETE FROM t_ride_order    WHERE id IN (SELECT id FROM del_orders);
DELETE FROM t_platform_user WHERE id IN (18,19,21,22,25,26,27,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46);

-- 5. 清理后盘点
SELECT 'remaining_users' item, COUNT(*) cnt FROM t_platform_user
UNION ALL SELECT 'remaining_orders', COUNT(*) FROM t_ride_order
UNION ALL SELECT 'remaining_driver_profiles', COUNT(*) FROM t_driver_profile
UNION ALL SELECT 'remaining_vehicles', COUNT(*) FROM t_vehicle
UNION ALL SELECT 'remaining_carpool_trips', COUNT(*) FROM t_carpool_trip
UNION ALL SELECT 'remaining_payment_records', COUNT(*) FROM t_payment_record
UNION ALL SELECT 'remaining_finance_flows', COUNT(*) FROM t_finance_flow
UNION ALL SELECT 'remaining_user_coupons', COUNT(*) FROM t_user_coupon
UNION ALL SELECT 'remaining_messages', COUNT(*) FROM t_message_record
UNION ALL SELECT 'remaining_support_msgs', COUNT(*) FROM t_support_message
UNION ALL SELECT 'remaining_travel_trace', COUNT(*) FROM t_travel_trace;

SELECT role_code, COUNT(*) FROM t_platform_user GROUP BY role_code;

COMMIT;
