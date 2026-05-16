# 2026-05-14 功能优化记录

本文记录本轮围绕管理端数据大盘、用户端订单流程、司机端轨迹模式和后台同步链路做过的改动，方便后续演示、答辩和二次维护。

## 1. 管理端数据大盘

### 数据加载优化

- 优化数据大盘打开时的加载体验，减少进入页面后的明显卡顿。
- 地区分布图改为由后端直接按订单出发地、到达地聚合。
- 不再为了计算地图分布而额外逐条请求订单详情。

### 实时订单展示优化

- 将“实时订单”区域从大块常驻展示优化为可展开、可收起的结构。
- 缩小字体和占用高度，避免压住或挤占其他大盘内容。
- 检查并修复部分控件被遮挡、显示不一致的问题。

## 2. 用户端订单流程

### 司机已接单页

- 优化 `sunshine-user-miniapp/pages/driver-arrival` 页面底部卡片。
- 压缩司机信息卡、接驾进度、车型、车牌、路况、取消规则和操作按钮的占用空间。
- 修复页面脚本中轨迹合并逻辑放错位置导致的显示异常。
- 页面现在会继续每 3 秒刷新订单运行态。

### 取消订单闭环

- 在“司机已接单”页新增“取消订单”按钮。
- 点击后调用后端 `POST /orders/{orderId}/cancel`。
- 成功后重新拉取订单详情并同步本地缓存，订单进入已取消状态。
- 取消中按钮会显示 loading，失败时保留当前页面并提示失败原因。

### 免费取消规则展示

- 后端 `/app/home` 返回 `systemConfigs`。
- 用户端首页保存后台系统配置。
- 订单模型根据 `freeCancelMinutes` 显示取消规则。
- 当前规则文案与后端实际计费逻辑保持一致：下单后配置分钟数内免费取消，派单中免费取消，超时按后台规则收取取消费。
- 取消费计费已调整为：未派单、无司机或派单中取消均为 0 元；司机已接单后超过免费取消时间才计费。
- 超时取消费不再是固定 5 元，而是按订单应付金额和超时时长比例计算：已接单阶段每 5 分钟按订单金额 5% 递增、最高 20%；接驾阶段每 5 分钟按 8% 递增、最高 35%。
- 用户端、支付确认页、首页订单卡片和后台详情均按 `cancelFee/payableAmount` 展示取消单金额，0 元取消不会再显示成待支付原行程费。

## 3. 司机端轨迹模式

### 接单大厅听单边界

- 修复后端遗留 `BUSY` 但没有进行中订单时，司机端“开始接单”按钮被错误置灰的问题。
- 修复管理员在后台把进行中订单取消、改为终态或退款后，司机服务状态没有从 `BUSY` 释放的问题。
- 司机端打开接单大厅时会自检：如果名下已经没有进行中的订单但状态仍是 `BUSY`，后端会自动恢复为可接单状态。
- 司机端打开接单大厅时，如果车辆已审核通过、没有进行中订单、后台状态为 `OFFLINE`，且司机本机没有明确点过“停止接单”，会自动恢复为听单中，避免无操作时显示“休息中”。
- 接单大厅请求后端超时时，不再把初始空状态误显示成“车辆未提交/接单未解锁”；有本地缓存时展示上次真实审核状态，没有缓存时明确提示“同步失败”。
- 司机点击“开始接单”时，会先记录当前等待池里的旧订单 ID。
- 自动接单只处理开启听单之后新增的即时打车订单，开启前已经存在的订单不会被自动接取。
- 新订单语音播报只针对开启听单之后新增的订单，旧订单不会重复播报。
- 乘客取消订单播报也按本次听单时间过滤，开启听单之前的旧取消记录不会重复播报。

### 新增轨迹模式设置

位置：`sunshine-driver-miniapp/pages/settings`

司机端“接单设置”新增“轨迹模式”：

- 演示轨迹：默认模式。
- 真实定位：需要手动切换。

### 演示轨迹模式

演示模式是当前开发和课程演示默认状态。

司机接单后：

