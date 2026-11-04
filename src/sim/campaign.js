// Builds the Game for a story stage, a Rehearsal (procedural side stage) or the classic show.
// Pure: the view and the tests use the same builders.
import { Game } from './game.js';
import { CAMPAIGN, REHEARSAL, RULES, WAVES, MODIFIERS } from './data.js';
import { generateStage, composeWaves, rng } from './stagegen.js';

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
 * story has unlocked by stage `chapter` (or everything with unlockAll). `modifiers` (ids from
 * MODIFIERS) bend the rules; `extra` passes player options (difficulty, bonds, loadout, known).
 */
export function rehearsalGame({ tier = 1, seed = 1, chapter = 0, unlockAll = false, personaWhole = false, modifiers = [], ...extra } = {}) {
  const t = Math.max(1, Math.min(5, tier));
  const stage = generateStage({ seed, lanes: REHEARSAL.lanes[t], tier: t });
  const lanes = Object.keys(stage.paths);
  const w = REHEARSAL.waves[t];
  const mods = modifiers.map((m) => MODIFIERS[m]).filter(Boolean);
  // the Shadows you have met in the story by `chapter` (everything once unlockAll)
  const met = unlockAll ? ['mannequin', 'runner', 'brute', 'bouncer', 'stagehand', 'doppel', 'critic'] : metBy(chapter);
  let mix = t === 1 ? met.filter((x) => x === 'mannequin' || x === 'runner') : met;
  for (const m of mods) if (m.mix) mix = m.mix;
  const pace = (1.15 - t * 0.06) * mods.reduce((k, m) => k * (m.pace ?? 1), 1);
  const waves = composeWaves({ seed, lanes, count: w.count, power: w.power, growth: 0.35, mix, pace, boss: t === 5 });
  const hp = REHEARSAL.hp[t] * mods.reduce((k, m) => k * (m.hp ?? 1), 1);
  const rules = {};
  for (const m of mods) {
    if (m.treasureHp) rules.treasureHp = m.treasureHp;
    if (m.cash) rules.startCash = Math.round(RULES.startCash * m.cash);
  }
  return new Game({
    ...extra, rules, stage, waves, hp, chapter, unlockAll, personaWhole,
    blind: mods.some((m) => m.blind), noMech: mods.find((m) => m.noMech)?.noMech ?? null,
  });
}

/** Shadow types that have appeared in the story up to stage `chapter`. */
export function metBy(chapter) {
  const out = new Set(['mannequin']);
  for (let i = 0; i <= Math.min(chapter, CAMPAIGN.length - 1); i++) for (const t of CAMPAIGN[i].waves.mix) out.add(t);
  return [...out];
}

/** Today's Rehearsal: the same seed, tier and two modifiers for everyone on a calendar day. */
export function dailySpec(date = new Date()) {
  const day = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const R = rng(day);
  const ids = Object.keys(MODIFIERS);
  const a = ids[Math.floor(R() * ids.length)];
  let b = ids[Math.floor(R() * ids.length)];
  if (b === a) b = ids[(ids.indexOf(a) + 1) % ids.length];
  return { day, seed: day % 99991, tier: 2 + Math.floor(R() * 3), modifiers: [a, b] };
}

/** The classic eight-wave show on the original two-lane board. */
export function classicGame(opts = {}) {
  return new Game({ ...opts, waves: WAVES, hpRamp: RULES.hpScale });
}
