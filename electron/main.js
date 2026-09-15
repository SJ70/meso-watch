const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { app, BrowserWindow, ipcMain, screen, shell } = require("electron");
const koffi = require("koffi");

let mainWindow = null;
let observedShortcuts = [];
let rawInputWorker = null;
let rawInputThreadId = null;

const user32 = koffi.load("user32.dll");
const PostThreadMessageW = user32.func(
  "bool __stdcall PostThreadMessageW(uint32 idThread, uint32 msg, void *wParam, void *lParam)"
);
const WM_QUIT = 0x0012;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "메소워치",
    icon: path.join(__dirname, "..", "public", "logo.png"),
    width: 800,
    resizable: false,
    transparent: true,
    frame: false,
    hasShadow: false,/*  */
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
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.loadFile(path.join(__dirname, "..", "src", "index.html"));
}

function startRawInputWorker() {
  rawInputWorker = new Worker(path.join(__dirname, "rawInputDaemon.js"));

  rawInputWorker.on("message", (event) => {
    if (event?.type === "started") {
      rawInputThreadId = event.threadId;
      return;
    }
    if (event?.type !== "keydown") return;

    const matchedShortcut = observedShortcuts.find((item) => event.code === item.shortcut.code
      && event.ctrlKey === item.shortcut.ctrlKey
      && event.altKey === item.shortcut.altKey
      && event.shiftKey === item.shortcut.shiftKey
      && event.metaKey === item.shortcut.metaKey);
    if (matchedShortcut) mainWindow?.webContents.send("global-restart", matchedShortcut.id);
  });

  rawInputWorker.on("error", (error) => {
    console.error("raw input worker error:", error);
  });
}

function stopRawInputWorker() {
  if (!rawInputWorker) return;
  // GetMessageW blocks the worker's own event loop, so a plain postMessage() can't
  // reach it until a Windows message arrives; PostThreadMessageW wakes it directly.
  if (rawInputThreadId != null) PostThreadMessageW(rawInputThreadId, WM_QUIT, null, null);
  rawInputWorker.terminate();
  rawInputWorker = null;
}

ipcMain.handle("set-global-shortcuts", (_event, shortcuts) => {
  observedShortcuts = shortcuts.filter((item) => item.shortcut?.code);
  return true;
});

// Width and height always arrive together in one call (see
// src/js/windowSize.js) instead of two independent IPC round trips, so there
// is no ordering race where a width-only or height-only update can clobber
// the other dimension with a stale value.
ipcMain.handle("resize-window", (_event, { width: requestedWidth, height: requestedHeight }) => {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  const workArea = screen.getDisplayMatching(bounds).workArea;
  const width = Math.min(Math.max(Math.round(requestedWidth), 200), workArea.width);
  const height = Math.min(Math.max(Math.round(requestedHeight), 120), workArea.height - 40);
  // Keeps x/y fixed and grows right/down, even past the bottom/right edge of
  // the screen - no pulling the window back on-screen when it grows taller.
  const x = bounds.x;
  const y = bounds.y;
  if (width === bounds.width && height === bounds.height) return;
  mainWindow.setBounds({ x, y, width, height: height + 1 });
  mainWindow.setBounds({ x, y, width, height });
});

app.whenReady().then(() => {
  createWindow();
  startRawInputWorker();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  stopRawInputWorker();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
