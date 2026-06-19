const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pet', {
  onState: (cb) => ipcRenderer.on('pet-state', (_e, data) => cb(data)),
  openApp: (path) => ipcRenderer.send('pet-open-app', path),
  sendAction: (action) => ipcRenderer.send('pet-send-action', action),
})
