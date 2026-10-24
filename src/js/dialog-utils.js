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

// Resizes to whichever dialog is still open (if any), else shrinks to the
// main content. Used both when a dialog closes and by actions that can run
// while a dialog (e.g. the timer management dialog) is still open behind
// them, so they don't shrink the window out from under it.
export function syncWindowToOpenDialogs() {
  const stillOpen = [...document.querySelectorAll("dialog[open]")].pop();
  return stillOpen ? syncWindowToDialog(stillOpen) : syncWindowToContent();
}

// If closing this dialog reveals another dialog still open underneath it
// (e.g. the timer-add or delete-confirm dialogs opened from within the timer
// management dialog), resize to that one instead of shrinking to the main
// content - otherwise the window would shrink out from under it.
export function registerDialogShrinkOnClose(dialog) {
  dialog.addEventListener("close", syncWindowToOpenDialogs);
}
