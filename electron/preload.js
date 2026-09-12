const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onGlobalRestart: (callback) => ipcRenderer.on("global-restart", (_event, timerId) => callback(timerId)),
  setGlobalShortcuts: (shortcuts) => ipcRenderer.invoke("set-global-shortcuts", shortcuts),
  resizeToContent: (height) => ipcRenderer.invoke("resize-to-content", height),
});
