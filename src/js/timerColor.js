import { TIMER_COLORS, DEFAULT_TIMER_COLOR } from "./constants.js";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// Unset/invalid falls back to the app accent color, so timers saved before
// this setting existed keep looking exactly as they did.
export function loadTimerColor(id) {
  const stored = localStorage.getItem(`meso-watch-timer-${id}-color`);
  return stored && HEX_COLOR.test(stored) ? stored.toLowerCase() : DEFAULT_TIMER_COLOR;
}

export function saveTimerColor(timer) {
  localStorage.setItem(`meso-watch-timer-${timer.id}-color`, timer.color);
}

export function removeTimerColor(id) {
  localStorage.removeItem(`meso-watch-timer-${id}-color`);
}

// The card's progress ring/gauges and its start/reset button read
// --timer-color (see timer-progress.css / index.css); the settings modal
// inside the card keeps using the app-wide --accent.
export function applyTimerColor(element, color) {
  element.style.setProperty("--timer-color", color);
}

const clamp01 =(value) => Math.min(1, Math.max(0, value));

function hexToHsv(hex) {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? delta / max : 0, v: max };
}

function hsvToHex({ h, s, v }) {
  const channel = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${[5, 3, 1].map((n) => Math.round(channel(n) * 255).toString(16).padStart(2, "0")).join("")}`;
}

// Per-.color-setting picker state. The picker works in HSV and keeps its own
// copy, so dragging to pure black/white (where hue is lost in the hex) doesn't
// snap the hue slider back to red; it's only re-derived from the hex when the
// color changes from outside the picker (a preset swatch, reset, hex input).
const pickerStates = new WeakMap();

// Preset swatches plus a custom swatch that opens an in-app HSV picker
// (saturation/brightness square, hue bar, hex field) styled like the rest of
// the settings, instead of the OS's native color dialog.
export function timerColorSettingMarkup(timer) {
  return `
        <div class="color-setting">
          <span class="control-label">게이지 색상</span>
          <div class="color-options" role="group" aria-label="타이머 ${timer.id} 게이지 색상 선택">
            ${TIMER_COLORS.map((color) => `
            <button class="color-option" type="button" data-color="${color.value}" style="--swatch: ${color.value}" aria-label="${color.label}" title="${color.label}"></button>`).join("")}
            <button class="color-option color-option-custom" type="button" aria-expanded="false" aria-label="직접 선택" title="직접 선택"></button>
          </div>
          <div class="color-picker" hidden>
            <div class="color-picker-sv" aria-label="채도 / 밝기"><span class="color-picker-thumb"></span></div>
            <div class="color-picker-hue" aria-label="색조"><span class="color-picker-thumb"></span></div>
            <div class="color-picker-row">
              <span class="color-picker-preview" aria-hidden="true"></span>
              <input class="color-picker-hex" type="text" maxlength="7" spellcheck="false" autocomplete="off" aria-label="타이머 ${timer.id} 색상 코드" />
            </div>
          </div>
        </div>`;
}

// onSelect(hex) fires for every pick; onToggle fires after the picker opens
// or closes from its own swatch (it changes the dialog's height). Returns
// { close }, which closes it silently - callers that close it while switching
// pages or closing the dialog resize the window themselves.
export function setupTimerColorSetting(container, onSelect, onToggle) {
  const root = container.querySelector(".color-setting");
  const customButton = root.querySelector(".color-option-custom");
  const picker = root.querySelector(".color-picker");
  const svArea = root.querySelector(".color-picker-sv");
  const hueBar = root.querySelector(".color-picker-hue");
  const hexInput = root.querySelector(".color-picker-hex");
  const state = { h: 0, s: 0, v: 0, hex: null };
  pickerStates.set(root, state);

  const emit = () => {
    state.hex = hsvToHex(state);
    onSelect(state.hex);
  };

  function setOpen(open, { notify = true } = {}) {
    if (picker.hidden === !open) return;
    picker.hidden = !open;
    customButton.setAttribute("aria-expanded", String(open));
    customButton.classList.toggle("is-open", open);
    if (notify) onToggle?.();
  }

  root.querySelectorAll("button.color-option:not(.color-option-custom)").forEach((button) => button.addEventListener("click", () => onSelect(button.dataset.color)));
  customButton.addEventListener("click", () => setOpen(picker.hidden));

  // Press-and-drag on either surface; position within it maps straight to
  // the HSV component(s) it controls.
  function trackPointer(surface, apply) {
    surface.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      surface.setPointerCapture(event.pointerId);
      const move = (moveEvent) => {
        const rect = surface.getBoundingClientRect();
        apply(clamp01((moveEvent.clientX - rect.left) / rect.width), clamp01((moveEvent.clientY - rect.top) / rect.height));
        emit();
      };
      const end = () => {
        surface.removeEventListener("pointermove", move);
        surface.removeEventListener("pointerup", end);
        surface.removeEventListener("pointercancel", end);
      };
      surface.addEventListener("pointermove", move);
      surface.addEventListener("pointerup", end);
      surface.addEventListener("pointercancel", end);
      move(event);
    });
  }
  trackPointer(svArea, (x, y) => {
    state.s = x;
    state.v = 1 - y;
  });
  trackPointer(hueBar, (x) => {
    state.h = x * 359.99;
  });

  function commitHexInput() {
    const value = hexInput.value.trim().replace(/^#?/, "#").toLowerCase();
    if (HEX_COLOR.test(value)) onSelect(value);
    else hexInput.value = state.hex ?? "";
  }
  hexInput.addEventListener("change", commitHexInput);
  hexInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    // Apply the code instead of letting the settings dialog treat Enter as
    // "done with this page".
    event.preventDefault();
    event.stopPropagation();
    commitHexInput();
  });

  return { close: () => setOpen(false, { notify: false }) };
}

export function updateTimerColorSetting(container, color) {
  const root = container.querySelector(".color-setting");
  let matchedPreset = false;
  root.querySelectorAll("button.color-option:not(.color-option-custom)").forEach((button) => {
    const selected = button.dataset.color === color;
    matchedPreset ||= selected;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const custom = root.querySelector(".color-option-custom");
  custom.classList.toggle("is-selected", !matchedPreset);
  custom.style.setProperty("--swatch", matchedPreset ? "" : color);

  const state = pickerStates.get(root);
  if (color !== state.hex) {
    const hsv = hexToHsv(color);
    // Grays carry no hue; keep the slider where it was.
    Object.assign(state, hsv.s ? hsv : { s: hsv.s, v: hsv.v }, { hex: color });
  }
  root.querySelector(".color-picker-sv").style.setProperty("--picker-hue", `hsl(${state.h} 100% 50%)`);
  const svThumb = root.querySelector(".color-picker-sv .color-picker-thumb");
  svThumb.style.left = `${state.s * 100}%`;
  svThumb.style.top = `${(1 - state.v) * 100}%`;
  root.querySelector(".color-picker-hue .color-picker-thumb").style.left = `${(state.h / 360) * 100}%`;
  root.querySelector(".color-picker-preview").style.setProperty("--swatch", color);
  const hexInput = root.querySelector(".color-picker-hex");
  if (document.activeElement !== hexInput) hexInput.value = color;
}
