SET NAMES utf8mb4;

INSERT INTO t_platform_user (
    id, open_id, phone, password, nickname, avatar, real_name, id_card, gender, role_code,
    auth_status, enabled, wallet_balance, member_status, member_level, member_opened_at, member_expire_at, member_last_coupon_week,
    emergency_contact, emergency_phone, default_language,
    auth_remark, created_at, updated_at
) VALUES
    (1, 'mock-admin-001', '13700000001', '$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m', '系统管理员', '/images/avatar-admin.svg', '平台管理员', '310101199001010011', 'MALE', 'ADMIN', 2, 1, 0.00, 'NONE', '普通用户', NULL, NULL, NULL, '运维老师', '13100000001', 'zh-CN', '系统初始化管理员', '2026-03-01 09:00:00', '2026-04-18 08:00:00'),
    (2, 'mock-user-001', '13800000001', '$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m', '小阳乘客', '/images/avatar-user.svg', '陈晓阳', '310101199804050026', 'FEMALE', 'USER', 2, 1, 286.20, 'ACTIVE', '阳光会员', '2026-06-01 09:00:00', '2026-07-01 23:59:59', NULL, '陈妈妈', '13200000001', 'zh-CN', '实名认证已通过', '2026-03-12 09:20:00', '2026-04-18 18:10:00'),
    (3, 'mock-user-002', '13800000002', '$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m', '校园乘客', '/images/avatar-user.svg', '李明远', '310101199706020033', 'MALE', 'USER', 2, 1, 88.50, 'NONE', '普通用户', NULL, NULL, NULL, '李爸爸', '13200000002', 'zh-CN', '实名认证已通过', '2026-03-28 10:15:00', '2026-04-18 10:12:00'),
    (4, 'mock-user-003', '13800000003', '$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m', '城市通勤客', '/images/avatar-user.svg', '王晨曦', '320101199912120028', 'FEMALE', 'USER', 0, 1, 58.80, 'NONE', '普通用户', NULL, NULL, NULL, '王姐姐', '13200000003', 'zh-CN', '新注册用户待实名', '2026-04-10 18:05:00', '2026-04-18 12:26:00'),
    (5, 'mock-user-004', '13800000004', '$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m', '商务出行客', '/images/avatar-user.svg', '周文博', '330101199706062015', 'MALE', 'USER', 2, 1, 120.00, 'NONE', '普通用户', NULL, NULL, NULL, '周同学', '13200000004', 'zh-CN', '高频乘客', '2026-04-17 20:16:00', '2026-04-18 15:22:00'),
    (6, 'mock-user-005', '13800000005', '$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m', '新注册乘客', '/images/avatar-user.svg', '孙悦然', NULL, 'FEMALE', 'USER', 1, 1, 15.50, 'NONE', '普通用户', NULL, NULL, NULL, '孙室友', '13200000005', 'zh-CN', '实名认证审核中', '2026-04-18 08:45:00', '2026-04-18 17:18:00'),
    (7, 'mock-driver-001', '13900000001', '$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m', '一号司机', '/images/avatar-driver.svg', '刘师傅', '310101198605180037', 'MALE', 'DRIVER', 2, 1, 0.00, 'NONE', '普通用户', NULL, NULL, NULL, '刘爱人', '13300000001', 'zh-CN', '司机资质审核通过', '2026-02-20 08:30:00', '2026-04-18 18:20:00'),
    (8, 'mock-driver-002', '13900000002', '$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m', '二号司机', '/images/avatar-driver.svg', '周师傅', '310101198409210019', 'MALE', 'DRIVER', 2, 1, 0.00, 'NONE', '普通用户', NULL, NULL, NULL, '周爱人', '13300000002', 'zh-CN', '司机资质审核通过', '2026-02-28 10:10:00', '2026-04-18 16:40:00'),
    (9, 'mock-driver-003', '13900000003', '$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m', '三号司机', '/images/avatar-driver.svg', '孙师傅', '320101198711110035', 'MALE', 'DRIVER', 1, 1, 0.00, 'NONE', '普通用户', NULL, NULL, NULL, '孙爸爸', '13300000003', 'zh-CN', '司机资质审核中', '2026-04-02 11:45:00', '2026-04-18 09:18:00'),
    (10, 'mock-driver-004', '13900000004', '$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m', '四号司机', '/images/avatar-driver.svg', '顾师傅', '310101198812120014', 'MALE', 'DRIVER', 2, 1, 0.00, 'NONE', '普通用户', NULL, NULL, NULL, '顾姐姐', '13300000004', 'zh-CN', '司机资质审核通过', '2026-03-05 07:45:00', '2026-04-18 16:20:00');

