// Procedural stages: runways and waves from a seed and a difficulty tier. Pure and deterministic,
// so the story can pin hand-picked seeds (every player gets the same tested map) while Rehearsal
// mode rolls fresh ones.
//
// A stage is { seed, tier, paths: { a: corners, b?: corners, c?: corners } }. Each path is a list of
// corner tiles from a spawn gate on the board edge to the Treasure in the centre, entering the dais
// from one of its four sides. Lanes never touch each other (not even diagonally), so every runway
// reads on its own and the plates between two lanes can cover both.
import { GRID, CENTER } from './data.js';

/** mulberry32: small, fast, good enough for level generation. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Difficulty tiers. Longer, more winding runways give the cast more time on each Shadow (easier);
// short direct ones are harder. Tier 1 is the tutorial.
export const TIERS = [
  null,
  { len: [20, 30], turns: 4 },
  { len: [17, 25], turns: 3 },
  { len: [15, 22], turns: 3 },
  { len: [13, 19], turns: 2 },
  { len: [11, 17], turns: 2 },
];

// the four tiles two steps from the centre, one per side of the 3x3 dais, and the way out of each
const ENTRIES = [
  { x: CENTER.x + 2, y: CENTER.y, dx: 1, dy: 0 },
  { x: CENTER.x - 2, y: CENTER.y, dx: -1, dy: 0 },
  { x: CENTER.x, y: CENTER.y - 2, dx: 0, dy: -1 },
  { x: CENTER.x, y: CENTER.y + 2, dx: 0, dy: 1 },
];
const K = (x, y) => `${x},${y}`;
const inDais = (x, y) => Math.abs(x - CENTER.x) <= 1 && Math.abs(y - CENTER.y) <= 1;
const onEdge = (x, y) => x === 0 || y === 0 || x === GRID - 1 || y === GRID - 1;
const inside = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID;

/**
 * One random runway walked outward from a dais entry: straight runs of 2+ tiles with right-angle
 * turns, never touching `blocked` (other lanes) or itself, ending on the board edge.
 * Returns the tile list from the spawn (edge) to the entry, or null.
 */
function walk(R, entry, blocked, maxLen) {
  const tiles = [[entry.x, entry.y]];
  const own = new Set([K(entry.x, entry.y)]);
  let x = entry.x;
  let y = entry.y;
  let dir = [entry.dx, entry.dy];
  let first = true;
  const ok = (nx, ny) => {
    if (!inside(nx, ny) || inDais(nx, ny) || own.has(K(nx, ny))) return false;
    // never brush past another side of the dais: it would read as a second way in
    if (ENTRIES.some((e) => e.x === nx && e.y === ny)) return false;
    // keep a one-tile gap to other lanes and to our own earlier tiles (the last two are our neck)
    const recent = new Set(tiles.slice(-2).map(([a, b]) => K(a, b)));
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const k = K(nx + ox, ny + oy);
        if (blocked.has(k)) return false;
        if (own.has(k) && !recent.has(k)) return false;
      }
    }
    return true;
  };
  for (let guard = 0; guard < 40; guard++) {
    const opts = first ? [dir] : [[dir[1], dir[0]], [-dir[1], -dir[0]]];
    if (!first && R() < 0.3) opts.push(dir); // occasionally keep going straight
    // shuffle, then try each direction with a random run length
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(R() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    let moved = false;
    for (const d of opts) {
      const want = 2 + Math.floor(R() * 4);
      let n = 0;
      let cx = x;
      let cy = y;
      const run = [];
      while (n < want) {
        const nx = cx + d[0];
        const ny = cy + d[1];
        if (!ok(nx, ny)) break;
        cx = nx;
        cy = ny;
        run.push([cx, cy]);
        own.add(K(cx, cy));
        tiles.push([cx, cy]);
        n++;
        if (onEdge(cx, cy) && tiles.length >= 6) break;
      }
      if (n >= 2 || (n >= 1 && onEdge(cx, cy))) {
        x = cx;
        y = cy;
        dir = d;
        moved = true;
        break;
      }
      for (const [rx, ry] of run) {
        own.delete(K(rx, ry));
        tiles.pop();
      }
    }
    first = false;
    if (!moved) return null;
    if (tiles.length > maxLen + 4) return null;
    if (onEdge(x, y)) return tiles.reverse();
  }
  return null;
}

/** Tile list -> corner list (spawn, each turn, entry, centre). */
function corners(tiles) {
  const out = [tiles[0]];
  for (let i = 1; i < tiles.length - 1; i++) {
    const [ax, ay] = tiles[i - 1];
    const [bx, by] = tiles[i];
    const [cx, cy] = tiles[i + 1];
    if (bx - ax !== cx - bx || by - ay !== cy - by) out.push(tiles[i]);
  }
  out.push(tiles.at(-1));
  out.push([CENTER.x, CENTER.y]);
  return out;
}

function turns(c) {
  return c.length - 3; // minus spawn, entry and the centre
}

const LANES = ['a', 'b', 'c'];

/**
 * Generate a stage. `lanes` 1..3, `tier` 1..5 (TIERS). Deterministic for a given seed.
 */
