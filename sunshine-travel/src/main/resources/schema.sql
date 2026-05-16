SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS t_coupon_operation_log;
DROP TABLE IF EXISTS t_system_version;
DROP TABLE IF EXISTS t_system_notice;
DROP TABLE IF EXISTS t_system_config;
DROP TABLE IF EXISTS t_user_coupon;
DROP TABLE IF EXISTS t_message_record;
DROP TABLE IF EXISTS t_travel_trace;
DROP TABLE IF EXISTS t_payment_record;
DROP TABLE IF EXISTS t_complaint;
DROP TABLE IF EXISTS t_carpool_application;
DROP TABLE IF EXISTS t_withdraw_application;
DROP TABLE IF EXISTS t_ride_order;
DROP TABLE IF EXISTS t_carpool_trip;
DROP TABLE IF EXISTS t_vehicle;
DROP TABLE IF EXISTS t_driver_profile;
DROP TABLE IF EXISTS t_coupon;
DROP TABLE IF EXISTS t_operation_log;
DROP TABLE IF EXISTS t_car_type;
DROP TABLE IF EXISTS t_platform_user;

CREATE TABLE IF NOT EXISTS t_platform_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    open_id VARCHAR(64) NOT NULL COMMENT '微信OpenID/模拟ID',
    phone VARCHAR(20) NOT NULL COMMENT '手机号',
    password VARCHAR(100) NOT NULL COMMENT '密码',
    nickname VARCHAR(50) NOT NULL COMMENT '昵称',
    avatar VARCHAR(255) DEFAULT NULL COMMENT '头像',
    real_name VARCHAR(50) DEFAULT NULL COMMENT '真实姓名',
    id_card VARCHAR(30) DEFAULT NULL COMMENT '身份证号',
    gender VARCHAR(10) DEFAULT NULL COMMENT '性别',
    role_code VARCHAR(20) NOT NULL COMMENT '角色编码',
    auth_status INT NOT NULL DEFAULT 0 COMMENT '实名认证状态',
    enabled INT NOT NULL DEFAULT 1 COMMENT '是否启用',
    wallet_balance DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '钱包余额',
    emergency_contact VARCHAR(50) DEFAULT NULL COMMENT '紧急联系人',
    emergency_phone VARCHAR(20) DEFAULT NULL COMMENT '紧急联系电话',
    default_language VARCHAR(20) DEFAULT 'zh-CN' COMMENT '默认语言',
    auth_remark VARCHAR(255) DEFAULT NULL COMMENT '实名审核备注',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_platform_user_phone_role (phone, role_code),
    KEY idx_platform_user_role (role_code),
    KEY idx_platform_user_auth_status (auth_status)
) COMMENT='平台用户表';

CREATE TABLE IF NOT EXISTS t_driver_profile (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    user_id BIGINT NOT NULL COMMENT '司机用户ID',
    driver_no VARCHAR(50) NOT NULL COMMENT '司机编号',
    license_no VARCHAR(64) NOT NULL COMMENT '驾驶证号',
    service_status VARCHAR(20) NOT NULL COMMENT '接单状态',
    audit_status INT NOT NULL DEFAULT 0 COMMENT '资质审核状态',
    score DECIMAL(4,2) NOT NULL DEFAULT 5.00 COMMENT '评分',
    total_income DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '累计收益',
    withdrawable_income DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '可提现收益',
    city_code VARCHAR(20) DEFAULT NULL COMMENT '城市编码',
    last_longitude VARCHAR(30) DEFAULT NULL COMMENT '最后上报经度',
    last_latitude VARCHAR(30) DEFAULT NULL COMMENT '最后上报纬度',
    audit_remark VARCHAR(255) DEFAULT NULL COMMENT '审核备注',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_driver_profile_user (user_id),
    KEY idx_driver_profile_status (service_status),
    CONSTRAINT fk_driver_profile_user FOREIGN KEY (user_id) REFERENCES t_platform_user(id)
) COMMENT='司机资料表';

