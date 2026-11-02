// Persistent save data (localStorage with an in-memory fallback).
const KEY = 'encore-protocol-save-v1';

const DEFAULTS = () => ({
  version: 1,
  started: false,
  cleared: {}, // stageId -> { stars, best }
  seen: {}, // sceneId -> true
  squad: ['joker', 'skull', 'panther', 'mona'],
  settings: {
    music: 0.6,
    sfx: 0.8,
    textSpeed: 45, // characters per second
    screenShake: true,
    reduceFlash: false,
    autoAdvance: false,
  },
});

let memory = null;

function read() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage blocked */ }
  return null;
}

export function loadSave() {
  if (memory) return memory;
  const d = DEFAULTS();
  const stored = read();
  memory = stored
    ? { ...d, ...stored, settings: { ...d.settings, ...(stored.settings || {}) } }
    : d;
  return memory;
}

export function persist() {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(loadSave()));
  } catch { /* ignore */ }
}

export function resetSave() {
  memory = DEFAULTS();
  persist();
  return memory;
}
