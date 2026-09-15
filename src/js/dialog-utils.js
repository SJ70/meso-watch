import { syncWindowToContent, syncWindowToDialog } from "./windowSize.js";

// Grows the window to fit the dialog before showing it (<dialog> renders in
// the top layer, so it never resizes the window on its own), then shrinks
// back to fit the main content once closed. Every dialog gets a "close"
// listener via registerDialogShrinkOnClose (fires for .close(), Escape, and
// <form method="dialog">).
export async function openDialog(dialog) {
  await syncWindowToDialog(dialog);
  dialog.showModal();
}

export function registerDialogShrinkOnClose(dialog) {
  dialog.addEventListener("close", () => syncWindowToContent());
}
