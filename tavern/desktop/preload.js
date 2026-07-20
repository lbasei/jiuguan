const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pet', {
  onState: (cb) => ipcRenderer.on('pet-state', (_e, data) => cb(data)),
  onMode: (cb) => ipcRenderer.on('pet-mode', (_e, mode) => cb(mode)),
  openApp: (path) => ipcRenderer.send('pet-open-app', path),
  sendAction: (action) => ipcRenderer.send('pet-send-action', action),
  selectBartender: (bartenderId) => ipcRenderer.send('pet-select-bartender', { bartenderId, selectedAt: Date.now() }),
  setMode: (mode) => ipcRenderer.send('pet-set-mode', mode),
  beginDrag: () => ipcRenderer.send('pet-begin-drag'),
  endDrag: () => ipcRenderer.send('pet-end-drag'),
  dragBy: (dx, dy) => ipcRenderer.send('pet-drag-window', { dx, dy }),
})
