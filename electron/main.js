const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");
const { uIOhook, UiohookKey } = require("uiohook-napi");

let mainWindow = null;
let observedShortcut = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "메소워치",
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

ipcMain.handle("set-global-shortcut", (_event, shortcut) => {
  const keycode = keycodeFromShortcut(shortcut);
  if (!keycode) return false;
  observedShortcut = { ...shortcut, keycode };
  return true;
});

uIOhook.on("keydown", (event) => {
  if (!observedShortcut || event.keycode !== observedShortcut.keycode) return;
  if (event.ctrlKey !== observedShortcut.ctrlKey
    || event.altKey !== observedShortcut.altKey
    || event.shiftKey !== observedShortcut.shiftKey
    || event.metaKey !== observedShortcut.metaKey) return;
  mainWindow?.webContents.send("global-restart");
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
