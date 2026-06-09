# Sunshine Desktop Feature Coverage

## 乘客端映射

| 原小程序页面/能力 | 桌面端位置 | 桌面端交互 |
| --- | --- | --- |
| welcome / login | 顶部角色登录 | 乘客角色登录、健康检查、离线降级 |
| home / address-search / map-picker | 乘客 / 即时叫车 | 起终点编辑、常用地址设为起点/终点、费用预估、创建订单 |
| taxi-waiting / driver-arrival / trip-progress | 乘客 / 当前行程 | 订单状态推进、接驾 ETA、司机信息、时间线 |
| fare-settlement / payment-confirm | 乘客 / 当前行程、订单与历史 | 一键支付、支付状态更新、钱包扣款、资金流水 |
| orders / order-detail | 乘客 / 订单与历史 | 订单筛选、查看、推进、支付、取消 |
| invoice | 乘客 / 账户记录、运营 / 发票审核 | 申请发票、发票记录、运营开具/驳回 |
| ride-review / reviews | 乘客 / 当前行程、账户记录 | 五星评价、评价记录 |
| complaint / help / messages | 乘客 / 当前行程、账户记录、运营 / 重要消息 | 投诉提交、客服工单、安全回访、运营处理 |
| coupon | 乘客 / 优惠券中心 | 领券、查看适用范围、核销统计 |
| carpool 系列页面 | 乘客 / 顺风车与国际出行 | 发布顺风车、申请同行、报名数量变化 |
| international 系列页面 | 乘客 / 顺风车与国际出行、运营 / 跨境与派单规则 | 跨境资料同步、履约状态推进、外币金额 |
| profile / profileEdit / auth / wallet / settings | 乘客 / 我的账户 | 实名状态、钱包充值、余额、积分、紧急联系人 |

## 司机端映射

| 原小程序页面/能力 | 桌面端位置 | 桌面端交互 |
| --- | --- | --- |
| onboarding | 司机 / 资料认证与消息 | 证件提交、认证催办、资料状态 |
| dashboard | 司机 / 听单工作台 | 听单开关、可接订单、接单、拒单 |
| orders / trip-detail / trip-progress | 司机 / 当前行程、我的行程 | 接驾、乘客上车、完单、订单跟进 |
| wallet / withdraw | 司机 / 收益与提现 | 收益流水、提现金额校验、提现申请、提现单 |
| profile / profile-edit / settings | 司机 / 资料认证与消息 | 司机资料、服务设置、接单偏好开关 |
| messages | 司机 / 资料认证与消息、右侧上下文 | 司机客服单、认证消息、待办提醒 |
| 位置与轨迹能力 | 司机 / 当前行程 | 经纬度上报、当前位置刷新、审计记录 |

## 运营端映射

| 管理端模块 | 桌面端位置 | 桌面端交互 |
| --- | --- | --- |
| DashboardView | 运营 / 运营大盘 | 指标刷新、趋势图、资金操作流、检查项完成 |
| ImportantMessagesView | 运营 / 重要消息 | 单条处理、全部处理、广播消息 |
| UserView | 运营 / 用户与司机审核 | 用户通过/驳回、启停账号、重置密码、司机认证 |
| DriverView | 运营 / 用户与司机审核 | 司机资料、证件审核通过/驳回 |
| OrderView | 运营 / 订单管理 | 订单推进、退款确认、申请开票 |
| CouponView | 运营 / 营销中心 | 新建券模板、发放、启停 |
| InternationalView | 运营 / 跨境与派单规则 | 跨境订单同步、汇率启停 |
| SystemView | 运营 / 系统配置 | 公告启停、版本发布、版本计划、系统参数启停 |
| 财务与售后 | 运营 / 资金、投诉与发票 | 提现审核、投诉跟进/关闭、发票开具/驳回 |
| 调度配置 | 运营 / 跨境与派单规则 | 派单规则启停、权重调节 |
| 审计追踪 | 运营 / 操作审计、右侧上下文 | 关键动作保留 actor/action/target/result/time |

## 技术与体验边界

- 框架：Electron + Vue 3 + TypeScript + Vite。
- UI：保留 Sunshine 暖橙主题，桌面端采用轻量玻璃感、低半径、低阴影、明确状态色，并引入 `src/assets/dispatch-city-visual.png` 作为统一路线/调度视觉资产。
- 动效：150-260ms，使用 opacity/transform，保留 `prefers-reduced-motion`。
- 可访问性：按钮语义、焦点态、状态文本配合颜色、表格空状态、键盘快捷键。
- 数据策略：优先业务接口，失败后使用离线 mock 数据并显示健康状态。
- 命令中心：顶部搜索框同时支持订单/用户/司机筛选、角色切换、视图跳转、刷新连接、登录角色、乘客支付/发票/行程推进、司机听单/接单/位置上报、运营刷新/待办/广播。
- 右侧上下文：当前订单小地图、费用、路线、履约状态、6 节点进度轨、快捷动作、调度决策、SLA、匹配置信度、离线/实时队列、风险队列和最近操作审计随角色切换。
- 响应式状态：1180px 及以下右侧上下文收起时，主工作区状态条继续展示调度决策、匹配置信度、下一步和服务写入模式。
- 验证截图：`output/passenger-status-localhost-1440x920.png`、`output/driver-status-localhost-1180x760.png`、`output/admin-status-localhost-760x900.png`。
