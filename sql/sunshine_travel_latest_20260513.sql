-- MySQL dump 10.13  Distrib 8.0.40, for Win64 (x86_64)
--
-- Host: localhost    Database: sunshine_travel
-- ------------------------------------------------------
-- Server version	8.0.40

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `sunshine_travel`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `sunshine_travel` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `sunshine_travel`;

--
-- Table structure for table `t_car_type`
--

DROP TABLE IF EXISTS `t_car_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_car_type` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `service_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '服务编码',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '车型名称',
  `icon` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '图标',
  `start_price` decimal(10,2) NOT NULL COMMENT '起步价',
  `start_distance_km` decimal(10,2) NOT NULL COMMENT '起步里程',
  `distance_price` decimal(10,2) NOT NULL COMMENT '里程单价',
  `duration_price` decimal(10,2) NOT NULL COMMENT '时长单价',
  `long_distance_price` decimal(10,2) NOT NULL COMMENT '远途附加费单价',
  `night_surcharge` decimal(10,2) NOT NULL COMMENT '夜间附加费',
  `cross_border_base_price` decimal(10,2) NOT NULL COMMENT '跨境基础价',
  `enabled` int NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_car_type_service` (`service_code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='车型配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_car_type`
--

LOCK TABLES `t_car_type` WRITE;
/*!40000 ALTER TABLE `t_car_type` DISABLE KEYS */;
INSERT INTO `t_car_type` VALUES (1,'TAXI','经济型','/images/car-economy.svg',12.00,3.00,2.60,0.45,1.20,5.00,88.00,1,'2026-01-01 00:00:00','2026-04-18 00:00:00'),(2,'TAXI','舒适型','/images/car-comfort.svg',18.00,3.00,3.20,0.55,1.50,8.00,128.00,1,'2026-01-01 00:00:00','2026-04-18 00:00:00'),(3,'INTERNATIONAL','商务型','/images/car-business.svg',28.00,3.00,4.20,0.75,2.50,12.00,260.00,1,'2026-01-01 00:00:00','2026-04-18 00:00:00');
/*!40000 ALTER TABLE `t_car_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_carpool_application`
--

DROP TABLE IF EXISTS `t_carpool_application`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_carpool_application` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `trip_id` bigint NOT NULL COMMENT '行程ID',
  `passenger_user_id` bigint NOT NULL COMMENT '乘客ID',
  `companion_count` int NOT NULL COMMENT '同行人数',
  `shared_amount` decimal(10,2) NOT NULL COMMENT '总分摊金额',
  `application_status` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '申请状态',
  `owner_confirmed_at` datetime DEFAULT NULL COMMENT '车主确认时间',
  `passenger_confirmed_at` datetime DEFAULT NULL COMMENT '乘客确认时间',
  `cancel_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '取消原因',
  `note` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_carpool_application_trip` (`trip_id`),
  KEY `idx_carpool_application_passenger` (`passenger_user_id`),
  CONSTRAINT `fk_carpool_application_trip` FOREIGN KEY (`trip_id`) REFERENCES `t_carpool_trip` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='顺风车申请表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_carpool_application`
--

LOCK TABLES `t_carpool_application` WRITE;
/*!40000 ALTER TABLE `t_carpool_application` DISABLE KEYS */;
INSERT INTO `t_carpool_application` VALUES (1,1,4,0,45.00,'APPROVED','2026-04-18 09:30:00','2026-04-18 09:35:00',NULL,'可准时到达上车点','2026-04-18 09:20:00','2026-04-18 09:35:00'),(2,1,6,1,90.00,'PENDING',NULL,NULL,NULL,'两人同行','2026-04-18 11:05:00','2026-04-18 11:05:00'),(3,2,2,1,78.00,'APPROVED','2026-04-18 16:30:00','2026-04-18 16:32:00',NULL,'可提前10分钟出发','2026-04-18 16:20:00','2026-04-18 16:32:00'),(4,3,2,0,36.00,'APPROVED','2026-04-16 18:12:00','2026-04-16 18:15:00',NULL,'历史拼车申请','2026-04-16 18:10:00','2026-04-16 18:15:00');
/*!40000 ALTER TABLE `t_carpool_application` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_carpool_trip`
--

DROP TABLE IF EXISTS `t_carpool_trip`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_carpool_trip` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `owner_user_id` bigint NOT NULL COMMENT '车主用户ID',
  `trip_no` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '行程号',
  `start_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '起点',
  `end_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '终点',
  `depart_time` datetime NOT NULL COMMENT '出发时间',
  `seat_count` int NOT NULL COMMENT '总座位数',
  `remain_seat_count` int NOT NULL COMMENT '剩余座位数',
  `shared_amount` decimal(10,2) NOT NULL COMMENT '单人分摊金额',
  `language_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'zh-CN' COMMENT '语言编码',
  `baggage_rule` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '行李规则',
  `trip_remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '备注',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '行程状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_carpool_trip_no` (`trip_no`),
  KEY `idx_carpool_trip_owner` (`owner_user_id`),
  KEY `idx_carpool_trip_depart` (`depart_time`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='顺风车行程表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_carpool_trip`
--

LOCK TABLES `t_carpool_trip` WRITE;
/*!40000 ALTER TABLE `t_carpool_trip` DISABLE KEYS */;
INSERT INTO `t_carpool_trip` VALUES (1,2,'CP202604180001','上海虹桥机场T2','上海迪士尼度假区','2026-04-19 18:30:00',3,1,45.00,'zh-CN','每位乘客限带1件登机箱','可在地铁口附近上车','PUBLISHED','2026-04-18 08:00:00','2026-04-18 08:00:00'),(2,5,'CP202604200002','陆家嘴中心','上海交通大学闵行校区','2026-04-20 07:40:00',4,2,39.00,'zh-CN','每位乘客限带1件登机箱','工作日通勤拼车','PUBLISHED','2026-04-18 15:05:00','2026-04-18 15:05:00'),(3,4,'CP202604160003','上海大学','苏州工业园区','2026-04-16 18:30:00',3,0,36.00,'zh-CN','仅限小件行李','历史已完成顺风车行程','FINISHED','2026-04-16 17:00:00','2026-04-16 19:46:00');
/*!40000 ALTER TABLE `t_carpool_trip` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_complaint`
--

DROP TABLE IF EXISTS `t_complaint`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_complaint` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `order_id` bigint NOT NULL COMMENT '订单ID',
  `user_id` bigint NOT NULL COMMENT '投诉人ID',
  `complaint_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '投诉类型',
  `content` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '投诉内容',
  `handle_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '处理状态',
  `handle_result` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '处理结果',
  `handle_time` datetime DEFAULT NULL COMMENT '处理时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_complaint_order` (`order_id`),
  KEY `idx_complaint_status` (`handle_status`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='投诉表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_complaint`
--

LOCK TABLES `t_complaint` WRITE;
/*!40000 ALTER TABLE `t_complaint` DISABLE KEYS */;
INSERT INTO `t_complaint` VALUES (1,9,2,'SERVICE','希望口岸接送时提供更清晰的双语指引。','PENDING',NULL,NULL,'2026-04-18 10:00:00','2026-04-18 10:00:00'),(2,11,4,'FEE','发票抬头需要调整为公司名称。','DONE','客服已跟进并重新发送电子发票','2026-04-17 22:40:00','2026-04-17 22:10:00','2026-04-17 22:40:00'),(3,18,12,'SERVICE','加油','PENDING',NULL,NULL,'2026-04-24 14:28:47','2026-04-24 14:28:47');
/*!40000 ALTER TABLE `t_complaint` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_coupon`
--

DROP TABLE IF EXISTS `t_coupon`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_coupon` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `coupon_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '优惠券名称',
  `coupon_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '优惠券类型',
  `service_scope` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '适用服务范围',
  `threshold_amount` decimal(10,2) DEFAULT NULL COMMENT '门槛金额',
  `discount_amount` decimal(10,2) DEFAULT NULL COMMENT '减免金额',
  `discount_rate` decimal(10,2) DEFAULT NULL COMMENT '折扣率',
  `stackable` int NOT NULL DEFAULT '0' COMMENT '是否可叠加',
  `total_count` int NOT NULL COMMENT '总库存',
  `remain_count` int NOT NULL COMMENT '剩余库存',
  `status` int NOT NULL DEFAULT '1' COMMENT '状态',
  `receive_limit_per_user` int NOT NULL DEFAULT '1' COMMENT '单人领取上限',
  `valid_start_time` datetime NOT NULL COMMENT '生效开始时间',
  `valid_end_time` datetime NOT NULL COMMENT '生效结束时间',
  `rule_desc` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '规则描述',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_coupon_status` (`status`),
  KEY `idx_coupon_scope` (`service_scope`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='优惠券模板表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_coupon`
--

LOCK TABLES `t_coupon` WRITE;
/*!40000 ALTER TABLE `t_coupon` DISABLE KEYS */;
INSERT INTO `t_coupon` VALUES (1,'新人立减18元券','CASH','ALL',40.00,18.00,NULL,0,1000,995,1,1,'2026-01-01 00:00:00','2026-12-31 23:59:59','首单满40元可减18元','2026-01-01 00:00:00','2026-04-18 00:00:00'),(2,'打车立减12元券','CASH','TAXI',50.00,12.00,NULL,0,800,794,1,2,'2026-01-01 00:00:00','2026-12-31 23:59:59','即时打车满50元减12元','2026-01-01 00:00:00','2026-04-18 00:00:00'),(3,'顺风车八折券','DISCOUNT','CARPOOL',20.00,NULL,0.80,0,600,595,1,2,'2026-01-01 00:00:00','2026-12-31 23:59:59','顺风车订单享受8折优惠','2026-01-01 00:00:00','2026-04-18 00:00:00'),(4,'国际出行20美元券','CASH','INTERNATIONAL',50.00,20.00,NULL,0,300,298,1,1,'2026-01-01 00:00:00','2026-12-31 23:59:59','国际出行满50美元减20美元','2026-01-01 00:00:00','2026-04-18 00:00:00'),(5,'通勤补贴10元券','CASH','TAXI',30.00,10.00,NULL,0,500,498,1,2,'2026-01-01 00:00:00','2026-12-31 23:59:59','工作日通勤满30元减10元','2026-01-01 00:00:00','2026-04-18 00:00:00'),(6,'5元立减券','CASH','ALL',5.00,5.00,NULL,0,19,16,1,5,'2026-04-19 00:00:00','2026-12-31 23:59:59','限时福利','2026-04-24 13:18:31','2026-04-24 13:18:31'),(7,'8元优惠','CASH','ALL',10.00,8.00,0.80,0,19,17,1,5,'2026-04-19 00:00:00','2026-12-31 23:59:59','限时优惠','2026-05-12 22:56:16','2026-05-12 22:56:16');
/*!40000 ALTER TABLE `t_coupon` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_coupon_operation_log`
--

DROP TABLE IF EXISTS `t_coupon_operation_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_coupon_operation_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `coupon_id` bigint NOT NULL COMMENT '优惠券模板ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `user_coupon_id` bigint DEFAULT NULL COMMENT '用户优惠券ID',
  `order_id` bigint DEFAULT NULL COMMENT '订单ID',
  `operation_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '操作类型',
  `content` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '操作说明',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_coupon_operation_user` (`user_id`),
  KEY `idx_coupon_operation_coupon` (`coupon_id`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='优惠券操作日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_coupon_operation_log`
--

LOCK TABLES `t_coupon_operation_log` WRITE;
/*!40000 ALTER TABLE `t_coupon_operation_log` DISABLE KEYS */;
INSERT INTO `t_coupon_operation_log` VALUES (1,1,2,1001,NULL,'INIT','为用户2初始化发放新人立减券','2026-04-01 08:30:00','2026-04-01 08:30:00'),(2,2,2,1002,NULL,'INIT','为用户2初始化发放打车立减券','2026-04-05 09:10:00','2026-04-05 09:10:00'),(3,2,2,1002,1,'USE','订单 SX202604180001 使用了优惠券','2026-04-18 10:40:00','2026-04-18 10:40:00'),(4,3,5,1007,NULL,'USER_RECEIVE','用户领取了顺风车折扣券','2026-04-17 20:30:00','2026-04-17 20:30:00'),(5,3,5,1007,7,'USE','订单 SX202604180007 使用了优惠券','2026-04-18 09:00:00','2026-04-18 09:00:00'),(6,4,2,1010,NULL,'INIT','为用户2初始化发放国际出行券','2026-04-12 10:00:00','2026-04-12 10:00:00'),(7,4,2,1010,9,'USE','订单 SX202604180009 使用了优惠券','2026-04-18 09:28:00','2026-04-18 09:28:00'),(8,2,4,1006,NULL,'ADMIN_GRANT','管理员向用户4发放打车券','2026-04-12 12:00:00','2026-04-12 12:00:00'),(9,1,3,1005,NULL,'EXPIRE','优惠券已自动过期','2026-04-01 00:00:00','2026-04-01 00:00:00'),(10,5,6,1008,NULL,'EXPIRE','优惠券已自动过期','2026-04-11 00:00:00','2026-04-11 00:00:00'),(11,6,12,1011,NULL,'USER_RECEIVE','优惠券发放成功','2026-04-24 13:18:59','2026-04-24 13:18:59'),(12,6,12,1011,NULL,'USE','Coupon used and bound to order','2026-04-24 13:19:08','2026-04-24 13:19:08'),(13,6,12,1011,13,'BIND_ORDER','Coupon bound to order','2026-04-24 13:19:08','2026-04-24 13:19:08'),(14,6,12,1011,13,'ROLLBACK','Coupon returned after order cancellation','2026-04-24 13:19:21','2026-04-24 13:19:21'),(15,6,12,1011,NULL,'USE','Coupon used and bound to order','2026-04-24 13:20:04','2026-04-24 13:20:04'),(16,6,12,1011,14,'BIND_ORDER','Coupon bound to order','2026-04-24 13:20:04','2026-04-24 13:20:04'),(17,6,12,1011,14,'ROLLBACK','Coupon returned after order cancellation','2026-04-24 13:20:27','2026-04-24 13:20:27'),(18,6,12,1011,NULL,'USE','Coupon used and bound to order','2026-04-24 13:20:37','2026-04-24 13:20:37'),(19,6,12,1011,15,'BIND_ORDER','Coupon bound to order','2026-04-24 13:20:37','2026-04-24 13:20:37'),(20,6,12,1011,15,'ROLLBACK','Coupon returned after order cancellation','2026-04-24 13:21:07','2026-04-24 13:21:07'),(21,6,12,1011,NULL,'USE','Coupon used and bound to order','2026-04-24 13:25:19','2026-04-24 13:25:19'),(22,6,12,1011,16,'BIND_ORDER','Coupon bound to order','2026-04-24 13:25:19','2026-04-24 13:25:19'),(23,2,12,1012,NULL,'USER_RECEIVE','优惠券发放成功','2026-04-24 13:33:44','2026-04-24 13:33:44'),(24,6,12,1013,NULL,'USER_RECEIVE','优惠券发放成功','2026-04-24 14:20:35','2026-04-24 14:20:35'),(25,6,12,1013,NULL,'USE','Coupon used and bound to order','2026-04-24 14:20:40','2026-04-24 14:20:40'),(26,6,12,1013,17,'BIND_ORDER','Coupon bound to order','2026-04-24 14:20:40','2026-04-24 14:20:40'),(27,3,12,1014,NULL,'USER_RECEIVE','优惠券发放成功','2026-04-24 14:25:47','2026-04-24 14:25:47'),(28,3,12,1015,NULL,'USER_RECEIVE','优惠券发放成功','2026-05-12 22:52:19','2026-05-12 22:52:19'),(29,2,12,1016,NULL,'USER_RECEIVE','优惠券发放成功','2026-05-12 22:53:26','2026-05-12 22:53:26'),(30,2,12,1016,NULL,'USE','Coupon used and bound to order','2026-05-12 22:54:07','2026-05-12 22:54:07'),(31,2,12,1016,21,'BIND_ORDER','Coupon bound to order','2026-05-12 22:54:07','2026-05-12 22:54:07'),(32,2,12,1016,21,'ROLLBACK','Coupon returned after order cancellation','2026-05-12 22:54:11','2026-05-12 22:54:11'),(33,7,12,1017,NULL,'USER_RECEIVE','优惠券发放成功','2026-05-12 22:56:29','2026-05-12 22:56:29'),(34,7,12,1017,NULL,'USE','Coupon used and bound to order','2026-05-12 22:57:10','2026-05-12 22:57:10'),(35,7,12,1017,22,'BIND_ORDER','Coupon bound to order','2026-05-12 22:57:10','2026-05-12 22:57:10'),(36,7,12,1018,NULL,'ADMIN_GRANT','优惠券发放成功','2026-05-13 00:04:28','2026-05-13 00:04:28'),(37,6,12,1019,NULL,'ADMIN_GRANT','优惠券发放成功','2026-05-13 00:04:56','2026-05-13 00:04:56');
/*!40000 ALTER TABLE `t_coupon_operation_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_driver_profile`
--

DROP TABLE IF EXISTS `t_driver_profile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_driver_profile` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` bigint NOT NULL COMMENT '司机用户ID',
  `driver_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '司机编号',
  `license_no` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '驾驶证号',
  `service_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '接单状态',
  `audit_status` int NOT NULL DEFAULT '0' COMMENT '资质审核状态',
  `score` decimal(4,2) NOT NULL DEFAULT '5.00' COMMENT '评分',
  `total_income` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '累计收益',
  `withdrawable_income` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '可提现收益',
  `city_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '城市编码',
  `last_longitude` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '最后上报经度',
  `last_latitude` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '最后上报纬度',
  `audit_remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '审核备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_driver_profile_user` (`user_id`),
  KEY `idx_driver_profile_status` (`service_status`),
  CONSTRAINT `fk_driver_profile_user` FOREIGN KEY (`user_id`) REFERENCES `t_platform_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='司机资料表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_driver_profile`
--

LOCK TABLES `t_driver_profile` WRITE;
/*!40000 ALTER TABLE `t_driver_profile` DISABLE KEYS */;
INSERT INTO `t_driver_profile` VALUES (1,7,'DRV2026001','沪驾字2026001','ONLINE',2,4.97,1336.51,294.21,'310100','117.07822','39.98246','车辆资料审核通过，司机可正常接单','2026-02-20 09:00:00','2026-04-18 18:20:00'),(2,8,'DRV2026002','沪驾字2026002','BUSY',2,4.88,1110.20,520.00,'310100','121.4550','31.2208','已通过平台审核，可正常接单','2026-02-28 10:30:00','2026-04-18 16:40:00'),(3,9,'DRV2026003','苏驾字2026003','OFFLINE',1,5.00,0.00,0.00,'320500','120.5853','31.2989','待管理员审核','2026-04-02 12:00:00','2026-04-18 09:18:00'),(4,10,'DRV2026004','沪驾字2026004','BUSY',2,4.92,1588.40,688.00,'310100','121.4100','31.2255','已通过平台审核，可正常接单','2026-03-05 08:00:00','2026-04-18 16:20:00'),(5,11,'DRV11','PENDING','OFFLINE',2,5.00,0.00,0.00,'310100','117.07822','39.98246','车辆资料已提交，等待审核','2026-04-24 13:08:06','2026-04-24 13:08:06');
/*!40000 ALTER TABLE `t_driver_profile` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_finance_flow`
--

DROP TABLE IF EXISTS `t_finance_flow`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_finance_flow` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `biz_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `biz_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `order_id` bigint DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  `driver_id` bigint DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `direction` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `currency_code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'CNY',
  `flow_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'SUCCESS',
  `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_finance_biz_no` (`biz_no`),
  KEY `idx_finance_order_id` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_finance_flow`
--

LOCK TABLES `t_finance_flow` WRITE;
/*!40000 ALTER TABLE `t_finance_flow` DISABLE KEYS */;
INSERT INTO `t_finance_flow` VALUES (1,'ORDER_PAY','FLOW202604180001',1,2,7,56.00,'IN','CNY','SUCCESS','即时打车订单支付入账','2026-04-18 10:45:00','2026-04-18 10:45:00'),(2,'DRIVER_INCOME','FLOW202604180002',1,NULL,7,45.92,'OUT','CNY','SUCCESS','订单1司机收益','2026-04-18 10:46:00','2026-04-18 10:46:00'),(3,'PLATFORM_COMMISSION','FLOW202604180003',1,NULL,7,10.08,'IN','CNY','SUCCESS','订单1平台服务费','2026-04-18 10:46:00','2026-04-18 10:46:00'),(4,'ORDER_PAY','FLOW202604180004',7,5,8,45.00,'IN','CNY','SUCCESS','顺风车订单支付入账','2026-04-18 09:06:00','2026-04-18 09:06:00'),(5,'DRIVER_INCOME','FLOW202604180005',7,NULL,8,36.90,'OUT','CNY','SUCCESS','订单7司机收益','2026-04-18 09:07:00','2026-04-18 09:07:00'),(6,'ORDER_PAY','FLOW202604180006',9,2,7,420.00,'IN','USD','SUCCESS','国际出行订单支付入账','2026-04-18 09:33:00','2026-04-18 09:33:00'),(7,'DRIVER_INCOME','FLOW202604180007',9,NULL,7,344.40,'OUT','USD','SUCCESS','订单9司机收益','2026-04-18 09:34:00','2026-04-18 09:34:00'),(8,'PLATFORM_COMMISSION','FLOW202604180008',9,NULL,7,75.60,'IN','USD','SUCCESS','订单9平台服务费','2026-04-18 09:34:00','2026-04-18 09:34:00'),(9,'ORDER_PAY','FLOW202604170009',11,4,7,52.00,'IN','CNY','SUCCESS','历史即时打车订单支付','2026-04-17 21:57:00','2026-04-17 21:57:00'),(10,'ORDER_PAY','FLOW202604160010',12,2,8,36.00,'IN','CNY','SUCCESS','历史顺风车订单支付','2026-04-16 19:47:00','2026-04-16 19:47:00'),(11,'WITHDRAW_APPLY','FLOW202604180011',NULL,NULL,7,500.00,'OUT','CNY','PENDING','司机提现申请待审核','2026-04-18 16:30:00','2026-04-18 16:30:00'),(12,'WITHDRAW_APPLY','FLOW202604170012',NULL,NULL,8,800.00,'OUT','CNY','SUCCESS','司机提现申请已通过','2026-04-17 11:20:00','2026-04-17 11:20:00');
/*!40000 ALTER TABLE `t_finance_flow` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_message_record`
--

DROP TABLE IF EXISTS `t_message_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_message_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` bigint NOT NULL COMMENT '接收用户ID',
  `biz_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '业务类型',
  `template_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '模板编码',
  `title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '消息标题',
  `content` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '消息内容',
  `language_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'zh-CN' COMMENT '语言编码',
  `send_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '发送状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_message_record_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='消息推送记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_message_record`
--

LOCK TABLES `t_message_record` WRITE;
/*!40000 ALTER TABLE `t_message_record` DISABLE KEYS */;
INSERT INTO `t_message_record` VALUES (1,2,'ORDER','ORDER_CREATED','订单已提交','你的订单已进入派单队列。','zh-CN','SUCCESS','2026-04-18 09:58:10','2026-04-18 09:58:10'),(2,2,'PAYMENT','PAY_SUCCESS','支付成功','订单 SX202604180001 已完成支付。','zh-CN','SUCCESS','2026-04-18 10:45:10','2026-04-18 10:45:10'),(3,5,'ORDER','TRIP_STARTED','行程进行中','你的跨境行程已开始，请留意司机动态。','zh-CN','SUCCESS','2026-04-18 15:18:10','2026-04-18 15:18:10'),(4,7,'WITHDRAW','WITHDRAW_APPLY','提现待审核','你的提现申请正在等待管理员审核。','zh-CN','SUCCESS','2026-04-18 16:30:10','2026-04-18 16:30:10'),(5,4,'COMPLAINT','COMPLAINT_DONE','投诉已处理','客服已完成发票信息修改并重新发送。','zh-CN','SUCCESS','2026-04-17 22:41:00','2026-04-17 22:41:00'),(6,5,'ORDER','TRIP_FINISHED','行程已结束','行程已结束，请完成支付并评价。','zh-CN','SUCCESS','2026-04-24 12:43:54','2026-04-24 12:43:54'),(7,12,'COUPON','COUPON_RECEIVED','优惠券到账','优惠券 5元立减券 已发放到账','zh-CN','SUCCESS','2026-04-24 13:18:59','2026-04-24 13:18:59'),(8,12,'ORDER','ORDER_CREATED','订单已创建','订单已提交，正在等待司机接单。','zh-CN','SUCCESS','2026-04-24 13:19:08','2026-04-24 13:19:08'),(9,12,'ORDER','ORDER_CANCELLED','订单已取消','订单已取消，取消费用：0','zh-CN','SUCCESS','2026-04-24 13:19:21','2026-04-24 13:19:21'),(10,12,'ORDER','ORDER_CREATED','订单已创建','订单已提交，正在等待司机接单。','zh-CN','SUCCESS','2026-04-24 13:20:04','2026-04-24 13:20:04'),(11,12,'ORDER','ORDER_CANCELLED','订单已取消','订单已取消，取消费用：0','zh-CN','SUCCESS','2026-04-24 13:20:27','2026-04-24 13:20:27'),(12,12,'ORDER','ORDER_CREATED','订单已创建','订单已提交，正在等待司机接单。','zh-CN','SUCCESS','2026-04-24 13:20:37','2026-04-24 13:20:37'),(13,12,'ORDER','DRIVER_ACCEPTED','司机已接单','王凯司机已接单，请准备上车。','zh-CN','SUCCESS','2026-04-24 13:21:06','2026-04-24 13:21:06'),(14,12,'ORDER','ORDER_CANCELLED','订单已取消','订单已取消，取消费用：0','zh-CN','SUCCESS','2026-04-24 13:21:07','2026-04-24 13:21:07'),(15,11,'ORDER','ORDER_CANCELLED','乘客取消订单','乘客已取消订单，请留意大厅新订单。','zh-CN','SUCCESS','2026-04-24 13:21:07','2026-04-24 13:21:07'),(16,12,'ORDER','ORDER_CREATED','订单已创建','订单已提交，正在等待司机接单。','zh-CN','SUCCESS','2026-04-24 13:25:19','2026-04-24 13:25:19'),(17,12,'ORDER','DRIVER_ACCEPTED','司机已接单','王凯司机已接单，请准备上车。','zh-CN','SUCCESS','2026-04-24 13:25:25','2026-04-24 13:25:25'),(18,12,'ORDER','DRIVER_ARRIVED','司机已到达','司机已到达上车点，请确认上车。','zh-CN','SUCCESS','2026-04-24 13:26:42','2026-04-24 13:26:42'),(19,12,'ORDER','TRIP_STARTED','行程已开始','乘客已上车，行程已开始。','zh-CN','SUCCESS','2026-04-24 13:31:27','2026-04-24 13:31:27'),(20,12,'ORDER','TRIP_FINISHED','行程已结束','行程已结束，请完成支付并评价。','zh-CN','SUCCESS','2026-04-24 13:32:15','2026-04-24 13:32:15'),(21,12,'COUPON','COUPON_RECEIVED','优惠券到账','优惠券 打车立减12元券 已发放到账','zh-CN','SUCCESS','2026-04-24 13:33:44','2026-04-24 13:33:44'),(22,12,'COUPON','COUPON_RECEIVED','优惠券到账','优惠券 5元立减券 已发放到账','zh-CN','SUCCESS','2026-04-24 14:20:35','2026-04-24 14:20:35'),(23,12,'ORDER','ORDER_CREATED','订单已创建','订单已提交，正在等待司机接单。','zh-CN','SUCCESS','2026-04-24 14:20:40','2026-04-24 14:20:40'),(24,12,'ORDER','DRIVER_ACCEPTED','司机已接单','王凯司机已接单，请准备上车。','zh-CN','SUCCESS','2026-04-24 14:20:46','2026-04-24 14:20:46'),(25,12,'ORDER','DRIVER_ARRIVED','司机已到达','司机已到达上车点，请确认上车。','zh-CN','SUCCESS','2026-04-24 14:22:44','2026-04-24 14:22:44'),(26,12,'ORDER','TRIP_STARTED','行程已开始','乘客已上车，行程已开始。','zh-CN','SUCCESS','2026-04-24 14:23:08','2026-04-24 14:23:08'),(27,12,'ORDER','TRIP_FINISHED','行程已结束','行程已结束，请完成支付并评价。','zh-CN','SUCCESS','2026-04-24 14:23:34','2026-04-24 14:23:34'),(28,12,'COUPON','COUPON_RECEIVED','优惠券到账','优惠券 顺风车八折券 已发放到账','zh-CN','SUCCESS','2026-04-24 14:25:47','2026-04-24 14:25:47'),(29,12,'ORDER','ORDER_CREATED','订单已创建','订单已提交，正在等待司机接单。','zh-CN','SUCCESS','2026-04-24 14:26:12','2026-04-24 14:26:12'),(30,12,'ORDER','DRIVER_ACCEPTED','司机已接单','王凯司机已接单，请准备上车。','zh-CN','SUCCESS','2026-04-24 14:27:38','2026-04-24 14:27:38'),(31,12,'ORDER','DRIVER_ARRIVED','司机已到达','司机已到达上车点，请确认上车。','zh-CN','SUCCESS','2026-04-24 14:30:34','2026-04-24 14:30:34'),(32,12,'ORDER','TRIP_STARTED','行程已开始','乘客已上车，行程已开始。','zh-CN','SUCCESS','2026-04-24 14:31:12','2026-04-24 14:31:12'),(33,12,'ORDER','TRIP_FINISHED','行程已结束','行程已结束，请完成支付并评价。','zh-CN','SUCCESS','2026-04-24 14:31:23','2026-04-24 14:31:23'),(34,12,'ORDER','ORDER_CREATED','订单已创建','订单已提交，正在等待司机接单。','zh-CN','SUCCESS','2026-04-24 14:41:33','2026-04-24 14:41:33'),(35,12,'ORDER','DRIVER_ACCEPTED','司机已接单','王凯司机已接单，请准备上车。','zh-CN','SUCCESS','2026-04-24 14:41:40','2026-04-24 14:41:40'),(36,12,'ORDER','DRIVER_ARRIVED','司机已到达','司机已到达上车点，请确认上车。','zh-CN','SUCCESS','2026-04-24 14:45:01','2026-04-24 14:45:01'),(37,12,'ORDER','TRIP_STARTED','行程已开始','乘客已上车，行程已开始。','zh-CN','SUCCESS','2026-04-24 14:45:57','2026-04-24 14:45:57'),(38,12,'ORDER','TRIP_FINISHED','行程已结束','行程已结束，请完成支付并评价。','zh-CN','SUCCESS','2026-04-24 14:56:04','2026-04-24 14:56:04'),(39,12,'ORDER','ORDER_CREATED','订单已创建','订单已提交，正在等待司机接单。','zh-CN','SUCCESS','2026-04-24 15:05:53','2026-04-24 15:05:53'),(40,12,'ORDER','DRIVER_ACCEPTED','司机已接单','王凯司机已接单，请准备上车。','zh-CN','SUCCESS','2026-04-24 15:06:10','2026-04-24 15:06:10'),(41,12,'ORDER','DRIVER_ON_THE_WAY','司机接驾中','司机正在前往上车点，请保持电话畅通。','zh-CN','SUCCESS','2026-04-24 15:09:46','2026-04-24 15:09:46'),(42,12,'ORDER','TRIP_STARTED','行程已开始','乘客已上车，行程已开始。','zh-CN','SUCCESS','2026-04-24 15:09:49','2026-04-24 15:09:49'),(43,12,'ORDER','TRIP_FINISHED','行程已结束','行程已结束，请完成支付并评价。','zh-CN','SUCCESS','2026-04-24 15:09:58','2026-04-24 15:09:58'),(44,12,'COUPON','COUPON_RECEIVED','优惠券到账','优惠券 顺风车八折券 已发放到账','zh-CN','SUCCESS','2026-05-12 22:52:19','2026-05-12 22:52:19'),(45,12,'COUPON','COUPON_RECEIVED','优惠券到账','优惠券 打车立减12元券 已发放到账','zh-CN','SUCCESS','2026-05-12 22:53:26','2026-05-12 22:53:26'),(46,12,'ORDER','ORDER_CREATED','订单已创建','订单已提交，正在等待司机接单。','zh-CN','SUCCESS','2026-05-12 22:54:07','2026-05-12 22:54:07'),(47,12,'ORDER','ORDER_CANCELLED','订单已取消','订单已取消，取消费用：0','zh-CN','SUCCESS','2026-05-12 22:54:11','2026-05-12 22:54:11'),(48,12,'COUPON','COUPON_RECEIVED','优惠券到账','优惠券 8元优惠 已发放到账','zh-CN','SUCCESS','2026-05-12 22:56:29','2026-05-12 22:56:29'),(49,12,'ORDER','ORDER_CREATED','订单已创建','订单已提交，正在等待司机接单。','zh-CN','SUCCESS','2026-05-12 22:57:10','2026-05-12 22:57:10'),(50,12,'ORDER','DRIVER_ACCEPTED','司机已接单','一号司机已接单，请准备上车。','zh-CN','SUCCESS','2026-05-12 22:57:40','2026-05-12 22:57:40'),(51,12,'ORDER','DRIVER_ARRIVED','司机已到达','司机已到达上车点，请确认上车。','zh-CN','SUCCESS','2026-05-12 23:01:13','2026-05-12 23:01:13'),(52,12,'ORDER','TRIP_STARTED','行程已开始','乘客已上车，行程已开始。','zh-CN','SUCCESS','2026-05-12 23:05:58','2026-05-12 23:05:58'),(53,12,'ORDER','TRIP_FINISHED','行程已结束','行程已结束，请完成支付并评价。','zh-CN','SUCCESS','2026-05-12 23:07:58','2026-05-12 23:07:58'),(54,12,'COUPON','COUPON_RECEIVED','优惠券到账','优惠券 8元优惠 已发放到账','zh-CN','SUCCESS','2026-05-13 00:04:28','2026-05-13 00:04:28'),(55,12,'COUPON','COUPON_RECEIVED','优惠券到账','优惠券 5元立减券 已发放到账','zh-CN','SUCCESS','2026-05-13 00:04:56','2026-05-13 00:04:56'),(56,6,'ORDER','DRIVER_ARRIVED','司机已到达','司机已到达上车点，请确认上车。','zh-CN','SUCCESS','2026-05-13 00:47:17','2026-05-13 00:47:17'),(57,12,'PAYMENT','PAY_SUCCESS','支付成功','订单已完成支付，可查看订单详情。','zh-CN','SUCCESS','2026-05-13 01:02:08','2026-05-13 01:02:08');
/*!40000 ALTER TABLE `t_message_record` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_operation_log`
--

DROP TABLE IF EXISTS `t_operation_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_operation_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `operator_id` bigint DEFAULT NULL COMMENT '操作人ID',
  `operator_role` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '操作人角色',
  `biz_module` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '业务模块',
  `biz_action` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '操作动作',
  `target_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '目标类型',
  `target_id` bigint DEFAULT NULL COMMENT '目标ID',
  `content` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '操作描述',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_operation_log_module` (`biz_module`),
  KEY `idx_operation_log_operator` (`operator_id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='后台操作日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_operation_log`
--

LOCK TABLES `t_operation_log` WRITE;
/*!40000 ALTER TABLE `t_operation_log` DISABLE KEYS */;
INSERT INTO `t_operation_log` VALUES (1,1,'ADMIN','USER','AUDIT','USER',2,'已通过陈晓阳的实名认证审核','2026-04-10 10:00:00','2026-04-10 10:00:00'),(2,1,'ADMIN','DRIVER','AUDIT','DRIVER',7,'已通过一号司机的资质审核','2026-04-10 10:10:00','2026-04-10 10:10:00'),(3,1,'ADMIN','DRIVER','AUDIT','DRIVER',8,'已通过二号司机的资质审核','2026-04-10 10:15:00','2026-04-10 10:15:00'),(4,1,'ADMIN','COUPON','GRANT','USER_COUPON',1006,'已向用户4发放打车立减12元券','2026-04-12 12:00:00','2026-04-12 12:00:00'),(5,1,'ADMIN','FINANCE','WITHDRAW_AUDIT','WITHDRAW',2,'已通过2号提现申请','2026-04-17 11:20:00','2026-04-17 11:20:00'),(6,1,'ADMIN','USER','UPDATE','USER',7,'管理员编辑用户资料','2026-04-24 13:06:03','2026-04-24 13:06:03'),(7,1,'ADMIN','DRIVER','AUDIT','DRIVER',7,'管理员审核通过司机车辆资料','2026-04-24 13:06:44','2026-04-24 13:06:44'),(8,1,'ADMIN','DRIVER','AUDIT','DRIVER',11,'管理员审核通过司机车辆资料','2026-04-24 13:10:29','2026-04-24 13:10:29'),(9,1,'ADMIN','USER','UPDATE','USER',12,'管理员编辑用户资料','2026-04-24 13:13:07','2026-04-24 13:13:07'),(10,1,'ADMIN','USER','UPDATE','USER',12,'管理员编辑用户资料','2026-04-24 13:16:49','2026-04-24 13:16:49'),(11,1,'ADMIN','USER','UPDATE','USER',12,'管理员编辑用户资料','2026-04-24 13:17:10','2026-04-24 13:17:10'),(12,1,'ADMIN','USER','UPDATE','USER',12,'管理员编辑用户资料','2026-04-24 13:17:26','2026-04-24 13:17:26'),(13,1,'ADMIN','USER','AUDIT','USER',12,'实名认证审核结果：2','2026-04-24 13:17:31','2026-04-24 13:17:31'),(14,1,'ADMIN','COUPON','CREATE','COUPON',6,'管理员创建优惠券模板','2026-04-24 13:18:31','2026-04-24 13:18:31'),(15,1,'ADMIN','COUPON','CREATE','COUPON',7,'管理员创建优惠券模板','2026-05-12 22:56:16','2026-05-12 22:56:16'),(16,1,'ADMIN','COUPON','UPDATE','COUPON',7,'管理员编辑优惠券模板','2026-05-12 22:56:52','2026-05-12 22:56:52'),(17,1,'ADMIN','COUPON','GRANT','USER_COUPON',NULL,'管理员向用户 12 发放优惠券 8元优惠','2026-05-13 00:04:28','2026-05-13 00:04:28'),(18,1,'ADMIN','COUPON','GRANT','USER_COUPON',NULL,'管理员向用户 12 发放优惠券 5元立减券','2026-05-13 00:04:56','2026-05-13 00:04:56'),(19,1,'ADMIN','COUPON','UPDATE','COUPON',7,'管理员编辑优惠券模板','2026-05-13 00:28:46','2026-05-13 00:28:46'),(20,1,'ADMIN','COUPON','UPDATE','COUPON',6,'管理员编辑优惠券模板','2026-05-13 00:28:57','2026-05-13 00:28:57');
/*!40000 ALTER TABLE `t_operation_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_order_track`
--

DROP TABLE IF EXISTS `t_order_track`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_order_track` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `track_role` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `track_stage` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `latitude` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `longitude` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `speed_kmh` decimal(10,2) DEFAULT '0.00',
  `accuracy_meter` decimal(10,2) DEFAULT '0.00',
  `report_time` datetime NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_track_order_id` (`order_id`),
  KEY `idx_track_report_time` (`report_time`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_order_track`
--

LOCK TABLES `t_order_track` WRITE;
/*!40000 ALTER TABLE `t_order_track` DISABLE KEYS */;
INSERT INTO `t_order_track` VALUES (1,4,'DRIVER','PICKING_UP','31.2088','121.3510',32.00,8.00,'2026-04-18 14:09:00','2026-04-18 14:09:00'),(2,4,'DRIVER','PICKING_UP','31.2135','121.3688',34.00,8.00,'2026-04-18 14:11:00','2026-04-18 14:11:00'),(3,4,'DRIVER','PICKING_UP','31.2186','121.3876',30.00,7.00,'2026-04-18 14:13:00','2026-04-18 14:13:00'),(4,4,'DRIVER','PICKING_UP','31.2218','121.4105',26.00,7.00,'2026-04-18 14:15:00','2026-04-18 14:15:00'),(5,4,'DRIVER','PICKING_UP','31.2235','121.4320',18.00,6.00,'2026-04-18 14:17:00','2026-04-18 14:17:00'),(6,5,'DRIVER','IN_TRIP','31.2398','121.5065',36.00,8.00,'2026-04-18 15:20:00','2026-04-18 15:20:00'),(7,5,'DRIVER','IN_TRIP','31.2330','121.5580',42.00,8.00,'2026-04-18 15:24:00','2026-04-18 15:24:00'),(8,5,'DRIVER','IN_TRIP','31.2250','121.6120',48.00,7.00,'2026-04-18 15:28:00','2026-04-18 15:28:00'),(9,5,'DRIVER','IN_TRIP','31.2135','121.6880',50.00,7.00,'2026-04-18 15:33:00','2026-04-18 15:33:00'),(10,5,'DRIVER','IN_TRIP','31.1910','121.7600',46.00,7.00,'2026-04-18 15:38:00','2026-04-18 15:38:00'),(11,5,'DRIVER','IN_TRIP','31.1650','121.8000',28.00,6.00,'2026-04-18 15:42:00','2026-04-18 15:42:00'),(12,1,'DRIVER','IN_TRIP','31.2035','121.3500',35.00,8.00,'2026-04-18 10:15:00','2026-04-18 10:15:00'),(13,1,'DRIVER','IN_TRIP','31.2110','121.3880',38.00,8.00,'2026-04-18 10:20:00','2026-04-18 10:20:00'),(14,1,'DRIVER','IN_TRIP','31.2185','121.4210',34.00,7.00,'2026-04-18 10:25:00','2026-04-18 10:25:00'),(15,1,'DRIVER','IN_TRIP','31.2245','121.4480',22.00,7.00,'2026-04-18 10:30:00','2026-04-18 10:30:00'),(16,1,'DRIVER','IN_TRIP','31.2290','121.4700',16.00,6.00,'2026-04-18 10:35:00','2026-04-18 10:35:00'),(17,9,'DRIVER','IN_TRIP','22.4710','113.9400',55.00,10.00,'2026-04-18 08:20:00','2026-04-18 08:20:00'),(18,9,'DRIVER','IN_TRIP','22.4350','113.9350',60.00,10.00,'2026-04-18 08:38:00','2026-04-18 08:38:00'),(19,9,'DRIVER','IN_TRIP','22.3800','113.9280',58.00,9.00,'2026-04-18 08:56:00','2026-04-18 08:56:00'),(20,9,'DRIVER','IN_TRIP','22.3250','113.9200',35.00,8.00,'2026-04-18 09:20:00','2026-04-18 09:20:00');
/*!40000 ALTER TABLE `t_order_track` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_payment_record`
--

DROP TABLE IF EXISTS `t_payment_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_payment_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `order_id` bigint NOT NULL COMMENT '订单ID',
  `pay_no` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '支付单号',
  `pay_channel` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '支付渠道',
  `pay_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '支付状态',
  `pay_amount` decimal(10,2) NOT NULL COMMENT '支付金额',
  `currency_code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '币种',
  `mock_transaction_no` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '模拟交易号',
  `refund_amount` decimal(10,2) DEFAULT NULL COMMENT '退款金额',
  `refund_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '退款原因',
  `refunded_at` datetime DEFAULT NULL COMMENT '退款时间',
  `paid_at` datetime DEFAULT NULL COMMENT '支付时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payment_record_pay_no` (`pay_no`),
  KEY `idx_payment_record_order` (`order_id`),
  CONSTRAINT `fk_payment_record_order` FOREIGN KEY (`order_id`) REFERENCES `t_ride_order` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='支付流水表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_payment_record`
--

LOCK TABLES `t_payment_record` WRITE;
/*!40000 ALTER TABLE `t_payment_record` DISABLE KEYS */;
INSERT INTO `t_payment_record` VALUES (1,1,'PAY202604180001','WECHAT_MOCK','PAID',46.12,'CNY','MOCK-TRADE-180001',NULL,NULL,NULL,'2026-04-18 10:45:00','2026-04-18 10:45:00','2026-04-18 10:45:00'),(2,7,'PAY202604180007','WECHAT_MOCK','PAID',42.30,'CNY','MOCK-TRADE-180007',NULL,NULL,NULL,'2026-04-18 09:06:00','2026-04-18 09:06:00','2026-04-18 09:06:00'),(3,9,'PAY202604180009','WECHAT_MOCK','PAID',78.18,'USD','MOCK-TRADE-180009',NULL,NULL,NULL,'2026-04-18 09:33:00','2026-04-18 09:33:00','2026-04-18 09:33:00'),(4,11,'PAY202604170011','WECHAT_MOCK','PAID',47.31,'CNY','MOCK-TRADE-170011',NULL,NULL,NULL,'2026-04-17 21:57:00','2026-04-17 21:57:00','2026-04-17 21:57:00'),(5,12,'PAY202604160012','WECHAT_MOCK','PAID',80.16,'CNY','MOCK-TRADE-160012',NULL,NULL,NULL,'2026-04-16 19:47:00','2026-04-16 19:47:00','2026-04-16 19:47:00'),(6,22,'PAY2054245752422891520','WECHAT','PAID',9.89,'CNY','MOCK-405b66e3197e493890988cc245f4d70e',NULL,NULL,NULL,'2026-05-13 01:02:08','2026-05-13 01:02:08','2026-05-13 01:02:08'),(7,16,'PAY-SYNC-ORD2047547411706273792','WECHAT_SYNC','PAID',21.61,'CNY','SYNC-ORD2047547411706273792',NULL,NULL,NULL,'2026-04-24 13:32:15','2026-05-13 13:56:48','2026-05-13 13:56:48'),(8,17,'PAY-SYNC-ORD2047561339144364032','WECHAT_SYNC','PAID',11.53,'CNY','SYNC-ORD2047561339144364032',NULL,NULL,NULL,'2026-04-24 14:23:34','2026-05-13 13:56:48','2026-05-13 13:56:48'),(9,18,'PAY-SYNC-ORD2047562734136320000','WECHAT_SYNC','PAID',232.62,'CNY','SYNC-ORD2047562734136320000',NULL,NULL,NULL,'2026-04-24 14:31:23','2026-05-13 13:56:48','2026-05-13 13:56:48'),(10,19,'PAY-SYNC-ORD2047566597484568576','WECHAT_SYNC','PAID',33.93,'CNY','SYNC-ORD2047566597484568576',NULL,NULL,NULL,'2026-04-24 14:56:04','2026-05-13 13:56:48','2026-05-13 13:56:48'),(11,20,'PAY-SYNC-ORD2047572720736395264','WECHAT_SYNC','PAID',30.37,'CNY','SYNC-ORD2047572720736395264',NULL,NULL,NULL,'2026-04-24 15:09:58','2026-05-13 13:56:48','2026-05-13 13:56:48');
/*!40000 ALTER TABLE `t_payment_record` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_platform_user`
--

DROP TABLE IF EXISTS `t_platform_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_platform_user` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `open_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '微信OpenID/模拟ID',
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '手机号',
  `password` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '密码',
  `nickname` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '昵称',
  `avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '头像',
  `real_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '真实姓名',
  `id_card` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '身份证号',
  `gender` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '性别',
  `role_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '角色编码',
  `auth_status` int NOT NULL DEFAULT '0' COMMENT '实名认证状态',
  `enabled` int NOT NULL DEFAULT '1' COMMENT '是否启用',
  `wallet_balance` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '钱包余额',
  `emergency_contact` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '紧急联系人',
  `emergency_phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '紧急联系电话',
  `default_language` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'zh-CN' COMMENT '默认语言',
  `auth_remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '实名审核备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_platform_user_phone_role` (`phone`,`role_code`),
  KEY `idx_platform_user_role` (`role_code`),
  KEY `idx_platform_user_auth_status` (`auth_status`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='平台用户表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_platform_user`
--

LOCK TABLES `t_platform_user` WRITE;
/*!40000 ALTER TABLE `t_platform_user` DISABLE KEYS */;
INSERT INTO `t_platform_user` VALUES (1,'mock-admin-001','13700000001','$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m','系统管理员','/images/avatar-admin.svg','课程管理员','310101199001010011','MALE','ADMIN',2,1,0.00,'运维老师','13100000001','zh-CN','系统初始化管理员','2026-03-01 09:00:00','2026-04-18 08:00:00'),(2,'mock-user-001','13800000001','$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m','小阳乘客','/images/avatar-user.svg','陈晓阳','310101199804050026','FEMALE','USER',2,1,286.20,'陈妈妈','13200000001','zh-CN','实名认证已通过','2026-03-12 09:20:00','2026-04-18 18:10:00'),(3,'mock-user-002','13800000002','$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m','校园乘客','/images/avatar-user.svg','李明远','310101199706020033','MALE','USER',2,1,88.50,'李爸爸','13200000002','zh-CN','实名认证已通过','2026-03-28 10:15:00','2026-04-18 10:12:00'),(4,'mock-user-003','13800000003','$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m','城市通勤客','/images/avatar-user.svg','王晨曦','320101199912120028','FEMALE','USER',0,1,58.80,'王姐姐','13200000003','zh-CN','新注册用户待实名','2026-04-10 18:05:00','2026-04-18 12:26:00'),(5,'mock-user-004','13800000004','$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m','商务出行客','/images/avatar-user.svg','周文博','330101199706062015','MALE','USER',2,1,120.00,'周同学','13200000004','zh-CN','高频乘客','2026-04-17 20:16:00','2026-04-18 15:22:00'),(6,'mock-user-005','13800000005','$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m','新注册乘客','/images/avatar-user.svg','孙悦然',NULL,'FEMALE','USER',1,1,15.50,'孙室友','13200000005','zh-CN','实名认证审核中','2026-04-18 08:45:00','2026-04-18 17:18:00'),(7,'mock-driver-001','13900000001','$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m','一号司机','/images/avatar-driver.svg','刘师傅','310101198605180037','MALE','DRIVER',2,1,0.00,'刘爱人','13300000009','zh-CN','司机资质审核通过','2026-02-20 08:30:00','2026-04-18 18:20:00'),(8,'mock-driver-002','13900000002','$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m','二号司机','/images/avatar-driver.svg','周师傅','310101198409210019','MALE','DRIVER',2,1,0.00,'周爱人','13300000002','zh-CN','司机资质审核通过','2026-02-28 10:10:00','2026-04-18 16:40:00'),(9,'mock-driver-003','13900000003','$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m','三号司机','/images/avatar-driver.svg','孙师傅','320101198711110035','MALE','DRIVER',1,1,0.00,'孙爸爸','13300000003','zh-CN','司机资质审核中','2026-04-02 11:45:00','2026-04-18 09:18:00'),(10,'mock-driver-004','13900000004','$2a$10$3Y9BVxGLBVkMjScULzO3ne6Bgw/DX5A9Pk0uWzrJ.mVGFrAtXTC8m','四号司机','/images/avatar-driver.svg','顾师傅','310101198812120014','MALE','DRIVER',2,1,0.00,'顾姐姐','13300000004','zh-CN','司机资质审核通过','2026-03-05 07:45:00','2026-04-18 16:20:00'),(11,'mock-18888888888-DRIVER','18888888888','$2a$10$7/IVZUd32Yc7js0x15SVM.hEbb7Ch7mau6deVKRPFXtHpYHuHE5Da','王凯司机',NULL,NULL,NULL,NULL,'DRIVER',0,1,200.00,NULL,NULL,'zh-CN',NULL,'2026-04-24 13:08:06','2026-04-24 13:08:06'),(12,'mock-19999999999-USER','19999999999','$2a$10$owyxHYjqEp8xCW2PVhi.2efez8LXdC5S2G6M1nltCJjxQlFeGgxTa','李cb','/images/avatar-user.svg','李佳韦','152365422522001238',NULL,'USER',2,1,200.00,'王小帅','1666666666','zh-CN','用户已提交实名认证，待管理员审核','2026-04-24 13:11:06','2026-04-24 13:11:06');
/*!40000 ALTER TABLE `t_platform_user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_ride_order`
--

DROP TABLE IF EXISTS `t_ride_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_ride_order` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `order_no` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '订单号',
  `user_id` bigint NOT NULL COMMENT '乘客ID',
  `driver_id` bigint DEFAULT NULL COMMENT '司机ID',
  `car_type_id` bigint NOT NULL COMMENT '车型ID',
  `service_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '服务类型',
  `order_status` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '订单状态',
  `start_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '起点名称',
  `start_lng` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '起点经度',
  `start_lat` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '起点纬度',
  `end_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '终点名称',
  `end_lng` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '终点经度',
  `end_lat` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '终点纬度',
  `estimated_distance_km` decimal(10,2) NOT NULL COMMENT '预估里程',
  `estimated_duration_min` decimal(10,2) NOT NULL COMMENT '预估时长',
  `estimated_amount` decimal(10,2) NOT NULL COMMENT '预估金额',
  `coupon_discount` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '优惠金额',
  `user_coupon_id` bigint DEFAULT NULL COMMENT '使用的用户优惠券ID',
  `payable_amount` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '应付金额',
  `actual_amount` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '实际金额',
  `actual_distance_km` decimal(10,2) DEFAULT NULL COMMENT '实际里程',
  `actual_duration_min` decimal(10,2) DEFAULT NULL COMMENT '实际时长',
  `night_surcharge_amount` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '夜间附加费',
  `long_distance_surcharge_amount` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '远途附加费',
  `platform_commission_amount` decimal(10,2) DEFAULT NULL COMMENT '平台佣金',
  `driver_income_amount` decimal(10,2) DEFAULT NULL COMMENT '司机收益',
  `exchange_rate` decimal(10,2) NOT NULL DEFAULT '1.00' COMMENT '汇率',
  `currency_code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '币种',
  `dispatch_mode` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '派单模式',
  `pay_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '支付状态',
  `cancel_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '取消原因',
  `cancel_by_role` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '取消角色',
  `cancel_fee` decimal(10,2) DEFAULT NULL COMMENT '取消违约金',
  `refund_amount` decimal(10,2) DEFAULT NULL COMMENT '退款金额',
  `refund_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '退款原因',
  `refunded_at` datetime DEFAULT NULL COMMENT '退款时间',
  `accepted_at` datetime DEFAULT NULL COMMENT '接单时间',
  `started_at` datetime DEFAULT NULL COMMENT '上车时间',
  `finished_at` datetime DEFAULT NULL COMMENT '完单时间',
  `paid_at` datetime DEFAULT NULL COMMENT '支付时间',
  `invoice_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '开票状态',
  `evaluation_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '评价状态',
  `complaint_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '投诉状态',
  `settlement_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '结算状态',
  `language_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'zh-CN' COMMENT '语言编码',
  `remark` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ride_order_no` (`order_no`),
  KEY `idx_ride_order_user_status` (`user_id`,`order_status`),
  KEY `idx_ride_order_driver_status` (`driver_id`,`order_status`),
  KEY `idx_ride_order_pay_status` (`pay_status`),
  KEY `fk_ride_order_car_type` (`car_type_id`),
  CONSTRAINT `fk_ride_order_car_type` FOREIGN KEY (`car_type_id`) REFERENCES `t_car_type` (`id`),
  CONSTRAINT `fk_ride_order_driver` FOREIGN KEY (`driver_id`) REFERENCES `t_platform_user` (`id`),
  CONSTRAINT `fk_ride_order_user` FOREIGN KEY (`user_id`) REFERENCES `t_platform_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='打车订单表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_ride_order`
--

LOCK TABLES `t_ride_order` WRITE;
/*!40000 ALTER TABLE `t_ride_order` DISABLE KEYS */;
INSERT INTO `t_ride_order` VALUES (1,'SX202604180001',2,7,1,'TAXI','FINISHED','上海虹桥站','121.3270','31.2000','人民广场','121.4737','31.2304',15.20,32.00,58.12,12.00,1002,46.12,49.22,15.80,34.00,0.00,0.00,9.84,39.38,1.00,'CNY','SMART','PAID',NULL,NULL,0.00,NULL,NULL,NULL,'2026-04-18 10:05:00','2026-04-18 10:12:00','2026-04-18 10:44:00','2026-04-18 10:45:00','NONE','DONE:5:本次行程体验很好','NONE','DONE','zh-CN','带优惠券的已完成打车订单','2026-04-18 09:58:00','2026-05-13 14:14:46'),(2,'SX202604180002',4,NULL,2,'TAXI','DISPATCHING','陆家嘴中心','121.4998','31.2397','上海交通大学闵行校区','121.4331','31.0236',24.80,46.00,122.06,0.00,NULL,122.06,122.06,NULL,NULL,0.00,0.00,NULL,NULL,1.00,'CNY','SMART','UNPAID',NULL,NULL,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'NONE','PENDING','NONE','PENDING','zh-CN','等待派单','2026-04-18 11:15:00','2026-05-13 14:14:46'),(3,'SX202604180003',6,8,2,'TAXI','PICKING_UP','静安寺','121.4451','31.2239','上海迪士尼度假区','121.6570','31.1430',26.50,52.00,138.65,0.00,NULL,138.65,138.65,NULL,NULL,0.00,0.00,NULL,NULL,1.00,'CNY','SMART','UNPAID',NULL,NULL,0.00,NULL,NULL,NULL,'2026-04-18 13:23:00',NULL,NULL,NULL,'NONE','PENDING','NONE','PENDING','zh-CN','司机已接单，正在前往起点','2026-04-18 13:20:00','2026-05-13 14:14:46'),(4,'SX202604180004',3,10,1,'TAXI','PICKING_UP','上海虹桥机场T2','121.3270','31.2000','静安寺','121.4451','31.2239',14.20,30.00,52.67,0.00,NULL,52.67,52.67,NULL,NULL,0.00,0.00,NULL,NULL,1.00,'CNY','SMART','UNPAID',NULL,NULL,0.00,NULL,NULL,NULL,'2026-04-18 14:08:00',NULL,NULL,NULL,'NONE','PENDING','NONE','PENDING','zh-CN','司机接驾中','2026-04-18 14:05:00','2026-05-13 14:14:46'),(5,'SX202604180005',5,7,3,'INTERNATIONAL','FINISHED','深圳湾口岸，中国深圳','113.9459','22.5027','香港国际机场，中国香港','113.9185','22.3080',58.00,90.00,98.18,0.00,NULL,68.26,68.26,37.57,85.25,0.00,2.65,13.65,54.61,7.15,'USD','SMART','UNPAID',NULL,NULL,0.00,NULL,NULL,NULL,'2026-04-18 15:03:00','2026-04-18 15:18:00','2026-04-24 12:43:54',NULL,'NONE','PENDING','NONE','PENDING','zh-CN','跨境行程进行中','2026-04-18 15:00:00','2026-05-13 14:14:46'),(6,'SX202604180006',2,NULL,1,'TAXI','CANCELLED','上海大学','121.4580','31.3030','人民广场','121.4737','31.2304',9.50,24.00,37.40,0.00,NULL,0.00,0.00,NULL,NULL,0.00,0.00,NULL,NULL,1.00,'CNY','SMART','UNPAID','用户临时调整行程','USER',0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'NONE','NONE','NONE','CANCELLED','zh-CN','司机接单前已取消','2026-04-18 09:30:00','2026-05-13 14:14:46'),(7,'SX202604180007',5,8,1,'CARPOOL','FINISHED','陆家嘴中心','121.4998','31.2397','上海交通大学闵行校区','121.4331','31.0236',22.00,48.00,52.87,10.57,1007,42.30,42.30,22.00,48.00,0.00,0.00,8.46,33.84,1.00,'CNY','CARPOOL_MATCH','PAID',NULL,NULL,0.00,NULL,NULL,NULL,'2026-04-18 08:18:00','2026-04-18 08:22:00','2026-04-18 09:05:00','2026-04-18 09:06:00','NONE','DONE:5:顺风车沟通顺畅','NONE','DONE','zh-CN','已完成顺风车订单','2026-04-18 08:10:00','2026-05-13 14:14:46'),(8,'SX202604180008',6,NULL,1,'CARPOOL','DISPATCHING','上海虹桥机场T2','121.3270','31.2000','上海迪士尼度假区','121.6570','31.1430',24.00,46.00,50.75,0.00,NULL,50.75,50.75,NULL,NULL,0.00,0.00,NULL,NULL,1.00,'CNY','CARPOOL_MATCH','UNPAID',NULL,NULL,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'NONE','PENDING','NONE','PENDING','zh-CN','等待匹配拼车','2026-04-18 16:10:00','2026-05-13 14:14:46'),(9,'SX202604180009',2,10,3,'INTERNATIONAL','FINISHED','深圳湾口岸，中国深圳','113.9459','22.5027','香港国际机场，中国香港','113.9185','22.3080',58.00,90.00,98.18,20.00,1010,78.18,78.18,58.00,90.00,0.00,9.79,15.64,62.54,7.15,'USD','SMART','PAID',NULL,NULL,0.00,NULL,NULL,NULL,'2026-04-18 07:52:00','2026-04-18 08:05:00','2026-04-18 09:32:00','2026-04-18 09:33:00','NONE','DONE:4:国际出行服务不错','PENDING','DONE','zh-CN','已完成国际接送机订单','2026-04-18 07:40:00','2026-05-13 14:14:46'),(10,'SX202604180010',4,NULL,3,'INTERNATIONAL','CANCELLED','香港国际机场，中国香港','113.9185','22.3080','澳门渔人码头，中国澳门','113.5582','22.1959',65.00,96.00,108.07,0.00,NULL,0.00,0.00,NULL,NULL,0.00,11.19,NULL,NULL,7.15,'USD','SMART','UNPAID','行程安排变化','USER',0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'NONE','NONE','NONE','CANCELLED','zh-CN','国际订单已取消','2026-04-18 17:20:00','2026-05-13 14:14:46'),(11,'SX202604170011',4,7,1,'TAXI','FINISHED','上海虹桥机场T2','121.3270','31.2000','静安寺','121.4451','31.2239',12.60,28.00,47.31,0.00,NULL,47.31,47.31,12.60,28.00,0.00,0.00,9.46,37.85,1.00,'CNY','SMART','PAID',NULL,NULL,0.00,NULL,NULL,NULL,'2026-04-17 21:20:00','2026-04-17 21:28:00','2026-04-17 21:56:00','2026-04-17 21:57:00','NONE','DONE:4:整体体验不错','DONE','DONE','zh-CN','昨日已完成订单','2026-04-17 21:15:00','2026-05-13 14:14:46'),(12,'SX202604160012',2,8,1,'CARPOOL','FINISHED','上海大学','121.4580','31.3030','苏州工业园区','120.7219','31.3240',36.00,58.00,80.16,0.00,NULL,80.16,80.16,36.00,58.00,0.00,7.20,16.03,64.13,1.00,'CNY','CARPOOL_MATCH','PAID',NULL,NULL,0.00,NULL,NULL,NULL,'2026-04-16 18:42:00','2026-04-16 18:50:00','2026-04-16 19:46:00','2026-04-16 19:47:00','NONE','PENDING','NONE','DONE','zh-CN','历史顺风车订单','2026-04-16 18:35:00','2026-05-13 14:14:46'),(13,'ORD2047545856265412608',12,NULL,1,'TAXI','CANCELLED','石家庄学院(北校区)','114.605157','38.034873','石家庄裕华万达广场','114.544842','38.024091',5.40,26.00,29.94,5.00,1011,0.00,0.00,NULL,NULL,0.00,0.00,NULL,NULL,1.00,'CNY','SMART','UNPAID','乘客主动取消','USER',0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'NONE','PENDING','NONE','CANCELLED','zh-CN','微信小程序乘客端下单 | SMART dispatch','2026-04-24 13:19:08','2026-05-13 14:14:46'),(14,'ORD2047546088759877632',12,NULL,1,'TAXI','CANCELLED','石家庄学院(北校区)','114.605157','38.034873','石家庄裕华万达广场','114.544842','38.024091',5.40,26.00,29.94,5.00,1011,0.00,0.00,NULL,NULL,0.00,0.00,NULL,NULL,1.00,'CNY','SMART','UNPAID','乘客主动取消','USER',0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'NONE','PENDING','NONE','CANCELLED','zh-CN','微信小程序乘客端下单 | SMART dispatch','2026-04-24 13:20:04','2026-05-13 14:14:46'),(15,'ORD2047546229331976192',12,11,1,'TAXI','CANCELLED','石家庄裕华万达广场','114.544842','38.024091','石家庄学院(北校区)','114.605157','38.034873',5.40,26.00,29.94,5.00,1011,0.00,0.00,NULL,NULL,0.00,0.00,NULL,NULL,1.00,'CNY','SMART','UNPAID','乘客主动取消','USER',0.00,NULL,NULL,NULL,'2026-04-24 13:21:05',NULL,NULL,NULL,'NONE','PENDING','NONE','CANCELLED','zh-CN','微信小程序乘客端下单 | SMART dispatch','2026-04-24 13:20:37','2026-05-13 14:14:46'),(16,'ORD2047547411706273792',12,11,1,'TAXI','FINISHED','石家庄学院(北校区)','114.605157','38.034873','石家庄裕华万达广场','114.544842','38.024091',5.40,26.00,29.94,5.00,1011,21.61,21.61,5.42,18.48,0.00,0.00,4.32,17.29,1.00,'CNY','SMART','PAID',NULL,NULL,NULL,NULL,NULL,NULL,'2026-04-24 13:25:25','2026-04-24 13:31:26','2026-04-24 13:32:15','2026-04-24 13:32:15','NONE','PENDING','NONE','DONE','zh-CN','微信小程序乘客端下单 | SMART dispatch','2026-04-24 13:25:19','2026-05-13 14:14:46'),(17,'ORD2047561339144364032',12,11,1,'TAXI','FINISHED','燕京理工学院','116.805618','40.00052','诸葛店[公交站]','116.78027','39.992558',2.30,16.00,19.20,5.00,1013,11.53,11.53,3.59,6.65,0.00,0.00,2.31,9.22,1.00,'CNY','SMART','PAID',NULL,NULL,NULL,NULL,NULL,NULL,'2026-04-24 14:20:46','2026-04-24 14:23:08','2026-04-24 14:23:34','2026-04-24 14:23:34','NONE','PENDING','NONE','DONE','zh-CN','微信小程序乘客端下单 | SMART dispatch','2026-04-24 14:20:40','2026-05-13 14:14:46'),(18,'ORD2047562734136320000',12,11,1,'CARPOOL','FINISHED','云南野生动物园','102.787801','25.096852','云南九乡国家地质公园','103.383429','25.068174',60.10,206.00,245.89,0.00,NULL,232.62,232.62,60.07,171.57,0.00,36.08,46.52,186.10,1.00,'CNY','CARPOOL_MATCH','PAID',NULL,NULL,NULL,NULL,NULL,NULL,'2026-04-24 14:27:38','2026-04-24 14:31:12','2026-04-24 14:31:23','2026-04-24 14:31:23','NONE','PENDING','PENDING','DONE','zh-CN','[CARPOOL_META]{\"departDate\":\"2026-04-24\",\"timeRange\":\"07:00-09:00\",\"passengerCount\":2,\"hasLuggage\":\"HAS_LUGGAGE\",\"tollMode\":\"PASSENGER_PAYS\",\"originalAmount\":30.05,\"discountAmount\":0,\"payableAmount\":30.05}[/CARPOOL_META]\n加油 | Manual dispatch','2026-04-24 14:26:12','2026-05-13 14:14:46'),(19,'ORD2047566597484568576',12,11,1,'CARPOOL','FINISHED','重庆中央公园','106.583861','29.716382','重庆园博园','106.551576','29.678899',5.20,25.00,24.62,0.00,NULL,33.93,33.93,8.53,30.10,0.00,0.00,6.79,27.14,1.00,'CNY','CARPOOL_MATCH','PAID',NULL,NULL,NULL,NULL,NULL,NULL,'2026-04-24 14:41:40','2026-04-24 14:45:57','2026-04-24 14:56:04','2026-04-24 14:56:04','NONE','PENDING','NONE','DONE','zh-CN','[CARPOOL_META]{\"departDate\":\"2026-04-24\",\"timeRange\":\"07:00-09:00\",\"passengerCount\":4,\"hasLuggage\":\"HAS_LUGGAGE\",\"tollMode\":\"NEGOTIABLE\",\"originalAmount\":2.6,\"discountAmount\":0,\"payableAmount\":2.6}[/CARPOOL_META] | Manual dispatch','2026-04-24 14:41:33','2026-05-13 14:14:46'),(20,'ORD2047572720736395264',12,11,1,'CARPOOL','FINISHED','重庆园博园','106.551576','29.678899','重庆中央公园','106.583861','29.716382',5.20,25.00,24.62,0.00,NULL,30.37,30.37,8.08,23.38,0.00,0.00,6.07,24.30,1.00,'CNY','CARPOOL_MATCH','PAID',NULL,NULL,NULL,NULL,NULL,NULL,'2026-04-24 15:06:10','2026-04-24 15:09:49','2026-04-24 15:09:58','2026-04-24 15:09:58','NONE','PENDING','NONE','DONE','zh-CN','[CARPOOL_META]{\"departDate\":\"2026-04-24\",\"timeRange\":\"07:00-09:00\",\"passengerCount\":1,\"hasLuggage\":\"NO_LUGGAGE\",\"tollMode\":\"NEGOTIABLE\",\"originalAmount\":2.6,\"discountAmount\":0,\"payableAmount\":2.6}[/CARPOOL_META] | Manual dispatch','2026-04-24 15:05:53','2026-05-13 14:14:46'),(21,'ORD2054213536611401728',12,NULL,1,'TAXI','CANCELLED','上海虹桥机场 T2','121.32756','31.20066','人民广场','121.4737','31.23037',14.30,55.00,66.13,12.00,1016,0.00,0.00,NULL,NULL,0.00,0.00,NULL,NULL,1.00,'CNY','SMART','UNPAID','乘客主动取消','USER',0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'NONE','PENDING','NONE','CANCELLED','zh-CN','微信小程序乘客端下单 | SMART dispatch','2026-05-12 22:54:07','2026-05-13 14:14:46'),(22,'ORD2054214302302568448',12,7,1,'TAXI','FINISHED','山西剧院(柳巷店)','112.567099','37.869326','山西省儿童医院','112.57355','37.87992',1.30,12.00,17.40,8.00,1017,9.89,9.89,1.31,1.97,5.00,0.00,1.98,7.91,1.00,'CNY','SMART','PAID',NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-12 22:57:40','2026-05-12 23:05:58','2026-05-12 23:07:58','2026-05-13 01:02:08','NONE','PENDING','NONE','DONE','zh-CN','微信小程序乘客端下单 | SMART dispatch','2026-05-12 22:57:10','2026-05-13 14:14:46');
/*!40000 ALTER TABLE `t_ride_order` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_system_config`
--

DROP TABLE IF EXISTS `t_system_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_system_config` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `config_key` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '配置键',
  `config_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '配置名称',
  `config_value` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '配置值',
  `config_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '配置类型',
  `config_group` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '配置分组',
  `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_system_config_key` (`config_key`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='系统配置表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_system_config`
--

LOCK TABLES `t_system_config` WRITE;
/*!40000 ALTER TABLE `t_system_config` DISABLE KEYS */;
INSERT INTO `t_system_config` VALUES (1,'platformCommissionRate','平台佣金比例','0.20','DECIMAL','ORDER','用于订单结算演示','2026-04-18 08:00:00','2026-04-18 08:00:00'),(2,'freeCancelMinutes','免费取消时长','3','NUMBER','ORDER','乘客下单后的免费取消分钟数','2026-04-18 08:00:00','2026-04-18 08:00:00'),(3,'nightTimeRange','夜间附加费时段','23:00-06:00','STRING','ORDER','夜间计费规则展示','2026-04-18 08:00:00','2026-04-18 08:00:00'),(4,'intlExchangeRate','国际出行汇率','7.15','DECIMAL','INTERNATIONAL','用于国际出行费用换算','2026-04-18 08:00:00','2026-04-18 08:00:00');
/*!40000 ALTER TABLE `t_system_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_system_notice`
--

DROP TABLE IF EXISTS `t_system_notice`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_system_notice` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '公告标题',
  `content` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '公告内容',
  `status` int NOT NULL DEFAULT '1' COMMENT '状态',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序',
  `target_role` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'ALL' COMMENT '目标角色',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_system_notice_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='系统公告表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_system_notice`
--

LOCK TABLES `t_system_notice` WRITE;
/*!40000 ALTER TABLE `t_system_notice` DISABLE KEYS */;
INSERT INTO `t_system_notice` VALUES (1,'夜间安全演示已开启','晚间订单已开启安全录音与紧急联系人展示能力，适合课堂演示。',1,100,'ALL','2026-04-18 08:00:00','2026-04-18 08:00:00'),(2,'国际出行支持多币种结算','港澳国际出行支持美元展示、中文下单与优惠券抵扣。',1,90,'USER','2026-04-18 08:00:00','2026-04-18 08:00:00'),(3,'司机提现审核时效','当前演示环境下提现申请会在一个工作日内完成审核。',1,80,'DRIVER','2026-04-18 08:00:00','2026-04-18 08:00:00');
/*!40000 ALTER TABLE `t_system_notice` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_system_version`
--

DROP TABLE IF EXISTS `t_system_version`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_system_version` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `version_no` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '版本号',
  `client_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '客户端类型',
  `release_note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '更新说明',
  `force_update` int NOT NULL DEFAULT '0' COMMENT '是否强制更新',
  `status` int NOT NULL DEFAULT '1' COMMENT '状态',
  `download_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '下载地址',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='版本管理表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_system_version`
--

LOCK TABLES `t_system_version` WRITE;
/*!40000 ALTER TABLE `t_system_version` DISABLE KEYS */;
INSERT INTO `t_system_version` VALUES (1,'1.0.0','ADMIN','首个课程大作业演示版，支持后台全链路操作。',0,1,'http://127.0.0.1:5173','2026-04-18 08:00:00','2026-04-18 08:00:00'),(2,'1.0.0','USER_MINIAPP','乘客端已支持打车、顺风车、国际出行、支付与评价闭环。',0,1,'微信开发者工具导入 sunshine-user-miniapp','2026-04-18 08:00:00','2026-04-18 08:00:00'),(3,'1.0.0','DRIVER_MINIAPP','司机端已支持听单、拒单、接单、开始行程、结束行程与提现。',0,1,'微信开发者工具导入 sunshine-driver-miniapp','2026-04-18 08:00:00','2026-04-18 08:00:00');
/*!40000 ALTER TABLE `t_system_version` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_travel_trace`
--

DROP TABLE IF EXISTS `t_travel_trace`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_travel_trace` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `order_id` bigint NOT NULL COMMENT '订单ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `driver_id` bigint DEFAULT NULL COMMENT '司机ID',
  `biz_role` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '上报角色',
  `longitude` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '经度',
  `latitude` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '纬度',
  `waiting_red_light` tinyint(1) NOT NULL DEFAULT '0' COMMENT '??????',
  `wait_seconds` bigint DEFAULT '0' COMMENT '??????',
  `current_wait_seconds` bigint DEFAULT '0' COMMENT '??????',
  `traffic_text` varchar(120) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '????',
  `waiting_text` varchar(120) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '????',
  `speed_kmh` decimal(10,2) DEFAULT NULL COMMENT '???????',
  `heading` decimal(10,2) DEFAULT NULL COMMENT '???????',
  `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '备注',
  `reported_at` datetime NOT NULL COMMENT '上报时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_travel_trace_order_time` (`order_id`,`reported_at`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='行程轨迹表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_travel_trace`
--

LOCK TABLES `t_travel_trace` WRITE;
/*!40000 ALTER TABLE `t_travel_trace` DISABLE KEYS */;
INSERT INTO `t_travel_trace` VALUES (1,4,3,10,'DRIVER','121.3510','31.2088',0,0,0,NULL,NULL,NULL,NULL,'正在前往上车点','2026-04-18 14:09:00','2026-04-18 14:09:00','2026-04-18 14:09:00'),(2,4,3,10,'DRIVER','121.3688','31.2135',0,0,0,NULL,NULL,NULL,NULL,'已进入机场快速路','2026-04-18 14:11:00','2026-04-18 14:11:00','2026-04-18 14:11:00'),(3,4,3,10,'DRIVER','121.3876','31.2186',0,0,0,NULL,NULL,NULL,NULL,'预计6分钟到达','2026-04-18 14:13:00','2026-04-18 14:13:00','2026-04-18 14:13:00'),(4,5,5,7,'DRIVER','113.9350','22.4350',0,0,0,NULL,NULL,NULL,NULL,'即将到达口岸检查点','2026-04-18 15:24:00','2026-04-18 15:24:00','2026-04-18 15:24:00'),(5,5,5,7,'DRIVER','113.9280','22.3800',0,0,0,NULL,NULL,NULL,NULL,'已驶入机场快速路','2026-04-18 15:33:00','2026-04-18 15:33:00','2026-04-18 15:33:00'),(6,5,5,7,'USER','113.9300','22.4020',0,0,0,NULL,NULL,NULL,NULL,'乘客主动上报位置','2026-04-18 15:30:00','2026-04-18 15:30:00','2026-04-18 15:30:00'),(7,1,2,7,'DRIVER','121.3880','31.2110',0,0,0,NULL,NULL,NULL,NULL,'行程中轨迹点示例','2026-04-18 10:20:00','2026-04-18 10:20:00','2026-04-18 10:20:00'),(8,1,2,7,'DRIVER','121.4480','31.2245',0,0,0,NULL,NULL,NULL,NULL,'即将到达终点','2026-04-18 10:30:00','2026-04-18 10:30:00','2026-04-18 10:30:00');
/*!40000 ALTER TABLE `t_travel_trace` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_user_coupon`
--

DROP TABLE IF EXISTS `t_user_coupon`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_user_coupon` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `coupon_id` bigint NOT NULL COMMENT '优惠券模板ID',
  `coupon_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '优惠券状态',
  `service_scope` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '适用服务范围',
  `valid_start_time` datetime NOT NULL COMMENT '生效开始时间',
  `valid_end_time` datetime NOT NULL COMMENT '生效结束时间',
  `bind_order_id` bigint DEFAULT NULL COMMENT '绑定订单ID',
  `receive_mode` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '发放方式',
  `used_at` datetime DEFAULT NULL COMMENT '使用时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_coupon_user_status` (`user_id`,`coupon_status`),
  KEY `idx_user_coupon_coupon` (`coupon_id`),
  CONSTRAINT `fk_user_coupon_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `t_coupon` (`id`),
  CONSTRAINT `fk_user_coupon_user` FOREIGN KEY (`user_id`) REFERENCES `t_platform_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1020 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户优惠券表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_user_coupon`
--

LOCK TABLES `t_user_coupon` WRITE;
/*!40000 ALTER TABLE `t_user_coupon` DISABLE KEYS */;
INSERT INTO `t_user_coupon` VALUES (1001,2,1,'UNUSED','ALL','2026-04-01 00:00:00','2026-12-31 23:59:59',NULL,'INIT',NULL,'2026-04-01 08:30:00','2026-04-18 08:30:00'),(1002,2,2,'USED','TAXI','2026-04-01 00:00:00','2026-12-31 23:59:59',1,'INIT','2026-04-18 10:40:00','2026-04-05 09:10:00','2026-04-18 10:45:00'),(1003,2,3,'UNUSED','CARPOOL','2026-04-10 00:00:00','2026-12-31 23:59:59',NULL,'INIT',NULL,'2026-04-10 09:00:00','2026-04-18 09:00:00'),(1004,2,4,'UNUSED','INTERNATIONAL','2026-04-10 00:00:00','2026-12-31 23:59:59',NULL,'INIT',NULL,'2026-04-10 09:30:00','2026-04-18 09:30:00'),(1005,3,1,'EXPIRED','ALL','2026-03-01 00:00:00','2026-03-31 23:59:59',NULL,'INIT',NULL,'2026-03-01 08:00:00','2026-04-01 00:00:00'),(1006,4,2,'UNUSED','TAXI','2026-04-12 00:00:00','2026-12-31 23:59:59',NULL,'ADMIN_GRANT',NULL,'2026-04-12 12:00:00','2026-04-18 12:00:00'),(1007,5,3,'USED','CARPOOL','2026-04-17 00:00:00','2026-12-31 23:59:59',7,'USER_RECEIVE','2026-04-18 09:00:00','2026-04-17 20:30:00','2026-04-18 09:00:00'),(1008,6,5,'EXPIRED','TAXI','2026-04-01 00:00:00','2026-04-10 23:59:59',NULL,'INIT',NULL,'2026-04-01 09:15:00','2026-04-11 00:00:00'),(1009,4,1,'UNUSED','ALL','2026-04-18 00:00:00','2026-12-31 23:59:59',NULL,'ADMIN_GRANT',NULL,'2026-04-18 08:10:00','2026-04-18 08:10:00'),(1010,2,4,'USED','INTERNATIONAL','2026-04-10 00:00:00','2026-12-31 23:59:59',9,'INIT','2026-04-18 09:28:00','2026-04-12 10:00:00','2026-04-18 09:32:00'),(1011,12,6,'USED','ALL','2026-04-19 00:00:00','2026-12-31 23:59:59',16,'USER_RECEIVE','2026-04-24 13:25:19','2026-04-24 13:18:59','2026-04-24 13:18:59'),(1012,12,2,'UNUSED','TAXI','2026-01-01 00:00:00','2026-12-31 23:59:59',NULL,'USER_RECEIVE',NULL,'2026-04-24 13:33:44','2026-04-24 13:33:44'),(1013,12,6,'USED','ALL','2026-04-19 00:00:00','2026-12-31 23:59:59',17,'USER_RECEIVE','2026-04-24 14:20:40','2026-04-24 14:20:35','2026-04-24 14:20:35'),(1014,12,3,'UNUSED','CARPOOL','2026-01-01 00:00:00','2026-12-31 23:59:59',NULL,'USER_RECEIVE',NULL,'2026-04-24 14:25:47','2026-04-24 14:25:47'),(1015,12,3,'UNUSED','CARPOOL','2026-01-01 00:00:00','2026-12-31 23:59:59',NULL,'USER_RECEIVE',NULL,'2026-05-12 22:52:19','2026-05-12 22:52:19'),(1016,12,2,'UNUSED','TAXI','2026-01-01 00:00:00','2026-12-31 23:59:59',21,'USER_RECEIVE','2026-05-12 22:54:07','2026-05-12 22:53:26','2026-05-12 22:53:26'),(1017,12,7,'USED','ALL','2026-04-19 00:00:00','2026-12-31 23:59:59',22,'USER_RECEIVE','2026-05-12 22:57:10','2026-05-12 22:56:29','2026-05-12 22:56:29'),(1018,12,7,'UNUSED','ALL','2026-04-19 00:00:00','2026-12-31 23:59:59',NULL,'ADMIN_GRANT',NULL,'2026-05-13 00:04:28','2026-05-13 00:04:28'),(1019,12,6,'UNUSED','ALL','2026-04-19 00:00:00','2026-12-31 23:59:59',NULL,'ADMIN_GRANT',NULL,'2026-05-13 00:04:56','2026-05-13 00:04:56');
/*!40000 ALTER TABLE `t_user_coupon` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_vehicle`
--

DROP TABLE IF EXISTS `t_vehicle`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_vehicle` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `driver_id` bigint NOT NULL COMMENT '司机用户ID',
  `plate_no` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '车牌号',
  `brand` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '品牌',
  `model_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '车型',
  `color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '颜色',
  `seat_count` int NOT NULL COMMENT '座位数',
  `insurance_expire_date` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '保险到期日',
  `annual_inspect_expire_date` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '年检到期日',
  `vehicle_license_image_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '行驶证照片',
  `driver_license_image_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '驾驶证照片',
  `audit_status` int NOT NULL DEFAULT '0' COMMENT '车辆审核状态',
  `audit_remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '车辆审核备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_vehicle_driver` (`driver_id`),
  CONSTRAINT `fk_vehicle_driver` FOREIGN KEY (`driver_id`) REFERENCES `t_platform_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='车辆信息表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_vehicle`
--

LOCK TABLES `t_vehicle` WRITE;
/*!40000 ALTER TABLE `t_vehicle` DISABLE KEYS */;
INSERT INTO `t_vehicle` VALUES (1,7,'沪A12345','比亚迪','秦PLUS DM-i','白色',5,'2026-12-31','2026-10-31','/uploads/driver-certification/7/vehicle-license-437ef2c5e3ec4351a896062beea33fc0.jpg','/uploads/driver-certification/7/driver-license-9cd3f85a1b9c46c1b979a5be5da92379.jpg',2,'车辆资料审核通过，司机可正常接单','2026-02-20 09:30:00','2026-04-18 18:20:00'),(2,8,'沪B8520D','丰田','凯美瑞','黑色',5,'2026-11-30','2026-09-30','/uploads/vehicle-license-8.jpg','/uploads/driver-license-8.jpg',2,'车辆审核通过','2026-02-28 11:00:00','2026-04-18 16:40:00'),(3,9,'苏E6M928','吉利','银河L7','银色',5,'2026-10-30','2026-08-31','/uploads/vehicle-license-9.jpg','/uploads/driver-license-9.jpg',1,'车辆待审核','2026-04-02 12:20:00','2026-04-18 09:18:00'),(4,10,'沪C66789','特斯拉','Model 3','灰色',5,'2026-12-15','2026-11-15','/uploads/vehicle-license-10.jpg','/uploads/driver-license-10.jpg',2,'车辆审核通过','2026-03-05 08:20:00','2026-04-18 16:20:00'),(5,11,'冀D99999','凯迪拉克GT5','小轿车','黑色',4,'2026-12-31','2026-12-31','/uploads/driver-certification/11/vehicle-license-46188b6fa8d44ae288a78c2391e0877f.jpg','/uploads/driver-certification/11/driver-license-88cb0454f9be4024aad4ee1b4040745a.jpg',2,'车辆资料已提交，等待审核','2026-04-24 13:10:10','2026-04-24 13:10:10');
/*!40000 ALTER TABLE `t_vehicle` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_withdraw_application`
--

DROP TABLE IF EXISTS `t_withdraw_application`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `t_withdraw_application` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `driver_id` bigint NOT NULL COMMENT '司机用户ID',
  `apply_amount` decimal(10,2) NOT NULL COMMENT '提现金额',
  `bank_account` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '银行卡号',
  `bank_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '开户行',
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '审核状态',
  `reject_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '驳回原因',
  `audited_at` datetime DEFAULT NULL COMMENT '审核时间',
  `audited_by` bigint DEFAULT NULL COMMENT '审核人',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_withdraw_driver_status` (`driver_id`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='提现申请表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_withdraw_application`
--

LOCK TABLES `t_withdraw_application` WRITE;
/*!40000 ALTER TABLE `t_withdraw_application` DISABLE KEYS */;
INSERT INTO `t_withdraw_application` VALUES (1,7,120.00,'6222020202020202','中国工商银行上海分行','PENDING',NULL,NULL,NULL,'2026-04-18 16:30:00','2026-04-18 16:30:00'),(2,8,300.00,'6225888888888888','招商银行上海分行','APPROVED',NULL,'2026-04-17 11:20:00',1,'2026-04-17 10:00:00','2026-04-17 11:20:00');
/*!40000 ALTER TABLE `t_withdraw_application` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-13 14:18:26
