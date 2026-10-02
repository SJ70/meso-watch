import { createIconElement } from "../svg/icons.js";
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

// A native <select> can't render icons in its option list, so this is a
// button + listbox dropdown instead.
export function progressStyleSettingMarkup(timer) {
  return `
      <div class="progress-style-setting">
        <span class="control-label">진행 표시 스타일</span>
        <div class="icon-select">
          <button class="icon-select-trigger progress-style-select" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="타이머 ${timer.id} 진행 표시 스타일">
            <span class="icon-select-current-icon" aria-hidden="true"></span>
            <span class="icon-select-current-label"></span>
          </button>
          <div class="icon-select-options" role="listbox" aria-label="타이머 ${timer.id} 진행 표시 스타일" hidden>
            ${PROGRESS_STYLES.map((progressStyle) => `
            <button class="icon-select-option" type="button" role="option" data-value="${progressStyle.id}" aria-selected="false">
              <span class="icon-select-option-icon" aria-hidden="true"></span>
              <span>${progressStyle.label}</span>
            </button>`).join("")}
          </div>
        </div>
      </div>`;
}

export function setupProgressStyleSelect(container, onSelect) {
  const root = container.querySelector(".progress-style-setting .icon-select");
  const trigger = root.querySelector(".icon-select-trigger");
  const optionList = root.querySelector(".icon-select-options");
  const options = [...optionList.querySelectorAll(".icon-select-option")];

  trigger.appendChild(createIconElement("chevron-down", { width: 16, height: 16 }));
  options.forEach((option) => {
    const progressStyle = PROGRESS_STYLES.find((item) => item.id === option.dataset.value);
    option.querySelector(".icon-select-option-icon").appendChild(createIconElement(progressStyle.icon, { width: 16, height: 16 }));
  });

  function setOpen(open) {
    optionList.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    root.classList.toggle("is-open", open);
    if (open) (options.find((option) => option.getAttribute("aria-selected") === "true") ?? options[0]).focus();
  }

  trigger.addEventListener("click", () => setOpen(optionList.hidden));
  options.forEach((option) => option.addEventListener("click", () => {
    onSelect(option.dataset.value);
    setOpen(false);
    trigger.focus();
  }));
  // Anything clicked elsewhere in the card or settings dialog closes the list.
  container.addEventListener("pointerdown", (event) => {
    if (!optionList.hidden && !root.contains(event.target)) setOpen(false);
  });
  root.addEventListener("keydown", (event) => {
    if (optionList.hidden) return;
    if (event.key === "Escape") {
      // Keep Escape from also cancelling the surrounding <dialog>.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const index = options.indexOf(document.activeElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      options[(index + step + options.length) % options.length].focus();
    }
  });

  return { close: () => setOpen(false) };
}

export function updateProgressStyleSelect(container, progressStyleId) {
  const root = container.querySelector(".progress-style-setting .icon-select");
  const progressStyle = PROGRESS_STYLES.find((item) => item.id === progressStyleId) ?? PROGRESS_STYLES[0];
  root.querySelector(".icon-select-current-icon").replaceChildren(createIconElement(progressStyle.icon, { width: 16, height: 16 }));
  root.querySelector(".icon-select-current-label").textContent = progressStyle.label;
  root.querySelectorAll(".icon-select-option").forEach((option) => {
    const selected = option.dataset.value === progressStyle.id;
    option.setAttribute("aria-selected", String(selected));
    option.classList.toggle("is-selected", selected);
  });
}
