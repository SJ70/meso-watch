// Resizing the window can itself nudge document.body's measured height by a
// pixel or two (rounding, the main-process shrink workaround), which would
// otherwise retrigger the observer in app.js in an endless loop. Ignore
// requests that don't differ meaningfully from the last one actually sent.
// No-op on web.
let lastRequestedHeight = null;
export async function requestResize(height) {
  if (!window.electronAPI) return;
  const rounded = Math.ceil(height);
  if (lastRequestedHeight !== null && Math.abs(rounded - lastRequestedHeight) <= 2) return;
  lastRequestedHeight = rounded;
  await window.electronAPI.resizeToContent(rounded);
}

// <dialog> renders in the top layer, so opening one doesn't change
// document.body's size and never trips the ResizeObserver in app.js. Grow the
// window to fit it when opened; every dialog gets a "close" listener
// (fires for .close(), Escape, and <form method="dialog">) to shrink back.
function measureDialogHeight(dialog) {
  // Measure the dialog's natural height without actually showing it yet,
  // so the window can be resized to fit *before* showModal() paints it -
  // mirroring the order that already works for the timer-list growing.
  const prevPosition = dialog.style.position;
  const prevVisibility = dialog.style.visibility;
  const prevDisplay = dialog.style.display;
  dialog.style.position = "fixed";
  dialog.style.visibility = "hidden";
  dialog.style.display = "block";
  const height = dialog.getBoundingClientRect().height;
  dialog.style.position = prevPosition;
  dialog.style.visibility = prevVisibility;
  dialog.style.display = prevDisplay;
  return height;
}

export async function openDialog(dialog) {
  const bodyHeight = document.body.getBoundingClientRect().height;
  const dialogHeight = measureDialogHeight(dialog);
  await requestResize(Math.max(bodyHeight, dialogHeight + 40));
  dialog.showModal();
}

export function registerDialogShrinkOnClose(dialog) {
  dialog.addEventListener("close", () => requestResize(document.body.getBoundingClientRect().height));
}
