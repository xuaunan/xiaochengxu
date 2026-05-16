# 阳光出行 Web 启动说明

## 一键启动

双击这个文件：

```text
D:\xiaochengxu\html\START_WEB.bat
```

它会自动进入 `D:\xiaochengxu\html`，启动 Vite 本地网页服务，并打开浏览器。

## 手动启动

如果你想自己在终端启动：

```powershell
cd /d D:\xiaochengxu\html
npm run dev -- --port 5174
```

然后浏览器打开：

```text
http://127.0.0.1:5174/
```

## 打包检查

```powershell
cd /d D:\xiaochengxu\html
npm run build
```

