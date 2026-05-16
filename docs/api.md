# Knife4j 接口演示傻瓜手册

一句话先说清楚：

Knife4j 就是后端功能的“可点可试操作面板”，你不用写前端，也能直接在网页里点按钮测试登录、下单、接单这些功能。

## 一、开始前先准备好

### 1. 打开地址

浏览器打开：

`http://127.0.0.1:8080/doc.html`

### 2. 演示账号

乘客账号：

- 手机号：`13800000001`
- 密码：`123456`

司机账号 1：

- 手机号：`13800000002`
- 密码：`123456`

司机账号 2：

- 手机号：`13900000001`
- 密码：`123456`

管理员账号：

- 手机号：`13800000000`
- 密码：`123456`
- 角色：`ADMIN`

### 3. 先记住一个最重要的规则

除了登录、注册这种接口，其他大多数接口都要先带上 `token`。

你可以这样理解：

先登录拿到一张“通行证”，后面再拿这张“通行证”去测试别的接口。

### 4. 正常返回长什么样

只要你看到：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

就说明这次请求成功了。

判断方法非常简单：

1. `code` 等于 `0`：成功
2. `code` 不等于 `0`：失败
3. `message`：失败原因
4. `data`：真正返回的数据

## 二、你第一次打开文档后，按这个顺序操作

## 第 1 步：找到接口

打开 `doc.html` 后：

1. 看左边接口分组列表。
2. 找到你要演示的模块。
3. 点开模块名称。
4. 再点具体接口名称。

你这次课程演示只需要看下面这些模块：

1. `认证模块`
2. `首页与计价`
3. `订单模块`
4. `优惠券模块`
5. `顺风车模块`
6. `司机模块`
7. `管理端模块`

## 第 2 步：打开调试区

点进某个接口后：

1. 先看接口标题下面的请求方式，比如 `GET` 或 `POST`
2. 再看请求地址，比如 `/auth/login`
3. 找到页面里的“调试”或者“Try it out”
4. 点一下这个按钮

点完后，参数输入框就能编辑了。

## 第 3 步：填写参数

有 3 种常见填写位置：

1. 路径参数
   例子：`/orders/{orderId}/accept`
   这里的 `orderId` 不能空，要填真实订单 ID，比如 `3`
2. 查询参数
   例子：`/app/estimate`
   参数一般一行一个，直接填数字或文字
3. 请求体
   一般是一个大文本框
   直接把我下面给你的整段 JSON 复制进去就行

## 第 4 步：发起测试

1. 参数填好后，点“发送”或者“Execute”
2. 等待页面返回结果
3. 重点看返回区里的 `code`、`message`、`data`

## 第 5 步：看结果

成功时：

1. `code` 是 `0`
2. `message` 一般是 `ok` 或成功提示
3. `data` 里能看到 token、订单、列表、统计数据这些内容

失败时：

1. 先看 `message`
2. 再看是不是少了参数
3. 再看是不是没带 token
4. 再看是不是用了错误的账号角色

## 三、先拿到 token，再测别的接口

最推荐的做法：

1. 先测乘客登录
2. 复制返回里的 `token`
3. 再去测乘客相关接口
4. 再测司机登录
5. 复制司机 `token`
6. 再去测接单、行程接口
7. 最后测管理员登录
8. 再看后台数据接口

如果页面右上角有 `Authorize` 按钮：

1. 点 `Authorize`
2. 输入：

```text
Bearer 这里粘贴你的token
```

3. 点确认

如果页面右上角没有 `Authorize`：

1. 打开当前接口
2. 找到参数区里的 `Authorization`
3. 填：

```text
Bearer 这里粘贴你的token
```

## 四、课程演示最核心接口

下面这些就是这套项目里最值得演示、也最容易讲清楚的接口。

---

## 1. 用户登录认证

### 接口：`POST /auth/login`

接口用途：

用户、司机、管理员登录，拿到后面调其他接口要用的 token。

### 怎么点

1. 在左边找到 `认证模块`
2. 点开 `POST /auth/login`
3. 点“调试”或“Try it out”
4. 在请求体里粘贴下面参数
5. 点“发送”

### 乘客测试参数

```json
{
  "phone": "13800000001",
  "password": "123456",
  "roleCode": "USER"
}
```

### 司机测试参数

