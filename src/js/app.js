import { createIconElement } from "../svg/icons.js";
import {
  NO_ICON,
  PROGRESS_STYLES,
  TIMER_ICON_NAMES,
  DEFAULT_MASTER_VOLUME,
  DEFAULT_TIMER_VOLUME,
  DEFAULT_TIMER_MINUTES,
  MAX_DURATION_MINUTES,
  DEFAULT_TIMERS_PER_ROW,
  DEFAULT_UI_ZOOM,
  MIN_UI_ZOOM,
  MAX_UI_ZOOM,
  ALARM_TYPES,
  DEFAULT_ALARM_TYPE,
  MIN_ALARM_REPEAT_COUNT,
  MAX_ALARM_REPEAT_COUNT,
  DEFAULT_ALARM_REPEAT_COUNT,
  DEFAULT_ALARM_REPEAT_UNLIMITED,
  DEFAULT_TIMER_AUTO_RESTART,
  MIN_RESTART_DELAY,
  MAX_RESTART_DELAY,
  RESTART_DELAY_STEP,
  DEFAULT_RESTART_DELAY,
  DEFAULT_TIMERS,
} from "./constants.js";
import { iconSelectMarkup, setupIconSelect, updateIconSelect } from "./iconSelect.js";
import { loadTimerProgressStyle, saveTimerProgressStyle, removeTimerProgressStyle, progressStyleSettingMarkup, setupProgressStyleSelect, updateProgressStyleSelect } from "./timerProgress.js";
import { loadTimerColor, saveTimerColor, removeTimerColor, applyTimerColor, timerColorSettingMarkup, setupTimerColorSetting, updateTimerColorSetting } from "./timerColor.js";
import { loadCustomSounds, getCustomSounds, addCustomSound, deleteCustomSound, MAX_CUSTOM_SOUND_BYTES } from "./customSounds.js";
import { openDialog, registerDialogShrinkOnClose } from "./dialog-utils.js";
import { previewAlarmSound, stopAlarmPreview, effectiveVolume, notifyDone, stopAlarm } from "./sound.js";
import { formatShortcut, NORMALIZE_MODIFIER_CODE } from "./shortcuts.js";
import { checkForUpdate } from "./updateCheck.js";
import { configureWindowSizeState, syncWindowToContent, syncWindowToDialog } from "./windowSize.js";

const timerList = document.getElementById("timerList");
const addTimerButton = document.getElementById("addTimerButton");
addTimerButton.appendChild(createIconElement("alarm-clock-plus", { width: 18, height: 18 }));

fetch("../package.json")
  .then((response) => response.json())
  .then((data) => {
    document.getElementById("versionTag").textContent = `v ${data.version}`;
    document.getElementById("electronVersionTag").textContent = `v ${data.version}`;
    checkForUpdate(data.version).then((update) => {
      if (!update) return;
      pendingUpdateUrl = update.url;
      openDialog(updateDialog);
    });
  })
  .catch(() => {});

const closeButton = document.getElementById("closeButton");
if (window.electronAPI) {
  closeButton.appendChild(createIconElement("x", { width: 18, height: 18 }));
  closeButton.addEventListener("click", () => window.close());
}

function loadOpacity(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const stored = Number(raw);
  return Number.isFinite(stored) && stored >= 0 && stored <= 100 ? stored : fallback;
}

const opacityDefaults = window.mesoWatchOpacityDefaults;
let bgOpacity = loadOpacity("meso-watch-bg-opacity", window.electronAPI ? opacityDefaults.bgOpacityElectron : opacityDefaults.bgOpacityWeb);
let panelOpacity = loadOpacity("meso-watch-panel-opacity", window.electronAPI ? opacityDefaults.panelOpacityElectron : opacityDefaults.panelOpacityWeb);
let committedBgOpacity = bgOpacity;
let committedPanelOpacity = panelOpacity;

function previewOpacity() {
  document.documentElement.style.setProperty("--bg-opacity", bgOpacity / 100);
  document.documentElement.style.setProperty("--panel-opacity", panelOpacity / 100);
  bgOpacityValue.textContent = `${bgOpacity}%`;
  panelOpacityValue.textContent = `${panelOpacity}%`;
}

function saveOpacity() {
  localStorage.setItem("meso-watch-bg-opacity", String(bgOpacity));
  localStorage.setItem("meso-watch-panel-opacity", String(panelOpacity));
  committedBgOpacity = bgOpacity;
  committedPanelOpacity = panelOpacity;
}

function revertOpacity() {
  bgOpacity = committedBgOpacity;
  panelOpacity = committedPanelOpacity;
  bgOpacitySlider.value = bgOpacity;
  panelOpacitySlider.value = panelOpacity;
  previewOpacity();
}

function loadTimersPerRow() {
  // Missing key here means an install from before this setting existed, not
  // "0" - Number(null) is 0, not NaN, so raw === null must be checked first
  // (same footgun the opacity defaults hit).
  const raw = localStorage.getItem("meso-watch-timers-per-row");
  if (raw === null) return DEFAULT_TIMERS_PER_ROW;
  const stored = Number(raw);
  return Number.isInteger(stored) && stored >= 1 && stored <= 6 ? stored : DEFAULT_TIMERS_PER_ROW;
}

function loadUiZoom() {
  const raw = localStorage.getItem("meso-watch-ui-zoom");
  if (raw === null) return DEFAULT_UI_ZOOM;
  const stored = Number(raw);
  return Number.isFinite(stored) && stored >= MIN_UI_ZOOM && stored <= MAX_UI_ZOOM ? stored : DEFAULT_UI_ZOOM;
}

let timersPerRow = loadTimersPerRow();
let committedTimersPerRow = timersPerRow;

function updateTimersPerRowUi() {
  timersPerRowSlider.value = timersPerRow;
  timersPerRowValue.textContent = `${timersPerRow}개`;
}

function saveTimersPerRow() {
  localStorage.setItem("meso-watch-timers-per-row", String(timersPerRow));
  committedTimersPerRow = timersPerRow;
  syncWindowToContent();
}

function revertTimersPerRow() {
  timersPerRow = committedTimersPerRow;
  updateTimersPerRowUi();
}

let uiZoom = loadUiZoom();
let committedUiZoom = uiZoom;

function updateUiZoomUi() {
  uiZoomSlider.value = uiZoom;
  uiZoomValue.textContent = `${uiZoom}%`;
}

function saveUiZoom() {
  localStorage.setItem("meso-watch-ui-zoom", String(uiZoom));
  committedUiZoom = uiZoom;
  document.documentElement.style.setProperty("--ui-zoom", uiZoom / 100);
  syncWindowToContent();
}

function revertUiZoom() {
  uiZoom = committedUiZoom;
  updateUiZoomUi();
}

configureWindowSizeState(() => ({ timerCount: timers.length, timersPerRow, uiZoom }));

const screenSettingsButton = document.getElementById("screenSettingsButton");
const screenSettingsDialog = document.getElementById("screenSettingsDialog");
const screenSettingsCancelButton = document.getElementById("screenSettingsCancelButton");
const screenSettingsConfirmButton = document.getElementById("screenSettingsConfirmButton");
const bgOpacitySlider = document.getElementById("bgOpacitySlider");
const panelOpacitySlider = document.getElementById("panelOpacitySlider");
const bgOpacityValue = document.getElementById("bgOpacityValue");
const panelOpacityValue = document.getElementById("panelOpacityValue");
const timersPerRowSlider = document.getElementById("timersPerRowSlider");
const timersPerRowValue = document.getElementById("timersPerRowValue");
const uiZoomSlider = document.getElementById("uiZoomSlider");
const uiZoomValue = document.getElementById("uiZoomValue");
screenSettingsButton.appendChild(createIconElement("settings", { width: 18, height: 18 }));
bgOpacitySlider.value = bgOpacity;
panelOpacitySlider.value = panelOpacity;
previewOpacity();
updateTimersPerRowUi();
updateUiZoomUi();
registerDialogShrinkOnClose(screenSettingsDialog);
screenSettingsButton.addEventListener("click", () => {
  committedBgOpacity = bgOpacity;
  committedPanelOpacity = panelOpacity;
  committedTimersPerRow = timersPerRow;
  committedUiZoom = uiZoom;
  bgOpacitySlider.value = bgOpacity;
  panelOpacitySlider.value = panelOpacity;
  updateTimersPerRowUi();
  updateUiZoomUi();
  openDialog(screenSettingsDialog);
});
screenSettingsConfirmButton.addEventListener("click", () => {
  saveOpacity();
  saveTimersPerRow();
  saveUiZoom();
  screenSettingsDialog.close();
});
screenSettingsCancelButton.addEventListener("click", () => {
  revertOpacity();
  revertTimersPerRow();
  revertUiZoom();
  screenSettingsDialog.close();
});
screenSettingsDialog.addEventListener("cancel", () => {
  revertOpacity();
  revertTimersPerRow();
  revertUiZoom();
});
bgOpacitySlider.addEventListener("input", (event) => {
  bgOpacity = Math.min(100, Math.max(0, Number(event.target.value)));
  previewOpacity();
});
panelOpacitySlider.addEventListener("input", (event) => {
  panelOpacity = Math.min(100, Math.max(0, Number(event.target.value)));
  previewOpacity();
});
timersPerRowSlider.addEventListener("input", (event) => {
  timersPerRow = Math.min(6, Math.max(1, Number(event.target.value)));
  updateTimersPerRowUi();
});
uiZoomSlider.addEventListener("input", (event) => {
  uiZoom = Math.min(MAX_UI_ZOOM, Math.max(MIN_UI_ZOOM, Number(event.target.value)));
  updateUiZoomUi();
});

