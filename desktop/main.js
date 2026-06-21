// Life Kitchen 桌宠主进程。
// 透明置顶无边框窗口 + 本地 HTTP 桥（:7878）。网页把"当前在做哪类任务"POST 进来，
// 主进程经 IPC 推给渲染层，小精灵分身当场摇杯/熬煮。

const { app, BrowserWindow, screen, ipcMain, shell } = require('electron')
const http = require('http')
const path = require('path')
const fs = require('fs')

let win
let current = { state: 'idle', bartenderId: 'lemon', selected: false }
let pendingActions = [] // 桌宠点击产生的动作队列，等网页端拉取
let petMode = 'normal'
let dragFollowTimer = null
let dragFollowState = null

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
function selectedFile() {
  return path.join(app.getPath('userData'), 'pet-selected.json')
}
function loadPos() {
  try { return JSON.parse(fs.readFileSync(posFile(), 'utf8')) } catch { return null }
}
function loadSelected() {
  try { return JSON.parse(fs.readFileSync(selectedFile(), 'utf8')) } catch { return null }
}
function savePos() {
  if (!win) return
  const [x, y] = win.getPosition()
  try { fs.writeFileSync(posFile(), JSON.stringify({ x, y })) } catch {}
}
function saveSelected() {
  if (!current?.selected || !current.bartenderId) return
  try {
    fs.writeFileSync(selectedFile(), JSON.stringify({
      bartenderId: current.bartenderId,
      customBartender: current.customBartender || null,
    }))
  } catch {}
}
function setPetMode(mode) {
  if (!win) return
  petMode = mode === 'island' ? 'island' : 'normal'
  const wa = screen.getPrimaryDisplay().workArea
  const [x, y] = win.getPosition()
  if (petMode === 'island') {
    const width = 176
    const height = 78
    const nextY = Math.min(Math.max(y, wa.y + 18), wa.y + wa.height - height - 18)
    win.setBounds({ width, height, x: wa.x + wa.width - width - 8, y: nextY })
  } else {
    const width = 300
    const height = 390
    const nextX = Math.round(wa.x + (wa.width - width) / 2)
    const nextY = Math.round(wa.y + (wa.height - height) / 2)
    win.setBounds({ width, height, x: nextX, y: nextY })
  }
  savePos()
  win.webContents.send('pet-mode', petMode)
}

function stopWindowDragFollow() {
  if (dragFollowTimer) clearInterval(dragFollowTimer)
  dragFollowTimer = null
  dragFollowState = null
}

function startWindowDragFollow() {
  if (!win) return
  stopWindowDragFollow()
  const cursor = screen.getCursorScreenPoint()
  const [x, y] = win.getPosition()
  dragFollowState = { cursorX: cursor.x, cursorY: cursor.y, winX: x, winY: y }
  dragFollowTimer = setInterval(() => {
    if (!win || !dragFollowState) return
    const next = screen.getCursorScreenPoint()
    const dx = next.x - dragFollowState.cursorX
    const dy = next.y - dragFollowState.cursorY
    if (!dx && !dy) return
    win.setPosition(Math.round(dragFollowState.winX + dx), Math.round(dragFollowState.winY + dy), false)
  }, 16)
}

function start() {
  const selected = loadSelected()
  if (selected?.bartenderId) {
    current = {
      state: 'idle',
      bartenderId: selected.bartenderId,
      selected: true,
      schedule: [],
      customBartender: selected.customBartender || null,
    }
  }
  const wa = screen.getPrimaryDisplay().workArea
  const width = 300
  const height = 390
  win = new BrowserWindow({
    width,
    height,
    x: Math.round(wa.x + (wa.width - width) / 2),
    y: Math.round(wa.y + (wa.height - height) / 2),
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
    win.webContents.send('pet-mode', petMode)
    syncWindowVisibility()
  })
  startServer()

  // 渲染层请求打开主应用（例如点击饮品进揭晓页）
  ipcMain.on('pet-open-app', (_e, openPath) => {
    shell.openExternal(`http://localhost:5173/#/${openPath || 'execute'}`)
  })

  // 渲染层发送动作（如点击原材料完成），加入队列等网页端拉取
  ipcMain.on('pet-send-action', (_e, action) => {
    pendingActions.push(action)
    if (pendingActions.length > 50) pendingActions = pendingActions.slice(-50)
  })

  ipcMain.on('pet-select-bartender', (_e, action = {}) => {
    if (!action.bartenderId) return
    current = {
      ...current,
      state: 'idle',
      bartenderId: action.bartenderId,
      selected: true,
      schedule: current.schedule || [],
      customBartender: current.customBartender || null,
    }
    saveSelected()
    pendingActions.push({ type: 'select-bartender', bartenderId: action.bartenderId, selectedAt: action.selectedAt || Date.now() })
    if (pendingActions.length > 50) pendingActions = pendingActions.slice(-50)
    win?.webContents.send('pet-state', current)
    syncWindowVisibility()
  })

  ipcMain.on('pet-set-mode', (_e, mode) => {
    setPetMode(mode)
  })

  ipcMain.on('pet-begin-drag', () => {
    startWindowDragFollow()
  })

  ipcMain.on('pet-end-drag', () => {
    stopWindowDragFollow()
    savePos()
  })

  ipcMain.on('pet-drag-window', (_e, delta = {}) => {
    if (!win) return
    const dx = Number(delta.dx) || 0
    const dy = Number(delta.dy) || 0
    if (!dx && !dy) return
    const [x, y] = win.getPosition()
    win.setPosition(Math.round(x + dx), Math.round(y + dy), false)
  })
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
          try {
            current = JSON.parse(body)
            if (!current.bartenderId) current.bartenderId = 'rosemary'
            saveSelected()
          } catch {}
          // 不在这里清空 pendingActions，让网页端轮询去消费并去重
          if (win) {
            win.webContents.send('pet-state', current)
            syncWindowVisibility()
          }
          res.writeHead(200); res.end('ok')
        })
        return
      }
      if (req.url === '/state') {
        res.writeHead(200, { 'content-type': 'application/json' })
        const actions = pendingActions
        pendingActions = []
        res.end(JSON.stringify({ current, actions }))
        return
      }
      res.writeHead(404); res.end()
    })
    .listen(7878, '127.0.0.1', () => console.log('🍹 桌宠桥已在 http://localhost:7878'))
}

function syncWindowVisibility() {
  if (!win) return
  const shouldShow =
    (current.state === 'choosing' && current.allowDesktopChoice) ||
    current.selected ||
    current.state === 'brewing' ||
    current.state === 'done'
  if (shouldShow) win.showInactive()
  else win.hide()
}

app.on('window-all-closed', () => app.quit())
