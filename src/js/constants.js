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
// Upper bound of the minutes column in the duration picker.
export const MAX_DURATION_MINUTES = 60;

// ids must match the keys of ALARM_PATTERNS in sound.js
// icon (optional) is an svg name from src/svg/icons.js, shown left of the label.
export const ALARM_TYPES = [
  { id: "beep", label: "기본음", icon: "volume-1" },
  { id: "chime", label: "차임벨", icon: "bell-check" },
  { id: "alert", label: "경고음", icon: "triangle-alert" },
  { id: "bell", label: "종소리", icon: "bell" },
  { id: "ping", label: "핑", icon: "map-pin" },
  { id: "double", label: "더블비프", icon: "volume-2" },
  { id: "arpeggio", label: "아르페지오", icon: "chart-no-axes-column-increasing" },
  { id: "siren", label: "사이렌", icon: "siren" },
  { id: "whistle", label: "호루라기", icon: "whistle" },
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

// Seconds to sit at 00:00 before a restart (manual or auto) kicks the
// countdown back off.
export const MIN_RESTART_DELAY = 0;
export const MAX_RESTART_DELAY = 10;
export const RESTART_DELAY_STEP = 0.5;
export const DEFAULT_RESTART_DELAY = 0;

// ids must match the data-progress-style values the CSS in timer-progress.css keys off.
// icon is an svg name from src/svg/icons.js, shown left of the label.
// warnBrightColor: whether picking a too-bright timer color shows the
// readability warning (see TOO_BRIGHT_LUMINANCE in timerColor.js). Set it
// to true when the style fills the area behind the white timer digits
// with the timer color (the gauges), false when the digits always sit on
// the dark card (the ring only colors the card's edge).
// When adding a new style, decide this explicitly: does its colored fill
// ever end up behind the digits?
export const PROGRESS_STYLES = [
  { id: "ring", label: "링", icon: "square-dashed-top-solid", warnBrightColor: false },
  { id: "gauge-v", label: "게이지 (세로)", icon: "square-arrow-down", warnBrightColor: true },
  { id: "gauge-h", label: "게이지 (가로)", icon: "square-arrow-left", warnBrightColor: true },
];
export const DEFAULT_PROGRESS_STYLE = PROGRESS_STYLES[0].id;

// Seeded once for a fresh install (see meso-watch-defaults-seeded in app.js).
// Preset swatches for a timer's color (progress ring/gauge + start button).
// The first one matches --accent in color.css, the default.
export const TIMER_COLORS = [
  { value: "#e85d3f", label: "주황" },
  { value: "#e8b03f", label: "노랑" },
  { value: "#4caf6e", label: "초록" },
  { value: "#36b5a8", label: "청록" },
  { value: "#3f8fe8", label: "파랑" },
  { value: "#8a63e8", label: "보라" },
  { value: "#e2508f", label: "분홍" },
  { value: "#7d8794", label: "회색" },
];
export const DEFAULT_TIMER_COLOR = TIMER_COLORS[0].value;

export const DEFAULT_TIMERS = [
  { name: "몬스터 리젠", totalMs: 7500, alarmType: "beep", icon: "attack.png" },
  { name: "야누스 설치", totalMs: 70000, alarmType: "bell", icon: "sol-janus.png" },
  { name: "경험치 버프", totalMs: 1800000, alarmType: "alert", icon: "exp.png" },
];
