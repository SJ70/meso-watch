export const NO_ICON = "none";

export const TIMER_ICON_NAMES = [
  NO_ICON,
  "attack.png",
  "exp.png",
  "sol-janus.png",
  "hexa-booster.webp",
  "rune.png",
  "river.png",
];

export const DEFAULT_MASTER_VOLUME = 50;
export const DEFAULT_TIMER_VOLUME = 100;
export const DEFAULT_TIMERS_PER_ROW = 3;
export const DEFAULT_UI_ZOOM = 100;
export const MIN_UI_ZOOM = 50;
export const MAX_UI_ZOOM = 150;

export const DEFAULT_TIMER_MINUTES = 1;

// ids must match the keys of ALARM_PATTERNS in sound.js
export const ALARM_TYPES = [
  { id: "beep", label: "기본음" },
  { id: "chime", label: "차임벨" },
  { id: "alert", label: "경고음" },
  { id: "bell", label: "종소리" },
  { id: "ping", label: "핑" },
  { id: "double", label: "더블비프" },
  { id: "arpeggio", label: "아르페지오" },
  { id: "siren", label: "사이렌" },
];
export const DEFAULT_ALARM_TYPE = ALARM_TYPES[0].id;

// The repeat count slider only covers a finite range; "무제한" (unlimited)
// is a separate checkbox that, when on, disables the slider and overrides
// it to repeat forever.
export const MIN_ALARM_REPEAT_COUNT = 1;
export const MAX_ALARM_REPEAT_COUNT = 10;
export const DEFAULT_ALARM_REPEAT_COUNT = 1;
export const DEFAULT_ALARM_REPEAT_UNLIMITED = false;

export const DEFAULT_TIMER_AUTO_RESTART = false;

// Seeded once for a fresh install (see meso-watch-defaults-seeded in app.js).
export const DEFAULT_TIMERS = [
  { name: "몬스터 리젠", totalMs: 7500, alarmType: "beep", icon: "attack.png" },
  { name: "야누스 설치", totalMs: 70000, alarmType: "bell", icon: "sol-janus.png" },
  { name: "경험치 버프", totalMs: 1800000, alarmType: "alert", icon: "exp.png" },
];
