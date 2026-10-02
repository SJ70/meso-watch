import { iconSelectMarkup, setupIconSelect, updateIconSelect } from "./iconSelect.js";
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
        <span class="control-label">게이지 스타일</span>
        ${iconSelectMarkup({ triggerClass: "progress-style-select", ariaLabel: `타이머 ${timer.id} 게이지 스타일`, items: PROGRESS_STYLES })}
      </div>`;
}

export function setupProgressStyleSelect(container, onSelect) {
  return setupIconSelect(container.querySelector(".progress-style-setting .icon-select"), container, PROGRESS_STYLES, onSelect);
}

export function updateProgressStyleSelect(container, progressStyleId) {
  updateIconSelect(container.querySelector(".progress-style-setting .icon-select"), PROGRESS_STYLES, progressStyleId);
}