```json
{
  "phone": "13800000002",
  "password": "123456",
  "roleCode": "DRIVER"
}
```

### 管理员测试参数

```json
{
  "phone": "13800000000",
  "password": "123456",
  "roleCode": "ADMIN"
}
```

### 正常结果怎么看

成功后重点看：

```json
{
  "code": 0,
  "data": {
    "token": "这里是一长串登录令牌"
  }
}
```

你只要把 `token` 复制出来，后面接口就能接着测。

### 报错怎么判断

1. 提示账号或密码错误：先检查手机号和 `roleCode` 有没有填错
2. `code` 不是 `0`：直接看 `message`
3. 返回 401：说明 token 失效，重新登录一次

---

## 2. 当前用户资料

### 接口：`GET /auth/profile`

接口用途：

查看当前登录的人是谁，顺便确认 token 有没有真的生效。

### 怎么点

1. 先完成登录
2. 把 token 放进 `Authorization`
3. 打开 `GET /auth/profile`
4. 点“发送”

### 需要填什么

这个接口一般不用填请求体，只要带 token。

### 正常结果怎么看

你会看到当前账号的手机号、昵称、实名状态、余额这些内容。

如果你用乘客账号测，应该能看到类似：

1. 手机号：`13800000001`
2. 昵称：`张雨桐`
3. 实名状态：已实名
4. 余额：大于 0

### 接口：`PUT /auth/profile`

接口用途：

乘客和司机编辑自己的基础资料，保存后写入 `t_platform_user`，后台“用户管理”刷新后能看到同一份数据。

### 可直接复制的参数

```json
{
  "nickname": "张雨桐",
  "avatar": "/images/avatar-user.svg",
  "realName": "张雨桐",
  "emergencyContact": "张妈妈",
  "emergencyPhone": "13200000001",
  "defaultLanguage": "zh-CN"
}
```

### 正常结果怎么看

接口返回更新后的用户资料；再调用 `GET /auth/profile`、后台 `GET /admin/users`，昵称、头像、真实姓名和紧急联系人应该保持一致。

---

## 3. 地址和路线这块怎么理解

先直接说结论：

这个项目当前真正走后端联调的，不是“地址搜索”接口，而是“费用预估”和“创建订单”接口。

也就是说：

1. 地址搜索和选点主要在前端完成
2. 后端从“你已经选好了起点和终点”这一步开始接收数据

所以课程演示时，地点相关最核心要测下面这个接口。

## 4. 费用预估

### 接口：`GET /app/estimate`

接口用途：

根据车型、业务类型、里程、时长，先算出这单大概多少钱。

### 怎么点

1. 打开 `首页与计价`
2. 点 `GET /app/estimate`
3. 点“调试”
4. 把下面参数填进去
5. 点“发送”

### 可直接复制的参数

```text
carTypeId=1
serviceType=TAXI
distanceKm=25
durationMin=48
```

### 正常结果怎么看

你重点看：

1. `amount`
2. `currencyCode`

即时打车一般会返回人民币金额。

国际出行一般会返回美元金额。

### 演示时怎么讲

你可以直接说：

“我先不下单，先让系统算价，确认路线和价格没问题，再提交订单。”

---

## 5. 下单叫车

### 接口：`POST /orders`

接口用途：

乘客正式创建一笔打车订单。

### 怎么点

1. 先用乘客账号登录
2. 先把乘客 token 放进去
3. 打开 `订单模块`
4. 点 `POST /orders`
5. 点“调试”
6. 把下面整段 JSON 复制进去
7. 点“发送”

### 即时打车测试参数

```json
{
  "carTypeId": 1,
  "serviceType": "TAXI",
  "startName": "上海虹桥站",
  "startLng": "121.3270",
  "startLat": "31.2000",
  "endName": "上海迪士尼度假区",
  "endLng": "121.6570",
  "endLat": "31.1430",
  "estimatedDistanceKm": 25,
  "estimatedDurationMin": 48,
  "dispatchMode": "SMART",
  "remark": "课程演示即时打车订单"
}
```

### 国际出行测试参数

```json
{
  "carTypeId": 1,
  "serviceType": "INTERNATIONAL",
  "startName": "深圳湾口岸",
  "startLng": "113.94598",
  "startLat": "22.50269",
  "endName": "Hong Kong International Airport",
  "endLng": "113.9185",
  "endLat": "22.3080",
  "estimatedDistanceKm": 58,
  "estimatedDurationMin": 90,
  "dispatchMode": "SMART",
  "currencyCode": "USD",
  "remark": "课程演示国际出行订单"
}
```

