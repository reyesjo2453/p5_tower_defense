// Campaign progress in localStorage: the stage to continue from, the furthest stage reached (opens
// Rehearsal tiers), the performance counter (the Prompter never forgets, so it survives new games),
// which scenes were seen and which lessons were finished, and whether Jester's Persona has its name.
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
  };
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // private mode / storage blocked: progress just won't persist
  }
}
