const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pet', {
  onState: (cb) => ipcRenderer.on('pet-state', (_e, data) => cb(data)),
})