### 正常结果怎么看

成功后，重点记住返回里的：

1. `id`
2. `orderNo`

后面司机接单、开始行程、结束行程，都会用到这个 `id`。

---

## 6. 查看我的订单

### 接口：`GET /orders/mine`

接口用途：

查看当前登录账号自己的订单列表。

### 怎么点

1. 先带上当前账号的 token
2. 打开 `GET /orders/mine`
3. 点“发送”

### 正常结果怎么看

你会看到多种状态的订单：

1. `FINISHED` 已完成
2. `DISPATCHING` 等待接单
3. `ACCEPTED` 已接单
4. `PICKING_UP` 接驾中
5. `IN_TRIP` 行程中
6. `CANCELLED` 已取消

这一步很适合答辩时展示“我的历史订单不是空白页面”。

---

## 7. 司机查看待接单池

### 接口：`GET /orders/waiting`

接口用途：

司机查看当前能抢的订单。

### 怎么点

1. 先用司机账号登录
2. 带上司机 token
3. 打开 `GET /orders/waiting`
4. 点“发送”

### 正常结果怎么看

应该能看到至少一批 `DISPATCHING` 状态订单。

你可以直接选一个 `id`，马上接着测“司机接单”。

---

## 8. 司机接单

### 接口：`POST /orders/{orderId}/accept`

接口用途：

司机正式抢到这笔单。

### 怎么点

1. 先执行 `GET /orders/waiting`
2. 复制其中一条订单的 `id`
3. 打开 `POST /orders/{orderId}/accept`
4. 在路径参数里把 `orderId` 改成刚复制的真实 ID
5. 点“发送”

### 可直接演示的现成订单 ID

如果你刚导入了演示数据，优先试：

- `2`
- `8`

### 正常结果怎么看

成功后再去查：

1. `GET /orders/mine`
2. 或 `GET /orders/{orderId}`

你会看到这笔单从“待接单”变成“已接单”。

---

## 9. 行程管理

这 3 个接口建议连着演示，效果最好。

### 接口 A：`POST /orders/{orderId}/start`

接口用途：

司机开始行程。

### 接口 B：`POST /orders/{orderId}/pickup`

接口用途：

司机确认乘客已经上车。

### 接口 C：`POST /orders/{orderId}/finish`

接口用途：

司机结束行程，订单进入待支付或已完成状态。

### 推荐演示顺序

1. 先接一笔单
2. 调 `start`
3. 再调 `pickup`
4. 最后调 `finish`

### `finish` 可直接复制的参数

```json
{
  "actualDistanceKm": 26,
  "actualDurationMin": 51
}
```

### 演示时可直接用的订单

如果你不想自己先接单，直接试这些现成数据：

1. `orderId = 3`
   适合测 `start`
2. `orderId = 4`
   适合测 `pickup`
3. `orderId = 5`
   适合测 `finish`

### 正常结果怎么看

每调一次，再查一次 `GET /orders/{orderId}`。

你会看到状态依次变化：

1. `ACCEPTED`
2. `PICKING_UP`
3. `IN_TRIP`
4. `FINISHED`

---

## 10. 行程轨迹

### 接口：`GET /orders/{orderId}/track/history`

接口用途：

查看司机轨迹点，适合演示地图轨迹不是假的空页面。

### 怎么点

1. 打开这个接口
2. 把 `orderId` 填成下面任意一个
3. 点“发送”

### 推荐测试订单

1. `4`
2. `5`
3. `9`

### 正常结果怎么看

你会看到一串经纬度点。

只要 `data` 里不是空数组，就说明轨迹数据已经有了。

---

## 11. 模拟支付

### 接口：`POST /orders/mock-pay`

接口用途：

不用真接微信支付，也能把订单走到已支付，适合课程演示。

### 怎么点

1. 打开 `POST /orders/mock-pay`
2. 点“调试”
3. 填下面参数
4. 点“发送”

### 测试参数

```json
{
  "orderId": 5
}
```

### 正常结果怎么看

再去查订单详情，重点看：

1. `payStatus`
2. `actualAmount`