export function generateStage({ seed = 1, lanes = 1, tier = 1 } = {}) {
  const T = TIERS[Math.max(1, Math.min(5, tier))];
  const R = rng(seed * 7919 + lanes * 104729 + tier);
  for (let attempt = 0; attempt < 60; attempt++) {
    // pick distinct dais sides for the lanes
    const sides = [...ENTRIES].sort(() => R() - 0.5).slice(0, lanes);
    const blocked = new Set();
    const paths = {};
    let failed = false;
    for (let li = 0; li < lanes; li++) {
      let best = null;
      let bestScore = Infinity;
      for (let k = 0; k < 90; k++) {
        const tiles = walk(R, sides[li], blocked, T.len[1]);
        if (!tiles) continue;
        const len = tiles.length + 2; // + dais tile + centre
        // later lanes have less room, so they may run a little shorter
        const lo = li === 0 ? T.len[0] : Math.max(8, T.len[0] - 2 - li);
        if (len < lo || len > T.len[1]) continue;
        const c = corners(tiles);
        // later lanes share the board: aim for the low end of the range so they all fit
        const target = li === 0 ? (T.len[0] + T.len[1]) / 2 : lo + 2;
        const score = Math.abs(len - target) + Math.abs(turns(c) - T.turns) * 1.5 + R() * 2;
        if (score < bestScore) {
          bestScore = score;
          best = tiles;
        }
      }
      if (!best) {
        failed = true;
        break;
      }
      paths[LANES[li]] = corners(best);
      for (const [x, y] of best) blocked.add(K(x, y));
    }
    if (!failed) return { seed, tier, lanes, paths };
  }
  // the generator should always find something; fall back to straight lanes just in case
  const fallback = { a: [[0, CENTER.y], [CENTER.x, CENTER.y]], b: [[GRID - 1, CENTER.y], [CENTER.x, CENTER.y]], c: [[CENTER.x, 0], [CENTER.x, CENTER.y]] };
  return { seed, tier, lanes, paths: Object.fromEntries(LANES.slice(0, lanes).map((l) => [l, fallback[l]])) };
}

// ---------------------------------------------------------------- waves
// Threat cost of each Shadow in "mannequin equivalents" (the wave budget is spent in these).
const COST = { mannequin: 1, runner: 0.8, brute: 3.4, bouncer: 2.2, stagehand: 1.4, doppel: 1.8, critic: 1 };
const HEAVY = new Set(['brute', 'bouncer']);
const GAP = { brute: 5.5, bouncer: 3.5, runner: 1.2, critic: 1.1, stagehand: 2.6, doppel: 2.4 };

/**
 * Compose `count` waves for a stage. power = budget of the first wave; each later wave grows by
 * `growth`. mix = which Shadow types may appear; pace scales the gaps (lower = denser);
 * boss = the last wave brings the Impresario. Groups alternate lanes so pressure is shared.
 */
export function composeWaves({ seed = 1, lanes = ['a'], count = 3, power = 4, growth = 0.3, mix = ['mannequin'], pace = 1, boss = false, miniboss = null }) {
  const R = rng(seed * 31337 + count);
  const waves = [];
  for (let w = 0; w < count; w++) {
    let budget = power * (1 + growth * w);
    const groups = [];
    let at = 0;
    let lane = Math.floor(R() * lanes.length);
    // a brute only once the budget can carry one; runners as a fast follow-up
    const kinds = mix.filter((t) => !HEAVY.has(t) || budget >= 6);
    while (budget > 0.7) {
      const type = kinds.length > 1 && R() < 0.45 ? kinds[1 + Math.floor(R() * (kinds.length - 1))] : kinds[0];
      const cost = COST[type];
      const max = Math.max(1, Math.floor(budget / cost));
      const n = Math.max(1, Math.min(max, HEAVY.has(type) ? 1 + Math.floor(R() * 2) : type === 'stagehand' ? 1 + Math.floor(R() * 2) : 3 + Math.floor(R() * 4)));
      const gap = (GAP[type] ?? 2.0) * pace;
      groups.push({ type, count: n, gap, path: lanes[lane % lanes.length], at: Math.round(at * 10) / 10 });
      budget -= n * cost;
      at += n * gap * (lanes.length > 1 ? 0.45 : 0.8) + 1.5 * pace;
      lane++;
    }
    // a bigger budget means a denser wave, not a longer one: squeeze the schedule into its time slot
    const total = power * (1 + growth * w);
    const slot = (8 + Math.sqrt(total) * 5) * pace;
    const end = Math.max(...groups.map((g) => g.at + (g.count - 1) * g.gap));
    if (end > slot) {
      const k = slot / end;
      for (const g of groups) {
        g.at = Math.round(g.at * k * 10) / 10;
        g.gap = Math.max(0.9, g.gap * k);
      }
    }
    if (boss && w === count - 1) groups.unshift({ type: 'boss', count: 1, gap: 1, path: lanes[0], at: 4 });
    // a mini-boss headlines the last wave of its act
    if (miniboss && w === count - 1) groups.unshift({ type: miniboss, count: 1, gap: 1, path: lanes[lanes.length - 1], at: 6 });
    waves.push(groups);
  }
  return waves;
}
