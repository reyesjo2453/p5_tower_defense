// Builds the Game for a story stage, a Rehearsal (procedural side stage) or the classic show.
// Pure: the view and the tests use the same builders.
import { Game } from './game.js';
import { CAMPAIGN, REHEARSAL, RULES, WAVES } from './data.js';
import { generateStage, composeWaves } from './stagegen.js';

/** The generated map + waves for campaign stage `i` (deterministic: the seed is pinned). */
export function stageSpec(i) {
  const ch = CAMPAIGN[i];
  const stage = generateStage(ch.stage);
  const lanes = Object.keys(stage.paths);
  const waves = composeWaves({ seed: ch.stage.seed, lanes, ...ch.waves });
  return { stage, waves, hp: ch.hp, cash: ch.cash };
}

/** A Game for campaign stage `i`. opts.personaWhole: Jester's Persona has its name back. */
export function campaignGame(i, opts = {}) {
  const { stage, waves, hp, cash } = stageSpec(i);
  return new Game({ ...opts, rules: { startCash: cash, ...opts.rules }, stage, waves, hp, chapter: i });
}

/**
 * A Rehearsal: a fresh procedural stage at `tier` 1..5. The cast and mechanics are whatever the
 * story has unlocked by stage `chapter` (or everything with unlockAll).
 */
export function rehearsalGame({ tier = 1, seed = 1, chapter = 0, unlockAll = false, personaWhole = false } = {}) {
  const t = Math.max(1, Math.min(5, tier));
  const stage = generateStage({ seed, lanes: REHEARSAL.lanes[t], tier: t });
  const lanes = Object.keys(stage.paths);
  const w = REHEARSAL.waves[t];
  const mix = t === 1 ? ['mannequin', 'runner'] : ['mannequin', 'runner', 'brute'];
  const waves = composeWaves({ seed, lanes, count: w.count, power: w.power, growth: 0.35, mix, pace: 1.15 - t * 0.06, boss: t === 5 });
  return new Game({ stage, waves, hp: REHEARSAL.hp[t], chapter, unlockAll, personaWhole });
}

/** The classic eight-wave show on the original two-lane board. */
export function classicGame(opts = {}) {
  return new Game({ ...opts, waves: WAVES, hpRamp: RULES.hpScale });
}
