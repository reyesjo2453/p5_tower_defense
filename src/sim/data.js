// Game data: board layout, units, enemies, waves. Pure data, no rendering.

export const GRID = 11; // board is GRID x GRID tiles, 1 world unit each
export const CENTER = { x: 5, y: 5 };

// The classic board: two runways that spiral toward the Treasure (campaign stages are generated).
export const PATHS = {
  a: [[0, 2], [7, 2], [7, 5], [5, 5]],
  b: [[10, 8], [3, 8], [3, 5], [5, 5]],
};

// Five unique Phantoms: each can be on stage once. Depth comes from Rank-ups and Blocking (moving
// a unit to another plate), not from stacking copies.
export const UNITS = {
  jester: {
    id: 'jester', name: 'JESTER', elem: 'slash', role: 'Leader', cost: 50, rankCost: [60, 110],
    range: 1.85, interval: 0.55, dmg: 22, posture: 15,
    color: '#ffffff', accent: '#e8e8f0',
    blurb: 'Twin silver blades. Fast strikes; a 1-MORE engine.',
    persona: { id: 'noone', name: 'NO ONE', whole: 'HARLEQUIN', skill: 'CURTAIN WIND', cost: 30, radius: 1.6, push: 2.6, pushWhole: 3.6, posture: 25, blurb: 'Blows every Shadow in the circle back down the runway.' },
    personaAlt: { kind: 'mirrorstep', skill: 'MIRROR STEP', cost: 35, radius: 2.4, posture: 45, blurb: 'A wide feint: every Shadow in the circle loses a chunk of posture.' },
  },
  queen: {
    id: 'queen', name: 'QUEEN', elem: 'strike', role: 'Vanguard', cost: 70, rankCost: [80, 140],
    range: 1.55, interval: 0.85, dmg: 34, posture: 32, splash: 0.9,
    color: '#1b2a4a', accent: '#ff1a3d',
    blurb: 'Crimson knuckles. Heavy posture damage with splash.',
    persona: { id: 'verdict', name: 'VERDICT', skill: 'GAVEL DROP', cost: 40, radius: 1.5, stun: 2.6, dmg: 60, posture: 45, blurb: 'Stuns everything in the circle and cracks its posture.' },
    personaAlt: { kind: 'objection', skill: 'OBJECTION', cost: 45, radius: 1.8, dmg: 220, posture: 80, blurb: 'One crushing blow to the toughest Shadow in the circle.' },
  },
  oracle: {
    id: 'oracle', name: 'ORACLE', elem: 'tech', role: 'Tactician', cost: 60, rankCost: [70, 120],
    range: 3.4, interval: 1.1, dmg: 12, posture: 6, mark: { t: 3, postureMul: 1.6, slow: 0.35 },
    color: '#39ff88', accent: '#39ff88',
    blurb: 'Drone pod. Long-range marks: slows and exposes posture.',
    persona: { id: 'sightline', name: 'SIGHTLINE', skill: 'SPOTLIGHT', cost: 30, radius: 2.6, mark: 7, blurb: 'Marks every Shadow in a wide circle: slowed, and easy to break.' },
    personaAlt: { kind: 'overclock', skill: 'OVERCLOCK', cost: 35, radius: 99, t: 6, intervalMul: 0.6, blurb: 'Every Phantom on stage attacks much faster for 6 s.' },
  },
  prompter: {
    id: 'prompter', name: 'PROMPTER', elem: 'light', role: 'Support', cost: 55, rankCost: [65, 110],
    range: 2.2, interval: 1.0, dmg: 8, posture: 4,
    cue: { radius: 2.4, intervalMul: [0.85, 0.8, 0.74] }, // allies in the radius act faster
    heal: { every: [8, 6, 4.5], amount: 1 }, // patches the Treasure (seconds per HP, by rank)
    color: '#ffd400', accent: '#ffd400',
    blurb: 'Feeds lines from the prompt box: patches the Treasure and quickens nearby allies.',
    persona: { id: 'ghostlight', name: 'GHOSTLIGHT', skill: 'GHOST LIGHT', cost: 45, radius: 1.8, heal: 3, ward: 3, slow: 4, blurb: 'Patches the Treasure, wards it against the next 3 hits and slows the circle.' },
    personaAlt: { kind: 'cuelight', skill: 'CUE LIGHT', cost: 40, radius: 2.4, t: 6, blurb: 'Phantoms inside the circle get a free Baton Pass buff.' },
  },
  limelight: {
    id: 'limelight', name: 'LIMELIGHT', elem: 'fire', role: 'Caster', cost: 80, rankCost: [90, 150],
    range: 2.5, interval: 1.35, dmg: 20, posture: 10, splash: 1.1, burn: { t: 3, dps: 9 },
    color: '#ff6a1a', accent: '#ff6a1a',
    blurb: 'Pyrotechnic star. Fire bursts that leave Shadows burning.',
    persona: { id: 'flashpaper', name: 'FLASHPAPER', skill: 'WALL OF FIRE', cost: 40, radius: 1.3, zone: 5, dps: 26, slow: 0.35, blurb: 'Leaves a ring of fire that burns and slows anything crossing it.' },
    personaAlt: { kind: 'flare', skill: 'FINALE FLARE', cost: 45, radius: 1.6, dmg: 130, blurb: 'An instant blast of fire that sets the whole circle burning.' },
  },
};

