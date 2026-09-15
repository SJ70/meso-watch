import { createIconElement } from "../svg/icons.js";
import {
  NO_ICON,
  TIMER_ICON_NAMES,
  DEFAULT_MASTER_VOLUME,
  DEFAULT_TIMER_VOLUME,
  DEFAULT_TIMER_MINUTES,
  DEFAULT_TIMERS_PER_ROW,
  DEFAULT_UI_ZOOM,
  MIN_UI_ZOOM,
  MAX_UI_ZOOM,
  ALARM_TYPES,
  DEFAULT_ALARM_TYPE,
  DEFAULT_TIMERS,
} from "./constants.js";
import { openDialog, registerDialogShrinkOnClose } from "./dialog-utils.js";
import { previewAlarmSound, effectiveVolume, notifyDone, stopAlarm } from "./sound.js";
import { formatShortcut, NORMALIZE_MODIFIER_CODE } from "./shortcuts.js";
import { checkForUpdate } from "./updateCheck.js";
import { configureWindowSizeState, syncWindowToContent } from "./windowSize.js";

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

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
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

function loadTimerAlarmType(id) {
  const stored = localStorage.getItem(`meso-watch-timer-${id}-alarm-type`);
  return ALARM_TYPES.some((alarmType) => alarmType.id === stored) ? stored : DEFAULT_ALARM_TYPE;
}

function buildTimer(id, totalMs, fallbackIndex = null) {
  const name = localStorage.getItem(`meso-watch-timer-${id}-name`)
    || (fallbackIndex === null ? defaultTimerName(null) : `타이머 ${fallbackIndex + 1}`);
  return { id, name, totalMs, remainingSeconds: Math.floor(totalMs / 1000), remainingMs: totalMs, timerId: null, alarmIntervalId: null, shortcut: loadShortcut(id), icon: loadTimerIcon(id), volume: loadTimerVolume(id), alarmType: loadTimerAlarmType(id), isDraft: false };
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
  element.querySelector(".timer-time").textContent = formatTime(timer.remainingSeconds);
  element.querySelector(".timer-ms").textContent = formatMs(timer.remainingMs);
  const settingsModalOpen = element.querySelector(".settings-modal")?.open;
  if (recordingElement !== element && !settingsModalOpen) {
    element.querySelector(".shortcut-button").value = formatShortcut(timer.shortcut);
  }
  element.querySelector(".timer-shortcut-badge").textContent = formatShortcut(timer.shortcut);
  element.classList.toggle("is-running", Boolean(timer.timerId));
  element.classList.toggle("is-finished", Boolean(timer.isFinished));
  element.classList.toggle("has-progress", timer.remainingMs < timer.totalMs);
  const progress = timer.totalMs > 0 ? timer.remainingMs / timer.totalMs : 0;
  element.style.setProperty("--progress-fraction", progress);
  element.querySelector(".start-button").disabled = Boolean(timer.timerId);
  element.querySelector(".pause-button").disabled = !timer.timerId && !timer.isFinished;
}

