// Shared Web Audio context + persisted mixer settings. BGM and SFX each own a separate gain bus
// (bgmManager.js / sfxManager.js) that feeds the destination directly, so their levels never mix.
// The context is created lazily and only resumed on a user gesture (browser autoplay rules).

const KEY = 'encore.audio';
const DEFAULTS = { muted: false, bgm: 0.55, sfx: 0.8 };

let ctx = null;

/** The AudioContext, or null when Web Audio is unavailable. */
export function audioContext() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC({ latencyHint: 'interactive' });
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Persisted { muted, bgm, sfx } (volumes 0..1). Storage failures fall back to defaults. */
export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      muted: typeof s.muted === 'boolean' ? s.muted : DEFAULTS.muted,
      bgm: clamp01(s.bgm, DEFAULTS.bgm),
      sfx: clamp01(s.sfx, DEFAULTS.sfx),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ muted: !!s.muted, bgm: s.bgm, sfx: s.sfx }));
  } catch { /* private mode / blocked storage: settings just don't persist */ }
}

function clamp01(v, d) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d;
}

/** Shared white-noise buffer (1 s) for drums and whooshes. */
let noise = null;
export function noiseBuffer(c) {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = noise.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    d[i] = seed / 2147483648 - 1;
  }
  return noise;
}

/** MIDI note -> Hz. */
export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
