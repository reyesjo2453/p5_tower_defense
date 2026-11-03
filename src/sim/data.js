// Game data: board layout, units, enemies, waves. Pure data, no rendering.

export const GRID = 11; // board is GRID x GRID tiles, 1 world unit each
export const CENTER = { x: 5, y: 5 };

// Two runways that spiral toward the Treasure in the centre (rotationally symmetric).
export const PATHS = {
  a: [[0, 2], [7, 2], [7, 5], [5, 5]],
  b: [[10, 8], [3, 8], [3, 5], [5, 5]],
};

// Five unique Phantoms: each can be on stage once. Depth comes from Rank-ups and Blocking (moving
// a unit to another plate), not from stacking copies.
export const UNITS = {
  jester: {
    id: 'jester', name: 'JESTER', role: 'Leader', cost: 50, rankCost: [60, 110],
    range: 1.85, interval: 0.55, dmg: 22, posture: 15,
    color: '#ffffff', accent: '#e8e8f0',
    blurb: 'Twin silver blades. Fast strikes; a 1-MORE engine.',
  },
  queen: {
    id: 'queen', name: 'QUEEN', role: 'Vanguard', cost: 70, rankCost: [80, 140],
    range: 1.55, interval: 0.85, dmg: 34, posture: 32, splash: 0.9,
    color: '#1b2a4a', accent: '#ff1a3d',
    blurb: 'Crimson knuckles. Heavy posture damage with splash.',
  },
  oracle: {
    id: 'oracle', name: 'ORACLE', role: 'Tactician', cost: 60, rankCost: [70, 120],
    range: 3.4, interval: 1.1, dmg: 12, posture: 6, mark: { t: 3, postureMul: 1.6, slow: 0.35 },
    color: '#39ff88', accent: '#39ff88',
    blurb: 'Drone pod. Long-range marks: slows and exposes posture.',
  },
  prompter: {
    id: 'prompter', name: 'PROMPTER', role: 'Support', cost: 55, rankCost: [65, 110],
    range: 2.2, interval: 1.0, dmg: 8, posture: 4,
    cue: { radius: 2.4, intervalMul: [0.85, 0.8, 0.74] }, // allies in the radius act faster
    heal: { every: [8, 6, 4.5], amount: 1 }, // patches the Treasure (seconds per HP, by rank)
    color: '#ffd400', accent: '#ffd400',
    blurb: 'Feeds lines from the prompt box: patches the Treasure and quickens nearby allies.',
  },
  limelight: {
    id: 'limelight', name: 'LIMELIGHT', role: 'Caster', cost: 80, rankCost: [90, 150],
    range: 2.5, interval: 1.35, dmg: 20, posture: 10, splash: 1.1, burn: { t: 3, dps: 9 },
    color: '#ff6a1a', accent: '#ff6a1a',
    blurb: 'Pyrotechnic star. Fire bursts that leave Shadows burning.',
  },
};

// Rank-ups ("rehearsals"): Rank 1 on deploy, up to Rank 3. Multipliers by rank index.
export const RANKS = {
  max: 3,
  dmgMul: [1, 1.5, 2.1],
  postureMul: [1, 1.35, 1.75],
  intervalMul: [1, 0.92, 0.84],
  range: [0, 0.2, 0.4],
};

export const ENEMIES = {
  mannequin: { id: 'mannequin', hp: 242, posture: 60, speed: 0.95, reward: 8, harm: 1, scale: 1 },
  runner: { id: 'runner', hp: 154, posture: 40, speed: 1.65, reward: 7, harm: 1, scale: 0.85 },
  brute: { id: 'brute', hp: 836, posture: 150, speed: 0.6, reward: 22, harm: 3, scale: 1.35 },
  boss: { id: 'boss', hp: 5720, posture: 420, speed: 0.42, reward: 150, harm: 10, scale: 2.1, boss: true },
};

