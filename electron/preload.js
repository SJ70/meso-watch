const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onGlobalRestart: (callback) => ipcRenderer.on("global-restart", callback),
  setGlobalShortcut: (shortcut) => ipcRenderer.invoke("set-global-shortcut", shortcut),
});