const masterVolumeSlider = document.getElementById("masterVolumeSlider");
const masterVolumeValue = document.getElementById("masterVolumeValue");

const confirmDialog = document.getElementById("confirmDialog");
const confirmMessage = document.getElementById("confirmMessage");
const confirmCancelButton = document.getElementById("confirmCancelButton");
const confirmDeleteButton = document.getElementById("confirmDeleteButton");
let pendingDeleteTimer = null;
registerDialogShrinkOnClose(confirmDialog);

confirmCancelButton.addEventListener("click", () => {
  pendingDeleteTimer = null;
  confirmDialog.close();
});
confirmDeleteButton.addEventListener("click", () => {
  if (pendingDeleteTimer) removeTimer(pendingDeleteTimer);
  pendingDeleteTimer = null;
  confirmDialog.close();
});
confirmDialog.addEventListener("cancel", () => {
  pendingDeleteTimer = null;
});

// Confirms deleting a registered alarm sound. Resolves true on 삭제, false
// on 취소/Escape. It's only ever opened from a timer's settings dialog, so it
// stacks on top of that one without resizing the window (unlike openDialog /
// registerDialogShrinkOnClose) - the window already fits the taller settings
// dialog, and shrinking on close would cut that one off.
const soundDeleteDialog = document.getElementById("soundDeleteDialog");
const soundDeleteMessage = document.getElementById("soundDeleteMessage");
let resolveSoundDelete = null;
function settleSoundDelete(confirmed) {
  resolveSoundDelete?.(confirmed);
  resolveSoundDelete = null;
  if (soundDeleteDialog.open) soundDeleteDialog.close();
}
document.getElementById("soundDeleteCancelButton").addEventListener("click", () => settleSoundDelete(false));
document.getElementById("soundDeleteConfirmButton").addEventListener("click", () => settleSoundDelete(true));
soundDeleteDialog.addEventListener("close", () => settleSoundDelete(false));
function confirmSoundDelete(label) {
  settleSoundDelete(false);
  soundDeleteMessage.textContent = `"${label}" 알람음을 삭제할까요?`;
  soundDeleteDialog.showModal();
  return new Promise((resolve) => {
    resolveSoundDelete = resolve;
  });
}

const updateDialog = document.getElementById("updateDialog");
const updateLaterButton = document.getElementById("updateLaterButton");
const updateDownloadButton = document.getElementById("updateDownloadButton");
registerDialogShrinkOnClose(updateDialog);
let pendingUpdateUrl = null;

updateLaterButton.addEventListener("click", () => updateDialog.close());
updateDownloadButton.addEventListener("click", () => {
  if (pendingUpdateUrl) window.open(pendingUpdateUrl, "_blank");
  updateDialog.close();
});

function loadVolume() {
  const raw = localStorage.getItem("meso-watch-volume");
  if (raw === null) return DEFAULT_MASTER_VOLUME;
  const stored = Number(raw);
  return Number.isFinite(stored) && stored >= 0 && stored <= 100 ? stored : DEFAULT_MASTER_VOLUME;
}

let volume = loadVolume();

function updateVolumeUi() {
  masterVolumeSlider.value = volume;
  masterVolumeValue.textContent = `${volume}%`;
}

function setVolume(value) {
  volume = Math.min(100, Math.max(0, value));
  localStorage.setItem("meso-watch-volume", String(volume));
  updateVolumeUi();
}

masterVolumeSlider.addEventListener("input", (event) => setVolume(Number(event.target.value)));
masterVolumeSlider.addEventListener("change", () => previewAlarmSound(volume));
updateVolumeUi();

function loadNextTimerId() {
  let maxUsedId = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const match = localStorage.key(i)?.match(/^meso-watch-timer-(\d+)-(name|shortcut|duration)$/);
    if (match) maxUsedId = Math.max(maxUsedId, Number(match[1]));
  }
  const stored = Number(localStorage.getItem("meso-watch-next-timer-id")) || 0;
  return Math.max(maxUsedId + 1, stored, 1);
}

function setNextTimerId(value) {
  nextTimerId = value;
  localStorage.setItem("meso-watch-next-timer-id", String(nextTimerId));
}

let nextTimerId = loadNextTimerId();
let timers = [];
let recordingDraft = null;
let recordingElement = null;
let draggedTimer = null;
let reorderLocked = false;

function animateTimerListReorder(update) {
  const before = new Map();
  timerList.querySelectorAll(".timer-card").forEach((card) => {
    before.set(card.dataset.timerId, card.getBoundingClientRect());
  });

  update();

  timerList.querySelectorAll(".timer-card").forEach((card) => {
    const first = before.get(card.dataset.timerId);
    if (!first) return;
    const last = card.getBoundingClientRect();
    const deltaX = first.left - last.left;
    const deltaY = first.top - last.top;
    if (!deltaX && !deltaY) return;
    card.style.transition = "none";
    card.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    requestAnimationFrame(() => {
      card.style.transition = "transform 180ms ease";
      card.style.transform = "";
    });
  });
}

function defaultShortcut(timerId) {
  return null;
}

function loadShortcut(timerId) {
  try {
    const raw = localStorage.getItem(`meso-watch-timer-${timerId}-shortcut`);
    if (raw === null) return defaultShortcut(timerId);
    const saved = JSON.parse(raw);
    if (saved === null) return null;
    if (saved && saved.key && saved.code) return saved;
  } catch (error) {
    localStorage.removeItem(`meso-watch-timer-${timerId}-shortcut`);
  }
  return defaultShortcut(timerId);
}

function saveShortcuts() {
  timers.forEach((timer) => localStorage.setItem(`meso-watch-timer-${timer.id}-shortcut`, JSON.stringify(timer.shortcut)));
  window.electronAPI?.setGlobalShortcuts(timers.filter((timer) => timer.shortcut).map((timer) => ({ id: timer.id, shortcut: timer.shortcut })));
}

// mm:ss, growing to h:mm:ss only once a timer is an hour or longer.
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

// Columns of the duration picker in the settings modal (mm:ss.cc, 10ms
// steps). separator is what's drawn before the column. hideLabel drops the
// visible unit label (the "." already reads as a fraction, stopwatch-style);
// label is still used as the input's aria-label.
const DURATION_UNITS = [
  { unit: "minutes", label: "분", max: MAX_DURATION_MINUTES, fromMs: (ms) => Math.floor(ms / 60000) },
  { unit: "seconds", label: "초", max: 59, separator: ":", fromMs: (ms) => Math.floor(ms / 1000) % 60 },
  { unit: "centiseconds", label: "1/100초", hideLabel: true, max: 99, separator: ".", fromMs: (ms) => Math.floor(ms / 10) % 100 },
];

// The settings modal's main page only edits the name and shortcut directly;
// these groups each get their own page, previewed by a row on the main page.
const SETTINGS_SUBPAGES = [
  { page: "time", title: "시간" },
  { page: "alarm", title: "알람" },
  { page: "appearance", title: "외형" },
];

function settingsSubpageHeaderMarkup(page) {
  const { title } = SETTINGS_SUBPAGES.find((subpage) => subpage.page === page);
  return `<div class="settings-modal-header">
          <button class="settings-back" type="button" aria-label="뒤로"></button>
          <span class="section-title">${title} 설정</span>
        </div>`;
}

function settingsSubpageFooterMarkup() {
  return `<div class="settings-actions">
          <button class="primary settings-back-confirm" type="button">확인</button>
        </div>`;
}

