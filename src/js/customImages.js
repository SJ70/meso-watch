import { withStore, createAssetId, assetLabelFromFile } from "./idbStore.js";

// Background images the user uploads for timer cards, shared by all timers.
// The files live in IndexedDB (too big for localStorage); each one gets an
// object URL at load/upload time that the card's background can point at.

const DB_NAME = "meso-watch-images";
const STORE_NAME = "images";

// Timer icon ids of uploaded images carry this prefix, so they can share the
// per-timer icon setting with the bundled TIMER_ICONS file names.
export const CUSTOM_IMAGE_PREFIX = "custom-image:";
export const MAX_CUSTOM_IMAGE_BYTES = 2 * 1024 * 1024;

const images = []; // { id, label, url }, in upload order

export function isCustomImageId(id) {
  return typeof id === "string" && id.startsWith(CUSTOM_IMAGE_PREFIX);
}

// Call once at startup, before timers read their saved icon, so a timer set
// to an uploaded image still recognizes it. If IndexedDB is unavailable
// there are simply no uploaded images.
export async function loadCustomImages() {
  try {
    const records = await withStore(DB_NAME, STORE_NAME, "readonly", (store) => store.getAll());
    records.sort((a, b) => a.createdAt - b.createdAt);
    records.forEach((record) => images.push({ id: record.id, label: record.label, url: URL.createObjectURL(record.blob) }));
  } catch {
    // No IndexedDB (e.g. blocked storage) - bundled images only.
  }
}

export function getCustomImages() {
  return images;
}

export function getCustomImageUrl(id) {
  return images.find((image) => image.id === id)?.url ?? null;
}

// Throws an Error whose message is "too-large", "decode-failed" or
// "save-failed" so the caller can say what went wrong.
export async function addCustomImage(file) {
  if (file.size > MAX_CUSTOM_IMAGE_BYTES) throw new Error("too-large");
  try {
    // Fails for anything that isn't a decodable image.
    (await createImageBitmap(file)).close();
  } catch {
    throw new Error("decode-failed");
  }
  const id = createAssetId(CUSTOM_IMAGE_PREFIX);
  const label = assetLabelFromFile(file, "내 이미지");
  try {
    await withStore(DB_NAME, STORE_NAME, "readwrite", (store) => store.put({ id, label, blob: file, createdAt: Date.now() }));
  } catch {
    throw new Error("save-failed");
  }
  const image = { id, label, url: URL.createObjectURL(file) };
  images.push(image);
  return image;
}

export async function deleteCustomImage(id) {
  await withStore(DB_NAME, STORE_NAME, "readwrite", (store) => store.delete(id));
  const index = images.findIndex((image) => image.id === id);
  if (index < 0) return;
  URL.revokeObjectURL(images[index].url);
  images.splice(index, 1);
}
