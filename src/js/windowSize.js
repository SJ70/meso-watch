// Single entry point for keeping the Electron window's outer size in sync
// with the app's content. Width and height are always sent together in one
// IPC call (see electron/main.js's resize-window handler) so a width-driven
// change (timers-per-row, zoom) can never race a height-driven one (dialog
// open/close) and clobber it with a stale value - the previous split
// resize-to-content/resize-width calls could do exactly that.
const TIMER_CARD_TARGET_WIDTH = 250;
const TIMER_LIST_GAP = 8;
const MAIN_OUTER_PADDING = 32;
const MIN_WINDOW_HEIGHT = 120;

let getState = () => ({ timerCount: 0, timersPerRow: 3, uiZoom: 100 });

// app.js registers a getter for the live values this module needs (timer
// count, the timers-per-row setting, the UI zoom level) once at startup, so
// every call site below can stay a plain no-argument function.
export function configureWindowSizeState(stateGetter) {
  getState = stateGetter;
}

function computeTargetWidth() {
  const { timerCount, timersPerRow, uiZoom } = getState();
  const columns = Math.max(1, Math.min(timersPerRow, timerCount || 1));
  const baseWidth = columns * TIMER_CARD_TARGET_WIDTH + (columns - 1) * TIMER_LIST_GAP + MAIN_OUTER_PADDING;
  return baseWidth * (uiZoom / 100);
}

let lastSent = null;

function sendResize(width, height) {
  if (!window.electronAPI) return;
  const rounded = { width: Math.round(width), height: Math.max(MIN_WINDOW_HEIGHT, Math.ceil(height)) };
  // The resize itself can nudge the next measured height by a pixel or two
  // (rounding, the main-process +1px repaint nudge); ignore requests that
  // don't differ meaningfully from the last one actually sent.
  if (lastSent && Math.abs(rounded.width - lastSent.width) <= 2 && Math.abs(rounded.height - lastSent.height) <= 2) return;
  lastSent = rounded;
  window.electronAPI.resizeWindow(rounded.width, rounded.height);
}

// Fits the window to the main timer list. Call after anything that changes
// how many timers there are, the timers-per-row setting, or the zoom level.
export function syncWindowToContent() {
  sendResize(computeTargetWidth(), document.body.getBoundingClientRect().height);
}

// <dialog> renders in the top layer, so its content never contributes to
// document.body's own measured height - call this when one opens so the
// window grows to fit it (measured off-screen, before showModal() paints it).
export function syncWindowToDialog(dialog) {
  const prevPosition = dialog.style.position;
  const prevVisibility = dialog.style.visibility;
  const prevDisplay = dialog.style.display;
  dialog.style.position = "fixed";
  dialog.style.visibility = "hidden";
  dialog.style.display = "block";
  const dialogHeight = dialog.getBoundingClientRect().height;
  dialog.style.position = prevPosition;
  dialog.style.visibility = prevVisibility;
  dialog.style.display = prevDisplay;
  const bodyHeight = document.body.getBoundingClientRect().height;
  sendResize(computeTargetWidth(), Math.max(bodyHeight, dialogHeight + 40));
}
