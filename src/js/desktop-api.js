// Plain (non-module) script loaded first in <head>: when running inside the
// Tauri overlay app, exposes window.desktopAPI - the only bridge the rest of
// the app uses to tell the desktop build apart from the web version and to
// reach native features. In a browser this does nothing and desktopAPI stays
// undefined.
(function () {
  const tauri = window.__TAURI__;
  if (!tauri) return;

  const { invoke } = tauri.core;
  const currentWindow = tauri.window.getCurrentWindow();

  window.desktopAPI = {
    // Fired by the native raw-input capture when a timer's restart shortcut
    // is pressed anywhere - including while the game has focus.
    onGlobalRestart: (callback) => tauri.event.listen("global-restart", (event) => callback(event.payload)),
    setGlobalShortcuts: (shortcuts) => invoke("set_global_shortcuts", { shortcuts }),
    minimizeWindow: () => currentWindow.minimize(),
    closeWindow: () => currentWindow.close(),
    resizeWindow: (width, height) => invoke("resize_window", { width, height }),
  };

  // External links open in the default browser, never inside the overlay.
  const openExternal = (url) => tauri.opener.openUrl(url);
  window.open = (url) => {
    if (url) openExternal(String(url));
    return null;
  };
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[href]");
    if (!link || !/^https?:/i.test(link.href)) return;
    event.preventDefault();
    openExternal(link.href);
  });

  // Frameless window: dragging any empty area moves it. Interactive regions
  // are excluded - the same split desktop.css used to express with
  // -webkit-app-region drag/no-drag in the Electron build.
  const NO_DRAG = ".header-actions, .global-controls, .timer-card, .settings-modal, dialog, button, input, select, textarea, a, label";
  document.addEventListener("mousedown", (event) => {
    if (event.button !== 0 || event.target.closest?.(NO_DRAG)) return;
    event.preventDefault();
    currentWindow.startDragging();
  });
})();