CREATE TABLE IF NOT EXISTS t_vehicle (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    driver_id BIGINT NOT NULL COMMENT '司机用户ID',
    plate_no VARCHAR(30) NOT NULL COMMENT '车牌号',
    brand VARCHAR(50) NOT NULL COMMENT '品牌',
    model_name VARCHAR(50) NOT NULL COMMENT '车型',
    color VARCHAR(20) NOT NULL COMMENT '颜色',
    seat_count INT NOT NULL COMMENT '座位数',
    insurance_expire_date VARCHAR(20) DEFAULT NULL COMMENT '保险到期日',
    annual_inspect_expire_date VARCHAR(20) DEFAULT NULL COMMENT '年检到期日',
    vehicle_license_image_url VARCHAR(255) DEFAULT NULL COMMENT '行驶证照片',
    driver_license_image_url VARCHAR(255) DEFAULT NULL COMMENT '驾驶证照片',
    audit_status INT NOT NULL DEFAULT 0 COMMENT '车辆审核状态',
    audit_remark VARCHAR(255) DEFAULT NULL COMMENT '车辆审核备注',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    KEY idx_vehicle_driver (driver_id),
    CONSTRAINT fk_vehicle_driver FOREIGN KEY (driver_id) REFERENCES t_platform_user(id)
) COMMENT='车辆信息表';

CREATE TABLE IF NOT EXISTS t_car_type (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    service_code VARCHAR(20) NOT NULL COMMENT '服务编码',
    name VARCHAR(50) NOT NULL COMMENT '车型名称',
    icon VARCHAR(255) DEFAULT NULL COMMENT '图标',
    start_price DECIMAL(10,2) NOT NULL COMMENT '起步价',
    start_distance_km DECIMAL(10,2) NOT NULL COMMENT '起步里程',
    distance_price DECIMAL(10,2) NOT NULL COMMENT '里程单价',
    duration_price DECIMAL(10,2) NOT NULL COMMENT '时长单价',
    long_distance_price DECIMAL(10,2) NOT NULL COMMENT '远途附加费单价',
    night_surcharge DECIMAL(10,2) NOT NULL COMMENT '夜间附加费',
    cross_border_base_price DECIMAL(10,2) NOT NULL COMMENT '跨境基础价',
    enabled INT NOT NULL DEFAULT 1 COMMENT '是否启用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    KEY idx_car_type_service (service_code)
) COMMENT='车型配置表';

CREATE TABLE IF NOT EXISTS t_coupon (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    coupon_name VARCHAR(100) NOT NULL COMMENT '优惠券名称',
    coupon_type VARCHAR(20) NOT NULL COMMENT '优惠券类型',
    service_scope VARCHAR(30) NOT NULL COMMENT '适用服务范围',
    threshold_amount DECIMAL(10,2) DEFAULT NULL COMMENT '门槛金额',
    discount_amount DECIMAL(10,2) DEFAULT NULL COMMENT '减免金额',
    discount_rate DECIMAL(10,2) DEFAULT NULL COMMENT '折扣率',
    stackable INT NOT NULL DEFAULT 0 COMMENT '是否可叠加',
    total_count INT NOT NULL COMMENT '总库存',
    remain_count INT NOT NULL COMMENT '剩余库存',
    status INT NOT NULL DEFAULT 1 COMMENT '状态',
    receive_limit_per_user INT NOT NULL DEFAULT 1 COMMENT '单人领取上限',
    valid_start_time DATETIME NOT NULL COMMENT '生效开始时间',
    valid_end_time DATETIME NOT NULL COMMENT '生效结束时间',
    rule_desc VARCHAR(255) DEFAULT NULL COMMENT '规则描述',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    KEY idx_coupon_status (status),
    KEY idx_coupon_scope (service_scope)
) COMMENT='优惠券模板表';

CREATE TABLE IF NOT EXISTS t_user_coupon (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    coupon_id BIGINT NOT NULL COMMENT '优惠券模板ID',
    coupon_status VARCHAR(20) NOT NULL COMMENT '优惠券状态',
    service_scope VARCHAR(30) NOT NULL COMMENT '适用服务范围',
    valid_start_time DATETIME NOT NULL COMMENT '生效开始时间',
    valid_end_time DATETIME NOT NULL COMMENT '生效结束时间',
    bind_order_id BIGINT DEFAULT NULL COMMENT '绑定订单ID',
    receive_mode VARCHAR(30) DEFAULT NULL COMMENT '发放方式',
    used_at DATETIME DEFAULT NULL COMMENT '使用时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    KEY idx_user_coupon_user_status (user_id, coupon_status),
    KEY idx_user_coupon_coupon (coupon_id),
    CONSTRAINT fk_user_coupon_user FOREIGN KEY (user_id) REFERENCES t_platform_user(id),
    CONSTRAINT fk_user_coupon_coupon FOREIGN KEY (coupon_id) REFERENCES t_coupon(id)
) COMMENT='用户优惠券表';

