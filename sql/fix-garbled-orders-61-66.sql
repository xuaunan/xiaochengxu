-- 修复 id 61-66 测试订单的乱码数据（早前会话用不带 UTF-8 的 curl 创建，中文被转成 ?）
-- 起点坐标 (117.0810, 39.9820) ≈ 燕京理工学院-东门，"??????-??" 字数与之一致
-- 终点 "????" 四字 = 天洋广场
-- 备注统一为：[CARPOOL_META]...[/CARPOOL_META]微信小程序乘客端下单 | 智能派单

USE sunshine_travel;

UPDATE t_ride_order SET start_name = '燕京理工学院-东门', end_name = '天洋广场' WHERE id BETWEEN 61 AND 66;

UPDATE t_ride_order SET remark = '[CARPOOL_META]{"passengerCount":2}[/CARPOOL_META]微信小程序乘客端下单 | 智能派单' WHERE id = 61;
UPDATE t_ride_order SET remark = '[CARPOOL_META]{"passengerCount":1}[/CARPOOL_META]微信小程序乘客端下单 | 智能派单' WHERE id = 62;
UPDATE t_ride_order SET remark = '[CARPOOL_META]{"passengerCount":1}[/CARPOOL_META]微信小程序乘客端下单 | 智能派单' WHERE id = 63;
UPDATE t_ride_order SET remark = '[CARPOOL_META]{"departDate":"2026-09-28","timeRange":"15:00 - 18:00","passengerCount":2,"hasLuggage":false,"tollMode":"NEGOTIABLE","originalAmount":18.69,"discountAmount":0,"payableAmount":18.69,"note":""}[/CARPOOL_META]微信小程序乘客端下单 | 智能派单' WHERE id = 64;
UPDATE t_ride_order SET remark = '[CARPOOL_META]{"passengerCount":2}[/CARPOOL_META]微信小程序乘客端下单 | 智能派单' WHERE id = 65;
UPDATE t_ride_order SET remark = '[CARPOOL_META]{"passengerCount":2}[/CARPOOL_META]微信小程序乘客端下单 | 智能派单' WHERE id = 66;

SELECT id, start_name, end_name, remark FROM t_ride_order WHERE id BETWEEN 61 AND 66;