const g = (type, count, gap, path, at = 0) => ({ type, count, gap, path, at });
// One wave per campaign chapter (see CAMPAIGN). Early chapters are short and slow so each new
// mechanic gets room to breathe; `at` delays a group's first spawn.
export const WAVES = [
  [g('mannequin', 5, 2.6, 'a')],
  [g('mannequin', 6, 2.0, 'a'), g('mannequin', 4, 2.4, 'b', 6)],
  [g('mannequin', 6, 1.8, 'a'), g('runner', 6, 1.4, 'b', 4)],
  [g('brute', 2, 7, 'a'), g('mannequin', 8, 1.5, 'b', 2), g('runner', 4, 1.2, 'a', 12)],
  [g('runner', 8, 0.9, 'a'), g('mannequin', 8, 1.3, 'b'), g('brute', 2, 6, 'b', 8)],
  [g('brute', 3, 4.5, 'b'), g('mannequin', 10, 1.1, 'a'), g('runner', 8, 0.8, 'b', 10)],
  [g('brute', 4, 3.6, 'a'), g('runner', 12, 0.7, 'b'), g('mannequin', 8, 1.0, 'a', 14)],
  [g('boss', 1, 1, 'a', 4), g('mannequin', 12, 1.2, 'b'), g('brute', 3, 6, 'a', 10), g('runner', 8, 0.8, 'b', 18)],
];

// Story chapters, one per wave: who joins the cast and which mechanic unlocks. Scenes and lessons
// for each chapter live in src/story/. Unlocks are cumulative.
export const CAMPAIGN = [
  { id: 'prologue', label: 'PROLOGUE', title: 'Places, Please', unlock: ['jester'], mech: ['onemore'] },
  { id: 'unscripted', label: 'SCENE I', title: 'Unscripted', unlock: ['queen'], mech: ['baton'] },
  { id: 'houselights', label: 'SCENE II', title: 'House Lights', unlock: ['oracle'], mech: ['mark'] },
  { id: 'promptbox', label: 'SCENE III', title: 'The Prompt Box', unlock: ['prompter'], mech: ['rank', 'blocking'] },
  { id: 'understudy', label: 'SCENE IV', title: 'Understudy', unlock: ['limelight'], mech: ['allout'] },
  { id: 'dress', label: 'SCENE V', title: 'Dress Rehearsal', unlock: [], mech: [] },
  { id: 'strike', label: 'SCENE VI', title: 'Strike the Set', unlock: [], mech: [] },
  { id: 'curtain', label: 'FINALE', title: 'Curtain Call', unlock: [], mech: [] },
];

export const ALL_MECHANICS = ['onemore', 'baton', 'mark', 'rank', 'blocking', 'allout'];

export const RULES = {
  startCash: 130,
  income: 3, // per second
  treasureHp: 20,
  downTime: 2.6, // seconds an enemy stays broken
  downDmgMul: 1.5,
  hitStop: 0.08, // posture-break freeze
  batonWindow: 3.5, // real seconds the Baton Pass prompt stays up (it runs on unscaled time)
  batonCooldown: 9, // per lane (runway): a fresh prompt from the same lane waits this long
  bulletTime: 0.25, // sim speed while a Baton Pass prompt is open
  bulletEase: 10, // 1/s: how fast the sim eases into / out of bullet-time
  baton: { t: 6, dmgMul: 1.5, postureMul: 1.5, intervalMul: 0.6 },
  allOutDowned: 3, // downed enemies needed (or a downed boss)
  allOutDmg: 520,
  allOutPct: 0.4, // + % of max HP to downed enemies
  allOutSplash: 90, // to everything else
  hpScale: [1, 1, 1.15, 1.35, 1.7, 2.1, 2.5, 2.6], // Shadow HP by chapter
  sellRefund: 0.5, // of everything spent on the unit (deploy + ranks)
  waveBreak: 5, // auto mode only; the campaign waits for the story between waves
  moveCd: 8, // Blocking: seconds before a moved unit can move again
  moveSettle: 0.6, // a moved unit needs this long to find its mark before it attacks
};