- 系统会按订单上车点生成一个上车点附近的虚拟司机位置。
- 虚拟位置通常在上车点附近几百米到一两公里范围内。
- 司机端优先请求地图道路规划路线，按道路路线持续上报虚拟车辆位置，不使用简单直线。
- 演示速度按每 1.5 公里约 1 分钟推进；遇到随机红灯时车辆暂停、时间继续增加，绿灯后继续按路线匀速行驶。
- 地图小车图标代表当前虚拟车辆位置，车头方向跟随当前道路段方向变化。
- 乘客端、司机端、后端数据库和管理后台看到的是同一条演示轨迹。
- 不使用司机手机真实定位，不暴露真实位置。

相关文件：

- `sunshine-driver-miniapp/utils/track-mode.js`
- `sunshine-driver-miniapp/utils/track-reporter.js`
- `sunshine-driver-miniapp/pages/dashboard/index.js`
- `sunshine-driver-miniapp/pages/trip-progress/index.js`

### 真实定位模式

真实模式需要司机端在设置里手动切换。

切换后：

- 司机端调用 `wx.getLocation` 获取司机手机实际定位。
- 上报真实经纬度到后端。
- 后端保存到 `t_travel_trace`。
- 乘客端、司机端和后台订单详情同步显示真实定位轨迹。

## 4. 后端轨迹同步

### 轨迹上报标记

`TrackReportRequest` 新增 `traceMode` 字段。

后端保存轨迹时会把来源写入 `remark`：

- `DEMO_ROUTE`：演示轨迹。
- `REAL_GPS`：真实定位。

演示轨迹的 `DEMO_ROUTE` 备注会附带摘要字段，例如已用秒数、已行驶距离、剩余距离、路线百分比和等待秒数。后端运行态会优先读取这些摘要，避免后台用直线距离粗算。

相关文件：

- `sunshine-travel/src/main/java/com/sunshine/travel/dto/TrackReportRequest.java`
- `sunshine-travel/src/main/java/com/sunshine/travel/service/impl/OrderServiceImpl.java`

### 运行态识别

后端订单运行态现在会区分轨迹来源：

- `routeSource = demo_trace`：演示轨迹。
- `routeSource = travel_trace`：真实定位轨迹。
- `routeSource = order_record`：没有轨迹记录时的订单基础坐标。

同时返回：

- `routeReal`
- `traceMode`
- `traceCount`
- `lastReportedAt`

相关文件：

- `sunshine-travel/src/main/java/com/sunshine/travel/service/support/OrderRuntimeSupport.java`

## 5. 管理后台订单详情

- 订单详情页新增“轨迹模式”展示。
- 后台订单详情展示已用时长、已行驶距离和路线进度百分比。
- 后台轨迹记录表不再展示具体经纬度；只保留上报时间、角色、行驶进度、已行驶、行驶时长和等待/路况信息，方便演示时看同步进度但不暴露具体位置。

相关文件：

- `sunshine-admin/src/views/OrderView.vue`

## 6. 当前推荐演示方式

1. 启动后端和管理端。
2. 打开司机端小程序，进入“我的 -> 接单设置”。
3. 确认“轨迹模式”为“演示”。
4. 用户端创建即时打车订单。
5. 司机端接单。
6. 用户端进入“司机已接单”页，看到司机从上车点附近模拟接驾。
7. 管理后台进入订单详情，查看轨迹模式和轨迹记录。
8. 如需演示真实定位，再回司机端设置切换为“真实”，重新接单测试。

## 7. 验证结果

本轮已执行：

```powershell
node sunshine-user-miniapp\scripts\page-smoke-test.js
```

结果：用户端 33 个页面全部通过。

```powershell
Get-ChildItem sunshine-driver-miniapp -Recurse -Include *.js | ForEach-Object { node --check $_.FullName }
```

结果：司机端 JS 语法检查通过。

```powershell
npm run build
```

执行目录：`sunshine-admin`

结果：管理端构建通过。

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-17'
& 'C:\Users\31379\.trae-cn\tools\maven\latest\bin\mvn.cmd' -q -DskipTests compile
```

执行目录：`sunshine-travel`

结果：后端编译通过。

说明：后端 `package` 如果提示无法重命名 `target/sunshine-travel-1.0.0.jar`，通常是本地后端服务正在运行并占用 jar 文件，先停止服务后再打包即可。
