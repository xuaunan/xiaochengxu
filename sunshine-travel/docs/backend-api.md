# 阳光出行后端接口文档

## 鉴权说明

- 请求头：`Authorization: Bearer {token}`
- 公开接口：`/auth/register`、`/auth/login`、`/app/home`、`/app/estimate`、`/coupons/center`、`/carpool/search`
- 角色权限：`USER` 乘客，`DRIVER` 司机，`ADMIN` 管理员

## 认证模块

| 接口 | 方法 | 权限 | 说明 |
|---|---|---|---|
| `/auth/register` | POST | 公开 | 用户/司机/管理员注册 |
| `/auth/login` | POST | 公开 | 登录获取 JWT |
| `/auth/refresh` | POST | 已登录 | 刷新令牌 |
| `/auth/profile` | GET | 已登录 | 获取当前登录用户信息 |
| `/auth/real-name` | POST | 已登录 | 提交实名认证资料 |

### `/auth/register`

- 请求体：`phone`、`password`、`nickname`、`roleCode`、`defaultLanguage`
- 返回：用户基础信息

### `/auth/login`

- 请求体：`phone`、`password`、`roleCode`
- 返回：`token`、`userId`、`roleCode`、`nickname`、`defaultLanguage`、`authStatus`

## 首页与试算

| 接口 | 方法 | 权限 | 说明 |
|---|---|---|---|
| `/app/home` | GET | 公开 | 首页聚合数据 |
| `/app/estimate` | GET | 公开 | 费用试算 |

### `/app/estimate`

- 参数：`carTypeId`、`serviceType`、`distanceKm`、`durationMin`
- 返回：`baseAmount`、`nightSurchargeAmount`、`longDistanceSurchargeAmount`、`amount`、`currencyCode`、`exchangeRate`

## 订单模块

| 接口 | 方法 | 权限 | 说明 |
|---|---|---|---|
| `/orders` | POST | USER | 创建订单 |
| `/orders/mine` | GET | USER/DRIVER/ADMIN | 查询我的订单 |
| `/orders/{orderId}` | GET | USER/DRIVER/ADMIN | 查询订单详情 |
| `/orders/waiting` | GET | DRIVER/ADMIN | 待抢订单列表 |
| `/orders/{orderId}/accept` | POST | DRIVER | 司机接单 |
| `/orders/{orderId}/start` | POST | DRIVER | 开始接驾 |
| `/orders/{orderId}/pickup` | POST | DRIVER | 乘客上车，行程开始 |
| `/orders/{orderId}/finish` | POST | DRIVER | 完成行程 |
| `/orders/{orderId}/cancel` | POST | USER/DRIVER/ADMIN | 取消订单 |
| `/orders/mock-pay` | POST | USER/ADMIN | 支付确认 |
| `/orders/evaluation` | POST | USER | 提交评价 |
| `/orders/complaint` | POST | USER/ADMIN | 提交投诉 |
| `/orders/{orderId}/track/report` | POST | USER/DRIVER | 上报轨迹点 |
| `/orders/{orderId}/track/history` | GET | USER/DRIVER/ADMIN | 查询轨迹历史 |

### 创建订单请求体

- `carTypeId`：车型 ID
- `serviceType`：`TAXI`、`CARPOOL`、`INTERNATIONAL`
- `startName`、`startLng`、`startLat`
- `endName`、`endLng`、`endLat`
- `estimatedDistanceKm`、`estimatedDurationMin`
- `userCouponId`
- `dispatchMode`
- `languageCode`
- `currencyCode`
- `remark`

### 完成行程请求体

- `actualDistanceKm`
- `actualDurationMin`

## 司机模块

| 接口 | 方法 | 权限 | 说明 |
|---|---|---|---|
| `/driver/dashboard` | GET | DRIVER | 司机工作台 |
| `/driver/service-status` | POST | DRIVER | 更新接单状态与位置 |
| `/driver/withdraw` | POST | DRIVER | 提交提现申请 |
| `/driver/certification` | POST | DRIVER | 提交司机资质审核 |

### `/driver/service-status`

- 请求体：`serviceStatus`、`longitude`、`latitude`

### `/driver/certification`

- 请求体：`licenseNo`、`plateNo`、`brand`、`modelName`、`color`、`seatCount`、`insuranceExpireDate`、`annualInspectExpireDate`

## 优惠券模块

| 接口 | 方法 | 权限 | 说明 |
|---|---|---|---|
| `/coupons/center` | GET | 公开 | 优惠券中心 |
| `/coupons/mine` | GET | USER | 我的优惠券 |
| `/coupons/{couponId}/receive` | POST | USER | 领取优惠券 |

## 顺风车模块

| 接口 | 方法 | 权限 | 说明 |
|---|---|---|---|
| `/carpool/publish` | POST | USER | 发布顺风车行程 |
| `/carpool/search` | GET | 公开 | 搜索顺风车行程 |
| `/carpool/apply` | POST | USER | 申请拼车 |
| `/carpool/owner-confirm` | POST | USER | 车主确认/拒绝 |
| `/carpool/passenger-confirm` | POST | USER | 乘客最终确认 |
| `/carpool/cancel` | POST | USER | 取消拼车申请 |
| `/carpool/mine` | GET | USER | 我的顺风车数据 |

## 管理员后台

| 接口 | 方法 | 权限 | 说明 |
|---|---|---|---|
| `/admin/dashboard` | GET | ADMIN | 数据大盘 |
| `/admin/users` | GET | ADMIN | 用户分页查询 |
| `/admin/drivers` | GET | ADMIN | 司机分页查询 |
| `/admin/orders` | GET | ADMIN | 订单分页查询 |
| `/admin/withdraws` | GET | ADMIN | 提现分页查询 |
| `/admin/coupons` | GET | ADMIN | 优惠券分页查询 |
| `/admin/logs` | GET | ADMIN | 操作日志分页查询 |
| `/admin/finance/summary` | GET | ADMIN | 财务汇总 |
| `/admin/coupons` | POST | ADMIN | 创建优惠券 |
| `/admin/coupons/grant` | POST | ADMIN | 指定用户发券 |
| `/admin/users/{userId}/audit` | POST | ADMIN | 审核实名认证 |
| `/admin/users/{userId}/enable` | POST | ADMIN | 启用/禁用用户 |
| `/admin/drivers/{driverId}/audit` | POST | ADMIN | 审核司机资质 |
| `/admin/withdraws/{withdrawId}/audit` | POST | ADMIN | 审核提现申请 |

### 分页查询公共参数

- `current`：页码，默认 `1`
- `size`：每页条数，默认 `10`
- `keyword`：模糊搜索关键字
- `status` / `roleCode` / `auditStatus` / `module`：业务筛选参数
