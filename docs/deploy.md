# 阳光出行本地部署教程

## 1. 环境要求

- JDK 17
- MySQL 8.0
- Redis 6.x 或 7.x
- Node.js 18+
- 微信开发者工具最新稳定版

## 2. 导入数据库

1. 打开 MySQL 客户端。
2. 执行 `D:\xiaochengxu\sql\sunshine_travel.sql`。
3. 确认数据库名为 `sunshine_travel`。

## 3. 启动后端

后端目录：`D:\xiaochengxu\sunshine-travel`

如 Maven 未配置到 PATH，可直接执行：

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-17'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
& 'C:\Users\31379\.trae-cn\tools\maven\latest\bin\mvn.cmd' spring-boot:run
```

启动成功后访问：

- 接口服务：`http://127.0.0.1:8080`
- Knife4j：`http://127.0.0.1:8080/doc.html`

## 4. 启动管理端

目录：`D:\xiaochengxu\sunshine-admin`

```powershell
cd D:\xiaochengxu\sunshine-admin
npm install
npm run dev
```

浏览器访问：`http://127.0.0.1:5173`

点击右上角“管理员演示登录”即可写入后台 token。

## 5. 打开微信用户端小程序

目录：`D:\xiaochengxu\sunshine-user-miniapp`

步骤：

1. 打开微信开发者工具
2. 选择“导入项目”
3. 选择目录 `D:\xiaochengxu\sunshine-user-miniapp`
4. AppID 可使用测试号
5. 进入后即可调试首页、订单、顺风车、优惠券、个人中心

## 6. 打开微信司机端小程序

目录：`D:\xiaochengxu\sunshine-driver-miniapp`

步骤与用户端一致，导入后可演示：

- 上线接单
- 查看待抢单池
- 抢单
- 收益提现
- 司机个人中心

## 7. 演示建议顺序

1. 管理员查看大盘与基础数据
2. 用户端创建即时打车订单
3. 司机端抢单并展示接单池
4. 用户端查看订单并执行模拟支付
5. 展示顺风车和国际出行
6. 回到管理端展示订单与营销数据

## 8. 常见问题排查

- 后端启动失败且提示数据库连接错误：检查 MySQL 用户名密码是否与 `application.yml` 一致。
- 管理端接口报错：确认后端已启动在 `8080` 端口。
- 小程序请求失败：在微信开发者工具中勾选“不校验合法域名”。
- Redis 未启动：当前项目多数接口仍可演示，但建议启动 Redis 保证配置完整。
