const ICON_NAMES = [
  "alarm-clock-plus",
  "bell",
  "bell-check",
  "chart-no-axes-column-increasing",
  "chevron-down",
  "file-music",
  "file-up",
  "map-pin",
  "pause",
  "pen",
  "play",
  "rotate-ccw-clock",
  "settings",
  "siren",
  "square",
  "square-arrow-down",
  "square-arrow-left",
  "square-dashed-top-solid",
  "trash",
  "triangle-alert",
  "volume-1",
  "volume-2",
  "whistle",
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
