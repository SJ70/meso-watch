const path = require("node:path");
const { app, BrowserWindow, ipcMain, screen } = require("electron");
const { uIOhook, UiohookKey } = require("uiohook-napi");

let mainWindow = null;
let observedShortcuts = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "메소워치",
    icon: path.join(__dirname, "..", "public", "meso.png"),
    width: 700,
    height: 640,
    minWidth: 700,
    minHeight: 120,
    maxWidth: 860,
    resizable: true,
    transparent: true,
    frame: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.on("blur", () => mainWindow.setAlwaysOnTop(true, "screen-saver"));

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

ipcMain.on("resize-to-content", (_event, contentHeight) => {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  const workAreaHeight = screen.getDisplayMatching(bounds).workAreaSize.height;
  const height = Math.min(Math.max(Math.round(contentHeight), 120), workAreaHeight - 40);
  if (height === bounds.height) return;
  mainWindow.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: height + 1 });
  mainWindow.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height });
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
