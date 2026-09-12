export const NO_ICON = "none";

export const TIMER_ICON_NAMES = [
  NO_ICON,
  "attack.png",
  "exp.png",
  "sol-janus.png",
  "hexa-booster.webp",
  "eruption.png",
  "river.png",
];

export const DEFAULT_BG_OPACITY_ELECTRON = 0;
export const DEFAULT_PANEL_OPACITY_ELECTRON = 75;
export const DEFAULT_BG_OPACITY_WEB = 100;
export const DEFAULT_PANEL_OPACITY_WEB = 100;

export const DEFAULT_MASTER_VOLUME = 50;
export const DEFAULT_TIMER_VOLUME = 100;

export const DEFAULT_TIMER_MINUTES = 1;

// ids must match the keys of ALARM_PATTERNS in sound.js
export const ALARM_TYPES = [
  { id: "beep", label: "기본음" },
  { id: "chime", label: "차임벨" },
  { id: "alert", label: "경고음" },
  { id: "bell", label: "종소리" },
];
export const DEFAULT_ALARM_TYPE = ALARM_TYPES[0].id;