CREATE TABLE IF NOT EXISTS t_coupon_operation_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    coupon_id BIGINT NOT NULL COMMENT '优惠券模板ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    user_coupon_id BIGINT DEFAULT NULL COMMENT '用户优惠券ID',
    order_id BIGINT DEFAULT NULL COMMENT '订单ID',
    operation_type VARCHAR(30) NOT NULL COMMENT '操作类型',
    content VARCHAR(255) DEFAULT NULL COMMENT '操作说明',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    KEY idx_coupon_operation_user (user_id),
    KEY idx_coupon_operation_coupon (coupon_id)
) COMMENT='优惠券操作日志表';

CREATE TABLE IF NOT EXISTS t_ride_order (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    order_no VARCHAR(64) NOT NULL COMMENT '订单号',
    user_id BIGINT NOT NULL COMMENT '乘客ID',
    driver_id BIGINT DEFAULT NULL COMMENT '司机ID',
    car_type_id BIGINT NOT NULL COMMENT '车型ID',
    service_type VARCHAR(30) NOT NULL COMMENT '服务类型',
    order_status VARCHAR(30) NOT NULL COMMENT '订单状态',
    start_name VARCHAR(255) NOT NULL COMMENT '起点名称',
    start_lng VARCHAR(30) NOT NULL COMMENT '起点经度',
    start_lat VARCHAR(30) NOT NULL COMMENT '起点纬度',
    end_name VARCHAR(255) NOT NULL COMMENT '终点名称',
    end_lng VARCHAR(30) NOT NULL COMMENT '终点经度',
    end_lat VARCHAR(30) NOT NULL COMMENT '终点纬度',
    estimated_distance_km DECIMAL(10,2) NOT NULL COMMENT '预估里程',
    estimated_duration_min DECIMAL(10,2) NOT NULL COMMENT '预估时长',
    estimated_amount DECIMAL(10,2) NOT NULL COMMENT '预估金额',
    coupon_discount DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '优惠金额',
    user_coupon_id BIGINT DEFAULT NULL COMMENT '使用的用户优惠券ID',
    payable_amount DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '应付金额',
    actual_amount DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '实际金额',
    actual_distance_km DECIMAL(10,2) DEFAULT NULL COMMENT '实际里程',
    actual_duration_min DECIMAL(10,2) DEFAULT NULL COMMENT '实际时长',
    night_surcharge_amount DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '夜间附加费',
    long_distance_surcharge_amount DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '远途附加费',
    platform_commission_amount DECIMAL(10,2) DEFAULT NULL COMMENT '平台佣金',
    driver_income_amount DECIMAL(10,2) DEFAULT NULL COMMENT '司机收益',
    exchange_rate DECIMAL(10,2) NOT NULL DEFAULT 1.00 COMMENT '汇率',
    currency_code VARCHAR(10) NOT NULL COMMENT '币种',
    dispatch_mode VARCHAR(20) NOT NULL COMMENT '派单模式',
    pay_status VARCHAR(20) NOT NULL COMMENT '支付状态',
    cancel_reason VARCHAR(255) DEFAULT NULL COMMENT '取消原因',
    cancel_by_role VARCHAR(20) DEFAULT NULL COMMENT '取消角色',
    cancel_fee DECIMAL(10,2) DEFAULT NULL COMMENT '取消违约金',
    refund_amount DECIMAL(10,2) DEFAULT NULL COMMENT '退款金额',
    refund_reason VARCHAR(255) DEFAULT NULL COMMENT '退款原因',
    refunded_at DATETIME DEFAULT NULL COMMENT '退款时间',
    accepted_at DATETIME DEFAULT NULL COMMENT '接单时间',
    started_at DATETIME DEFAULT NULL COMMENT '上车时间',
    finished_at DATETIME DEFAULT NULL COMMENT '完单时间',
    paid_at DATETIME DEFAULT NULL COMMENT '支付时间',
    invoice_status VARCHAR(20) NOT NULL COMMENT '开票状态',
    evaluation_status VARCHAR(50) NOT NULL COMMENT '评价状态',
    complaint_status VARCHAR(20) NOT NULL COMMENT '投诉状态',
    settlement_status VARCHAR(20) NOT NULL COMMENT '结算状态',
    language_code VARCHAR(20) DEFAULT 'zh-CN' COMMENT '语言编码',
    remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_ride_order_no (order_no),
    KEY idx_ride_order_user_status (user_id, order_status),
    KEY idx_ride_order_driver_status (driver_id, order_status),
    KEY idx_ride_order_pay_status (pay_status),
    CONSTRAINT fk_ride_order_user FOREIGN KEY (user_id) REFERENCES t_platform_user(id),
    CONSTRAINT fk_ride_order_driver FOREIGN KEY (driver_id) REFERENCES t_platform_user(id),
    CONSTRAINT fk_ride_order_car_type FOREIGN KEY (car_type_id) REFERENCES t_car_type(id)
) COMMENT='打车订单表';

