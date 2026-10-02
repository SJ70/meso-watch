import { createIconElement } from "../svg/icons.js";

// A native <select> can't render icons in its option list, so this is a
// button + listbox dropdown instead. items are { id, label, icon? } - icon is
// an svg name from src/svg/icons.js; items without one get an empty slot so
// labels still line up.
export function iconSelectMarkup({ triggerClass, ariaLabel, items }) {
  return `
        <div class="icon-select">
          <button class="icon-select-trigger ${triggerClass}" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="${ariaLabel}">
            <span class="icon-select-current-icon" aria-hidden="true"></span>
            <span class="icon-select-current-label"></span>
          </button>
          <div class="icon-select-options" role="listbox" aria-label="${ariaLabel}" hidden>
            ${items.map((item) => `
            <button class="icon-select-option" type="button" role="option" data-value="${item.id}" aria-selected="false">
              <span class="icon-select-option-icon" aria-hidden="true"></span>
              <span>${item.label}</span>
            </button>`).join("")}
          </div>
        </div>`;
}

function itemIcon(item) {
  return item.icon ? [createIconElement(item.icon, { width: 16, height: 16 })] : [];
}

// root is the .icon-select element; container is the surrounding card/dialog,
// where any click outside root closes the list.
export function setupIconSelect(root, container, items, onSelect) {
  const trigger = root.querySelector(".icon-select-trigger");
  const optionList = root.querySelector(".icon-select-options");
  const options = [...optionList.querySelectorAll(".icon-select-option")];

  trigger.appendChild(createIconElement("chevron-down", { width: 16, height: 16 }));
  options.forEach((option) => {
    const item = items.find((candidate) => candidate.id === option.dataset.value);
    option.querySelector(".icon-select-option-icon").replaceChildren(...itemIcon(item));
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

export function updateIconSelect(root, items, value) {
  const item = items.find((candidate) => candidate.id === value) ?? items[0];
  root.querySelector(".icon-select-current-icon").replaceChildren(...itemIcon(item));
  root.querySelector(".icon-select-current-label").textContent = item.label;
  root.querySelectorAll(".icon-select-option").forEach((option) => {
    const selected = option.dataset.value === item.id;
    option.setAttribute("aria-selected", String(selected));
    option.classList.toggle("is-selected", selected);
  });
}
