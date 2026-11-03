// Game data: board layout, units, enemies, waves. Pure data, no rendering.

export const GRID = 11; // board is GRID x GRID tiles, 1 world unit each
export const CENTER = { x: 5, y: 5 };

// Two runways that spiral toward the Treasure in the centre (rotationally symmetric).
export const PATHS = {
  a: [[0, 2], [7, 2], [7, 5], [5, 5]],
  b: [[10, 8], [3, 8], [3, 5], [5, 5]],
};

export const UNITS = {
  jester: {
    id: 'jester', name: 'JESTER', role: 'Leader', cost: 50,
    range: 1.85, interval: 0.55, dmg: 22, posture: 15,
    color: '#ffffff', accent: '#e8e8f0',
    blurb: 'Twin silver blades. Fast strikes; a 1-MORE engine.',
  },
  queen: {
    id: 'queen', name: 'QUEEN', role: 'Vanguard', cost: 70,
    range: 1.55, interval: 0.85, dmg: 34, posture: 32, splash: 0.9,
    color: '#1b2a4a', accent: '#ff1a3d',
    blurb: 'Crimson knuckles. Heavy posture damage with splash.',
  },
  oracle: {
    id: 'oracle', name: 'ORACLE', role: 'Tactician', cost: 60,
    range: 3.4, interval: 1.1, dmg: 12, posture: 6, mark: { t: 3, postureMul: 1.6, slow: 0.35 },
    color: '#39ff88', accent: '#39ff88',
    blurb: 'Drone pod. Long-range marks: slows and exposes posture.',
  },
};

export const ENEMIES = {
  mannequin: { id: 'mannequin', hp: 242, posture: 60, speed: 0.95, reward: 8, harm: 1, scale: 1 },
  runner: { id: 'runner', hp: 154, posture: 40, speed: 1.65, reward: 7, harm: 1, scale: 0.85 },
  brute: { id: 'brute', hp: 836, posture: 150, speed: 0.6, reward: 22, harm: 3, scale: 1.35 },
  boss: { id: 'boss', hp: 5720, posture: 420, speed: 0.42, reward: 150, harm: 10, scale: 2.1, boss: true },
};

const g = (type, count, gap, path) => ({ type, count, gap, path });
export const WAVES = [
  [g('mannequin', 6, 1.4, 'a')],
  [g('mannequin', 5, 1.2, 'a'), g('mannequin', 5, 1.2, 'b')],
  [g('runner', 8, 0.8, 'b'), g('mannequin', 4, 1.4, 'a')],
  [g('brute', 2, 3.5, 'a'), g('mannequin', 8, 1.0, 'b')],
  [g('runner', 10, 0.6, 'a'), g('runner', 10, 0.6, 'b')],
  [g('brute', 3, 2.6, 'b'), g('mannequin', 10, 0.9, 'a')],
  [g('brute', 4, 2.2, 'a'), g('runner', 12, 0.55, 'b')],
  [g('boss', 1, 1, 'a'), g('mannequin', 12, 1.1, 'b'), g('brute', 2, 5, 'a')],
];

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
  sellRefund: 0.5,
  waveBreak: 5,
};