INSERT INTO t_driver_profile (
    id, user_id, driver_no, license_no, service_status, audit_status, score,
    total_income, withdrawable_income, city_code, last_longitude, last_latitude,
    audit_remark, created_at, updated_at
) VALUES
    (1, 7, 'DRV2026001', '沪驾字2026001', 'BUSY', 2, 4.97, 1328.60, 286.30, '310100', '121.5290', '31.2162', '已通过平台审核，可正常接单', '2026-02-20 09:00:00', '2026-04-18 18:20:00'),
    (2, 8, 'DRV2026002', '沪驾字2026002', 'BUSY', 2, 4.88, 1110.20, 520.00, '310100', '121.4550', '31.2208', '已通过平台审核，可正常接单', '2026-02-28 10:30:00', '2026-04-18 16:40:00'),
    (3, 9, 'DRV2026003', '苏驾字2026003', 'OFFLINE', 1, 5.00, 0.00, 0.00, '320500', '120.5853', '31.2989', '待管理员审核', '2026-04-02 12:00:00', '2026-04-18 09:18:00'),
    (4, 10, 'DRV2026004', '沪驾字2026004', 'BUSY', 2, 4.92, 1588.40, 688.00, '310100', '121.4100', '31.2255', '已通过平台审核，可正常接单', '2026-03-05 08:00:00', '2026-04-18 16:20:00');

INSERT INTO t_vehicle (
    id, driver_id, plate_no, brand, model_name, color, seat_count,
    insurance_expire_date, annual_inspect_expire_date, vehicle_license_image_url, driver_license_image_url,
    audit_status, audit_remark,
    created_at, updated_at
) VALUES
    (1, 7, '沪A12345', '比亚迪', '秦PLUS DM-i', '白色', 5, '2026-12-31', '2026-10-31', '/uploads/vehicle-license-7.jpg', '/uploads/driver-license-7.jpg', 2, '车辆审核通过', '2026-02-20 09:30:00', '2026-04-18 18:20:00'),
    (2, 8, '沪B8520D', '丰田', '凯美瑞', '黑色', 5, '2026-11-30', '2026-09-30', '/uploads/vehicle-license-8.jpg', '/uploads/driver-license-8.jpg', 2, '车辆审核通过', '2026-02-28 11:00:00', '2026-04-18 16:40:00'),
    (3, 9, '苏E6M928', '吉利', '银河L7', '银色', 5, '2026-10-30', '2026-08-31', '/uploads/vehicle-license-9.jpg', '/uploads/driver-license-9.jpg', 1, '车辆待审核', '2026-04-02 12:20:00', '2026-04-18 09:18:00'),
    (4, 10, '沪C66789', '特斯拉', 'Model 3', '灰色', 5, '2026-12-15', '2026-11-15', '/uploads/vehicle-license-10.jpg', '/uploads/driver-license-10.jpg', 2, '车辆审核通过', '2026-03-05 08:20:00', '2026-04-18 16:20:00');

INSERT INTO t_car_type (
    id, service_code, name, icon, start_price, start_distance_km, distance_price,
    duration_price, long_distance_price, night_surcharge, cross_border_base_price,
    enabled, created_at, updated_at
) VALUES
    (1, 'TAXI', '经济型', '/images/car-economy.svg', 12.00, 3.00, 2.60, 0.45, 1.20, 5.00, 88.00, 1, '2026-01-01 00:00:00', '2026-04-18 00:00:00'),
    (2, 'TAXI', '舒适型', '/images/car-comfort.svg', 18.00, 3.00, 3.20, 0.55, 1.50, 8.00, 128.00, 1, '2026-01-01 00:00:00', '2026-04-18 00:00:00'),
    (3, 'INTERNATIONAL', '商务型', '/images/car-business.svg', 28.00, 3.00, 4.20, 0.75, 2.50, 12.00, 260.00, 1, '2026-01-01 00:00:00', '2026-04-18 00:00:00');