CREATE TABLE IF NOT EXISTS t_payment_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    pay_no VARCHAR(64) NOT NULL COMMENT '支付单号',
    pay_channel VARCHAR(30) NOT NULL COMMENT '支付渠道',
    pay_status VARCHAR(20) NOT NULL COMMENT '支付状态',
    pay_amount DECIMAL(10,2) NOT NULL COMMENT '支付金额',
    currency_code VARCHAR(10) NOT NULL COMMENT '币种',
    mock_transaction_no VARCHAR(64) DEFAULT NULL COMMENT '模拟交易号',
    refund_amount DECIMAL(10,2) DEFAULT NULL COMMENT '退款金额',
    refund_reason VARCHAR(255) DEFAULT NULL COMMENT '退款原因',
    refunded_at DATETIME DEFAULT NULL COMMENT '退款时间',
    paid_at DATETIME DEFAULT NULL COMMENT '支付时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_payment_record_pay_no (pay_no),
    KEY idx_payment_record_order (order_id),
    CONSTRAINT fk_payment_record_order FOREIGN KEY (order_id) REFERENCES t_ride_order(id)
) COMMENT='支付流水表';

CREATE TABLE IF NOT EXISTS t_complaint (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    user_id BIGINT NOT NULL COMMENT '投诉人ID',
    complaint_type VARCHAR(30) NOT NULL COMMENT '投诉类型',
    content VARCHAR(500) NOT NULL COMMENT '投诉内容',
    handle_status VARCHAR(20) NOT NULL COMMENT '处理状态',
    handle_result VARCHAR(255) DEFAULT NULL COMMENT '处理结果',
    handle_time DATETIME DEFAULT NULL COMMENT '处理时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    KEY idx_complaint_order (order_id),
    KEY idx_complaint_status (handle_status)
) COMMENT='投诉表';

CREATE TABLE IF NOT EXISTS t_carpool_trip (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    owner_user_id BIGINT NOT NULL COMMENT '车主用户ID',
    trip_no VARCHAR(64) NOT NULL COMMENT '行程号',
    start_name VARCHAR(255) NOT NULL COMMENT '起点',
    end_name VARCHAR(255) NOT NULL COMMENT '终点',
    depart_time DATETIME NOT NULL COMMENT '出发时间',
    seat_count INT NOT NULL COMMENT '总座位数',
    remain_seat_count INT NOT NULL COMMENT '剩余座位数',
    shared_amount DECIMAL(10,2) NOT NULL COMMENT '单人分摊金额',
    language_code VARCHAR(20) DEFAULT 'zh-CN' COMMENT '语言编码',
    baggage_rule VARCHAR(255) DEFAULT NULL COMMENT '行李规则',
    trip_remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
    status VARCHAR(20) NOT NULL COMMENT '行程状态',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_carpool_trip_no (trip_no),
    KEY idx_carpool_trip_owner (owner_user_id),
    KEY idx_carpool_trip_depart (depart_time)
) COMMENT='顺风车行程表';

CREATE TABLE IF NOT EXISTS t_carpool_application (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    trip_id BIGINT NOT NULL COMMENT '行程ID',
    passenger_user_id BIGINT NOT NULL COMMENT '乘客ID',
    companion_count INT NOT NULL COMMENT '同行人数',
    shared_amount DECIMAL(10,2) NOT NULL COMMENT '总分摊金额',
    application_status VARCHAR(30) NOT NULL COMMENT '申请状态',
    owner_confirmed_at DATETIME DEFAULT NULL COMMENT '车主确认时间',
    passenger_confirmed_at DATETIME DEFAULT NULL COMMENT '乘客确认时间',
    cancel_reason VARCHAR(255) DEFAULT NULL COMMENT '取消原因',
    note VARCHAR(255) DEFAULT NULL COMMENT '备注',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    KEY idx_carpool_application_trip (trip_id),
    KEY idx_carpool_application_passenger (passenger_user_id),
    CONSTRAINT fk_carpool_application_trip FOREIGN KEY (trip_id) REFERENCES t_carpool_trip(id)
) COMMENT='顺风车申请表';