function renderTimer(timer, target = timerList) {
  const element = document.createElement("article");
  element.className = "timer-card";
  element.draggable = true;
  element.dataset.timerId = timer.id;
  element.style.setProperty("--timer-icon", timerIconUrl(timer));
  timer.element = element;
  element.innerHTML = `
    <svg class="timer-progress-ring" aria-hidden="true"><rect pathLength="1" /></svg>
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
      <div class="settings-modal-header">
        <span class="section-title">타이머 설정</span>
      </div>
      <label class="name-field">
        <span class="control-label">이름</span>
        <input class="name-input" type="text" maxlength="30" value="${escapeHtml(timer.name)}" aria-label="타이머 이름" />
      </label>
      <div class="duration-setting">
        <div class="duration-setting-header">
          <span class="control-label">시간</span>
          <span class="duration-hint">마우스 휠로 조절 가능</span>
        </div>
        <div class="duration-fields" aria-label="타이머 ${timer.id} 시간 입력">
          <input class="duration-input minutes-input" type="text" inputmode="numeric" pattern="[0-9]*" value="${Math.floor(timer.totalMs / 60000)}" aria-label="타이머 ${timer.id} 분" />
          <span class="duration-separator" aria-hidden="true">:</span>
          <input class="duration-input seconds-input" type="text" inputmode="numeric" pattern="[0-9]*" value="${Math.floor(timer.totalMs / 1000) % 60}" aria-label="타이머 ${timer.id} 초" />
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
      <div class="alarm-type-setting">
        <span class="control-label">알람음</span>
        <div class="select-wrapper">
          <select class="alarm-type-select" aria-label="타이머 ${timer.id} 알람음">
            ${ALARM_TYPES.map((alarmType) => `<option value="${alarmType.id}"${alarmType.id === timer.alarmType ? " selected" : ""}>${alarmType.label}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="opacity-setting volume-setting">
        <div class="opacity-setting-header">
          <span class="control-label">알람 볼륨</span>
          <span class="duration-hint volume-value"></span>
        </div>
        <input class="opacity-slider volume-slider-input" type="range" min="0" max="100" step="1" aria-label="타이머 ${timer.id} 음량" />
      </div>
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
      <div class="shortcut-setting timer-shortcut-setting">
        <span class="control-label">재시작 단축키</span>
        <input class="shortcut-input shortcut-button" type="text" readonly autocomplete="off" aria-label="타이머 ${timer.id} 단축키 설정" value="${escapeHtml(formatShortcut(timer.shortcut))}" />
      </div>
      <div class="settings-actions">
        <button class="secondary modal-close" type="button">취소</button>
        <button class="primary modal-save" type="button">${timer.isDraft ? "완료" : "저장"}</button>
      </div>
    </dialog>`;

  const settingsModal = element.querySelector(".settings-modal");
  registerDialogShrinkOnClose(settingsModal);
  let draft = { name: timer.name, totalMs: timer.totalMs, shortcut: timer.shortcut, icon: timer.icon, volume: timer.volume, alarmType: timer.alarmType };
  function updateIconOptionsUi() {
    element.querySelectorAll(".icon-option").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.icon === draft.icon);
    });
  }
  function updateVolumeSettingUi() {
    const slider = element.querySelector(".volume-slider-input");
    const valueDisplay = element.querySelector(".volume-value");
    slider.value = draft.volume;
    valueDisplay.textContent = `마스터 볼륨의 ${draft.volume}%`;
  }
  function updateAlarmTypeSettingUi() {
    element.querySelector(".alarm-type-select").value = draft.alarmType;
  }
  function resetDraftFromTimer() {
    draft = { name: timer.name, totalMs: timer.totalMs, shortcut: timer.shortcut, icon: timer.icon, volume: timer.volume, alarmType: timer.alarmType };
    element.querySelector(".name-input").value = timer.name;
    element.querySelector(".minutes-input").value = Math.floor(timer.totalMs / 60000);
    element.querySelector(".seconds-input").value = Math.floor(timer.totalMs / 1000) % 60;
    element.querySelector(".shortcut-button").value = formatShortcut(timer.shortcut);
    updateIconOptionsUi();
    updateVolumeSettingUi();
    updateAlarmTypeSettingUi();
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
  element.querySelector(".alarm-type-select").addEventListener("change", (event) => {
    draft.alarmType = event.target.value;
    previewAlarmSound(effectiveVolume(volume, draft.volume), draft.alarmType);
  });
  element.querySelector(".select-wrapper").appendChild(createIconElement("chevron-down", { width: 16, height: 16 }));
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
      if (timer.id === nextTimerId - 1) setNextTimerId(nextTimerId - 1);
      element.parentElement?.remove();
    }
  });
  element.querySelector(".modal-save").addEventListener("click", () => {
    cancelShortcutRecording();
    const durationChanged = draft.totalMs !== timer.totalMs;
    timer.name = draft.name;
    timer.totalMs = draft.totalMs;
    timer.shortcut = draft.shortcut;
    timer.icon = draft.icon;
    timer.volume = draft.volume;
    timer.alarmType = draft.alarmType;
    localStorage.setItem(`meso-watch-timer-${timer.id}-name`, timer.name);
    localStorage.setItem(`meso-watch-timer-${timer.id}-icon`, timer.icon);
    localStorage.setItem(`meso-watch-timer-${timer.id}-volume`, String(timer.volume));
    localStorage.setItem(`meso-watch-timer-${timer.id}-alarm-type`, timer.alarmType);
    element.querySelector(".timer-label").textContent = timer.name;
    element.style.setProperty("--timer-icon", timerIconUrl(timer));
    if (durationChanged) resetTimer(timer);
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
    element.querySelector(".modal-save").click();
  });
  element.querySelector(".name-input").addEventListener("change", (event) => {
    draft.name = event.target.value.trim() || defaultTimerName(timer);
    event.target.value = draft.name;
  });
  const durationInputMax = (input) => (input.classList.contains("seconds-input") ? 59 : 60);
  element.querySelectorAll(".duration-input").forEach((input) => input.addEventListener("input", (event) => {
    event.target.value = event.target.value.replace(/\D/g, "");
    if (Number(event.target.value) > durationInputMax(event.target)) event.target.value = "0";
  }));
  element.querySelectorAll(".duration-input").forEach((input) => input.addEventListener("wheel", (event) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 1 : -1;
    input.value = Math.min(durationInputMax(input), Math.max(0, (Number(input.value) || 0) + delta));
    input.dispatchEvent(new Event("change"));
  }, { passive: false }));
  element.querySelectorAll(".duration-input").forEach((input) => input.addEventListener("change", () => {
    const minutesInput = element.querySelector(".minutes-input");
    const secondsInput = element.querySelector(".seconds-input");
    const minutes = Math.min(60, Math.max(0, Number(minutesInput.value) || 0));
    const seconds = Math.min(59, Math.max(0, Number(secondsInput.value) || 0));
    const totalSeconds = minutes * 60 + seconds;
    if (totalSeconds === 0) {
      minutesInput.value = 0;
      secondsInput.value = 1;
      draft.totalMs = 1000;
    } else {
      minutesInput.value = minutes;
      secondsInput.value = seconds;
      draft.totalMs = totalSeconds * 1000;
    }
  }));
  element.querySelectorAll(".duration-preset").forEach((button) => button.addEventListener("click", () => {
    const ms = Number(button.dataset.ms);
    draft.totalMs = ms;
    element.querySelector(".minutes-input").value = Math.floor(ms / 60000);
    element.querySelector(".seconds-input").value = Math.floor(ms / 1000) % 60;
  }));
  element.querySelector(".shortcut-button").addEventListener("click", () => {
    recordingDraft = draft;
    recordingElement = element;
    const shortcutButton = element.querySelector(".shortcut-button");
    shortcutButton.classList.add("is-setting-shortcut");
    shortcutButton.value = "원하는 키를 입력하세요 (Esc: 제거)";
  });
  element.querySelector(".start-button").addEventListener("click", () => (timer.isFinished ? restartTimer(timer) : startTimer(timer)));
  element.querySelector(".pause-button").addEventListener("click", () => (timer.isFinished ? resetTimer(timer) : stopTimer(timer)));
  element.querySelector(".reset-button").addEventListener("click", () => resetTimer(timer));
  element.querySelector(".restart-button").addEventListener("click", () => restartTimer(timer));
  element.querySelector(".remove-button").addEventListener("click", () => confirmDeleteTimer(timer));
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
    notifyDone(timer, () => volume, () => bounceTimerCard(timer));
    return;
  }
  updateTimerElement(timer);
}

function startTimer(timer) {
  if (timer.timerId || timer.remainingMs <= 0) return;
  timer.isFinished = false;
  timer.endTimestamp = Date.now() + timer.remainingMs;
  timer.timerId = setInterval(() => tickTimer(timer), 10);
  updateTimerElement(timer);
}

function stopTimer(timer) {
  clearInterval(timer.timerId);
  timer.timerId = null;
  updateTimerElement(timer);
}

function resetTimer(timer) {
  stopAlarm(timer);
  stopTimer(timer);
  timer.remainingMs = timer.totalMs;
  timer.remainingSeconds = Math.floor(timer.totalMs / 1000);
  timer.isFinished = false;
  updateTimerElement(timer);
}

function restartTimer(timer) {
  stopAlarm(timer);
  stopTimer(timer);
  timer.remainingMs = timer.totalMs;
  timer.remainingSeconds = Math.floor(timer.totalMs / 1000);
  timer.isFinished = false;
  startTimer(timer);
  updateTimerElement(timer);
}

function removeTimer(timer) {
  stopAlarm(timer);
  stopTimer(timer);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-name`);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-shortcut`);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-duration`);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-icon`);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-volume`);
  localStorage.removeItem(`meso-watch-timer-${timer.id}-alarm-type`);
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
