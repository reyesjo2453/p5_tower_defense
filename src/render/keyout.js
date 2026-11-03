// Background key-out for card-style art (pure pixel logic, no DOM, unit-tested in tests/keyout.test.js).
// A cut-in "card" is a rectangle: an optional border frame around a near-black backdrop with the
// character on top. For the standing billboard we want only the figure, so:
//   1. strip uniform frame lines from each edge (solid colour rows/columns, up to 12% in);
//   2. flood-fill from the edges through near-black pixels (max(r,g,b) < threshold) and anything
//      already transparent: black *inside* the figure (hair, coat) is enclosed and survives;
//   3. eat a thin dark fringe left by antialiasing / JPEG ringing along the cut;
//   4. keep the largest opaque blob plus any blob at least `keepFrac` of it (detached hands,
//      weapons), dropping stray text, stars and logos.

/** True when most edge pixels are opaque, i.e. the art is a rectangular card, not a cut-out. */
export function needsKey(data, w, h) {
  let opaque = 0, n = 0;
  const at = (x, y) => { n++; if (data[(y * w + x) * 4 + 3] > 25) opaque++; };
  for (let x = 0; x < w; x++) { at(x, 0); at(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { at(0, y); at(w - 1, y); }
  return n > 0 && opaque / n > 0.5;
}

/**
 * Key out the backdrop in place (RGBA, row-major). Returns { keyed, kept, frame } where kept is
 * the fraction of pixels left opaque. If keying would leave almost nothing, the data is untouched.
 */
export function keyOut(data, w, h, { threshold = 18, maxBand = 0.12, keepFrac = 0.08, fringe = 2 } = {}) {
  const N = w * h;
  const max3 = (i) => Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  const dark = (i) => data[i * 4 + 3] <= 25 || max3(i) < threshold;
  const clear = new Uint8Array(N); // 1 = background

  // 1. frame lines: walk inward from each side while lines are uniform colour (or all dark)
  const frame = { top: 0, bottom: 0, left: 0, right: 0 };
  const lineKind = (get, len) => {
    let nDark = 0, r = 0, g = 0, b = 0;
    for (let k = 0; k < len; k++) {
      const i = get(k);
      if (dark(i)) nDark++;
      r += data[i * 4]; g += data[i * 4 + 1]; b += data[i * 4 + 2];
    }
    if (nDark >= len * 0.9) return 'dark';
    r /= len; g /= len; b /= len;
    let near = 0;
    for (let k = 0; k < len; k++) {
      const i = get(k);
      if (Math.abs(data[i * 4] - r) + Math.abs(data[i * 4 + 1] - g) + Math.abs(data[i * 4 + 2] - b) < 60) near++;
    }
    return near >= len * 0.9 ? 'frame' : 'content';
  };
  const sides = [
    ['top', h, w, (d) => (k) => d * w + k],
    ['bottom', h, w, (d) => (k) => (h - 1 - d) * w + k],
    ['left', w, h, (d) => (k) => k * w + d],
    ['right', w, h, (d) => (k) => k * w + (w - 1 - d)],
  ];
  for (const [side, dim, len, line] of sides) {
    const limit = Math.floor(dim * maxBand);
    let band = 0;
    for (let d = 0; d < limit; d++) {
      const kind = lineKind(line(d), len);
      if (kind === 'content') break;
      if (kind === 'frame') band = d + 1;
    }
    frame[side] = band;
    for (let d = 0; d < band; d++) { const get = line(d); for (let k = 0; k < len; k++) clear[get(k)] = 1; }
  }

  // 2. flood from the edges / frame through dark pixels
  const stack = new Int32Array(N);
  let sp = 0;
  const push = (i) => { if (!clear[i] && dark(i)) { clear[i] = 1; stack[sp++] = i; } };
  for (let i = 0; i < N; i++) {
    const x = i % w, y = (i / w) | 0;
    if (clear[i]) {
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w);
      if (y < h - 1) push(i + w);
    } else if (x === 0 || y === 0 || x === w - 1 || y === h - 1) push(i);
  }
  while (sp) {
    const i = stack[--sp];
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < N - w) push(i + w);
  }

  // 3. dark fringe along the cut
  for (let pass = 0; pass < fringe; pass++) {
    const eat = [];
    for (let i = 0; i < N; i++) {
      if (clear[i] || max3(i) >= threshold * 2.5) continue;
      const x = i % w;
      if ((x > 0 && clear[i - 1]) || (x < w - 1 && clear[i + 1]) || (i >= w && clear[i - w]) || (i < N - w && clear[i + w])) eat.push(i);
    }
    for (const i of eat) clear[i] = 1;
  }

  // 4. connected blobs of what is left; keep the figure
  const label = new Int32Array(N).fill(-1);
  const sizes = [];
  for (let s = 0; s < N; s++) {
    if (clear[s] || label[s] >= 0) continue;
    const id = sizes.length;
    let size = 0;
    label[s] = id;
    stack[sp++] = s;
    while (sp) {
      const i = stack[--sp];
      size++;
      const x = i % w;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < N - w ? i + w : -1];
      for (const j of nb) if (j >= 0 && !clear[j] && label[j] < 0) { label[j] = id; stack[sp++] = j; }
    }
    sizes.push(size);
  }
  const biggest = sizes.reduce((m, s) => Math.max(m, s), 0);
  let kept = 0;
  for (let i = 0; i < N; i++) {
    if (!clear[i] && sizes[label[i]] >= biggest * keepFrac) kept++;
  }
  if (kept < N * 0.02) return { keyed: false, kept: 1, frame }; // nothing figure-like: leave the card as is

  for (let i = 0; i < N; i++) {
    if (clear[i] || sizes[label[i]] < biggest * keepFrac) data[i * 4 + 3] = 0;
  }
  return { keyed: true, kept: kept / N, frame };
}