CREATE TABLE IF NOT EXISTS t_withdraw_application (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    driver_id BIGINT NOT NULL COMMENT '司机用户ID',
    apply_amount DECIMAL(10,2) NOT NULL COMMENT '提现金额',
    bank_account VARCHAR(64) NOT NULL COMMENT '银行卡号',
    bank_name VARCHAR(64) NOT NULL COMMENT '开户行',
    status VARCHAR(20) NOT NULL COMMENT '审核状态',
    reject_reason VARCHAR(255) DEFAULT NULL COMMENT '驳回原因',
    audited_at DATETIME DEFAULT NULL COMMENT '审核时间',
    audited_by BIGINT DEFAULT NULL COMMENT '审核人',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    KEY idx_withdraw_driver_status (driver_id, status)
) COMMENT='提现申请表';

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

CREATE TABLE IF NOT EXISTS t_message_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    user_id BIGINT NOT NULL COMMENT '接收用户ID',
    biz_type VARCHAR(30) NOT NULL COMMENT '业务类型',
    template_code VARCHAR(50) NOT NULL COMMENT '模板编码',
    title VARCHAR(100) NOT NULL COMMENT '消息标题',
    content VARCHAR(500) NOT NULL COMMENT '消息内容',
    language_code VARCHAR(20) DEFAULT 'zh-CN' COMMENT '语言编码',
    send_status VARCHAR(20) NOT NULL COMMENT '发送状态',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    KEY idx_message_record_user (user_id)
) COMMENT='消息推送记录表';

CREATE TABLE IF NOT EXISTS t_operation_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    operator_id BIGINT DEFAULT NULL COMMENT '操作人ID',
    operator_role VARCHAR(20) DEFAULT NULL COMMENT '操作人角色',
    biz_module VARCHAR(30) NOT NULL COMMENT '业务模块',
    biz_action VARCHAR(30) NOT NULL COMMENT '操作动作',
    target_type VARCHAR(30) DEFAULT NULL COMMENT '目标类型',
    target_id BIGINT DEFAULT NULL COMMENT '目标ID',
    content VARCHAR(500) DEFAULT NULL COMMENT '操作描述',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    KEY idx_operation_log_module (biz_module),
    KEY idx_operation_log_operator (operator_id)
) COMMENT='后台操作日志表';

CREATE TABLE IF NOT EXISTS t_system_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    config_key VARCHAR(64) NOT NULL COMMENT '配置键',
    config_name VARCHAR(100) NOT NULL COMMENT '配置名称',
    config_value VARCHAR(255) NOT NULL COMMENT '配置值',
    config_type VARCHAR(30) NOT NULL COMMENT '配置类型',
    config_group VARCHAR(50) DEFAULT NULL COMMENT '配置分组',
    remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_system_config_key (config_key)
) COMMENT='系统配置表';

CREATE TABLE IF NOT EXISTS t_system_notice (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    title VARCHAR(100) NOT NULL COMMENT '公告标题',
    content VARCHAR(500) NOT NULL COMMENT '公告内容',
    status INT NOT NULL DEFAULT 1 COMMENT '状态',
    sort_no INT NOT NULL DEFAULT 0 COMMENT '排序',
    target_role VARCHAR(20) DEFAULT 'ALL' COMMENT '目标角色',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    KEY idx_system_notice_status (status)
) COMMENT='系统公告表';

CREATE TABLE IF NOT EXISTS t_system_version (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    version_no VARCHAR(30) NOT NULL COMMENT '版本号',
    client_type VARCHAR(20) NOT NULL COMMENT '客户端类型',
    release_note VARCHAR(500) NOT NULL COMMENT '更新说明',
    force_update INT NOT NULL DEFAULT 0 COMMENT '是否强制更新',
    status INT NOT NULL DEFAULT 1 COMMENT '状态',
    download_url VARCHAR(255) DEFAULT NULL COMMENT '下载地址',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) COMMENT='版本管理表';

SET FOREIGN_KEY_CHECKS = 1;