// Bonds (the Green Room, between stages): stars earned on stages are spent on short scenes with a
// cast member. Bond 1 unlocks their perk, bond 2 their second Persona skill (personaAlt; pick it in
// the loadout before a stage).
export const BONDS = {
  jester: { perk: { id: 'encore', name: 'ENCORE', blurb: 'Jester\'s own posture breaks give +4 SP.' } },
  queen: { perk: { id: 'veteran', name: 'VETERAN', blurb: 'Queen deploys at Rank 2.' } },
  oracle: { perk: { id: 'longscan', name: 'LONG SCAN', blurb: 'Oracle\'s marks last 2 s longer.' } },
  prompter: { perk: { id: 'understudy', name: 'SAFETY NET', blurb: 'The Treasure has 3 more HP.' } },
  limelight: { perk: { id: 'pyro', name: 'PYROTECHNICS', blurb: 'Limelight\'s burns deal 50% more damage.' } },
};
export const BOND_COST = [2, 4]; // stars for bond 1 and bond 2

// Rank-ups ("rehearsals"): Rank 1 on deploy, up to Rank 3. Multipliers by rank index.
export const RANKS = {
  max: 3,
  dmgMul: [1, 1.5, 2.1],
  postureMul: [1, 1.35, 1.75],
  intervalMul: [1, 0.92, 0.84],
  range: [0, 0.2, 0.4],
};

// Elements (Persona-style affinities). A weak hit deals 1.5x damage and 2x posture damage and
// shows WEAK!; a resisted one deals half. Affinities show over a Shadow once they are known: Oracle
// marking that kind of Shadow, SIGHTLINE, or landing a weak hit reveals them (and the save keeps them).
export const ELEMENTS = {
  slash: { name: 'SLASH', icon: '⚔', color: '#ffffff' },
  strike: { name: 'STRIKE', icon: '✊', color: '#ff1a3d' },
  tech: { name: 'TECH', icon: '⚡', color: '#39ff88' },
  light: { name: 'LIGHT', icon: '✦', color: '#ffd400' },
  fire: { name: 'FIRE', icon: '🔥', color: '#ff6a1a' },
};
export const AFFINITY = { weakDmg: 1.5, weakPosture: 2, resist: 0.5 };

