const ICON_NAMES = [
  "alarm-clock-plus",
  "pause",
  "play",
  "rotate-ccw-clock",
  "settings",
  "square",
  "trash",
  "volume-1",
  "volume-2",
  "volume-x",
  "x"
];

const icons = new Map();

await Promise.all(
  ICON_NAMES.map(async (name) => {
    const response = await fetch(new URL(`./${name}.svg`, import.meta.url));
    const svgText = await response.text();
    const svg = new DOMParser().parseFromString(svgText, "image/svg+xml").documentElement;
    icons.set(name, svg);
  })
);

export function createIconElement(name, { width, height } = {}) {
  const template = icons.get(name);
  if (!template) throw new Error(`Unknown icon: ${name}`);
  const svg = template.cloneNode(true);
  if (width != null) svg.setAttribute("width", width);
  if (height != null) svg.setAttribute("height", height);
  return svg;
}