// Like formatTime, but keeps any fraction of a second (e.g. the 7.5초 preset).
function formatDurationPreview(ms) {
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${formatTime(Math.floor(ms / 1000))}${centiseconds ? `.${String(centiseconds).padStart(2, "0")}` : ""}`;
}

function formatMs(ms) {
  return Math.floor((((ms % 1000) + 1000) % 1000) / 10).toString().padStart(2, "0");
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
  }[character]));
}

function defaultTimerName(timer) {
  const index = timer ? timers.indexOf(timer) : -1;
  return `타이머 ${index >= 0 ? index + 1 : timers.length + 1}`;
}

function timerIconUrl(timer) {
  if (timer.icon === NO_ICON) return "none";
  // Absolute, not relative: a url() inside a custom property resolves against
  // the stylesheet that consumes it via var() (src/css/index.css), not the
  // document, so a relative path here breaks if that file ever moves again.
  const href = new URL(`../public/icons/${timer.icon}`, document.baseURI).href;
  return `url("${href}")`;
}

function loadDuration(timerId) {
  const stored = Number(localStorage.getItem(`meso-watch-timer-${timerId}-duration`));
  return Number.isFinite(stored) && stored > 0 ? stored : null;
}

function saveDuration(timer) {
  localStorage.setItem(`meso-watch-timer-${timer.id}-duration`, String(timer.totalMs));
}

function loadTimerIds() {
  try {
    const raw = JSON.parse(localStorage.getItem("meso-watch-timer-ids") || "[]");
    return Array.isArray(raw) ? raw.filter((id) => Number.isInteger(id)) : [];
  } catch (error) {
    return [];
  }
}

function saveTimerIds() {
  localStorage.setItem("meso-watch-timer-ids", JSON.stringify(timers.map((timer) => timer.id)));
}

function loadTimerIcon(id) {
  const stored = localStorage.getItem(`meso-watch-timer-${id}-icon`);
  return TIMER_ICON_NAMES.includes(stored) ? stored : NO_ICON;
}

function loadTimerVolume(id) {
  const raw = localStorage.getItem(`meso-watch-timer-${id}-volume`);
  if (raw === null) return DEFAULT_TIMER_VOLUME;
  const stored = Number(raw);
  return Number.isFinite(stored) && stored >= 0 && stored <= 100 ? stored : DEFAULT_TIMER_VOLUME;
}

// Built-in alarm sounds followed by the user's registered ones (see
// customSounds.js), which get a music-file icon and an × to delete them.
function getAlarmTypes() {
  return [...ALARM_TYPES, ...getCustomSounds().map((sound) => ({ ...sound, icon: "file-music", removable: true }))];
}

// The alarm sound dropdown's last row: not a sound, but uploads one.
// The alarm repeats every second and each repeat cuts off the last one, so
// longer files get clipped.
const UPLOAD_SOUND_ITEM = { id: "upload-sound", label: "소리 파일 업로드", icon: "file-up", action: true, hint: "1초 이내 권장" };
const alarmTypeSelectItems = () => [...getAlarmTypes(), UPLOAD_SOUND_ITEM];

// Every rendered timer's alarm sound dropdown registers a refresher here, so
// registering or deleting a sound (shared by all timers) updates them all.
const alarmTypeSelectRefreshers = new Set();
function refreshAlarmTypeSelects() {
  alarmTypeSelectRefreshers.forEach((refresh) => refresh());
}

// Timers set to a sound that was just deleted fall back to the default.
function handleCustomSoundDeleted(soundId) {
  timers.forEach((timer) => {
    if (timer.alarmType !== soundId) return;
    timer.alarmType = DEFAULT_ALARM_TYPE;
    localStorage.setItem(`meso-watch-timer-${timer.id}-alarm-type`, timer.alarmType);
  });
  refreshAlarmTypeSelects();
}

const CUSTOM_SOUND_ERRORS = {
  "too-large": `${MAX_CUSTOM_SOUND_BYTES / 1024 / 1024}MB 이하의 파일만 등록할 수 있습니다.`,
  "decode-failed": "재생할 수 없는 오디오 파일입니다.",
  "save-failed": "알람음을 저장하지 못했습니다.",
};

function loadTimerAlarmType(id) {
  const stored = localStorage.getItem(`meso-watch-timer-${id}-alarm-type`);
  return getAlarmTypes().some((alarmType) => alarmType.id === stored) ? stored : DEFAULT_ALARM_TYPE;
}

function loadTimerAlarmRepeatCount(id) {
  const raw = localStorage.getItem(`meso-watch-timer-${id}-alarm-repeat-count`);
  if (raw === null) return DEFAULT_ALARM_REPEAT_COUNT;
  const stored = Number(raw);
  return Number.isInteger(stored) && stored >= MIN_ALARM_REPEAT_COUNT && stored <= MAX_ALARM_REPEAT_COUNT ? stored : DEFAULT_ALARM_REPEAT_COUNT;
}

function loadTimerAlarmRepeatUnlimited(id) {
  const raw = localStorage.getItem(`meso-watch-timer-${id}-alarm-repeat-unlimited`);
  if (raw === null) return DEFAULT_ALARM_REPEAT_UNLIMITED;
  return raw === "true";
}

function loadTimerAutoRestart(id) {
  const raw = localStorage.getItem(`meso-watch-timer-${id}-auto-restart`);
  if (raw === null) return DEFAULT_TIMER_AUTO_RESTART;
  return raw === "true";
}

function loadTimerRestartDelay(id) {
  const raw = localStorage.getItem(`meso-watch-timer-${id}-restart-delay`);
  if (raw === null) return DEFAULT_RESTART_DELAY;
  const stored = Number(raw);
  return Number.isFinite(stored) && stored >= MIN_RESTART_DELAY && stored <= MAX_RESTART_DELAY ? stored : DEFAULT_RESTART_DELAY;
}

// "무제한" isn't a real infinite loop - it's just a very large finite count,
// so notifyDone's countdown logic stays the same either way.
const UNLIMITED_ALARM_REPEAT_COUNT = 9999;

function alarmRepeatMax(timer) {
  return timer.alarmRepeatUnlimited ? UNLIMITED_ALARM_REPEAT_COUNT : timer.alarmRepeatCount;
}

// classList.toggle("is-alarming", true) when it's already true is a no-op,
// so a refreshed remainingAlarmCount (see notifyDone's "restarted" callback)
// wouldn't otherwise restart the CSS animation to match the new count -
// forcing it off, a reflow, then back on restarts it from iteration 1.
function restartAlarmBlink(timer) {
  const element = getTimerElement(timer);
  if (!element) return;
  element.style.setProperty("--alarm-blink-count", alarmRepeatMax(timer));
  element.classList.remove("is-alarming");
  void element.offsetWidth;
  element.classList.add("is-alarming");
}

function buildTimer(id, totalMs, fallbackIndex = null) {
  const name = localStorage.getItem(`meso-watch-timer-${id}-name`)
    || (fallbackIndex === null ? defaultTimerName(null) : `타이머 ${fallbackIndex + 1}`);
  return { id, name, totalMs, remainingSeconds: Math.floor(totalMs / 1000), remainingMs: totalMs, timerId: null, alarmIntervalId: null, remainingAlarmCount: 0, shortcut: loadShortcut(id), icon: loadTimerIcon(id), volume: loadTimerVolume(id), alarmType: loadTimerAlarmType(id), alarmRepeatCount: loadTimerAlarmRepeatCount(id), alarmRepeatUnlimited: loadTimerAlarmRepeatUnlimited(id), autoRestart: loadTimerAutoRestart(id), restartDelay: loadTimerRestartDelay(id), restartHandle: null, progressStyle: loadTimerProgressStyle(id), color: loadTimerColor(id), isDraft: false };
}

function createTimer(minutes = DEFAULT_TIMER_MINUTES) {
  const id = nextTimerId;
  setNextTimerId(nextTimerId + 1);
  return buildTimer(id, minutes * 60000);
}

function seedDefaultTimersIfNeeded() {
  if (localStorage.getItem("meso-watch-defaults-seeded")) return [];
  localStorage.setItem("meso-watch-defaults-seeded", "1");
  return DEFAULT_TIMERS.map((defaults) => {
    const id = nextTimerId;
    setNextTimerId(nextTimerId + 1);
    localStorage.setItem(`meso-watch-timer-${id}-name`, defaults.name);
    localStorage.setItem(`meso-watch-timer-${id}-duration`, String(defaults.totalMs));
    localStorage.setItem(`meso-watch-timer-${id}-icon`, defaults.icon);
    localStorage.setItem(`meso-watch-timer-${id}-alarm-type`, defaults.alarmType);
    return buildTimer(id, defaults.totalMs);
  });
}

function getTimerElement(timer) {
  if (timer.element?.isConnected) return timer.element;
  return timerList.querySelector(`[data-timer-id="${timer.id}"]`);
}

function bounceTimerCard(timer) {
  const element = getTimerElement(timer);
  if (!element) return;
  // A low jump under gravity: ease-out rising to each peak (decelerating
  // against gravity), ease-in falling back down (accelerating into it),
  // with a small secondary bounce so it settles instead of stopping dead.
  element.animate(
    [
      { transform: "translateY(0)", offset: 0, easing: "ease-out" },
      { transform: "translateY(-8px)", offset: 0.4, easing: "ease-in" },
      { transform: "translateY(0)", offset: 0.7, easing: "ease-out" },
      { transform: "translateY(-2px)", offset: 0.88, easing: "ease-in" },
      { transform: "translateY(0)", offset: 1 },
    ],
    { duration: 380 }
  );
}

function updateTimerElement(timer) {
  const element = getTimerElement(timer);
  if (!element) return;
  // getTimerElement can return a freshly re-queried element (e.g. after
  // renderAllTimers() rebuilds the list) whose sub-elements weren't cached
  // by this timer's own renderTimer() call - fall back to a live query in
  // that case rather than touching a stale cache from the old element.
  const cache = timer.elements?.settingsModal?.isConnected ? timer.elements : null;
  const timeEl = cache ? cache.timeEl : element.querySelector(".timer-time");
  const msEl = cache ? cache.msEl : element.querySelector(".timer-ms");
  const settingsModal = cache ? cache.settingsModal : element.querySelector(".settings-modal");
  const shortcutButtonEl = cache ? cache.shortcutButtonEl : element.querySelector(".shortcut-button");
  const shortcutBadgeEl = cache ? cache.shortcutBadgeEl : element.querySelector(".timer-shortcut-badge");
  const startButtonEl = cache ? cache.startButtonEl : element.querySelector(".start-button");
  const pauseButtonEl = cache ? cache.pauseButtonEl : element.querySelector(".pause-button");

  timeEl.textContent = formatTime(timer.remainingSeconds);
  msEl.textContent = formatMs(timer.remainingMs);
  if (recordingElement !== element && !settingsModal?.open) {
    shortcutButtonEl.value = formatShortcut(timer.shortcut);
  }
  shortcutBadgeEl.textContent = formatShortcut(timer.shortcut);
  element.classList.toggle("is-running", Boolean(timer.timerId));
  element.classList.toggle("is-finished", Boolean(timer.isFinished));
  element.style.setProperty("--alarm-blink-count", alarmRepeatMax(timer));
  element.classList.toggle("is-alarming", timer.remainingAlarmCount > 0);
  element.classList.toggle("has-progress", timer.remainingMs < timer.totalMs);
  element.dataset.progressStyle = timer.progressStyle;
  // While a delayed restart is pending, the gauge refills from empty to
  // full over the delay - a CSS transition stretched to the delay's length
  // (see .is-restart-pending in timer-progress.css) does the animating.
  const restartPending = Boolean(timer.restartHandle);
  element.classList.toggle("is-restart-pending", restartPending);
  element.style.setProperty("--restart-delay", `${timer.restartDelay}s`);
  const progress = restartPending ? 1 : timer.totalMs > 0 ? timer.remainingMs / timer.totalMs : 0;
  element.style.setProperty("--progress-fraction", progress);
  startButtonEl.disabled = Boolean(timer.timerId || timer.restartHandle);
  pauseButtonEl.disabled = !timer.timerId && !timer.isFinished && !timer.restartHandle;
}

function renderTimer(timer, target = timerList) {
  const element = document.createElement("article");
  element.className = "timer-card";
  element.draggable = true;
  element.dataset.timerId = timer.id;
  element.dataset.progressStyle = timer.progressStyle;
  element.style.setProperty("--timer-icon", timerIconUrl(timer));
  applyTimerColor(element, timer.color);
  timer.element = element;
  element.innerHTML = `
    <svg class="timer-progress-visual ring" aria-hidden="true"><rect pathLength="1" /></svg>
    <div class="timer-progress-visual gauge-v" aria-hidden="true"></div>
    <div class="timer-progress-visual gauge-h" aria-hidden="true"></div>
    <div class="timer-card-header">
      <span class="timer-shortcut-badge">${formatShortcut(timer.shortcut)}</span>
      <span class="timer-label">${escapeHtml(timer.name)}</span>
      <button class="settings-toggle" type="button" aria-label="타이머 설정"></button>
    </div>
    <section class="timer-progress" aria-label="타이머 진행">
      <div class="timer-display">
        <strong class="timer-time">${formatTime(timer.remainingSeconds)}</strong>
        <span class="timer-ms">${formatMs(timer.remainingMs)}</span>
      </div>
      <div class="timer-actions">
        <div class="timer-actions-group">
          <button class="timer-action start-button" type="button" aria-label="시작하기"></button>
          <button class="timer-action pause-button" type="button" aria-label="일시정지"></button>
          <button class="timer-action reset-button" type="button" aria-label="정지"></button>
          <button class="timer-action restart-button" type="button" aria-label="재시작"></button>
        </div>
        <button class="timer-action remove-button" type="button" aria-label="타이머 ${timer.id} 삭제"></button>
      </div>
    </section>
    <dialog class="settings-modal" aria-label="타이머 설정">
      <div class="settings-page" data-page="main">
        <div class="settings-modal-header">
          <span class="section-title">타이머 설정</span>
        </div>
        <label class="name-field">
          <span class="control-label">이름</span>
          <input class="name-input" type="text" maxlength="30" value="${escapeHtml(timer.name)}" aria-label="타이머 이름" />
        </label>
        <div class="settings-nav" role="group" aria-label="타이머 ${timer.id} 세부 설정">
          ${SETTINGS_SUBPAGES.map(({ page, title }) => `
          <div class="settings-nav-item">
            <span class="control-label">${title}</span>
            <button class="settings-nav-row" type="button" data-target-page="${page}" aria-label="${title} 설정">
              <span class="settings-nav-preview" data-preview="${page}"></span>
            </button>
          </div>`).join("")}
        </div>
        <div class="shortcut-setting timer-shortcut-setting">
          <span class="control-label">재시작 단축키</span>
          <input class="shortcut-input shortcut-button" type="text" readonly autocomplete="off" aria-label="타이머 ${timer.id} 단축키 설정" value="${escapeHtml(formatShortcut(timer.shortcut))}" />
        </div>
        <div class="settings-actions">
          <button class="secondary modal-close" type="button">취소</button>
          <button class="primary modal-save" type="button">${timer.isDraft ? "완료" : "저장"}</button>
        </div>
      </div>
      <div class="settings-page" data-page="time" hidden>
        ${settingsSubpageHeaderMarkup("time")}
        <div class="duration-setting">
          <span class="control-label">시간</span>
          <div class="duration-fields" aria-label="타이머 ${timer.id} 시간 입력">
            ${DURATION_UNITS.map(({ unit, label, hideLabel, separator }) => `${separator ? `<span class="duration-separator" aria-hidden="true">${separator}</span>` : ""}
            <div class="duration-column">
              ${hideLabel ? "" : `<span class="duration-wheel-label" aria-hidden="true">${label}</span>`}
              <div class="duration-wheel" data-unit="${unit}">
                <div class="duration-wheel-track">
                  <span class="duration-wheel-value" data-offset="-2" aria-hidden="true"></span>
                  <button class="duration-wheel-value duration-wheel-step" data-offset="-1" type="button" tabindex="-1" aria-hidden="true"></button>
                  <input class="duration-input" type="text" inputmode="numeric" pattern="[0-9]*" aria-label="타이머 ${timer.id} ${label}" />
                  <button class="duration-wheel-value duration-wheel-step" data-offset="1" type="button" tabindex="-1" aria-hidden="true"></button>
                  <span class="duration-wheel-value" data-offset="2" aria-hidden="true"></span>
                </div>
              </div>
            </div>`).join("")}
          </div>
          <div class="duration-presets" role="group" aria-label="타이머 ${timer.id} 시간 프리셋">
            <button class="duration-preset" type="button" data-ms="7500">7.5초</button>
            <button class="duration-preset" type="button" data-ms="30000">30초</button>
            <button class="duration-preset" type="button" data-ms="60000">1분</button>
            <button class="duration-preset" type="button" data-ms="120000">2분</button>
            <button class="duration-preset" type="button" data-ms="600000">10분</button>
            <button class="duration-preset" type="button" data-ms="900000">15분</button>
            <button class="duration-preset" type="button" data-ms="1800000">30분</button>
          </div>
        </div>
        <div class="auto-restart-setting toggle-setting">
          <div class="opacity-setting-header">
            <span class="control-label">타이머 자동 재시작</span>
            <label class="toggle-switch">
              <input class="auto-restart-checkbox" type="checkbox"${timer.autoRestart ? " checked" : ""} aria-label="타이머 ${timer.id} 자동 재시작" />
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>
        </div>
        <div class="opacity-setting restart-delay-setting">
          <div class="opacity-setting-header">
            <span class="control-label">재시작 지연 시간</span>
            <span class="setting-value restart-delay-value"></span>
          </div>
          <input class="opacity-slider restart-delay-slider" type="range" min="${MIN_RESTART_DELAY}" max="${MAX_RESTART_DELAY}" step="${RESTART_DELAY_STEP}" aria-label="타이머 ${timer.id} 재시작 지연 시간" />
        </div>
        ${settingsSubpageFooterMarkup()}
      </div>
      <div class="settings-page" data-page="alarm" hidden>
        ${settingsSubpageHeaderMarkup("alarm")}
        <div class="alarm-type-setting">
          <span class="control-label">알람음</span>
          ${iconSelectMarkup({ triggerClass: "alarm-type-select", ariaLabel: `타이머 ${timer.id} 알람음` })}
          <input class="custom-sound-file" type="file" accept="audio/*" hidden />
          <p class="custom-sound-error" role="alert" hidden></p>
        </div>
        <div class="opacity-setting volume-setting">
          <div class="opacity-setting-header">
            <span class="control-label">알람 볼륨</span>
            <span class="setting-value volume-value"></span>
          </div>
          <input class="opacity-slider volume-slider-input" type="range" min="0" max="100" step="1" aria-label="타이머 ${timer.id} 음량" />
        </div>
        <div class="alarm-repeat-setting">
          <div class="opacity-setting-header">
            <span class="control-label">알람 반복 횟수</span>
            <span class="setting-value alarm-repeat-count-value"></span>
          </div>
          <input class="opacity-slider alarm-repeat-count-slider" type="range" min="${MIN_ALARM_REPEAT_COUNT}" max="${MAX_ALARM_REPEAT_COUNT}" step="1" aria-label="타이머 ${timer.id} 알람 반복 횟수"${timer.alarmRepeatUnlimited ? " disabled" : ""} />
        </div>
        <div class="alarm-repeat-unlimited-setting toggle-setting">
          <div class="opacity-setting-header">
            <span class="control-label">알람 반복 무제한</span>
            <label class="toggle-switch">
              <input class="alarm-repeat-unlimited-checkbox" type="checkbox"${timer.alarmRepeatUnlimited ? " checked" : ""} aria-label="타이머 ${timer.id} 알람 반복 무제한" />
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>
        </div>
        ${settingsSubpageFooterMarkup()}
      </div>
      <div class="settings-page" data-page="appearance" hidden>
        ${settingsSubpageHeaderMarkup("appearance")}
        ${progressStyleSettingMarkup(timer)}
        ${timerColorSettingMarkup(timer)}
        <div class="icon-setting">
          <span class="control-label">아이콘</span>
          <div class="icon-options" role="group" aria-label="타이머 ${timer.id} 아이콘 선택">
            ${TIMER_ICON_NAMES.map((name) => name === NO_ICON ? `
              <button class="icon-option icon-option-none${name === timer.icon ? " is-selected" : ""}" type="button" data-icon="${name}" aria-label="아이콘 없음">없음</button>
            ` : `
              <button class="icon-option${name === timer.icon ? " is-selected" : ""}" type="button" data-icon="${name}" aria-label="${name.replace(/\.(png|webp)$/, "")} 아이콘">
                <img src="../public/icons/${name}" alt="" />
              </button>
            `).join("")}
          </div>
        </div>
        ${settingsSubpageFooterMarkup()}
      </div>
    </dialog>`;

  const settingsModal = element.querySelector(".settings-modal");
  registerDialogShrinkOnClose(settingsModal);
  settingsModal.addEventListener("close", stopAlarmPreview);
  // updateTimerElement runs on every tick (up to display refresh rate while
  // any timer is running) - cache the sub-elements it touches once here
  // instead of re-querying the DOM on every single call.
  timer.elements = {
    settingsModal,
    timeEl: element.querySelector(".timer-time"),
    msEl: element.querySelector(".timer-ms"),
    shortcutButtonEl: element.querySelector(".shortcut-button"),
    shortcutBadgeEl: element.querySelector(".timer-shortcut-badge"),
    startButtonEl: element.querySelector(".start-button"),
    pauseButtonEl: element.querySelector(".pause-button"),
  };
  let draft = { name: timer.name, totalMs: timer.totalMs, shortcut: timer.shortcut, icon: timer.icon, volume: timer.volume, alarmType: timer.alarmType, alarmRepeatCount: timer.alarmRepeatCount, alarmRepeatUnlimited: timer.alarmRepeatUnlimited, autoRestart: timer.autoRestart, restartDelay: timer.restartDelay, progressStyle: timer.progressStyle, color: timer.color };
  function updateIconOptionsUi() {
    element.querySelectorAll(".icon-option").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.icon === draft.icon);
    });
  }
  function updateVolumeSettingUi() {
    const slider = element.querySelector(".volume-slider-input");
    const valueDisplay = element.querySelector(".volume-value");
    slider.value = draft.volume;
    valueDisplay.textContent = `${draft.volume}%`;
  }
  function updateAlarmTypeSettingUi() {
    updateIconSelect(element.querySelector(".alarm-type-setting .icon-select"), getAlarmTypes(), draft.alarmType);
  }
  function showCustomSoundError(message) {
    const errorElement = element.querySelector(".custom-sound-error");
    if (errorElement.textContent === message && errorElement.hidden === !message) return;
    errorElement.textContent = message;
    errorElement.hidden = !message;
    if (settingsModal.open) syncWindowToDialog(settingsModal);
  }
  function updateAlarmRepeatSettingUi() {
    element.querySelector(".alarm-repeat-count-slider").value = draft.alarmRepeatCount;
    element.querySelector(".alarm-repeat-count-slider").disabled = draft.alarmRepeatUnlimited;
    element.querySelector(".alarm-repeat-count-value").textContent = draft.alarmRepeatUnlimited ? "무제한" : `${draft.alarmRepeatCount}회`;
    element.querySelector(".alarm-repeat-unlimited-checkbox").checked = draft.alarmRepeatUnlimited;
  }
  function updateAutoRestartSettingUi() {
    element.querySelector(".auto-restart-checkbox").checked = draft.autoRestart;
    element.querySelector(".restart-delay-slider").value = draft.restartDelay;
    element.querySelector(".restart-delay-value").textContent = draft.restartDelay === 0 ? "없음" : `${draft.restartDelay}초`;
  }
  function updateProgressStyleSettingUi() {
    updateProgressStyleSelect(element, draft.progressStyle);
  }
  function updateTimerColorSettingUi() {
    const progressStyle = PROGRESS_STYLES.find((item) => item.id === draft.progressStyle) ?? PROGRESS_STYLES[0];
    updateTimerColorSetting(element, draft.color, { warnBrightColor: progressStyle.warnBrightColor });
    // This timer's settings dialog is themed with its own color instead of
    // the app accent, following the color being picked live. (The default
    // timer color equals --accent, so untouched timers look the same.)
    settingsModal.style.setProperty("--accent", draft.color);
    settingsModal.style.setProperty("--accent-dark", `color-mix(in srgb, ${draft.color} 78%, #000)`);
  }
  function resetDraftFromTimer() {
    draft = { name: timer.name, totalMs: timer.totalMs, shortcut: timer.shortcut, icon: timer.icon, volume: timer.volume, alarmType: timer.alarmType, alarmRepeatCount: timer.alarmRepeatCount, alarmRepeatUnlimited: timer.alarmRepeatUnlimited, autoRestart: timer.autoRestart, restartDelay: timer.restartDelay, progressStyle: timer.progressStyle, color: timer.color };
    element.querySelector(".name-input").value = timer.name;
    setDurationWheels(timer.totalMs);
    element.querySelector(".shortcut-button").value = formatShortcut(timer.shortcut);
    updateIconOptionsUi();
    updateVolumeSettingUi();
    updateAlarmTypeSettingUi();
    showCustomSoundError("");
    updateAlarmRepeatSettingUi();
    updateAutoRestartSettingUi();
    updateProgressStyleSettingUi();
    updateTimerColorSettingUi();
    showSettingsPage("main");
  }
  element.querySelectorAll(".icon-option").forEach((button) => button.addEventListener("click", () => {
    draft.icon = button.dataset.icon;
    updateIconOptionsUi();
  }));
  element.querySelector(".volume-slider-input").addEventListener("input", (event) => {
    draft.volume = Number(event.target.value);
    updateVolumeSettingUi();
  });
  element.querySelector(".volume-slider-input").addEventListener("change", (event) => {
    previewAlarmSound(effectiveVolume(volume, Number(event.target.value)), draft.alarmType);
  });
  const alarmTypeSelect = setupIconSelect(element.querySelector(".alarm-type-setting .icon-select"), element, alarmTypeSelectItems(), (alarmTypeId) => {
    draft.alarmType = alarmTypeId;
    updateAlarmTypeSettingUi();
    previewAlarmSound(effectiveVolume(volume, draft.volume), draft.alarmType);
  }, {
    onAction: () => customSoundFileInput.click(),
    onRemove: (soundId) => removeCustomSound(soundId),
  });
  // Rebuilds this dropdown after the registered sounds change; a draft set to
  // a sound that's gone falls back to the default. Drops itself once this
  // card has been removed/re-rendered.
  const refreshAlarmTypeSelect = () => {
    if (!element.isConnected) {
      alarmTypeSelectRefreshers.delete(refreshAlarmTypeSelect);
      return;
    }
    if (!getAlarmTypes().some((alarmType) => alarmType.id === draft.alarmType)) draft.alarmType = DEFAULT_ALARM_TYPE;
    alarmTypeSelect.setItems(alarmTypeSelectItems());
    updateAlarmTypeSettingUi();
    updateSettingsPreviews();
  };
  alarmTypeSelectRefreshers.add(refreshAlarmTypeSelect);
  // Upload picked from the dropdown's last row; the new sound gets selected.
  const customSoundFileInput = element.querySelector(".custom-sound-file");
  customSoundFileInput.addEventListener("change", async () => {
    const file = customSoundFileInput.files[0];
    customSoundFileInput.value = "";
    if (!file) return;
    showCustomSoundError("");
    try {
      const sound = await addCustomSound(file);
      draft.alarmType = sound.id;
      refreshAlarmTypeSelects();
      previewAlarmSound(effectiveVolume(volume, draft.volume), draft.alarmType);
    } catch (error) {
      showCustomSoundError(CUSTOM_SOUND_ERRORS[error.message] ?? CUSTOM_SOUND_ERRORS["save-failed"]);
    }
  });
  // The × on a registered sound's row.
  async function removeCustomSound(soundId) {
    const sound = getCustomSounds().find((item) => item.id === soundId);
    if (!sound) return;
    if (!(await confirmSoundDelete(sound.label))) return;
    showCustomSoundError("");
    try {
      await deleteCustomSound(sound.id);
    } catch {
      showCustomSoundError("알람음을 삭제하지 못했습니다.");
      return;
    }
    handleCustomSoundDeleted(sound.id);
  }
  element.querySelector(".alarm-repeat-count-slider").addEventListener("input", (event) => {
    draft.alarmRepeatCount = Number(event.target.value);
    updateAlarmRepeatSettingUi();
  });
  element.querySelector(".alarm-repeat-unlimited-checkbox").addEventListener("change", (event) => {
    draft.alarmRepeatUnlimited = event.target.checked;
    updateAlarmRepeatSettingUi();
  });
  element.querySelector(".auto-restart-checkbox").addEventListener("change", (event) => {
    draft.autoRestart = event.target.checked;
    updateAutoRestartSettingUi();
  });
  element.querySelector(".restart-delay-slider").addEventListener("input", (event) => {
    draft.restartDelay = Number(event.target.value);
    updateAutoRestartSettingUi();
  });
  const progressStyleSelect = setupProgressStyleSelect(element, (progressStyleId) => {
    draft.progressStyle = progressStyleId;
    updateProgressStyleSettingUi();
    // Whether a too-bright color warrants the warning depends on the style.
    updateTimerColorSettingUi();
  });
  const timerColorSetting = setupTimerColorSetting(element, (color) => {
    draft.color = color;
    updateTimerColorSettingUi();
  }, () => {
    // The picker opening/closing changes the dialog's height.
    if (settingsModal.open) syncWindowToDialog(settingsModal);
  });
  element.querySelector(".settings-toggle").appendChild(createIconElement("settings", { width: 16, height: 16 }));
  element.querySelector(".remove-button").appendChild(createIconElement("trash", { width: 16, height: 16 }));
  element.querySelector(".start-button").appendChild(createIconElement("play", { width: 16, height: 16 }));
  element.querySelector(".pause-button").appendChild(createIconElement("pause", { width: 16, height: 16 }));
  element.querySelector(".reset-button").appendChild(createIconElement("square", { width: 16, height: 16 }));
  element.querySelector(".restart-button").appendChild(createIconElement("rotate-ccw-clock", { width: 16, height: 16 }));
  element.addEventListener("dragstart", (event) => {
    if (event.target.closest("button, input, dialog")) {
      event.preventDefault();
      return;
    }
    draggedTimer = timer;
    element.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(timer.id));
  });
  element.addEventListener("dragend", () => {
    element.classList.remove("is-dragging");
    draggedTimer = null;
  });
  element.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!draggedTimer || draggedTimer === timer || reorderLocked) return;
    const fromIndex = timers.indexOf(draggedTimer);
    const toIndex = timers.indexOf(timer);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    // Only swap once the cursor crosses partway into this card in the direction
    // of travel, so hovering near the boundary doesn't flip-flop the order.
    // Using less than the full midpoint (30%) makes the swap trigger sooner.
    const rect = element.getBoundingClientRect();
    const movingDown = fromIndex < toIndex;
    const triggerY = movingDown ? rect.top + rect.height * 0.3 : rect.top + rect.height * 0.7;
    if (movingDown && event.clientY < triggerY) return;
    if (!movingDown && event.clientY > triggerY) return;

    // Lock further swaps until the shift animation settles - mid-animation
    // rects are still moving, which otherwise causes the order to flicker.
    reorderLocked = true;
    setTimeout(() => { reorderLocked = false; }, 200);

    animateTimerListReorder(() => {
      timers.splice(fromIndex, 1);
      timers.splice(toIndex, 0, draggedTimer);
      const draggedElement = getTimerElement(draggedTimer);
      const referenceElement = movingDown ? element.nextSibling : element;
      timerList.insertBefore(draggedElement, referenceElement);
    });
  });
  element.addEventListener("drop", (event) => {
    event.preventDefault();
    saveTimerIds();
  });
  element.querySelector(".settings-toggle").addEventListener("click", () => {
    resetDraftFromTimer();
    openDialog(settingsModal);
  });
  element.querySelector(".modal-close").addEventListener("click", () => {
    cancelShortcutRecording();
    resetDraftFromTimer();
    settingsModal.close();
    if (timer.isDraft) {
      localStorage.removeItem(`meso-watch-timer-${timer.id}-name`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-shortcut`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-duration`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-icon`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-volume`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-alarm-type`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-alarm-repeat-count`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-alarm-repeat-unlimited`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-auto-restart`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-restart-delay`);
      removeTimerProgressStyle(timer.id);
      removeTimerColor(timer.id);
      if (timer.id === nextTimerId - 1) setNextTimerId(nextTimerId - 1);
      element.parentElement?.remove();
    }
  });
  element.querySelector(".modal-save").addEventListener("click", () => {
    cancelShortcutRecording();
    const durationChanged = draft.totalMs !== timer.totalMs;
    const previousTotalMs = timer.totalMs;
    timer.name = draft.name;
    timer.totalMs = draft.totalMs;
    timer.shortcut = draft.shortcut;
    timer.icon = draft.icon;
    timer.volume = draft.volume;
    timer.alarmType = draft.alarmType;
    timer.alarmRepeatCount = draft.alarmRepeatCount;
    timer.alarmRepeatUnlimited = draft.alarmRepeatUnlimited;
    timer.autoRestart = draft.autoRestart;
    timer.restartDelay = draft.restartDelay;
    timer.progressStyle = draft.progressStyle;
    timer.color = draft.color;
    localStorage.setItem(`meso-watch-timer-${timer.id}-name`, timer.name);
    localStorage.setItem(`meso-watch-timer-${timer.id}-icon`, timer.icon);
    localStorage.setItem(`meso-watch-timer-${timer.id}-volume`, String(timer.volume));
    localStorage.setItem(`meso-watch-timer-${timer.id}-alarm-type`, timer.alarmType);
    localStorage.setItem(`meso-watch-timer-${timer.id}-alarm-repeat-count`, String(timer.alarmRepeatCount));
    localStorage.setItem(`meso-watch-timer-${timer.id}-alarm-repeat-unlimited`, String(timer.alarmRepeatUnlimited));
    localStorage.setItem(`meso-watch-timer-${timer.id}-auto-restart`, String(timer.autoRestart));
    localStorage.setItem(`meso-watch-timer-${timer.id}-restart-delay`, String(timer.restartDelay));
    saveTimerProgressStyle(timer);
    saveTimerColor(timer);
    element.querySelector(".timer-label").textContent = timer.name;
    element.style.setProperty("--timer-icon", timerIconUrl(timer));
    applyTimerColor(element, timer.color);
    if (durationChanged) adjustTimerDuration(timer, previousTotalMs);
    if (timer.isDraft) {
      timer.isDraft = false;
      timers.push(timer);
      const draftHost = element.parentElement;
      timerList.appendChild(element);
      draftHost?.remove();
      saveTimerIds();
      syncWindowToContent();
    }
    saveDuration(timer);
    saveShortcuts();
    updateTimerElement(timer);
    settingsModal.close();
  });
  settingsModal.addEventListener("cancel", (event) => {
    if (currentSettingsPage !== "main") {
      event.preventDefault();
      navigateSettings("main");
      return;
    }
    cancelShortcutRecording();
    resetDraftFromTimer();
    if (timer.isDraft) {
      event.preventDefault();
      settingsModal.close();
      localStorage.removeItem(`meso-watch-timer-${timer.id}-name`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-shortcut`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-duration`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-icon`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-volume`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-alarm-type`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-alarm-repeat-count`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-alarm-repeat-unlimited`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-auto-restart`);
      localStorage.removeItem(`meso-watch-timer-${timer.id}-restart-delay`);
      removeTimerProgressStyle(timer.id);
      removeTimerColor(timer.id);
      if (timer.id === nextTimerId - 1) setNextTimerId(nextTimerId - 1);
      element.parentElement?.remove();
    }
  });
  settingsModal.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || recordingDraft !== null) return;
    const target = event.target;
    if (target.tagName === "BUTTON" || target.tagName === "SELECT") return;
    event.preventDefault();
    // Commit whatever's still in the focused field before saving - typing
    // Enter doesn't itself fire "change" the way blurring the field would.
    if (target.matches(".duration-input, .name-input")) target.dispatchEvent(new Event("change"));
    if (currentSettingsPage !== "main") navigateSettings("main");
    else element.querySelector(".modal-save").click();
  });
  element.querySelector(".name-input").addEventListener("change", (event) => {
    draft.name = event.target.value.trim() || defaultTimerName(timer);
    event.target.value = draft.name;
  });
  // Which page of the settings modal is showing (see SETTINGS_SUBPAGES).
  // Sub-page edits only touch the draft, so leaving a sub-page keeps them
  // until the main page's 저장/취소.
  let currentSettingsPage = "main";
  function showSettingsPage(page) {
    // A sound previewed on the alarm page stops once you leave it.
    if (page !== "alarm") stopAlarmPreview();
    currentSettingsPage = page;
    alarmTypeSelect.close();
    progressStyleSelect.close();
    timerColorSetting.close();
    element.querySelectorAll(".settings-page").forEach((settingsPage) => {
      settingsPage.hidden = settingsPage.dataset.page !== page;
    });
    if (page === "main") updateSettingsPreviews();
  }
  // showSettingsPage plus what a user-driven page change needs: refit the
  // window to the new page's height and move focus onto the new page.
  function navigateSettings(page) {
    const fromPage = currentSettingsPage;
    showSettingsPage(page);
    syncWindowToDialog(settingsModal);
    const focusTarget = page === "main"
      ? element.querySelector(`.settings-nav-row[data-target-page="${fromPage}"]`)
      : element.querySelector(`.settings-page[data-page="${page}"] .settings-back`);
    focusTarget?.focus();
  }
  const previewIcon = (name) => createIconElement(name, { width: 14, height: 14 });
  const previewText = (text) => document.createTextNode(text);
  function updateSettingsPreviews() {
    const preview = (page) => element.querySelector(`.settings-nav-preview[data-preview="${page}"]`);
    // The restart delay applies to manual restarts too, so it's shown
    // whether or not auto-restart is on.
    const timeParts = [formatDurationPreview(draft.totalMs)];
    if (draft.autoRestart) timeParts.push("자동 재시작");
    if (draft.restartDelay) timeParts.push(`지연 ${draft.restartDelay}초`);
    preview("time").replaceChildren(previewText(timeParts.join(" · ")));
    const alarmType = getAlarmTypes().find((item) => item.id === draft.alarmType) ?? ALARM_TYPES[0];
    const repeatText = draft.alarmRepeatUnlimited ? "무제한" : `${draft.alarmRepeatCount}회`;
    preview("alarm").replaceChildren(
      ...(alarmType.icon ? [previewIcon(alarmType.icon)] : []),
      previewText(`${alarmType.label} · ${draft.volume}% · ${repeatText}`),
    );
    const progressStyle = PROGRESS_STYLES.find((item) => item.id === draft.progressStyle) ?? PROGRESS_STYLES[0];
    const timerIcon = draft.icon === NO_ICON ? null : Object.assign(document.createElement("img"), { src: `../public/icons/${draft.icon}`, alt: "" });
    const colorDot = Object.assign(document.createElement("span"), { className: "settings-nav-color" });
    colorDot.style.setProperty("--swatch", draft.color);
    preview("appearance").replaceChildren(
      previewIcon(progressStyle.icon),
      previewText(`${progressStyle.label} · `),
      colorDot,
      previewText(" · "),
      timerIcon ?? previewText("아이콘 없음"),
    );
  }
  element.querySelectorAll(".settings-nav-row").forEach((row) => {
    row.appendChild(createIconElement("chevron-down", { width: 16, height: 16 }));
    row.addEventListener("click", () => navigateSettings(row.dataset.targetPage));
  });
  element.querySelectorAll(".settings-back").forEach((button) => button.appendChild(createIconElement("chevron-down", { width: 16, height: 16 })));
  element.querySelectorAll(".settings-back, .settings-back-confirm").forEach((button) => button.addEventListener("click", () => navigateSettings("main")));
  // Each picker column is a drum: the current value in an input (click to
  // type) with faded neighbours above/below. Wheel or clicking a neighbour
  // steps it with a short slide; dragging moves the track with the pointer
  // and snaps to the nearest row on release. Values wrap (59 -> 00).
  const durationWheels = DURATION_UNITS.map((unitInfo) => {
    const wheel = element.querySelector(`.duration-wheel[data-unit="${unitInfo.unit}"]`);
    return { ...unitInfo, wheel, track: wheel.querySelector(".duration-wheel-track"), input: wheel.querySelector(".duration-input") };
  });
  const wrapDurationValue = (value, max) => ((value % (max + 1)) + max + 1) % (max + 1);
  const padDurationValue = (value) => String(value).padStart(2, "0");
  function setDurationWheel({ wheel, input, max }, value) {
    input.value = padDurationValue(value);
    wheel.querySelectorAll("[data-offset]").forEach((row) => {
      row.textContent = padDurationValue(wrapDurationValue(value + Number(row.dataset.offset), max));
    });
  }
  function setDurationWheels(ms) {
    durationWheels.forEach((unitInfo) => setDurationWheel(unitInfo, unitInfo.fromMs(ms)));
  }
  // Rebuilds draft.totalMs from the columns (at most 60:59.99). A zero total
  // isn't a usable timer, so it's bumped to 1 second.
  function commitDurationWheels() {
    const [minutes, seconds, centiseconds] = durationWheels.map(({ input, max }) => Math.min(max, Math.max(0, Number(input.value) || 0)));
    const totalMs = minutes * 60000 + seconds * 1000 + centiseconds * 10;
    draft.totalMs = totalMs || 1000;
    setDurationWheels(draft.totalMs);
  }
  function stepDurationWheel(unitInfo, delta) {
    setDurationWheel(unitInfo, wrapDurationValue((Number(unitInfo.input.value) || 0) + delta, unitInfo.max));
    commitDurationWheels();
  }
  // Positive offset shifts the track down (shows smaller values). settle
  // animates from the current offset back to rest instead of jumping.
  function setTrackOffset(track, offsetPx, { settle = false } = {}) {
    track.classList.toggle("is-settling", settle);
    track.style.transform = offsetPx ? `translateY(${offsetPx}px)` : "";
  }
  // Steps by delta, then slides the new rows in from where the old ones
  // were, so the jump reads as the drum rolling.
  function rollDurationWheel(unitInfo, delta) {
    const rowHeight = unitInfo.input.offsetHeight;
    stepDurationWheel(unitInfo, delta);
    setTrackOffset(unitInfo.track, Math.sign(delta) * rowHeight);
    void unitInfo.track.offsetHeight; // commit the offset before animating it away
    setTrackOffset(unitInfo.track, 0, { settle: true });
  }
  // How far (px) the pointer must move before a press counts as a drag
  // rather than a click on the input / a neighbour.
  const DURATION_DRAG_THRESHOLD_PX = 3;
  durationWheels.forEach((unitInfo) => {
    const { wheel, track, input, max } = unitInfo;
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(-2);
      if (Number(input.value) > max) input.value = String(max);
    });
    input.addEventListener("change", commitDurationWheels);
    input.addEventListener("focus", () => input.select());
    // Scrolling down rolls the drum toward larger numbers, the way the next
    // (larger) row sits below the current one.
    wheel.addEventListener("wheel", (event) => {
      event.preventDefault();
      rollDurationWheel(unitInfo, event.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    wheel.querySelectorAll(".duration-wheel-step").forEach((step) => step.addEventListener("click", () => {
      rollDurationWheel(unitInfo, Number(step.dataset.offset));
    }));
    // The track follows the pointer; each time it passes half a row the
    // value steps and the offset is re-based, so the rows appear to scroll
    // continuously. Dragging up brings the larger (lower) rows into place.
    let drag = null;
    let suppressClick = false;
    wheel.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      drag = { startY: event.clientY, steps: 0, moved: false, rowHeight: input.offsetHeight };
      suppressClick = false;
    });
    wheel.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const distance = drag.startY - event.clientY;
      if (!drag.moved) {
        if (Math.abs(distance) < DURATION_DRAG_THRESHOLD_PX) return;
        drag.moved = true;
        wheel.setPointerCapture(event.pointerId);
        input.blur();
      }
      const steps = Math.round(distance / drag.rowHeight);
      if (steps !== drag.steps) {
        stepDurationWheel(unitInfo, steps - drag.steps);
        drag.steps = steps;
      }
      setTrackOffset(track, -(distance - steps * drag.rowHeight));
    });
    const endDrag = () => {
      if (!drag) return;
      if (drag.moved) {
        suppressClick = true;
        setTrackOffset(track, 0, { settle: true });
      }
      drag = null;
    };
    wheel.addEventListener("pointerup", endDrag);
    wheel.addEventListener("pointercancel", endDrag);
    // A real drag shouldn't also count as a click on whatever it ended over.
    wheel.addEventListener("click", (event) => {
      if (!suppressClick) return;
      event.stopPropagation();
      event.preventDefault();
      suppressClick = false;
    }, true);
  });
  element.querySelectorAll(".duration-preset").forEach((button) => button.addEventListener("click", () => {
    const ms = Number(button.dataset.ms);
    draft.totalMs = ms;
    setDurationWheels(ms);
  }));
  element.querySelector(".shortcut-button").addEventListener("click", () => {
    recordingDraft = draft;
    recordingElement = element;
    const shortcutButton = element.querySelector(".shortcut-button");
    shortcutButton.classList.add("is-setting-shortcut");
    shortcutButton.value = "원하는 키를 입력하세요 (Esc: 제거)";
  });
  element.querySelector(".start-button").addEventListener("click", () => (timer.isFinished ? restartTimer(timer) : startTimer(timer)));
  element.querySelector(".pause-button").addEventListener("click", () => (timer.isFinished || timer.restartHandle ? resetTimer(timer) : stopTimer(timer)));
  element.querySelector(".reset-button").addEventListener("click", () => resetTimer(timer));
  element.querySelector(".restart-button").addEventListener("click", () => restartTimer(timer));
  element.querySelector(".remove-button").addEventListener("click", () => confirmDeleteTimer(timer));
  // A new timer's settings open straight away without going through the
  // settings-toggle click, so fill the setting controls in up front too.
  resetDraftFromTimer();
  target.appendChild(element);
  updateTimerElement(timer);
}

function renderAllTimers() {
  timerList.replaceChildren();
  timers.forEach((timer) => renderTimer(timer));
}

function tickTimer(timer) {
  const remainingMs = Math.max(0, timer.endTimestamp - Date.now());
  timer.remainingMs = remainingMs;
  timer.remainingSeconds = Math.floor(remainingMs / 1000);
  if (remainingMs <= 0) {
    stopTimer(timer);
    timer.remainingSeconds = 0;
    timer.remainingMs = 0;
    timer.isFinished = true;
    updateTimerElement(timer);
    // The alarm (sound + blink) runs on its own repeat-count schedule
    // regardless of auto-restart - it's a separate notification, not
    // something the countdown needs to wait on before starting over.
    notifyDone(timer, () => volume, () => bounceTimerCard(timer), alarmRepeatMax(timer), (restarted) => {
      if (restarted) restartAlarmBlink(timer);
      // Once the alarm has fully run its course, return the card to a
      // stopped state showing the original duration instead of sitting at
      // 00:00 indefinitely. If auto-restart already kicked the countdown
      // back off below, isFinished is already false, so this is a no-op.
      // A delayed restart still waiting to fire counts the same way -
      // resetting here would cancel it.
      if (timer.remainingAlarmCount <= 0 && timer.isFinished && !timer.restartHandle) resetTimer(timer);
      else updateTimerElement(timer);
    });
    if (timer.autoRestart) scheduleRestart(timer);
    return;
  }
  updateTimerElement(timer);
}

// Restarting - manual or auto - first holds at 00:00 for the timer's
// restart delay (the gauge refills over it, see updateTimerElement), then
// starts the countdown over.
function scheduleRestart(timer) {
  cancelPendingRestart(timer);
  if (timer.restartDelay <= 0) {
    beginRestartedCountdown(timer);
    return;
  }
  timer.remainingMs = 0;
  timer.remainingSeconds = 0;
  updateTimerElement(timer);
  // Flush the current gauge as the transition's starting point before
  // flipping it to full, or the refill would just snap.
  void getTimerElement(timer)?.offsetWidth;
  timer.restartHandle = setTimeout(() => {
    timer.restartHandle = null;
    beginRestartedCountdown(timer);
  }, timer.restartDelay * 1000);
  updateTimerElement(timer);
}

function beginRestartedCountdown(timer) {
  timer.remainingMs = timer.totalMs;
  timer.remainingSeconds = Math.floor(timer.totalMs / 1000);
  startTimer(timer);
}

// Any manual reset/restart/removal during the delay takes over from the
// pending restart.
function cancelPendingRestart(timer) {
  clearTimeout(timer.restartHandle);
  timer.restartHandle = null;
}

// A separate setInterval(10ms) per running timer forces the CPU out of idle
// power states ~100x/sec per timer (Windows flags this as high "power
// usage", and it multiplies with every extra timer running at once). One
// shared requestAnimationFrame loop ticks every running timer per paint
// instead: it matches the display's own refresh rate rather than an
// arbitrary fixed rate, is scheduled by the browser's own efficient timer
// rather than a raw OS timer, and - unlike setInterval - is automatically
// throttled or paused while the window is minimized or fully occluded
// (expiry while minimized is handled by scheduleExpiryWatchdog below).
const runningTimers = new Set();
let tickLoopHandle = null;

// rAF still fires at full display refresh rate (needed for its automatic
// hidden/occluded throttling), but a countdown display doesn't need actual
// DOM work done that often - skip most frames and only really tick at this
// rate. remainingMs is always computed fresh from Date.now() in tickTimer,
// so skipped frames don't cost any accuracy, only update frequency.
const TICK_INTERVAL_MS = 50;
let lastTickTime = 0;

function runTickLoop(now) {
  if (now - lastTickTime >= TICK_INTERVAL_MS) {
    lastTickTime = now;
    runningTimers.forEach((timer) => tickTimer(timer));
  }
  tickLoopHandle = runningTimers.size > 0 ? requestAnimationFrame(runTickLoop) : null;
}

// rAF doesn't fire at all while the window is minimized, so on its own the
// tick loop would freeze and a timer would never finish (no alarm) until the
// window is restored. A single setTimeout aimed at the earliest end time
// covers that: it wakes the CPU only once per expiry rather than per frame,
// and while visible it's harmless since the rAF loop usually gets there first.
let expiryWatchdogHandle = null;

function scheduleExpiryWatchdog() {
  clearTimeout(expiryWatchdogHandle);
  expiryWatchdogHandle = null;
  if (runningTimers.size === 0) return;
  let earliestEnd = Infinity;
  runningTimers.forEach((timer) => { earliestEnd = Math.min(earliestEnd, timer.endTimestamp); });
  expiryWatchdogHandle = setTimeout(() => {
    expiryWatchdogHandle = null;
    runningTimers.forEach((timer) => tickTimer(timer));
    scheduleExpiryWatchdog();
  }, Math.max(0, earliestEnd - Date.now()));
}

function startTimer(timer) {
  if (timer.timerId || timer.remainingMs <= 0) return;
  timer.isFinished = false;
  timer.endTimestamp = Date.now() + timer.remainingMs;
  timer.timerId = true;
  runningTimers.add(timer);
  if (tickLoopHandle === null) tickLoopHandle = requestAnimationFrame(runTickLoop);
  scheduleExpiryWatchdog();
  updateTimerElement(timer);
}

function stopTimer(timer) {
  runningTimers.delete(timer);
  timer.timerId = null;
  scheduleExpiryWatchdog();
  updateTimerElement(timer);
}

function resetTimer(timer) {
  cancelPendingRestart(timer);
  stopAlarm(timer);
  stopTimer(timer);
  timer.remainingMs = timer.totalMs;
  timer.remainingSeconds = Math.floor(timer.totalMs / 1000);
  timer.isFinished = false;
  updateTimerElement(timer);
}

// Editing the duration of a timer that's mid-countdown (or paused partway
// through) shouldn't throw away its progress - shift the remaining time by
// however much the total just changed by, so elapsed time stays the same.
function adjustTimerDuration(timer, previousTotalMs) {
  // Nothing in-progress to preserve for a timer that hasn't started counting
  // down this duration yet, or that already finished - reset to the new length.
  if (timer.isFinished || timer.remainingMs >= previousTotalMs) {
    resetTimer(timer);
    return;
  }
  const newRemainingMs = Math.max(0, timer.remainingMs + (timer.totalMs - previousTotalMs));
  timer.remainingMs = newRemainingMs;
  timer.remainingSeconds = Math.floor(newRemainingMs / 1000);
  if (timer.timerId) {
    // Still running - retarget the end time so the existing 10ms tick loop
    // picks up the rescaled remaining time.
    timer.endTimestamp = Date.now() + newRemainingMs;
    scheduleExpiryWatchdog();
  }
  updateTimerElement(timer);
}

function restartTimer(timer) {
  cancelPendingRestart(timer);
  stopAlarm(timer);
  stopTimer(timer);
  timer.isFinished = false;
  scheduleRestart(timer);
}

function removeTimer(timer) {
  cancelPendingRestart(timer);
  stopAlarm(timer);
  stopTimer(timer);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-name`);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-shortcut`);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-duration`);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-icon`);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-volume`);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-alarm-type`);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-alarm-repeat-count`);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-alarm-repeat-unlimited`);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-auto-restart`);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-restart-delay`);
  removeTimerProgressStyle(timer.id);
  removeTimerColor(timer.id);
  timers = timers.filter((item) => item !== timer);
  timer.element = null;
  renderAllTimers();
  saveTimerIds();
  saveShortcuts();
  syncWindowToContent();
}

function confirmDeleteTimer(timer) {
  confirmMessage.textContent = `"${timer.name}" 타이머를 삭제할까요?`;
  pendingDeleteTimer = timer;
  openDialog(confirmDialog);
}

function restartTimerById(timerId) {
  const timer = timers.find((item) => item.id === timerId);
  if (timer) restartTimer(timer);
}

function cancelShortcutRecording() {
  if (recordingDraft === null) return;
  const shortcutButton = recordingElement.querySelector(".shortcut-button");
  shortcutButton.classList.remove("is-setting-shortcut");
  shortcutButton.blur();
  shortcutButton.value = formatShortcut(recordingDraft.shortcut);
  recordingDraft = null;
  recordingElement = null;
}

// Korean keyboards' right Alt/Ctrl double as IME toggles (한/영, 한자).
// Chromium reports pressing them with the toggle's own key name and the
// modifier flag left false, even though the user physically pressed
// Alt/Ctrl. Raw Input (used to actually trigger shortcuts in Electron) reads
// the real hardware key and reports an ordinary Alt/Ctrl press instead, so
// recording has to correct for the mismatch here or the shortcut can never
// match. The web build has no Raw Input trigger path - both recording and
// triggering see the same browser-level value there, so it's left alone.
const IME_MODIFIER_OVERRIDE = {
  hangulmode: { key: "alt", code: "AltLeft", ctrlKey: false, altKey: true, shiftKey: false, metaKey: false },
  hanjamode: { key: "control", code: "ControlLeft", ctrlKey: true, altKey: false, shiftKey: false, metaKey: false },
};

window.addEventListener("keydown", (event) => {
  if (recordingDraft !== null) {
    event.preventDefault();
    const shortcutButton = recordingElement.querySelector(".shortcut-button");
    const lowerKey = event.key.toLowerCase();
    const code = window.electronAPI ? (NORMALIZE_MODIFIER_CODE[event.code] || event.code) : event.code;
    const imeOverride = window.electronAPI ? IME_MODIFIER_OVERRIDE[lowerKey] : null;
    recordingDraft.shortcut = event.key === "Escape"
      ? null
      : imeOverride || { key: lowerKey, code, ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey, metaKey: event.metaKey };
    shortcutButton.classList.remove("is-setting-shortcut");
    shortcutButton.blur();
    shortcutButton.value = formatShortcut(recordingDraft.shortcut);
    recordingDraft = null;
    recordingElement = null;
    return;
  }

  if (window.electronAPI || event.repeat) return;
  timers.forEach((timer) => {
    const shortcut = timer.shortcut;
    if (!shortcut) return;
    if (event.key.toLowerCase() === shortcut.key && event.ctrlKey === shortcut.ctrlKey && event.altKey === shortcut.altKey && event.shiftKey === shortcut.shiftKey && event.metaKey === shortcut.metaKey) restartTimer(timer);
  });
});

addTimerButton.addEventListener("click", () => {
  const timer = createTimer();
  timer.isDraft = true;
  const draftHost = document.createElement("div");
  draftHost.className = "draft-host";
  document.body.appendChild(draftHost);
  renderTimer(timer, draftHost);
  openDialog(draftHost.querySelector(".settings-modal"));
});

// Registered alarm sounds must be loaded before timers read their saved
// alarm type, or a timer set to one would fall back to the default.
await loadCustomSounds();
const initialTimerIds = loadTimerIds();
if (initialTimerIds.length > 0) {
  timers = initialTimerIds.map((id, index) => buildTimer(id, loadDuration(id) ?? 60000, index));
} else {
  timers = seedDefaultTimersIfNeeded();
  saveTimerIds();
}
renderAllTimers();
saveShortcuts();
syncWindowToContent();

window.electronAPI?.onGlobalRestart(restartTimerById);