INSERT INTO t_coupon (
    id, coupon_name, coupon_type, service_scope, threshold_amount, discount_amount,
    discount_rate, stackable, total_count, remain_count, status, receive_limit_per_user,
    valid_start_time, valid_end_time, rule_desc, created_at, updated_at
) VALUES
    (1, '新人立减18元券', 'CASH', 'ALL', 40.00, 18.00, NULL, 0, 1000, 995, 1, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', '首单满40元可减18元', '2026-01-01 00:00:00', '2026-04-18 00:00:00'),
    (2, '打车立减12元券', 'CASH', 'TAXI', 50.00, 12.00, NULL, 0, 800, 796, 1, 2, '2026-01-01 00:00:00', '2026-12-31 23:59:59', '即时打车满50元减12元', '2026-01-01 00:00:00', '2026-04-18 00:00:00'),
    (3, '顺风车八折券', 'DISCOUNT', 'CARPOOL', 20.00, NULL, 0.80, 0, 600, 597, 1, 2, '2026-01-01 00:00:00', '2026-12-31 23:59:59', '顺风车订单享受8折优惠', '2026-01-01 00:00:00', '2026-04-18 00:00:00'),
    (4, '国际出行20美元券', 'CASH', 'INTERNATIONAL', 50.00, 20.00, NULL, 0, 300, 298, 1, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59', '国际出行满50美元减20美元', '2026-01-01 00:00:00', '2026-04-18 00:00:00'),
    (5, '通勤补贴10元券', 'CASH', 'TAXI', 30.00, 10.00, NULL, 0, 500, 498, 1, 2, '2026-01-01 00:00:00', '2026-12-31 23:59:59', '工作日通勤满30元减10元', '2026-01-01 00:00:00', '2026-04-18 00:00:00');

INSERT INTO t_user_coupon (
    id, user_id, coupon_id, coupon_status, service_scope, valid_start_time,
    valid_end_time, bind_order_id, receive_mode, used_at, created_at, updated_at
) VALUES
    (1001, 2, 1, 'UNUSED', 'ALL', '2026-04-01 00:00:00', '2026-12-31 23:59:59', NULL, 'INIT', NULL, '2026-04-01 08:30:00', '2026-04-18 08:30:00'),
    (1002, 2, 2, 'USED', 'TAXI', '2026-04-01 00:00:00', '2026-12-31 23:59:59', 1, 'INIT', '2026-04-18 10:40:00', '2026-04-05 09:10:00', '2026-04-18 10:45:00'),
    (1003, 2, 3, 'UNUSED', 'CARPOOL', '2026-04-10 00:00:00', '2026-12-31 23:59:59', NULL, 'INIT', NULL, '2026-04-10 09:00:00', '2026-04-18 09:00:00'),
    (1004, 2, 4, 'UNUSED', 'INTERNATIONAL', '2026-04-10 00:00:00', '2026-12-31 23:59:59', NULL, 'INIT', NULL, '2026-04-10 09:30:00', '2026-04-18 09:30:00'),
    (1005, 3, 1, 'EXPIRED', 'ALL', '2026-03-01 00:00:00', '2026-03-31 23:59:59', NULL, 'INIT', NULL, '2026-03-01 08:00:00', '2026-04-01 00:00:00'),
    (1006, 4, 2, 'UNUSED', 'TAXI', '2026-04-12 00:00:00', '2026-12-31 23:59:59', NULL, 'ADMIN_GRANT', NULL, '2026-04-12 12:00:00', '2026-04-18 12:00:00'),
    (1007, 5, 3, 'USED', 'CARPOOL', '2026-04-17 00:00:00', '2026-12-31 23:59:59', 7, 'USER_RECEIVE', '2026-04-18 09:00:00', '2026-04-17 20:30:00', '2026-04-18 09:00:00'),
    (1008, 6, 5, 'EXPIRED', 'TAXI', '2026-04-01 00:00:00', '2026-04-10 23:59:59', NULL, 'INIT', NULL, '2026-04-01 09:15:00', '2026-04-11 00:00:00'),
    (1009, 4, 1, 'UNUSED', 'ALL', '2026-04-18 00:00:00', '2026-12-31 23:59:59', NULL, 'ADMIN_GRANT', NULL, '2026-04-18 08:10:00', '2026-04-18 08:10:00'),
    (1010, 2, 4, 'USED', 'INTERNATIONAL', '2026-04-10 00:00:00', '2026-12-31 23:59:59', 9, 'INIT', '2026-04-18 09:28:00', '2026-04-12 10:00:00', '2026-04-18 09:32:00');

INSERT INTO t_ride_order (
    id, order_no, user_id, driver_id, car_type_id, service_type, order_status,
    start_name, start_lng, start_lat, end_name, end_lng, end_lat,
    estimated_distance_km, estimated_duration_min, estimated_amount, coupon_discount, user_coupon_id,
    payable_amount, actual_amount, actual_distance_km, actual_duration_min,
    night_surcharge_amount, long_distance_surcharge_amount, platform_commission_amount, driver_income_amount,
    exchange_rate, currency_code, dispatch_mode, pay_status, cancel_reason, cancel_by_role, cancel_fee,
    accepted_at, started_at, finished_at, paid_at, invoice_status, evaluation_status, complaint_status,
    settlement_status, language_code, remark, created_at, updated_at
) VALUES
    (1, 'SX202604180001', 2, 7, 1, 'TAXI', 'FINISHED', '上海虹桥站', '121.3270', '31.2000', '人民广场', '121.4737', '31.2304', 15.20, 32.00, 58.12, 12.00, 1002, 46.12, 49.22, 15.80, 34.00, 0.00, 0.00, 9.84, 39.38, 1.00, 'CNY', 'SMART', 'PAID', NULL, NULL, 0.00, '2026-04-18 10:05:00', '2026-04-18 10:12:00', '2026-04-18 10:44:00', '2026-04-18 10:45:00', 'NONE', 'DONE:5:本次行程体验很好', 'NONE', 'DONE', 'zh-CN', '带优惠券的已完成打车订单', '2026-04-18 09:58:00', '2026-04-18 10:45:00'),
    (2, 'SX202604180002', 4, NULL, 2, 'TAXI', 'DISPATCHING', '陆家嘴中心', '121.4998', '31.2397', '上海交通大学闵行校区', '121.4331', '31.0236', 24.80, 46.00, 122.06, 0.00, NULL, 122.06, 122.06, NULL, NULL, 0.00, 0.00, NULL, NULL, 1.00, 'CNY', 'SMART', 'UNPAID', NULL, NULL, 0.00, NULL, NULL, NULL, NULL, 'NONE', 'PENDING', 'NONE', 'PENDING', 'zh-CN', '等待派单', '2026-04-18 11:15:00', '2026-04-18 11:15:00'),
    (3, 'SX202604180003', 6, 8, 2, 'TAXI', 'ACCEPTED', '静安寺', '121.4451', '31.2239', '上海迪士尼度假区', '121.6570', '31.1430', 26.50, 52.00, 138.65, 0.00, NULL, 138.65, 138.65, NULL, NULL, 0.00, 0.00, NULL, NULL, 1.00, 'CNY', 'SMART', 'UNPAID', NULL, NULL, 0.00, '2026-04-18 13:23:00', NULL, NULL, NULL, 'NONE', 'PENDING', 'NONE', 'PENDING', 'zh-CN', '司机已接单，正在前往起点', '2026-04-18 13:20:00', '2026-04-18 13:23:00'),
    (4, 'SX202604180004', 3, 10, 1, 'TAXI', 'PICKING_UP', '上海虹桥机场T2', '121.3270', '31.2000', '静安寺', '121.4451', '31.2239', 14.20, 30.00, 52.67, 0.00, NULL, 52.67, 52.67, NULL, NULL, 0.00, 0.00, NULL, NULL, 1.00, 'CNY', 'SMART', 'UNPAID', NULL, NULL, 0.00, '2026-04-18 14:08:00', NULL, NULL, NULL, 'NONE', 'PENDING', 'NONE', 'PENDING', 'zh-CN', '司机接驾中', '2026-04-18 14:05:00', '2026-04-18 14:18:00'),
    (5, 'SX202604180005', 5, 7, 3, 'INTERNATIONAL', 'IN_TRIP', '深圳湾口岸，中国深圳', '113.9459', '22.5027', '香港国际机场，中国香港', '113.9185', '22.3080', 58.00, 90.00, 98.18, 0.00, NULL, 98.18, 98.18, NULL, NULL, 0.00, 9.79, NULL, NULL, 7.15, 'USD', 'SMART', 'UNPAID', NULL, NULL, 0.00, '2026-04-18 15:03:00', '2026-04-18 15:18:00', NULL, NULL, 'NONE', 'PENDING', 'NONE', 'PENDING', 'zh-CN', '跨境行程进行中', '2026-04-18 15:00:00', '2026-04-18 15:28:00'),
    (6, 'SX202604180006', 2, NULL, 1, 'TAXI', 'CANCELLED', '上海大学', '121.4580', '31.3030', '人民广场', '121.4737', '31.2304', 9.50, 24.00, 37.40, 0.00, NULL, 0.00, 0.00, NULL, NULL, 0.00, 0.00, NULL, NULL, 1.00, 'CNY', 'SMART', 'UNPAID', '用户临时调整行程', 'USER', 0.00, NULL, NULL, NULL, NULL, 'NONE', 'NONE', 'NONE', 'CANCELLED', 'zh-CN', '司机接单前已取消', '2026-04-18 09:30:00', '2026-04-18 09:35:00'),
    (7, 'SX202604180007', 5, 8, 1, 'CARPOOL', 'FINISHED', '陆家嘴中心', '121.4998', '31.2397', '上海交通大学闵行校区', '121.4331', '31.0236', 22.00, 48.00, 52.87, 10.57, 1007, 42.30, 42.30, 22.00, 48.00, 0.00, 0.00, 8.46, 33.84, 1.00, 'CNY', 'CARPOOL_MATCH', 'PAID', NULL, NULL, 0.00, '2026-04-18 08:18:00', '2026-04-18 08:22:00', '2026-04-18 09:05:00', '2026-04-18 09:06:00', 'NONE', 'DONE:5:顺风车沟通顺畅', 'NONE', 'DONE', 'zh-CN', '已完成顺风车订单', '2026-04-18 08:10:00', '2026-04-18 09:06:00'),
    (8, 'SX202604180008', 6, NULL, 1, 'CARPOOL', 'DISPATCHING', '上海虹桥机场T2', '121.3270', '31.2000', '上海迪士尼度假区', '121.6570', '31.1430', 24.00, 46.00, 50.75, 0.00, NULL, 50.75, 50.75, NULL, NULL, 0.00, 0.00, NULL, NULL, 1.00, 'CNY', 'CARPOOL_MATCH', 'UNPAID', NULL, NULL, 0.00, NULL, NULL, NULL, NULL, 'NONE', 'PENDING', 'NONE', 'PENDING', 'zh-CN', '等待匹配拼车', '2026-04-18 16:10:00', '2026-04-18 16:10:00'),
    (9, 'SX202604180009', 2, 10, 3, 'INTERNATIONAL', 'FINISHED', '深圳湾口岸，中国深圳', '113.9459', '22.5027', '香港国际机场，中国香港', '113.9185', '22.3080', 58.00, 90.00, 98.18, 20.00, 1010, 78.18, 78.18, 58.00, 90.00, 0.00, 9.79, 15.64, 62.54, 7.15, 'USD', 'SMART', 'PAID', NULL, NULL, 0.00, '2026-04-18 07:52:00', '2026-04-18 08:05:00', '2026-04-18 09:32:00', '2026-04-18 09:33:00', 'NONE', 'DONE:4:国际出行服务不错', 'PENDING', 'DONE', 'zh-CN', '已完成国际接送机订单', '2026-04-18 07:40:00', '2026-04-18 09:33:00'),
    (10, 'SX202604180010', 4, NULL, 3, 'INTERNATIONAL', 'CANCELLED', '香港国际机场，中国香港', '113.9185', '22.3080', '澳门渔人码头，中国澳门', '113.5582', '22.1959', 65.00, 96.00, 108.07, 0.00, NULL, 0.00, 0.00, NULL, NULL, 0.00, 11.19, NULL, NULL, 7.15, 'USD', 'SMART', 'UNPAID', '行程安排变化', 'USER', 0.00, NULL, NULL, NULL, NULL, 'NONE', 'NONE', 'NONE', 'CANCELLED', 'zh-CN', '国际订单已取消', '2026-04-18 17:20:00', '2026-04-18 17:26:00'),
    (11, 'SX202604170011', 4, 7, 1, 'TAXI', 'FINISHED', '上海虹桥机场T2', '121.3270', '31.2000', '静安寺', '121.4451', '31.2239', 12.60, 28.00, 47.31, 0.00, NULL, 47.31, 47.31, 12.60, 28.00, 0.00, 0.00, 9.46, 37.85, 1.00, 'CNY', 'SMART', 'PAID', NULL, NULL, 0.00, '2026-04-17 21:20:00', '2026-04-17 21:28:00', '2026-04-17 21:56:00', '2026-04-17 21:57:00', 'NONE', 'DONE:4:整体体验不错', 'DONE', 'DONE', 'zh-CN', '昨日已完成订单', '2026-04-17 21:15:00', '2026-04-17 21:57:00'),
    (12, 'SX202604160012', 2, 8, 1, 'CARPOOL', 'FINISHED', '上海大学', '121.4580', '31.3030', '苏州工业园区', '120.7219', '31.3240', 36.00, 58.00, 80.16, 0.00, NULL, 80.16, 80.16, 36.00, 58.00, 0.00, 7.20, 16.03, 64.13, 1.00, 'CNY', 'CARPOOL_MATCH', 'PAID', NULL, NULL, 0.00, '2026-04-16 18:42:00', '2026-04-16 18:50:00', '2026-04-16 19:46:00', '2026-04-16 19:47:00', 'NONE', 'PENDING', 'NONE', 'DONE', 'zh-CN', '历史顺风车订单', '2026-04-16 18:35:00', '2026-04-16 19:47:00');

INSERT INTO t_payment_record (
    id, order_id, pay_no, pay_channel, pay_status, pay_amount, currency_code,
    mock_transaction_no, paid_at, created_at, updated_at
) VALUES
    (1, 1, 'PAY202604180001', 'WECHAT_MOCK', 'PAID', 46.12, 'CNY', 'MOCK-TRADE-180001', '2026-04-18 10:45:00', '2026-04-18 10:45:00', '2026-04-18 10:45:00'),
    (2, 7, 'PAY202604180007', 'WECHAT_MOCK', 'PAID', 42.30, 'CNY', 'MOCK-TRADE-180007', '2026-04-18 09:06:00', '2026-04-18 09:06:00', '2026-04-18 09:06:00'),
    (3, 9, 'PAY202604180009', 'WECHAT_MOCK', 'PAID', 78.18, 'USD', 'MOCK-TRADE-180009', '2026-04-18 09:33:00', '2026-04-18 09:33:00', '2026-04-18 09:33:00'),
    (4, 11, 'PAY202604170011', 'WECHAT_MOCK', 'PAID', 47.31, 'CNY', 'MOCK-TRADE-170011', '2026-04-17 21:57:00', '2026-04-17 21:57:00', '2026-04-17 21:57:00'),
    (5, 12, 'PAY202604160012', 'WECHAT_MOCK', 'PAID', 80.16, 'CNY', 'MOCK-TRADE-160012', '2026-04-16 19:47:00', '2026-04-16 19:47:00', '2026-04-16 19:47:00');

INSERT INTO t_complaint (
    id, order_id, user_id, complaint_type, content, handle_status, handle_result, handle_time, created_at, updated_at
) VALUES
    (1, 9, 2, 'SERVICE', '希望口岸接送时提供更清晰的双语指引。', 'PENDING', NULL, NULL, '2026-04-18 10:00:00', '2026-04-18 10:00:00'),
    (2, 11, 4, 'FEE', '发票抬头需要调整为公司名称。', 'DONE', '客服已跟进并重新发送电子发票', '2026-04-17 22:40:00', '2026-04-17 22:10:00', '2026-04-17 22:40:00');

INSERT INTO t_carpool_trip (
    id, owner_user_id, trip_no, start_name, end_name, depart_time, seat_count,
    remain_seat_count, shared_amount, language_code, baggage_rule, trip_remark,
    status, created_at, updated_at
) VALUES
    (1, 2, 'CP202604180001', '上海虹桥机场T2', '上海迪士尼度假区', '2026-04-19 18:30:00', 3, 1, 45.00, 'zh-CN', '每位乘客限带1件登机箱', '可在地铁口附近上车', 'PUBLISHED', '2026-04-18 08:00:00', '2026-04-18 08:00:00'),
    (2, 5, 'CP202604200002', '陆家嘴中心', '上海交通大学闵行校区', '2026-04-20 07:40:00', 4, 2, 39.00, 'zh-CN', '每位乘客限带1件登机箱', '工作日通勤拼车', 'PUBLISHED', '2026-04-18 15:05:00', '2026-04-18 15:05:00'),
    (3, 4, 'CP202604160003', '上海大学', '苏州工业园区', '2026-04-16 18:30:00', 3, 0, 36.00, 'zh-CN', '仅限小件行李', '历史已完成顺风车行程', 'FINISHED', '2026-04-16 17:00:00', '2026-04-16 19:46:00');

INSERT INTO t_carpool_application (
    id, trip_id, passenger_user_id, companion_count, shared_amount, application_status,
    owner_confirmed_at, passenger_confirmed_at, cancel_reason, note, created_at, updated_at
) VALUES
    (1, 1, 4, 0, 45.00, 'APPROVED', '2026-04-18 09:30:00', '2026-04-18 09:35:00', NULL, '可准时到达上车点', '2026-04-18 09:20:00', '2026-04-18 09:35:00'),
    (2, 1, 6, 1, 90.00, 'PENDING', NULL, NULL, NULL, '两人同行', '2026-04-18 11:05:00', '2026-04-18 11:05:00'),
    (3, 2, 2, 1, 78.00, 'APPROVED', '2026-04-18 16:30:00', '2026-04-18 16:32:00', NULL, '可提前10分钟出发', '2026-04-18 16:20:00', '2026-04-18 16:32:00'),
    (4, 3, 2, 0, 36.00, 'APPROVED', '2026-04-16 18:12:00', '2026-04-16 18:15:00', NULL, '历史拼车申请', '2026-04-16 18:10:00', '2026-04-16 18:15:00');

INSERT INTO t_withdraw_application (
    id, driver_id, apply_amount, bank_account, bank_name, status,
    reject_reason, audited_at, audited_by, created_at, updated_at
) VALUES
    (1, 7, 120.00, '6222020202020202', '中国工商银行上海分行', 'PENDING', NULL, NULL, NULL, '2026-04-18 16:30:00', '2026-04-18 16:30:00'),
    (2, 8, 300.00, '6225888888888888', '招商银行上海分行', 'APPROVED', NULL, '2026-04-17 11:20:00', 1, '2026-04-17 10:00:00', '2026-04-17 11:20:00');

INSERT INTO t_travel_trace (
    id, order_id, user_id, driver_id, biz_role, longitude, latitude,
    remark, reported_at, created_at, updated_at
) VALUES
    (1, 4, 3, 10, 'DRIVER', '121.3510', '31.2088', '正在前往上车点', '2026-04-18 14:09:00', '2026-04-18 14:09:00', '2026-04-18 14:09:00'),
    (2, 4, 3, 10, 'DRIVER', '121.3688', '31.2135', '已进入机场快速路', '2026-04-18 14:11:00', '2026-04-18 14:11:00', '2026-04-18 14:11:00'),
    (3, 4, 3, 10, 'DRIVER', '121.3876', '31.2186', '预计6分钟到达', '2026-04-18 14:13:00', '2026-04-18 14:13:00', '2026-04-18 14:13:00'),
    (4, 5, 5, 7, 'DRIVER', '113.9350', '22.4350', '即将到达口岸检查点', '2026-04-18 15:24:00', '2026-04-18 15:24:00', '2026-04-18 15:24:00'),
    (5, 5, 5, 7, 'DRIVER', '113.9280', '22.3800', '已驶入机场快速路', '2026-04-18 15:33:00', '2026-04-18 15:33:00', '2026-04-18 15:33:00'),
    (6, 5, 5, 7, 'USER', '113.9300', '22.4020', '乘客主动上报位置', '2026-04-18 15:30:00', '2026-04-18 15:30:00', '2026-04-18 15:30:00'),
    (7, 1, 2, 7, 'DRIVER', '121.3880', '31.2110', '行程中轨迹点示例', '2026-04-18 10:20:00', '2026-04-18 10:20:00', '2026-04-18 10:20:00'),
    (8, 1, 2, 7, 'DRIVER', '121.4480', '31.2245', '即将到达终点', '2026-04-18 10:30:00', '2026-04-18 10:30:00', '2026-04-18 10:30:00');

INSERT INTO t_message_record (
    id, user_id, biz_type, template_code, title, content, language_code, send_status, created_at, updated_at
) VALUES
    (1, 2, 'ORDER', 'ORDER_CREATED', '订单已提交', '你的订单已进入派单队列。', 'zh-CN', 'SUCCESS', '2026-04-18 09:58:10', '2026-04-18 09:58:10'),
    (2, 2, 'PAYMENT', 'PAY_SUCCESS', '支付成功', '订单 SX202604180001 已完成支付。', 'zh-CN', 'SUCCESS', '2026-04-18 10:45:10', '2026-04-18 10:45:10'),
    (3, 5, 'ORDER', 'TRIP_STARTED', '行程进行中', '你的跨境行程已开始，请留意司机动态。', 'zh-CN', 'SUCCESS', '2026-04-18 15:18:10', '2026-04-18 15:18:10'),
    (4, 7, 'WITHDRAW', 'WITHDRAW_APPLY', '提现待审核', '你的提现申请正在等待管理员审核。', 'zh-CN', 'SUCCESS', '2026-04-18 16:30:10', '2026-04-18 16:30:10'),
    (5, 4, 'COMPLAINT', 'COMPLAINT_DONE', '投诉已处理', '客服已完成发票信息修改并重新发送。', 'zh-CN', 'SUCCESS', '2026-04-17 22:41:00', '2026-04-17 22:41:00');

INSERT INTO t_support_conversation (
    id, user_id, user_role, channel, status, last_message, last_message_at, unread_for_admin, unread_for_user, created_at, updated_at
) VALUES
    (1, 2, 'USER', 'MINIAPP', 'OPEN', '想确认会员每周券什么时候到账。', '2026-06-09 09:16:00', 1, 0, '2026-06-09 09:12:00', '2026-06-09 09:16:00'),
    (2, 7, 'DRIVER', 'MINIAPP', 'OPEN', '车辆审核资料已经重新上传，请帮忙看一下。', '2026-06-09 09:20:00', 1, 0, '2026-06-09 09:18:00', '2026-06-09 09:20:00');

INSERT INTO t_support_message (
    id, conversation_id, sender_id, sender_role, content, created_at, updated_at
) VALUES
    (1, 1, NULL, 'ADMIN', '您好，阳光出行客服已接入，请描述您遇到的问题。', '2026-06-09 09:12:00', '2026-06-09 09:12:00'),
    (2, 1, 2, 'USER', '想确认会员每周券什么时候到账。', '2026-06-09 09:16:00', '2026-06-09 09:16:00'),
    (3, 2, NULL, 'ADMIN', '您好，阳光出行客服已接入，请描述您遇到的问题。', '2026-06-09 09:18:00', '2026-06-09 09:18:00'),
    (4, 2, 7, 'DRIVER', '车辆审核资料已经重新上传，请帮忙看一下。', '2026-06-09 09:20:00', '2026-06-09 09:20:00');

INSERT INTO t_operation_log (
    id, operator_id, operator_role, biz_module, biz_action, target_type, target_id,
    content, created_at, updated_at
) VALUES
    (1, 1, 'ADMIN', 'USER', 'AUDIT', 'USER', 2, '已通过陈晓阳的实名认证审核', '2026-04-10 10:00:00', '2026-04-10 10:00:00'),
    (2, 1, 'ADMIN', 'DRIVER', 'AUDIT', 'DRIVER', 7, '已通过一号司机的资质审核', '2026-04-10 10:10:00', '2026-04-10 10:10:00'),
    (3, 1, 'ADMIN', 'DRIVER', 'AUDIT', 'DRIVER', 8, '已通过二号司机的资质审核', '2026-04-10 10:15:00', '2026-04-10 10:15:00'),
    (4, 1, 'ADMIN', 'COUPON', 'GRANT', 'USER_COUPON', 1006, '已向用户4发放打车立减12元券', '2026-04-12 12:00:00', '2026-04-12 12:00:00'),
    (5, 1, 'ADMIN', 'FINANCE', 'WITHDRAW_AUDIT', 'WITHDRAW', 2, '已通过2号提现申请', '2026-04-17 11:20:00', '2026-04-17 11:20:00');

INSERT INTO t_coupon_operation_log (
    id, coupon_id, user_id, user_coupon_id, order_id, operation_type, content, created_at, updated_at
) VALUES
    (1, 1, 2, 1001, NULL, 'INIT', '为用户2初始化发放新人立减券', '2026-04-01 08:30:00', '2026-04-01 08:30:00'),
    (2, 2, 2, 1002, NULL, 'INIT', '为用户2初始化发放打车立减券', '2026-04-05 09:10:00', '2026-04-05 09:10:00'),
    (3, 2, 2, 1002, 1, 'USE', '订单 SX202604180001 使用了优惠券', '2026-04-18 10:40:00', '2026-04-18 10:40:00'),
    (4, 3, 5, 1007, NULL, 'USER_RECEIVE', '用户领取了顺风车折扣券', '2026-04-17 20:30:00', '2026-04-17 20:30:00'),
    (5, 3, 5, 1007, 7, 'USE', '订单 SX202604180007 使用了优惠券', '2026-04-18 09:00:00', '2026-04-18 09:00:00'),
    (6, 4, 2, 1010, NULL, 'INIT', '为用户2初始化发放国际出行券', '2026-04-12 10:00:00', '2026-04-12 10:00:00'),
    (7, 4, 2, 1010, 9, 'USE', '订单 SX202604180009 使用了优惠券', '2026-04-18 09:28:00', '2026-04-18 09:28:00'),
    (8, 2, 4, 1006, NULL, 'ADMIN_GRANT', '管理员向用户4发放打车券', '2026-04-12 12:00:00', '2026-04-12 12:00:00'),
    (9, 1, 3, 1005, NULL, 'EXPIRE', '优惠券已自动过期', '2026-04-01 00:00:00', '2026-04-01 00:00:00'),
    (10, 5, 6, 1008, NULL, 'EXPIRE', '优惠券已自动过期', '2026-04-11 00:00:00', '2026-04-11 00:00:00');

INSERT INTO t_system_config (
    id, config_key, config_name, config_value, config_type, config_group, remark, created_at, updated_at
) VALUES
    (1, 'platformCommissionRate', '平台佣金比例', '0.20', 'DECIMAL', 'ORDER', '用于订单结算规则', '2026-04-18 08:00:00', '2026-04-18 08:00:00'),
    (2, 'freeCancelMinutes', '免费取消时长', '3', 'NUMBER', 'ORDER', '乘客下单后的免费取消分钟数', '2026-04-18 08:00:00', '2026-04-18 08:00:00'),
    (3, 'nightTimeRange', '夜间附加费时段', '23:00-06:00', 'STRING', 'ORDER', '夜间计费规则展示', '2026-04-18 08:00:00', '2026-04-18 08:00:00'),
    (4, 'intlExchangeRate', '国际出行汇率', '7.15', 'DECIMAL', 'INTERNATIONAL', '用于国际出行费用换算', '2026-04-18 08:00:00', '2026-04-18 08:00:00');

INSERT INTO t_system_notice (
    id, title, content, status, sort_no, target_role, created_at, updated_at
) VALUES
    (1, '夜间安全服务已开启', '晚间订单已开启安全录音与紧急联系人展示能力。', 1, 100, 'ALL', '2026-04-18 08:00:00', '2026-04-18 08:00:00'),
    (2, '国际出行支持多币种结算', '港澳国际出行支持美元展示、中文下单与优惠券抵扣。', 1, 90, 'USER', '2026-04-18 08:00:00', '2026-04-18 08:00:00'),
    (3, '司机提现审核时效', '提现申请会在一个工作日内完成审核。', 1, 80, 'DRIVER', '2026-04-18 08:00:00', '2026-04-18 08:00:00');

INSERT INTO t_system_version (
    id, version_no, client_type, release_note, force_update, status, download_url, created_at, updated_at
) VALUES
    (1, '1.0.0', 'ADMIN', '首个正式运营版本，支持后台全链路操作。', 0, 1, 'http://127.0.0.1:5173', '2026-04-18 08:00:00', '2026-04-18 08:00:00'),
    (2, '1.0.0', 'USER_MINIAPP', '乘客端已支持打车、顺风车、国际出行、支付与评价闭环。', 0, 1, '微信开发者工具导入 sunshine-user-miniapp', '2026-04-18 08:00:00', '2026-04-18 08:00:00'),
    (3, '1.0.0', 'DRIVER_MINIAPP', '司机端已支持听单、拒单、接单、开始行程、结束行程与提现。', 0, 1, '微信开发者工具导入 sunshine-driver-miniapp', '2026-04-18 08:00:00', '2026-04-18 08:00:00');
