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

ipcMain.handle("resize-to-content", (_event, contentHeight) => {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  const workArea = screen.getDisplayMatching(bounds).workArea;
  const height = Math.min(Math.max(Math.round(contentHeight), 120), workArea.height - 40);
  // setBounds keeps x/y fixed and grows downward; if that would push the
  // bottom edge past the screen, pull the top up instead so it stays visible.
  const y = Math.min(bounds.y, workArea.y + workArea.height - height);
  if (height === bounds.height && y === bounds.y) return;
  mainWindow.setBounds({ x: bounds.x, y, width: bounds.width, height: height + 1 });
  mainWindow.setBounds({ x: bounds.x, y, width: bounds.width, height });
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
