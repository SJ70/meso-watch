const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");
const { uIOhook, UiohookKey } = require("uiohook-napi");

let mainWindow = null;
let observedShortcuts = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "메소워치",
    icon: path.join(__dirname, "..", "public", "meso.png"),
    width: 560,
    height: 680,
    minWidth: 360,
    minHeight: 480,
    resizable: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, "..", "src", "index.html"));
}

function keycodeFromShortcut(shortcut) {
  const code = shortcut.code;
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return UiohookKey[letter[1]];

  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) return UiohookKey[digit[1]];

  const codeAliases = {
    ControlLeft: "Ctrl",
    ControlRight: "CtrlRight",
    AltLeft: "Alt",
    AltRight: "AltRight",
    ShiftLeft: "Shift",
    ShiftRight: "ShiftRight",
    MetaLeft: "Meta",
    MetaRight: "MetaRight",
  };
  return UiohookKey[codeAliases[code] || code];
}

ipcMain.handle("set-global-shortcuts", (_event, shortcuts) => {
  observedShortcuts = shortcuts
    .map((item) => ({ ...item, keycode: keycodeFromShortcut(item.shortcut) }))
    .filter((item) => item.keycode);
  return true;
});

uIOhook.on("keydown", (event) => {
  const matchedShortcut = observedShortcuts.find((item) => event.keycode === item.keycode
    && event.ctrlKey === item.shortcut.ctrlKey
    && event.altKey === item.shortcut.altKey
    && event.shiftKey === item.shortcut.shiftKey
    && event.metaKey === item.shortcut.metaKey);
  if (matchedShortcut) mainWindow?.webContents.send("global-restart", matchedShortcut.id);
});

app.whenReady().then(() => {
  createWindow();
  uIOhook.start();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  uIOhook.stop();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
