// Chapter 1 stages. Maps are generated from enemy routes:
//   p = path tile (melee operators; enemies walk here)   h = high ground (ranged operators)
//   # = blocked                                          S/E = spawn / goal (also path tiles)
export const TILE_PATH = 'p';
export const TILE_HIGH = 'h';

/** Expand corner waypoints into every tile along the route. */
export function expandRoute(corners) {
  const tiles = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[i + 1];
    const sx = Math.sign(bx - ax);
    const sy = Math.sign(by - ay);
    let x = ax;
    let y = ay;
    tiles.push([x, y]);
    while (x !== bx || y !== by) {
      x += sx;
      y += sy;
      tiles.push([x, y]);
    }
  }
  return tiles;
}

export function buildMap(cols, rows, routes, { high = [], walls = [] } = {}) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill('#'));
  const pathSet = new Set();
  for (const corners of Object.values(routes)) {
    for (const [x, y] of expandRoute(corners)) {
      grid[y][x] = 'p';
      pathSet.add(`${x},${y}`);
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 'p') continue;
      let near = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) if (pathSet.has(`${x + dx},${y + dy}`)) near = true;
      }
      if (near) grid[y][x] = 'h';
    }
  }
  for (const [x, y] of high) grid[y][x] = 'h';
  for (const [x, y] of walls) grid[y][x] = '#';
  const firstRoute = Object.values(routes)[0];
  const lastCorners = firstRoute[firstRoute.length - 1];
  for (const corners of Object.values(routes)) {
    const [sx, sy] = corners[0];
    grid[sy][sx] = 'S';
  }
  grid[lastCorners[1]][lastCorners[0]] = 'E';
  return grid.map((r) => r.join(''));
}

const w = (at, enemy, count, gap, route = 'a') => ({ at, enemy, count, gap, route });

const R11 = { a: [[0, 2], [4, 2], [4, 4], [9, 4], [9, 1], [15, 1]] };
const R12 = {
  a: [[0, 0], [7, 0], [7, 3], [15, 3]],
  b: [[0, 5], [7, 5], [7, 3], [15, 3]],
};
const R13 = { a: [[0, 5], [3, 5], [3, 1], [7, 1], [7, 4], [11, 4], [11, 1], [15, 1]] };

export const STAGES = [
  {
    id: '1-1', chapter: 1, name: 'Last Train Loop', subtitle: 'Platform 0 · Shibuya line',
    cols: 16, rows: 6, routes: R11, map: buildMap(16, 6, R11),
    startDp: 14, lives: 3, music: 'battle', theme: 'loop',
    waves: [
      w(4, 'shade', 3, 3),
      w(26, 'shade', 4, 2.5),
      w(46, 'hound', 3, 1.6), w(48, 'shade', 3, 2.2),
      w(70, 'shade', 5, 2), w(76, 'hound', 4, 1.2),
      w(100, 'shade', 6, 1.6), w(104, 'hound', 4, 1.1),
    ],
    tips: [
      { at: 1, text: 'Tap an operator card, tap a green tile, then drag to pick which way they face.' },
      { at: 14, text: 'Melee operators (Joker, Skull) go on the path and BLOCK enemies. Ranged ones go on high ground.' },
      { at: 34, text: 'Hit an Echo with its weakness (shown on its card) to fill its Stagger bar. A full bar means DOWN!' },
      { at: 60, text: 'Skills charge up. When SP is full, select the operator and press SKILL. Watch the Rush gauge too.' },
    ],
    triggers: [{ on: 'time', t: 9, scene: '1-1.mid' }],
    scenes: { pre: '1-1.pre', post: '1-1.post' },
    recommended: ['joker', 'skull', 'panther', 'mona'],
  },
  {
    id: '1-2', chapter: 1, name: 'Static Between Stations', subtitle: 'Service tunnel · Same four bars',
    cols: 16, rows: 6, routes: R12, map: buildMap(16, 6, R12),
    startDp: 14, lives: 3, music: 'battle', theme: 'static',
    waves: [
      w(4, 'shade', 3, 2.5, 'a'), w(6, 'shade', 3, 2.5, 'b'),
      w(30, 'hound', 4, 1.4, 'a'), w(32, 'hound', 4, 1.4, 'b'),
      w(54, 'seer', 2, 5, 'a'), w(56, 'seer', 2, 5, 'b'), w(58, 'shade', 4, 2, 'a'),
      w(84, 'bulwark', 1, 1, 'a'), w(90, 'shade', 4, 1.6, 'b'), w(96, 'hound', 4, 1.1, 'a'),
      w(118, 'bulwark', 1, 1, 'b'), w(122, 'seer', 2, 4, 'a'), w(124, 'shade', 5, 1.5, 'b'), w(128, 'hound', 5, 1.0, 'a'),
    ],
    tips: [
      { at: 2, text: 'Two routes merge into one. The long corridor before the goal is your kill zone.' },
      { at: 50, text: 'Mute Seers attack from range and resist magic. Use guns and physical hits.' },
      { at: 82, text: 'Walls of Sound resist physical hits. Lightning and Nuke shatter them.' },
    ],
    triggers: [{ on: 'kills', n: 10, scene: '1-2.mid' }, { on: 'kills', n: 28, scene: '1-2.mid2' }],
    scenes: { pre: '1-2.pre', post: '1-2.post' },
    recommended: ['joker', 'skull', 'panther', 'mona', 'fox', 'noir'],
  },
  {
    id: '1-3', chapter: 1, name: 'Overture of Regret', subtitle: 'Encore Theatre · Palace of the Maestro',
    cols: 16, rows: 6, routes: R13, map: buildMap(16, 6, R13),
    startDp: 20, lives: 3, music: 'boss', theme: 'palace',
    waves: [
      w(4, 'shade', 4, 2), w(24, 'hound', 5, 1.2), w(30, 'seer', 1, 4),
      w(52, 'bulwark', 1, 6), w(56, 'shade', 5, 1.6),
      w(84, 'conductor', 1, 1),
      w(124, 'hound', 5, 1), w(130, 'seer', 2, 5),
      w(165, 'maestro', 1, 1),
    ],
    tips: [
      { at: 3, text: 'The Maestro is weak to Bless and Psy. Save big skills and the Rush gauge for him.' },
      { at: 84, text: 'The Conductor keeps summoning Echoes. Break its Stagger to stop the music.' },
    ],
    triggers: [
      { on: 'spawn', enemy: 'conductor', scene: '1-3.conductor' },
      { on: 'spawn', enemy: 'maestro', scene: '1-3.mid' },
      { on: 'encore', scene: '1-3.encore' },
    ],
    scenes: { pre: '1-3.pre', post: '1-3.post' },
    recommended: ['joker', 'skull', 'panther', 'mona', 'oracle', 'noir', 'fox', 'queen'],
  },
];

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));
