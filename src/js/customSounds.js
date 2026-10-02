import { withStore, createAssetId, assetLabelFromFile } from "./idbStore.js";

// Alarm sounds the user registers from their own audio files, shared by all
// timers. The files live in IndexedDB (audio is too big for localStorage);
// each one is decoded once, up front, and the AudioBuffer kept in memory so
// an alarm can start it synchronously the instant a timer finishes.

const DB_NAME = "meso-watch-sounds";
const STORE_NAME = "sounds";

// Alarm type ids of registered sounds carry this prefix, so they can share
// the per-timer alarm-type setting with the built-in ALARM_TYPES ids.
export const CUSTOM_SOUND_PREFIX = "custom-sound:";
export const MAX_CUSTOM_SOUND_BYTES = 5 * 1024 * 1024;

const sounds = []; // { id, label }, in registration order
const buffers = new Map(); // id -> AudioBuffer

export function isCustomSoundId(id) {
  return typeof id === "string" && id.startsWith(CUSTOM_SOUND_PREFIX);
}

// An OfflineAudioContext decodes without needing a user gesture (a regular
// AudioContext may start suspended). decodeAudioData detaches the buffer it's
// given, so callers pass a copy when they still need the bytes.
function decodeAudio(arrayBuffer) {
  return new OfflineAudioContext(1, 1, 44100).decodeAudioData(arrayBuffer);
}

// Call once at startup, before timers read their saved alarm type, so a
// timer set to a registered sound still recognizes it. A sound that no
// longer decodes is skipped; if IndexedDB is unavailable there are simply
// no registered sounds.
export async function loadCustomSounds() {
  try {
    const records = await withStore(DB_NAME, STORE_NAME, "readonly", (store) => store.getAll());
    records.sort((a, b) => a.createdAt - b.createdAt);
    for (const record of records) {
      try {
        buffers.set(record.id, await decodeAudio(record.data.slice(0)));
        sounds.push({ id: record.id, label: record.label });
      } catch {
        // Undecodable - leave it out of the list.
      }
    }
  } catch {
    // No IndexedDB (e.g. blocked storage) - built-in sounds only.
  }
}

export function getCustomSounds() {
  return sounds;
}

export function getCustomSoundBuffer(id) {
  return buffers.get(id) ?? null;
}

// Throws an Error whose message is "too-large", "decode-failed" or
// "save-failed" so the caller can say what went wrong.
export async function addCustomSound(file) {
  if (file.size > MAX_CUSTOM_SOUND_BYTES) throw new Error("too-large");
  const data = await file.arrayBuffer();
  let buffer;
  try {
    buffer = await decodeAudio(data.slice(0));
  } catch {
    throw new Error("decode-failed");
  }
  const id = createAssetId(CUSTOM_SOUND_PREFIX);
  const label = assetLabelFromFile(file, "내 알람음");
  try {
    await withStore(DB_NAME, STORE_NAME, "readwrite", (store) => store.put({ id, label, data, createdAt: Date.now() }));
  } catch {
    throw new Error("save-failed");
  }
  buffers.set(id, buffer);
  sounds.push({ id, label });
  return { id, label };
}

export async function deleteCustomSound(id) {
  await withStore(DB_NAME, STORE_NAME, "readwrite", (store) => store.delete(id));
  buffers.delete(id);
  const index = sounds.findIndex((sound) => sound.id === id);
  if (index >= 0) sounds.splice(index, 1);
}
