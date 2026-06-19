// Life Kitchen 桌宠主进程。
// 透明置顶无边框窗口 + 本地 HTTP 桥（:7878）。网页把"当前在做哪类任务"POST 进来，
// 主进程经 IPC 推给渲染层，小精灵分身当场摇杯/熬煮。

const { app, BrowserWindow, screen } = require('electron')
const http = require('http')
const path = require('path')
const fs = require('fs')

let win
let current = { state: 'idle', bartenderId: 'rosemary' }

// 单实例锁，防重复窗口
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => { if (win) win.show() })
  app.whenReady().then(start)
}

function posFile() {
  return path.join(app.getPath('userData'), 'pet-pos.json')
}
function loadPos() {
  try { return JSON.parse(fs.readFileSync(posFile(), 'utf8')) } catch { return null }
}
function savePos() {
  if (!win) return
  const [x, y] = win.getPosition()
  try { fs.writeFileSync(posFile(), JSON.stringify({ x, y })) } catch {}
}

function start() {
  const pos = loadPos()
  const wa = screen.getPrimaryDisplay().workAreaSize
  win = new BrowserWindow({
    width: 220,
    height: 290,
    x: pos ? pos.x : wa.width - 260,
    y: pos ? pos.y : wa.height - 340,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  win.on('moved', savePos)
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('pet-state', current)
    win.showInactive() // 确保启动即可见（不抢焦点）
  })
  startServer()
}

function startServer() {
  http
    .createServer((req, res) => {
      // CORS：必须含 Allow-Methods，否则浏览器预检失败、POST 被拦
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'content-type')
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
      if (req.url === '/state' && req.method === 'POST') {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          try { current = JSON.parse(body) } catch {}
          if (win) {
            win.webContents.send('pet-state', current)
            // 开始做事时把桌宠浮到前面（不抢焦点）
            if (current.state === 'brewing') win.showInactive()
          }
          res.writeHead(200); res.end('ok')
        })
        return
      }
      if (req.url === '/state') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(current))
        return
      }
      res.writeHead(404); res.end()
    })
    .listen(7878, '127.0.0.1', () => console.log('🍹 桌宠桥已在 http://localhost:7878'))
}

app.on('window-all-closed', () => app.quit())
