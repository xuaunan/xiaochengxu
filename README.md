# 阳光出行唯一开发目录

从 2026-05-13 开始，本项目只以 `D:\xiaochengxu` 为准。

以后只打开、只修改这个目录：

```text
D:\xiaochengxu
```

## 当前目录说明

- `sunshine-travel`：Spring Boot 3 + MyBatis-Plus + MySQL 8 + Redis 后端
- `sunshine-admin`：后台管理前端
- `sunshine-user-miniapp`：乘客端微信小程序
- `sunshine-driver-miniapp`：司机端微信小程序
- `sql`：最新数据库导出和同步补丁
- `docs`：部署、接口、架构和说明文档
- `zhengshu`：证件图片素材

这些不是多个版本，而是同一个完整项目的不同组成部分。

## 最新数据库

最新完整数据库文件：

```text
D:\xiaochengxu\sql\sunshine_travel_latest_20260513.sql
```

同步补丁保留在：

```text
D:\xiaochengxu\sql\sync-order-realtime-state-20260513.sql
```

当前完整导出已经包含同步补丁，补丁文件只是为了以后排查和查阅。

## 不要再改旧目录

看到名字里带 `OLD_DO_NOT_USE` 的目录，都不要打开、不要改。它们只是回退归档，不是当前项目。

旧目录已经改名为：

```text
D:\OLD_DO_NOT_USE_xiaochengxu_BACKUP_before_single_version_20260513-130216
C:\jdk-17\OLD_DO_NOT_USE_sunshine-travel_20260513
```

最终开发、运行、保存，都只看 `D:\xiaochengxu`。
