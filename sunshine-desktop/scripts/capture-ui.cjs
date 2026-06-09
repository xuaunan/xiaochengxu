const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow } = require('electron')

app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('no-sandbox')

const target = process.argv[2] || path.resolve(__dirname, '..', 'out', 'renderer', 'index.html')
const outputDir = path.resolve(__dirname, '..', 'output')

if (process.env.DEBUG_CAPTURE === '1') {
  console.log(JSON.stringify({ argv: process.argv, target }, null, 2))
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function capture(win, name) {
  await delay(260)
  const image = await win.webContents.capturePage()
  fs.writeFileSync(path.join(outputDir, name), image.toPNG())
}

async function clickMode(win, index) {
  await win.webContents.executeJavaScript(
    `document.querySelectorAll('.mode-switch__item')[${index}]?.click()`,
    true
  )
  await delay(360)
}

async function createWindow(width, height) {
  const win = new BrowserWindow({
    width,
    height,
    show: process.env.SHOW_CAPTURE === '1',
    backgroundColor: '#f5f7fb',
    webPreferences: {
      contextIsolation: true
    }
  })
  if (/^(https?:|data:)/.test(target)) {
    await win.loadURL(target)
  } else {
    await win.loadURL(pathToFileURL(target).toString())
  }
  await delay(500)
  return win
}

app.whenReady().then(async () => {
  fs.mkdirSync(outputDir, { recursive: true })

  const desktop = await createWindow(1180, 780)
  await capture(desktop, 'passenger-1180.png')
  await clickMode(desktop, 1)
  await capture(desktop, 'driver-1180.png')
  await clickMode(desktop, 2)
  await capture(desktop, 'admin-1180.png')
  desktop.destroy()

  const mobile = await createWindow(420, 820)
  await capture(mobile, 'passenger-420.png')
  mobile.destroy()

  app.quit()
}).catch((error) => {
  console.error(error)
  app.exit(1)
})
