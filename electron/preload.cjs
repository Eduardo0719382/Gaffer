// Puente seguro entre la ventana y el proceso principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gafferDesktop', {
  platform: process.platform,
  onUpdate: cb => ipcRenderer.on('update', (_e, ev) => cb(ev)),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onOpenFile: cb => ipcRenderer.on('open-file', (_e, name, text) => cb(name, text)),
});
