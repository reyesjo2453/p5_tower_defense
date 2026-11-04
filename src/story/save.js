// Campaign progress in localStorage: the stage to continue from, the furthest stage reached (opens
// Rehearsal tiers), the performance counter (the Prompter never forgets, so it survives new games),
// which scenes were seen and which lessons were finished, and whether Jester's Persona has its name.
// Also: stars per stage (best), bonds bought in the Green Room, the Persona loadout, the Shadow
// types whose affinities are known, difficulty, the daily Rehearsal best and the player settings.
import { FIRST_PERFORMANCE } from './script.js';

const KEY = 'encore.save';

export function loadSave() {
  let s = null;
  try {
    s = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    s = null;
  }
  return {
    // { stage } (older saves stored a one-wave chapter checkpoint; those restart the story)
    cp: typeof s?.cp?.stage === 'number' ? { stage: s.cp.stage } : null,
    best: s?.best ?? 0,
    whole: !!s?.whole,
    perf: s?.perf ?? FIRST_PERFORMANCE,
    seen: s?.seen ?? [],
    lessons: s?.lessons ?? [],
    revealed: !!s?.revealed,
    finished: !!s?.finished,
    stars: s?.stars ?? {}, // stage id -> best stars (1..3)
    bonds: s?.bonds ?? {}, // unit -> 0..2
    loadout: s?.loadout ?? {}, // unit -> 'A' | 'B'
    known: s?.known ?? [],
    difficulty: s?.difficulty ?? 'normal',
    daily: s?.daily ?? null, // { day, stars }
    settings: { textSize: 1, colorblind: false, reduceMotion: false, speed: 1, ...(s?.settings ?? {}) },
  };
}

/** Stars earned minus stars spent in the Green Room. */
export function bondPoints(save, cost) {
  const earned = Object.values(save.stars).reduce((a, b) => a + b, 0);
  let spent = 0;
  for (const lvl of Object.values(save.bonds)) for (let i = 0; i < lvl; i++) spent += cost[i];
  return earned - spent;
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // private mode / storage blocked: progress just won't persist
  }
}