// Shadows. shield: weak hits it needs to strip before posture really moves (until then posture
// damage is cut to 20% and damage to 60%); heal: a stagehand patches nearby Shadows; split: spawns
// smaller Shadows on death; review: the Reviewer slows Phantoms near it; miniboss / boss: a big
// health bar and a named entrance; phases: the Impresario changes the scene at these HP fractions.
export const ENEMIES = {
  mannequin: { id: 'mannequin', name: 'MANNEQUIN', hp: 242, posture: 60, speed: 0.95, reward: 8, harm: 1, scale: 1, weak: ['slash'], resist: [] },
  runner: { id: 'runner', name: 'RUNNER', hp: 154, posture: 40, speed: 1.65, reward: 7, harm: 1, scale: 0.85, weak: ['tech'], resist: ['strike'] },
  brute: { id: 'brute', name: 'BRUTE', hp: 836, posture: 150, speed: 0.6, reward: 22, harm: 3, scale: 1.35, weak: ['fire'], resist: ['slash'] },
  bouncer: { id: 'bouncer', name: 'BOUNCER', hp: 380, posture: 90, speed: 0.8, reward: 12, harm: 2, scale: 1.15, weak: ['strike'], resist: [], shield: 3 },
  stagehand: { id: 'stagehand', name: 'STAGEHAND', hp: 190, posture: 40, speed: 1.0, reward: 10, harm: 1, scale: 0.9, weak: ['tech'], resist: [], heal: { every: 3, radius: 1.8, pct: 0.08 } },
  doppel: { id: 'doppel', name: 'DOPPEL', hp: 300, posture: 55, speed: 0.9, reward: 9, harm: 1, scale: 1.05, weak: ['fire'], resist: [], split: { into: 'runner', n: 2 } },
  critic: { id: 'critic', name: 'CRITIC', hp: 170, posture: 45, speed: 1.9, reward: 9, harm: 2, scale: 0.85, weak: ['light'], resist: ['tech'] },
  usher: { id: 'usher', name: 'THE USHER', hp: 2600, posture: 260, speed: 0.5, reward: 80, harm: 6, scale: 1.7, weak: ['strike'], resist: ['fire'], shield: 6, miniboss: true },
  reviewer: { id: 'reviewer', name: 'THE REVIEWER', hp: 3600, posture: 320, speed: 0.5, reward: 100, harm: 6, scale: 1.8, weak: ['light'], resist: ['slash'], miniboss: true, review: { every: 6, radius: 2.4, t: 3, intervalMul: 1.5 } },
  boss: { id: 'boss', name: 'THE IMPRESARIO', hp: 5720, posture: 420, speed: 0.42, reward: 150, harm: 10, scale: 2.1, boss: true, weak: ['light'], resist: [], phases: [0.66, 0.33] },
};

const g = (type, count, gap, path, at = 0) => ({ type, count, gap, path, at });
// The classic eight-wave show on the two-lane PATHS board (tests and `?map=classic`); campaign and
// Rehearsal stages compose their waves with stagegen.composeWaves. `at` delays a group's first spawn.
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

