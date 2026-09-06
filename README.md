# 阳光出行

阳光出行（Sunshine Travel）是一套面向乘客、司机与运营人员的一体化出行服务平台。项目覆盖微信小程序、运营管理后台与业务服务端，围绕叫车、接驾、行程、支付、售后和运营管理建立完整的业务闭环。

![Java](https://img.shields.io/badge/Java-17-007396?style=flat-square&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2-6DB33F?style=flat-square&logo=springboot&logoColor=white)
![Vue](https://img.shields.io/badge/Vue-3-42B883?style=flat-square&logo=vuedotjs&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?style=flat-square&logo=mysql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-supported-DC382D?style=flat-square&logo=redis&logoColor=white)

## 项目概览

平台以真实订单状态和运行数据为核心，提供稳定、清晰、可追踪的出行体验：

- **乘客端**：位置搜索、地图选点、打车、等待接单、司机接驾、行程跟踪、费用结算、支付、评价、发票与售后支持。
- **司机端**：接单大厅、接驾与行程管理、收益、车辆信息、资质审核、消息通知和语音播报。
- **运营后台**：用户、司机、车辆、订单、支付、评价、优惠券、投诉、发票和客服会话管理。
- **客服体系**：支持智能客服与人工客服协同，人工接管、消息状态和两端来源均可追踪。

## 系统架构

```text
微信小程序（乘客端） ─┐
                       ├─ sunshine-travel ─ MySQL
微信小程序（司机端） ─┤                    └─ Redis
                       └─ sunshine-admin
```

| 模块 | 说明 | 主要技术 |
| --- | --- | --- |
| `sunshine-travel` | 业务 API、认证、订单、支付、消息和客服服务 | Spring Boot 3、Spring Security、MyBatis-Plus |
| `sunshine-admin` | 运营管理后台 | Vue 3、Vite、Element Plus、ECharts |
| `sunshine-user-miniapp` | 乘客端微信小程序 | WXML、WXSS、JavaScript |
| `sunshine-driver-miniapp` | 司机端微信小程序 | WXML、WXSS、JavaScript |
| `sql` | 数据库导出与同步脚本 | MySQL 8 |
| `docs` | API、架构、部署和测试文档 | Markdown |

## 技术栈

- **服务端**：Java 17、Spring Boot 3.2、Spring Security、MyBatis-Plus、MySQL 8、Redis、Knife4j
- **运营后台**：Vue 3、Vite、Vue Router、Element Plus、ECharts、Axios
- **小程序**：微信小程序原生开发、地图与定位能力、实时状态刷新、语音播报
- **工程实践**：分层业务结构、统一 API 调用、订单状态流转、运行轨迹同步、前端页面冒烟检查

## 快速开始

### 环境要求

- JDK 17+
- Maven 3.9+
- Node.js 18+
- MySQL 8+
- Redis 6+
- 微信开发者工具

### 启动服务端

```bash
cd sunshine-travel
mvn spring-boot:run
```

服务端配置、数据库初始化和接口说明见 [`docs/deploy.md`](docs/deploy.md)、[`docs/api.md`](docs/api.md) 与 [`docs/architecture.md`](docs/architecture.md)。

### 启动运营后台

```bash
cd sunshine-admin
npm install
npm run dev
```

### 运行微信小程序

使用微信开发者工具分别导入以下目录：

```text
sunshine-user-miniapp
sunshine-driver-miniapp
```

开发环境的服务端地址、地图配置和测试数据请根据 [`docs/demo-data-guide.md`](docs/demo-data-guide.md) 与项目配置进行设置。

## 文档导航

- [接口文档](docs/api.md)
- [系统架构](docs/architecture.md)
- [部署说明](docs/deploy.md)
- [小程序前端说明](docs/miniapp-front-end.md)
- [演示数据说明](docs/demo-data-guide.md)
- [测试用例](docs/test-cases.md)
- [变更记录](docs/change-log-2026-05-14.md)

## 设计与产品原则

- 让当前任务始终清晰可见，减少不必要的操作和信息噪声。
- 以订单状态、路线、时间和金额为核心信息，优先保证可读性。
- 使用统一的视觉语言和稳定的交互反馈，服务真实的日常出行场景。
- 乘客端、司机端和运营端的会话上下文彼此隔离，业务数据保持统一同步。

## 项目状态

项目持续迭代中，当前重点围绕订单闭环、实时行程、客服协同、地图交互和双端体验进行完善。提交代码前请先阅读对应模块文档，并通过相关页面检查与后端测试。

## 说明

本仓库用于阳光出行项目的开发、演示与持续维护。生产环境部署前请自行完成密钥管理、数据库初始化、地图服务配置、支付配置和安全审计。
