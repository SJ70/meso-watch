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

// CSS-effective width (pre-zoom) the timer grid should have. Electron's
// `zoom` on <html> already rescales measured heights into physical px on its
// own (see below), so only the width sent to the main process needs the
// explicit uiZoom multiplier.
function computeBaseWidth() {
  const { timerCount, timersPerRow } = getState();
  const columns = Math.max(1, Math.min(timersPerRow, timerCount || 1));
  return columns * TIMER_CARD_TARGET_WIDTH + (columns - 1) * TIMER_LIST_GAP + MAIN_OUTER_PADDING;
}

// The timer grid's columns come from CSS auto-fill, driven by the window's
// *current* width - not by timersPerRow directly. Measuring body height at
// the current width (e.g. the hardcoded width Electron creates the window
// with at startup) can therefore catch the grid at a different column/row
// count than the width we're about to resize to. Temporarily pinning body's
// width to the target width forces the grid to lay out at its final column
// count before we measure, so the height sent alongside it actually matches.
// Reverted before this function returns, so it never paints.
function measureBodyHeightAtWidth(baseWidth) {
  const prevWidth = document.body.style.width;
  document.body.style.width = `${baseWidth}px`;
  const height = document.body.getBoundingClientRect().height;
  document.body.style.width = prevWidth;
  return height;
}

let lastSent = null;

// Returns a promise that resolves once the window has actually finished
// resizing, so callers that need the new size in place before doing anything
// else (e.g. opening a dialog without it flashing at the old size) can await it.
function sendResize(width, height) {
  if (!window.electronAPI) return Promise.resolve();
  const rounded = { width: Math.round(width), height: Math.max(MIN_WINDOW_HEIGHT, Math.ceil(height)) };
  // The resize itself can nudge the next measured height by a pixel or two
  // (rounding, the main-process +1px repaint nudge); ignore requests that
  // don't differ meaningfully from the last one actually sent.
  if (lastSent && Math.abs(rounded.width - lastSent.width) <= 2 && Math.abs(rounded.height - lastSent.height) <= 2) return Promise.resolve();
  lastSent = rounded;
  return window.electronAPI.resizeWindow(rounded.width, rounded.height);
}

// Fits the window to the main timer list. Call after anything that changes
// how many timers there are, the timers-per-row setting, or the zoom level.
export function syncWindowToContent() {
  const { uiZoom } = getState();
  const baseWidth = computeBaseWidth();
  const height = measureBodyHeightAtWidth(baseWidth);
  return sendResize(baseWidth * (uiZoom / 100), height);
}

// <dialog> renders in the top layer, so its content never contributes to
// document.body's own measured height - call this when one opens so the
// window grows to fit it (measured off-screen, before showModal() paints it).
// Await the result before actually opening the dialog so it never flashes at
// the pre-resize window size.
export function syncWindowToDialog(dialog) {
  const { uiZoom } = getState();
  const baseWidth = computeBaseWidth();
  const prevBodyWidth = document.body.style.width;
  document.body.style.width = `${baseWidth}px`;

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
  document.body.style.width = prevBodyWidth;

  return sendResize(baseWidth * (uiZoom / 100), Math.max(bodyHeight, dialogHeight + 40));
}
