import { createIconElement } from "../svg/icons.js";

// A native <select> can't render icons in its option list, so this is a
// button + listbox dropdown instead. items are { id, label, icon?, action?,
// removable? }:
// - icon: an svg name from src/svg/icons.js; items without one get an empty
//   slot so labels still line up.
// - action: not a value - clicking it calls onAction(id) instead of
//   onSelect, and it's never shown as selected (e.g. "upload a sound").
// - removable: gets an × button on the right that calls onRemove(id).
// The options themselves are built by setupIconSelect (and rebuilt by its
// setItems), with labels set as text since some come from user input
// (registered alarm sound file names).
export function iconSelectMarkup({ triggerClass, ariaLabel }) {
  return `
        <div class="icon-select">
          <button class="icon-select-trigger ${triggerClass}" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="${ariaLabel}">
            <span class="icon-select-current-icon" aria-hidden="true"></span>
            <span class="icon-select-current-label"></span>
          </button>
          <div class="icon-select-options" role="listbox" aria-label="${ariaLabel}" hidden></div>
        </div>`;
}

function itemIcon(item) {
  return item.icon ? [createIconElement(item.icon, { width: 16, height: 16 })] : [];
}

// A row wraps the option button so a removable item's × can sit beside it
// (a button can't be nested inside another button).
function createOptionRow(item) {
  const row = document.createElement("div");
  row.className = "icon-select-row";
  row.setAttribute("role", "none");
  const option = document.createElement("button");
  option.className = "icon-select-option";
  option.classList.toggle("is-action", Boolean(item.action));
  option.type = "button";
  option.setAttribute("role", "option");
  option.setAttribute("aria-selected", "false");
  option.dataset.value = item.id;
  const icon = document.createElement("span");
  icon.className = "icon-select-option-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.replaceChildren(...itemIcon(item));
  const label = document.createElement("span");
  label.className = "icon-select-option-label";
  label.textContent = item.label;
  option.append(icon, label);
  row.append(option);
  if (item.removable) {
    const remove = document.createElement("button");
    remove.className = "icon-select-remove";
    remove.type = "button";
    remove.dataset.value = item.id;
    remove.setAttribute("aria-label", `${item.label} 삭제`);
    remove.title = "삭제";
    remove.append(createIconElement("x", { width: 14, height: 14 }));
    row.append(remove);
  }
  return row;
}

// root is the .icon-select element; container is the surrounding card/dialog,
// where any click outside root closes the list. Returns { close, setItems },
// setItems swapping in a new option list (selection is then re-applied by
// the caller via updateIconSelect).
export function setupIconSelect(root, container, items, onSelect, { onAction, onRemove } = {}) {
  const trigger = root.querySelector(".icon-select-trigger");
  const optionList = root.querySelector(".icon-select-options");
  const getOptions = () => [...optionList.querySelectorAll(".icon-select-option")];
  let currentItems = items;

  function setItems(newItems) {
    currentItems = newItems;
    optionList.replaceChildren(...newItems.map(createOptionRow));
  }
  setItems(items);
  trigger.appendChild(createIconElement("chevron-down", { width: 16, height: 16 }));

  function setOpen(open) {
    optionList.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    root.classList.toggle("is-open", open);
    if (open) {
      const options = getOptions();
      (options.find((option) => option.getAttribute("aria-selected") === "true") ?? options[0])?.focus();
    }
  }

  trigger.addEventListener("click", () => setOpen(optionList.hidden));
  optionList.addEventListener("click", (event) => {
    const remove = event.target.closest(".icon-select-remove");
    if (remove) {
      onRemove?.(remove.dataset.value);
      return;
    }
    const option = event.target.closest(".icon-select-option");
    if (!option) return;
    const item = currentItems.find((candidate) => candidate.id === option.dataset.value);
    setOpen(false);
    trigger.focus();
    if (item?.action) onAction?.(item.id);
    else onSelect(option.dataset.value);
  });
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
      const options = getOptions();
      const index = options.indexOf(document.activeElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      options[(index + step + options.length) % options.length].focus();
    }
  });

  return { close: () => setOpen(false), setItems };
}

export function updateIconSelect(root, items, value) {
  const item = items.find((candidate) => candidate.id === value && !candidate.action) ?? items[0];
  root.querySelector(".icon-select-current-icon").replaceChildren(...itemIcon(item));
  root.querySelector(".icon-select-current-label").textContent = item.label;
  root.querySelectorAll(".icon-select-option").forEach((option) => {
    const selected = option.dataset.value === item.id;
    option.setAttribute("aria-selected", String(selected));
    option.classList.toggle("is-selected", selected);
  });
}
