// Electron's raw-input capture treats left/right Ctrl/Alt/Shift as the same key
// (see electron/rawInputDaemon.js); normalize recorded codes to match, so a
// shortcut set with either side still triggers. The web build has no such
// capture and is left alone.
export const NORMALIZE_MODIFIER_CODE = {
  ControlRight: "ControlLeft",
  ShiftRight: "ShiftLeft",
  AltRight: "AltLeft"
};

export function formatShortcut(shortcut) {
  if (!shortcut) return "없음";
  const standaloneModifierLabels = {
    ControlLeft: "Ctrl",
    ControlRight: "Ctrl",
    AltLeft: "Alt",
    AltRight: "Alt",
    ShiftLeft: "Shift",
    ShiftRight: "Shift",
    MetaLeft: "Meta",
    MetaRight: "Meta"
  };
  const standaloneModifier = standaloneModifierLabels[shortcut.code];
  if (standaloneModifier) return standaloneModifier;

  if (shortcut.key === " " || shortcut.key === "space" || shortcut.key === "spacebar") return "Spacebar";

  const arrowSymbols = {
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→"
  };

  const modifiers = [];
  if (shortcut.ctrlKey) modifiers.push("Ctrl");
  if (shortcut.altKey) modifiers.push("Alt");
  if (shortcut.shiftKey) modifiers.push("Shift");
  if (shortcut.metaKey) modifiers.push("Meta");
  const keyLabel = arrowSymbols[shortcut.key] || shortcut.key.toUpperCase();
  return [...modifiers, keyLabel].join(" + ");
}