如果 `payStatus` 变成已支付，就说明成功了。

---

## 12. 优惠券查看和领取

### 接口 A：`GET /coupons/mine`

接口用途：

看当前用户已经拿到手的券。

### 接口 B：`GET /coupons/center`

接口用途：

看券中心还有哪些券能领。

### 接口 C：`POST /coupons/{couponId}/receive`

接口用途：

领取一张优惠券。

### 领取券怎么点

1. 先用乘客账号登录
2. 打开 `GET /coupons/center`
3. 先看列表里有哪些券
4. 复制一个 `couponId`
5. 打开 `POST /coupons/{couponId}/receive`
6. 把 `couponId` 换成真实值
7. 点“发送”
8. 再打开 `GET /coupons/mine`
9. 你就能看到新领到的券

### 可直接测试的券 ID

1. `1` 新人券
2. `2` 满减券
3. `3` 折扣券
4. `4` 国际出行券

### 正常结果怎么看

在 `GET /coupons/mine` 里重点看：

1. `couponStatus`
2. `validEndTime`
3. `serviceScope`

这套演示数据里已经准备好了：

1. `UNUSED` 未使用
2. `USED` 已使用
3. `EXPIRED` 已过期

---

## 13. 顺风车匹配

### 接口 A：`GET /carpool/search`

接口用途：

搜索顺风车行程。

### 可直接测试参数

```text
keyword=上海
```

### 接口 B：`POST /carpool/publish`

接口用途：

发布一个顺风车行程。

### 可直接复制的参数

```json
{
  "startName": "陆家嘴中心",
  "endName": "上海交通大学闵行校区",
  "departTime": "2026-04-20 07:40:00",
  "seatCount": 3,
  "sharedAmount": 39,
  "baggageRule": "20寸行李箱 1 件",
  "tripRemark": "支持工作日通勤拼车"
}
```

### 接口 C：`POST /carpool/apply`

接口用途：

乘客申请加入顺风车行程。

### 可直接复制的参数

```json
{
  "tripId": 1,
  "companionCount": 0,
  "note": "按时到达上车点"
}
```

### 正常结果怎么看

再去调 `GET /carpool/mine`，就能看到自己发布的行程或申请记录。

---

## 14. 评价和投诉

### 接口 A：`POST /orders/evaluation`

接口用途：

用户给本次行程打分评价。

### 可直接复制的参数

```json
{
  "orderId": 1,
  "score": 5,
  "content": "司机准时，车内整洁，整体体验很好。"
}
```

### 接口 B：`POST /orders/complaint`

接口用途：

用户提交投诉。

### 可直接复制的参数

```json
{
  "orderId": 9,
  "complaintType": "SERVICE",
  "content": "建议国际订单增加更明显的双语提醒。"
}
```

### 正常结果怎么看

成功后：

1. 评价接口会把这笔订单变成已评价
2. 投诉接口会让后台投诉数据有内容

---

## 15. 司机工作台和提现

### 接口 A：`GET /driver/dashboard`

接口用途：

看司机自己的资料、车辆、接单状态、收益和订单。

### 怎么点

1. 先用司机账号登录
2. 带上司机 token
3. 打开 `GET /driver/dashboard`
4. 点“发送”

### 正常结果怎么看

重点看这几块：

1. `profile`
2. `vehicle`
3. `orders`

### 接口 A-1：`PUT /driver/profile`

接口用途：

司机编辑自己的司机档案，保存后写入 `t_driver_profile`；后台“司机管理”刷新后能看到同一份城市编码和驾驶证号。

### 可直接复制的参数

```json
{
  "nickname": "周师傅",
  "cityCode": "310100",
  "licenseNo": "SH-LIC-2026002"
}
```

### 正常结果怎么看

接口返回更新后的司机档案；再调用 `GET /driver/dashboard`、后台 `GET /admin/drivers`，司机昵称、城市编码、驾驶证号应该一致。

### 接口 B：`POST /driver/service-status`

接口用途：

切换司机在线/离线状态。

### 可直接复制的参数

```json
{
  "serviceStatus": "ONLINE",
  "longitude": "121.4737",
  "latitude": "31.2304"
}
```

### 接口 C：`POST /driver/withdraw`

接口用途：

提交提现申请。

### 可直接复制的参数