// The story campaign: fifteen stages in three acts. Each stage is its own procedurally generated
// map (pinned seed, see stagegen.js), 3-5 waves, and introduces at most one new thing: who joins
// the cast (unlock) and which mechanic opens (mech). Unlocks are cumulative. Scenes and lessons
// for each stage live in src/story/.
//   stage: { seed, lanes, tier }   map generator input (tier 1 = long gentle runways ... 5 = short)
//   waves: { count, power, growth, mix, pace, boss }   composeWaves input
//   cash: starting ¥ (later stages hand you enough to field most of the cast up front)
//   hp: Shadow HP multiplier for the whole stage
export const CAMPAIGN = [
  // ACT I · OPENING NIGHT: one lane, Jester alone, then a partner
  { id: 'prologue', label: 'PROLOGUE', title: 'Places, Please', unlock: ['jester'], mech: ['onemore'],
    stage: { seed: 11, lanes: 1, tier: 1 }, cash: 130, hp: 0.8, waves: { count: 3, power: 4, growth: 0.35, mix: ['mannequin'], pace: 1.35 } },
  { id: 'opening', label: 'SCENE I', title: 'Opening Night', unlock: [], mech: ['rank'],
    stage: { seed: 23, lanes: 1, tier: 1 }, cash: 130, hp: 0.9, waves: { count: 3, power: 5, growth: 0.4, mix: ['mannequin', 'runner'], pace: 1.25 } },
  { id: 'noone', label: 'SCENE II', title: 'No One', unlock: [], mech: ['summon'],
    stage: { seed: 37, lanes: 1, tier: 2 }, cash: 130, hp: 1, waves: { count: 4, power: 6, growth: 0.35, mix: ['mannequin', 'runner'], pace: 1.1 } },
  { id: 'unscripted', label: 'SCENE III', title: 'Unscripted', unlock: ['queen'], mech: ['baton'],
    stage: { seed: 41, lanes: 1, tier: 2 }, cash: 160, hp: 1, waves: { count: 4, power: 7, growth: 0.35, mix: ['mannequin', 'runner', 'brute'], pace: 1.05 } },
  { id: 'twodoors', label: 'SCENE IV', title: 'Two Doors', unlock: [], mech: [],
    stage: { seed: 53, lanes: 2, tier: 2 }, cash: 170, hp: 1, waves: { count: 4, power: 6, growth: 0.35, mix: ['mannequin', 'runner'], pace: 1.2, miniboss: 'usher' } },
  // ACT II · INTERMISSION: two lanes, the cast fills out, the loop is revealed
  { id: 'houselights', label: 'SCENE V', title: 'House Lights', unlock: ['oracle'], mech: ['mark'],
    stage: { seed: 67, lanes: 2, tier: 3 }, cash: 210, hp: 1.1, waves: { count: 4, power: 9, growth: 0.35, mix: ['mannequin', 'runner', 'brute', 'bouncer'], pace: 1.05 } },
  { id: 'crosstalk', label: 'SCENE VI', title: 'Crosstalk', unlock: [], mech: [],
    stage: { seed: 71, lanes: 2, tier: 3 }, cash: 230, hp: 1.2, waves: { count: 4, power: 10, growth: 0.35, mix: ['mannequin', 'runner', 'stagehand', 'bouncer'], pace: 1 } },
  { id: 'promptbox', label: 'SCENE VII', title: 'The Prompt Box', unlock: ['prompter'], mech: [],
    stage: { seed: 83, lanes: 2, tier: 3 }, cash: 270, hp: 1.3, waves: { count: 4, power: 13, growth: 0.4, mix: ['mannequin', 'critic', 'brute', 'stagehand'], pace: 1 } },
  { id: 'greenroom', label: 'SCENE VIII', title: 'The Green Room', unlock: [], mech: [],
    stage: { seed: 97, lanes: 2, tier: 4 }, cash: 290, hp: 1.4, waves: { count: 4, power: 15, growth: 0.4, mix: ['mannequin', 'doppel', 'brute', 'critic'], pace: 0.95 } },
  { id: 'understudy', label: 'SCENE IX', title: 'Understudy', unlock: ['limelight'], mech: ['allout'],
    stage: { seed: 101, lanes: 2, tier: 4 }, cash: 350, hp: 1.5, waves: { count: 5, power: 16, growth: 0.35, mix: ['mannequin', 'runner', 'brute', 'bouncer', 'doppel'], pace: 0.95, miniboss: 'reviewer' } },
  // ACT III · CURTAIN CALL: the twists, three lanes, the finale
  { id: 'dress', label: 'SCENE X', title: 'Dress Rehearsal', unlock: [], mech: ['blocking'],
    stage: { seed: 113, lanes: 2, tier: 4 }, cash: 360, hp: 1.7, waves: { count: 4, power: 17, growth: 0.4, mix: ['mannequin', 'critic', 'brute', 'stagehand', 'bouncer'], pace: 0.9 } },
  { id: 'strike', label: 'SCENE XI', title: 'Strike the Set', unlock: [], mech: [],
    stage: { seed: 127, lanes: 2, tier: 5 }, cash: 370, hp: 1.85, waves: { count: 5, power: 18, growth: 0.35, mix: ['mannequin', 'brute', 'doppel', 'critic', 'stagehand'], pace: 0.9 } },
  { id: 'room312', label: 'SCENE XII', title: 'Room 312', unlock: [], mech: [],
    stage: { seed: 131, lanes: 3, tier: 4 }, cash: 380, hp: 1.9, waves: { count: 5, power: 17, growth: 0.35, mix: ['mannequin', 'runner', 'brute', 'bouncer', 'critic', 'doppel'], pace: 0.9 } },
  { id: 'musicbox', label: 'SCENE XIII', title: 'The Music Box', unlock: [], mech: [],
    stage: { seed: 149, lanes: 3, tier: 5 }, cash: 390, hp: 2, waves: { count: 5, power: 14, growth: 0.35, mix: ['runner', 'mannequin', 'brute', 'stagehand', 'doppel', 'critic'], pace: 0.85 } },
  { id: 'curtain', label: 'FINALE', title: 'Curtain Call', unlock: [], mech: [],
    stage: { seed: 151, lanes: 3, tier: 5 }, cash: 400, hp: 1.8, waves: { count: 5, power: 11, growth: 0.3, mix: ['mannequin', 'brute', 'runner', 'bouncer', 'critic'], pace: 0.85, boss: true } },
];

