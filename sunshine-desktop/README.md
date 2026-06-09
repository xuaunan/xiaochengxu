# Sunshine Travel Desktop

> Project status: abandoned on 2026-06-07.
>
> 这个桌面端方向已停止继续开发。原因很直接：电脑端打车不是一个自然高频场景，继续投入会变成鸡肋产品。保留本目录只是为了留存此前实验代码、功能映射和构建记录，后续不再作为阳光出行主线交付目标。

阳光出行独立 Windows 桌面端。这个工程只写入 `D:\xiaochengxu\sunshine-desktop`，原有小程序、网页、后台和后端工程只作为只读参考。

## 定位

桌面端把乘客、司机、运营后台三套核心业务合并为一个企业级工作台：可以演示完整订单闭环，也能在业务接口在线时尝试连接真实服务；服务不可用时自动降级为离线数据，不阻断演示和操作。

## 已覆盖模块

- 乘客端：即时叫车、常用地址、路线预估、订单推进、支付、取消、发票、评价、投诉、优惠券、顺风车、国际出行、钱包充值、流水、实名资料、安全联系人、客服工单。
- 司机端：听单状态、可接订单、接单/拒单、接驾/上车/完单、位置上报、收益钱包、提现申请、提现单、证件提交、服务偏好、认证消息、司机客服单。
- 运营端：运营大盘、重要消息、用户审核、司机审核、证件审核、账号启停、密码重置、提现审核、投诉处理、发票审核、订单推进/退款/开票、优惠券模板/发放/启停、跨境订单、派单规则、外币汇率、公告、版本计划、系统参数、操作审计。
- 体验层：Apple-like 轻玻璃桌面外壳、三角色 source list、实时状态条、路线视觉资产、可执行命令中心、右侧 Live Activity、调度决策/SLA/匹配置信度、当前订单进度轨、最近操作审计、toast 与确认弹窗。中窄屏会把调度决策提升到主工作区状态条，保证右栏收起后第一屏仍能看到下一步。

完整映射见 [FEATURE_COVERAGE.md](./FEATURE_COVERAGE.md)。

## 命令

```powershell
npm install
npm run dev
npm run build
npm run dist
```

默认业务服务地址为 `http://127.0.0.1:8080`，可在桌面端顶部工具栏修改。

## 交付状态

- 开发预览：`npm run dev`
- 生产构建：`npm run build`
- Windows 安装包：`npm run dist`
- 已验证：`vue-tsc --noEmit && electron-vite build`
- 浏览器 QA 截图：`output/passenger-status-localhost-1440x920.png`、`output/driver-status-localhost-1180x760.png`、`output/admin-status-localhost-760x900.png`

`npm run dist` 会调用 `electron-builder` 生成 Windows 安装器。如当前 Windows 环境没有创建符号链接权限，`winCodeSign` 解压阶段可能失败；这不影响 `npm run build` 产物和桌面端代码质量。
