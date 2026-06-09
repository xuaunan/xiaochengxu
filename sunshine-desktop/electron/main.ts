import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    backgroundColor: '#f5f7fb',
    title: '阳光出行桌面端',
    titleBarStyle: 'hidden',
    titleBarOverlay:
      process.platform === 'win32'
        ? {
            color: '#f8fafc',
            symbolColor: '#162033',
            height: 38
          }
        : false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('sunshine:app-info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged
  }))

  ipcMain.handle('sunshine:window-control', (event, action: 'minimize' | 'maximize' | 'close') => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    if (action === 'minimize') win.minimize()
    if (action === 'maximize') {
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
    }
    if (action === 'close') win.close()
    return true
  })

  ipcMain.handle('sunshine:open-external', async (_event, url: string) => {
    if (!/^https?:\/\//.test(url)) return false
    await shell.openExternal(url)
    return true
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
