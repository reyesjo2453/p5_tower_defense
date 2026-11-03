// Campaign progress in localStorage: the chapter checkpoint, the performance counter (the Prompter
// never forgets, so it survives new games), which scenes were seen and which lessons were finished.
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
    cp: s?.cp ?? null,
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
