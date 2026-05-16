# 前后端字段对齐规范

## 统一返回格式

```json
{
  "code": 0,
  "msg": "success",
  "data": {}
}
```

## JWT 规范

- 登录后返回 `token`
- 所有非公开接口通过请求头传入：`Authorization: Bearer {token}`
- 令牌过期返回：`4002 / 登录已过期，请重新登录`
- 前端角色值必须固定使用：`USER`、`DRIVER`、`ADMIN`

## 核心枚举

### 用户角色 `roleCode`

| 值 | 含义 |
|---|---|
| `USER` | 乘客 |
| `DRIVER` | 司机 |
| `ADMIN` | 管理员 |

### 服务类型 `serviceType`

| 值 | 含义 |
|---|---|
| `TAXI` | 即时打车 |
| `CARPOOL` | 顺风车 |
| `INTERNATIONAL` | 国际出行 |

### 订单状态 `orderStatus`

| 值 | 含义 |
|---|---|
| `CREATED` | 已创建 |
| `DISPATCHING` | 派单中 |
| `ACCEPTED` | 已接单 |
| `PICKING_UP` | 接驾中 |
| `IN_TRIP` | 行程中 |
| `FINISHED` | 已完成 |
| `CANCELLED` | 已取消 |

### 支付状态 `payStatus`

| 值 | 含义 |
|---|---|
| `UNPAID` | 未支付 |
| `PAID` | 已支付 |
| `REFUNDED` | 已退款 |

### 优惠券类型 `couponType`

| 值 | 含义 |
|---|---|
| `CASH` | 满减券 |
| `DISCOUNT` | 折扣券 |

### 用户优惠券状态 `couponStatus`

| 值 | 含义 |
|---|---|
| `UNUSED` | 未使用 |
| `USED` | 已使用 |
| `EXPIRED` | 已过期 |

### 顺风车行程状态 `trip.status`

| 值 | 含义 |
|---|---|
| `PUBLISHED` | 已发布 |
| `MATCHING` | 匹配中 |
| `FULL` | 满座 |
| `CONFIRMED` | 已确认 |
| `CANCELLED` | 已取消 |
| `FINISHED` | 已完成 |

### 顺风车申请状态 `applicationStatus`

| 值 | 含义 |
|---|---|
| `APPLIED` | 已申请 |
| `OWNER_CONFIRMED` | 车主已确认 |
| `PASSENGER_CONFIRMED` | 乘客已确认 |
| `CONFIRMED` | 双方确认成功 |
| `CANCELLED` | 已取消 |
| `REJECTED` | 已拒绝 |

### 司机接单状态 `serviceStatus`

| 值 | 含义 |
|---|---|
| `OFFLINE` | 离线 |
| `ONLINE` | 在线可接单 |
| `BUSY` | 服务中 |

### 提现审核状态 `withdraw.status`

| 值 | 含义 |
|---|---|
| `PENDING` | 待审核 |
| `APPROVED` | 已通过 |
| `REJECTED` | 已驳回 |

### 实名与资质审核状态 `authStatus`

| 值 | 含义 |
|---|---|
| `0` | 未认证 |
| `1` | 待审核 |
| `2` | 已通过 |
| `3` | 已驳回 |

## 错误码对照表

| code | 含义 |
|---|---|
| `0` | 成功 |
| `4000` | 通用业务失败 |
| `4001` | 参数不合法 |
| `4002` | 未登录或登录过期 |
| `4003` | 无权限 |
| `4004` | 数据不存在 |
| `4005` | 状态不允许当前操作 |
| `4006` | 重复请求 |
| `4007` | 优惠券不可用 |
| `4008` | 订单不可操作 |
| `4009` | 司机状态异常 |
| `5000` | 系统异常 |

## 前端联调注意事项

- 金额字段统一使用小数类型字符串或 number，后端按 `BigDecimal` 计算并保留两位。
- 所有时间字段统一为 `yyyy-MM-dd HH:mm:ss`。
- 前端提交状态枚举时必须严格使用大写常量，不允许传中文状态名。
- 非公开接口在未携带 token、token 过期、角色不匹配时都会返回统一错误码，不再返回 HTML 或框架默认异常。