export const ALL_MECHANICS = ['onemore', 'rank', 'summon', 'baton', 'mark', 'allout', 'blocking'];

// Rehearsal mode (procedural side stages): lanes and Shadow HP by tier 1..5.
// Daily Rehearsal: one seed per calendar day for everyone, with two of these modifiers.
export const MODIFIERS = {
  rush: { name: 'RUSH', blurb: 'Waves come 25% denser.', pace: 0.75 },
  heavy: { name: 'HEAVY SET', blurb: 'Shadows have 25% more HP.', hp: 1.25 },
  glass: { name: 'GLASS CROWN', blurb: 'The Treasure has 10 HP, but you start with 50% more ¥.', treasureHp: 10, cash: 1.5 },
  noranks: { name: 'NO REHEARSALS', blurb: 'Rank-ups are off.', noMech: 'rank' },
  blind: { name: 'HOUSE LIGHTS DOWN', blurb: 'Weaknesses stay hidden.', blind: true },
  swarm: { name: 'SWARM', blurb: 'Runners and critics everywhere.', mix: ['runner', 'critic', 'mannequin'] },
};

export const REHEARSAL = {
  lanes: [0, 1, 2, 2, 3, 3],
  hp: [0, 1, 1.3, 1.6, 1.9, 2.2],
  waves: [0, { count: 4, power: 5 }, { count: 5, power: 7 }, { count: 5, power: 9 }, { count: 5, power: 10 }, { count: 6, power: 12 }],
};

// Difficulty modes: Story is for the plot, Hard for people who want a fight.
export const DIFFICULTY = {
  story: { name: 'STORY', hp: 0.7, treasureHp: 30, cash: 1.3 },
  normal: { name: 'NORMAL', hp: 1, treasureHp: 20, cash: 1 },
  hard: { name: 'HARD', hp: 1.3, treasureHp: 15, cash: 0.9 },
};

// Stage rating by the share of the Treasure left: 3 stars untouched-ish, 2 stars over half, else 1.
export const STARS = [0.9, 0.5];

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
  baton: { t: 6, dmgMul: 1.5, postureMul: 1.5, intervalMul: 0.6, chainCap: 5 }, // +10% damage per chain link, up to the cap
  allOutDmg: 520, // the All-Out Attack is the full-SP ultimate
  allOutPct: 0.4, // + % of max HP to downed enemies
  allOutSplash: 90, // to everything else
  hpScale: [1, 1, 1.15, 1.35, 1.7, 2.1, 2.5, 2.6], // classic 8-wave show: Shadow HP by wave
  sellRefund: 0.5, // of everything spent on the unit (deploy + ranks)
  waveBreak: 6, // seconds between the waves of a stage (CALL skips the wait)
  spMax: 100, // shared SP gauge for Persona summons; a full gauge is the All-Out Attack
  spBreak: 6, // SP per posture break
  spKill: 1, // SP per Shadow sent home
  summonSlow: 0.25, // bullet-time while the player aims a Persona
  moveCd: 8, // Blocking: seconds before a moved unit can move again
  moveSettle: 0.6, // a moved unit needs this long to find its mark before it attacks
  bossSpSteal: 40, // the Impresario's last act takes this much SP
};