```json
{
  "applyAmount": 500,
  "bankAccount": "6222020202020202",
  "bankName": "中国工商银行"
}
```

---

## 16. 管理员后台核心接口

### 接口 A：`GET /admin/dashboard`

接口用途：

看管理后台数据大盘。

### 怎么点

1. 先用管理员账号登录
2. 带上管理员 token
3. 打开 `GET /admin/dashboard`
4. 点“发送”

### 正常结果怎么看

你应该能看到：

1. `userTotal`
2. `driverTotal`
3. `todayOrderTotal`
4. `todayTurnover`

这次导入的数据已经确保这些值不是 0。

### 接口 B：`GET /admin/users`

接口用途：

看用户列表。

### 接口 C：`GET /admin/drivers`

接口用途：

看司机列表和审核状态。

### 接口 D：`GET /admin/orders`

接口用途：

看订单列表。

### 接口 E：`GET /admin/coupons`

接口用途：

看优惠券列表。

### 最适合演示的说法

你可以直接这样讲：

“前面我用乘客和司机接口做业务闭环，最后再用管理员接口看后台统计、用户、司机、订单、优惠券，说明系统是完整打通的。”

## 五、最省事的演示顺序

如果你只想 5 分钟快速演示，照这个顺序来。

1. `POST /auth/login`
   用乘客账号登录，拿 token
2. `GET /app/estimate`
   先算价
3. `POST /orders`
   创建订单
4. `POST /auth/login`
   用司机账号登录，拿司机 token
5. `GET /orders/waiting`
   看待接单池
6. `POST /orders/{orderId}/accept`
   司机接单
7. `POST /orders/{orderId}/start`
   开始行程
8. `POST /orders/{orderId}/pickup`
   乘客上车
9. `POST /orders/{orderId}/finish`
   结束行程
10. `POST /orders/mock-pay`
   模拟支付
11. `GET /admin/dashboard`
   看管理后台大盘
12. `GET /admin/orders`
   看后台订单列表

## 六、常见问题排查清单

### 1. 打开 `doc.html` 白屏或打不开

直接检查：

1. 后端有没有启动成功
2. 端口是不是 `8080`
3. 浏览器地址是不是 `http://127.0.0.1:8080/doc.html`

### 2. 接口点了没反应

先看这 3 件事：

1. 有没有点“调试”或“Try it out”
2. 参数框是不是还不能编辑
3. 点完参数后有没有再点“发送”或“Execute”

### 3. 返回 401 或提示未登录

说明 token 没带对。

重新按这个做：

1. 重新登录一次
2. 重新复制 token
3. `Authorization` 里一定写成：

```text
Bearer 你的token
```

注意中间有一个空格。

### 4. 登录失败

优先检查：

1. 手机号对不对
2. 密码是不是 `123456`
3. `roleCode` 有没有填错

最容易错的是：

1. 用户账号却填成 `DRIVER`
2. 管理员账号却填成 `USER`

### 5. 下单时报参数错误

直接核对这几个字段有没有漏：

1. `carTypeId`
2. `serviceType`
3. `startName`
4. `startLng`
5. `startLat`
6. `endName`
7. `endLng`
8. `endLat`

### 6. 司机接不到单

按这个顺序查：

1. 司机是不是先登录了司机账号
2. 司机 token 是不是司机登录拿到的
3. 订单是不是 `DISPATCHING` 状态
4. 司机状态是不是已经切到 `ONLINE`

### 7. 大盘还是 0

直接查这 4 个点：

1. 数据脚本有没有真的执行成功
2. 项目连的是不是 `sunshine_travel`
3. 管理员有没有登录成功
4. 管理后台是不是请求到了正确后端地址 `http://127.0.0.1:8080`

### 8. 订单列表有数据，但某个页面还是空

优先刷新这几类接口：

1. `GET /orders/mine`
2. `GET /driver/dashboard`
3. `GET /admin/orders`
4. `GET /coupons/mine`
5. `GET /orders/{orderId}/track/history`

一般不是系统坏了，而是你当前登录角色不对，或者这页需要先带 token。

## 七、最后给你一个最实用的建议

答辩时不要一上来就讲原理，直接按“登录 -> 算价 -> 下单 -> 接单 -> 行程 -> 支付 -> 后台看大盘”这条线演示。

这样最顺，也最容易让老师一眼看懂你这个项目已经跑通了。
