import { PROGRESS_STYLES, DEFAULT_PROGRESS_STYLE } from "./constants.js";

// null (unset) falls back to the pre-existing ring style, so timers saved
// before this setting existed keep looking exactly as they did.
export function loadTimerProgressStyle(id) {
  const stored = localStorage.getItem(`meso-watch-timer-${id}-progress-style`);
  return PROGRESS_STYLES.some((progressStyle) => progressStyle.id === stored) ? stored : DEFAULT_PROGRESS_STYLE;
}

export function saveTimerProgressStyle(timer) {
  localStorage.setItem(`meso-watch-timer-${timer.id}-progress-style`, timer.progressStyle);
}

export function removeTimerProgressStyle(id) {
  localStorage.removeItem(`meso-watch-timer-${id}-progress-style`);
}

export function progressStyleSettingMarkup(timer) {
  return `
      <div class="progress-style-setting">
        <span class="control-label">진행 표시 스타일</span>
        <div class="select-wrapper">
          <select class="progress-style-select" aria-label="타이머 ${timer.id} 진행 표시 스타일">
            ${PROGRESS_STYLES.map((progressStyle) => `<option value="${progressStyle.id}"${progressStyle.id === timer.progressStyle ? " selected" : ""}>${progressStyle.label}</option>`).join("")}
          </select>
        </div>
      </div>`;
}
