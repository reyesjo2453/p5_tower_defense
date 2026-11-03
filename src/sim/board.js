// Board geometry helpers. A stage's paths (see stagegen.js) default to the classic two-lane PATHS.
import { GRID, PATHS, CENTER } from './data.js';

export function expand(corners) {
  const out = [];
  for (let i = 0; i < corners.length - 1; i++) {
    let [x, y] = corners[i];
    const [bx, by] = corners[i + 1];
    const sx = Math.sign(bx - x);
    const sy = Math.sign(by - y);
    if (i === 0) out.push([x, y]);
    while (x !== bx || y !== by) {
      x += sx;
      y += sy;
      out.push([x, y]);
    }
  }
  return out;
}

export function buildBoard(paths = PATHS) {
  const runway = new Set();
  for (const corners of Object.values(paths)) for (const [x, y] of expand(corners)) runway.add(`${x},${y}`);
  const slots = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const k = `${x},${y}`;
      if (runway.has(k)) continue;
      if (Math.abs(x - CENTER.x) <= 1 && Math.abs(y - CENTER.y) <= 1) continue; // treasure dais
      let near = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        if (runway.has(`${x + dx},${y + dy}`)) near = true;
      }
      if (near) slots.push({ x, y });
    }
  }
  return { runway, slots, slotSet: new Set(slots.map((s) => `${s.x},${s.y}`)) };
}

/** Waypoints (tile centres) for a path. */
export function waypoints(pathId, paths = PATHS) {
  return paths[pathId].map(([x, y]) => ({ x, y }));
}

/** How many runway tiles a unit with range `r` on plate (x, y) can reach (placement heuristic). */
export function coverage(board, x, y, r) {
  let n = 0;
  for (const k of board.runway) {
    const [a, b] = k.split(',').map(Number);
    if (Math.hypot(a - x, b - y) <= r) n++;
  }
  return n;
}
