// Small math / helper toolbox shared by sim and render code.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const TAU = Math.PI * 2;

export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInCubic = (t) => t ** 3;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
export const easeOutElastic = (t) => {
  if (t === 0 || t === 1) return t;
  return 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * TAU) / 3) + 1;
};
export const pulse = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

/** Deterministic PRNG so battles are reproducible in tests. */
export function mulberry32(seed) {
  let a = seed | 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cardinal directions: 0 = right, 1 = down, 2 = left, 3 = up. */
export const DIRS = [
  { x: 1, y: 0, name: 'right' },
  { x: 0, y: 1, name: 'down' },
  { x: -1, y: 0, name: 'left' },
  { x: 0, y: -1, name: 'up' },
];

/** Rotate an attack-range offset (authored facing right) to a facing direction. */
export function rotateOffset(dx, dy, dir) {
  let r;
  switch (dir) {
    case 0: r = [dx, dy]; break;
    case 1: r = [-dy, dx]; break;
    case 2: r = [-dx, -dy]; break;
    default: r = [dy, -dx];
  }
  return [r[0] + 0, r[1] + 0]; // normalise -0
}

export function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
