// Procedural comic-print kit for the DOM overlays: starbursts, ink splatters, speedline fields and
// torn-paper clip paths. Pure string builders (SVG data-URLs / CSS polygon() values), deterministic.

export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const svgURL = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Jagged starburst as an SVG points list (cx, cy, inner r, outer r, spikes, seed). */
export function burstPoints(cx, cy, r0, r1, n = 14, seed = 1) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + (r() - 0.5) * 0.12;
    const rr = i % 2 ? r0 * (0.85 + r() * 0.3) : r1 * (0.75 + r() * 0.4);
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** The same starburst as a CSS clip-path polygon() in percentages. */
export function burstClip(n = 12, inner = 0.62, seed = 2) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = (i % 2 ? inner * (0.9 + r() * 0.15) : 0.92 + r() * 0.08) * 50;
    pts.push(`${(50 + Math.cos(a) * rr).toFixed(1)}% ${(50 + Math.sin(a) * rr).toFixed(1)}%`);
  }
  return `polygon(${pts.join(',')})`;
}

/** Comic explosion star (yellow / white / red layers, heavy ink stroke) as a data-URL. */
export function starURL(seed = 1, colors = ['#ffe600', '#fff']) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <polygon points="${burstPoints(104, 106, 46, 96, 13, seed)}" fill="#050505"/>
    <polygon points="${burstPoints(100, 100, 44, 92, 13, seed)}" fill="${colors[0]}" stroke="#050505" stroke-width="5" stroke-linejoin="miter"/>
    <polygon points="${burstPoints(100, 100, 22, 50, 9, seed + 7)}" fill="${colors[1]}"/>
  </svg>`;
  return svgURL(svg);
}

/** Ink splatter blob with flung droplets. */
export function splatterURL(fill, seed = 3) {
  const r = rng(seed);
  let d = '';
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = 34 + r() * 18 + (i % 3 === 0 ? 34 * r() : 0);
    d += `${i ? 'L' : 'M'}${(100 + Math.cos(a) * rr).toFixed(1)},${(100 + Math.sin(a) * rr).toFixed(1)}`;
  }
  let drops = '';
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const dd = 66 + r() * 30;
    drops += `<circle cx="${(100 + Math.cos(a) * dd).toFixed(1)}" cy="${(100 + Math.sin(a) * dd).toFixed(1)}" r="${(2 + r() * 7).toFixed(1)}"/>`;
  }
  return svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><g fill="${fill}"><path d="${d}Z"/>${drops}</g></svg>`);
}

/**
 * Heavy diagonal speedlines converging on a focal point (fx, fy in 0..1 of a w x h field):
 * thin wedge polygons in ink + an accent colour, as a data-URL for a CSS background.
 */
export function speedlinesURL({ w = 800, h = 300, fx = 0.25, fy = 0.5, n = 70, ink = '#fff', accent = '#e8002d', seed = 4, inner = 0.18 } = {}) {
  const r = rng(seed);
  const cx = fx * w;
  const cy = fy * h;
  const R = Math.hypot(w, h);
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.08;
    const da = 0.004 + r() * 0.018;
    const r0 = R * (inner + r() * 0.22);
    const p = (ang, rad) => `${(cx + Math.cos(ang) * rad).toFixed(1)},${(cy + Math.sin(ang) * rad).toFixed(1)}`;
    const col = r() < 0.25 ? accent : ink;
    out += `<polygon points="${p(a, r0)} ${p(a - da, R)} ${p(a + da, R)}" fill="${col}" fill-opacity="${(0.35 + r() * 0.55).toFixed(2)}"/>`;
  }
  return svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${out}</svg>`);
}

/** Torn-paper polygon(): ragged top + bottom edges (amp in %), straight-ish sides. */
export function tornClip(seed = 5, amp = 7, steps = 34) {
  const r = rng(seed);
  const top = [];
  const bot = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * 100;
    top.push(`${x.toFixed(1)}% ${(r() * amp).toFixed(1)}%`);
    bot.push(`${(100 - x).toFixed(1)}% ${(100 - r() * amp).toFixed(1)}%`);
  }
  return `polygon(${top.join(',')},${bot.join(',')})`;
}

/** Torn-paper polygon() for tall panels: ragged left + right edges. */
export function tornClipV(seed = 6, amp = 6, steps = 26) {
  const r = rng(seed);
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * 100;
    right.push(`${(100 - r() * amp).toFixed(1)}% ${y.toFixed(1)}%`);
    left.push(`${(r() * amp).toFixed(1)}% ${(100 - y).toFixed(1)}%`);
  }
  return `polygon(${right.join(',')},${left.join(',')})`;
}
