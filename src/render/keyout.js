// Background key-out for card-style art (pure pixel logic, no DOM, unit-tested in tests/keyout.test.js).
// A cut-in "card" is a rectangle: an optional border frame around a near-black backdrop with the
// character on top. For the standing billboard we want only the figure, so:
//   1. strip uniform frame lines from each edge (solid colour rows/columns, up to 12% in);
//   2. flood-fill from the edges through near-black pixels (max(r,g,b) < threshold) and anything
//      already transparent: black *inside* the figure (hair, coat) is enclosed and survives;
//   3. eat a thin dark fringe left by antialiasing / JPEG ringing along the cut;
//   4. keep the largest opaque blob plus any blob at least `keepFrac` of it (detached hands,
//      weapons), dropping stray text, stars and logos;
//      Every piece other than the main body is also dropped when it touches the outer edge (border
//      shards), is a long thin streak (speedline) or floats away from the body;
//   5. restore black that the flood ate from inside the silhouette (a coat or hair touching the
//      black backdrop): dark pixels inside a morphological closing of the figure come back;
//   6. a small morphological opening severs thin speedlines and comic slashes that only touch the
//      body through a narrow neck, and the isolation rules run again on what is left.

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
export function keyOut(data, w, h, { threshold = 18, maxBand = 0.12, keepFrac = 0.08, fringe = 2, sever = 0.006, near = 0.15, close = 0.03 } = {}) {
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

  // 4. figure isolation: main body + big nearby parts; small / edge / floating / streak pieces go
  const inner = { x0: frame.left, y0: frame.top, x1: w - 1 - frame.right, y1: h - 1 - frame.bottom };
  const mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) mask[i] = clear[i] ? 0 : 1;
  isolate(mask, w, h, keepFrac, inner, near);

  // 5. black clothing / hair touching the black backdrop got flooded away with it: a morphological
  //    closing of the figure fills those bays, and the dark pixels inside it come back as ink
  if (close > 0) {
    const R = Math.max(1, Math.round(Math.max(w, h) * close));
    const out = distance(mask, w, h, true);
    const grown = new Uint8Array(N);
    for (let i = 0; i < N; i++) grown[i] = out[i] <= R ? 1 : 0;
    const back = distance(grown, w, h, false, true);
    for (let i = 0; i < N; i++) {
      if (!mask[i] && back[i] > R && max3(i) < threshold * 2.5 && data[i * 4 + 3] > 25) mask[i] = 1;
    }
  }

  // 6. sever thin speedlines / slashes attached to the body (morphological opening), then re-isolate
  if (sever > 0) {
    const r = Math.max(1, Math.round(Math.max(w, h) * sever));
    const core = distance(mask, w, h);
    for (let i = 0; i < N; i++) core[i] = core[i] > r ? 1 : 0;
    isolate(core, w, h, keepFrac / 2, inner, near); // erosion shrinks small parts more than the body
    const reach = distance(core, w, h, true); // distance from the kept core, outside it
    for (let i = 0; i < N; i++) if (mask[i] && reach[i] > r) mask[i] = 0;
    isolate(mask, w, h, keepFrac, inner, near); // tidy crumbs the opening left behind
  }
  let kept = 0;
  for (let i = 0; i < N; i++) kept += mask[i];
  if (kept < N * 0.02) return { keyed: false, kept: 1, frame }; // nothing figure-like: leave the card as is

  for (let i = 0; i < N; i++) if (!mask[i]) data[i * 4 + 3] = 0;
  return { keyed: true, kept: kept / N, frame };
}

/**
 * Chessboard distance transform. Default: for pixels inside `m`, steps to the nearest pixel outside
 * it (the image border counts as outside). `outside`: for pixels outside `m`, steps to the nearest
 * pixel inside it (0 inside). `borderInside`: beyond the image counts as inside (no border erosion).
 */
function distance(m, w, h, outside = false, borderInside = false) {
  const N = w * h, BIG = 1 << 20;
  const d = new Int32Array(N);
  for (let i = 0; i < N; i++) d[i] = (outside ? m[i] : !m[i]) ? 0 : BIG;
  const off = outside || borderInside ? BIG : 0; // value just beyond the image border
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? off : d[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i]) d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x - 1, y - 1) + 1, at(x, y - 1) + 1, at(x + 1, y - 1) + 1);
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i]) d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x + 1, y + 1) + 1, at(x, y + 1) + 1, at(x - 1, y + 1) + 1);
    }
  }
  return d;
}

/**
 * Keep the main body (largest 4-connected blob of `m`) and any other blob that is big enough
 * (>= keepFrac of it), does not touch the inner edge, is not a long thin streak and sits near the
 * body. Clears every other blob in place.
 */
function isolate(m, w, h, keepFrac, inner, near) {
  const N = w * h;
  const label = new Int32Array(N).fill(-1);
  const stack = new Int32Array(N);
  const blobs = [];
  for (let s = 0; s < N; s++) {
    if (!m[s] || label[s] >= 0) continue;
    const b = { size: 0, x0: w, y0: h, x1: -1, y1: -1, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0, edge: false };
    const id = blobs.length;
    let sp = 0;
    label[s] = id;
    stack[sp++] = s;
    while (sp) {
      const i = stack[--sp];
      const x = i % w, y = (i / w) | 0;
      b.size++;
      b.sx += x; b.sy += y; b.sxx += x * x; b.syy += y * y; b.sxy += x * y;
      if (x < b.x0) b.x0 = x;
      if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y;
      if (y > b.y1) b.y1 = y;
      if (x <= inner.x0 || y <= inner.y0 || x >= inner.x1 || y >= inner.y1) b.edge = true;
      if (x > 0 && m[i - 1] && label[i - 1] < 0) { label[i - 1] = id; stack[sp++] = i - 1; }
      if (x < w - 1 && m[i + 1] && label[i + 1] < 0) { label[i + 1] = id; stack[sp++] = i + 1; }
      if (y > 0 && m[i - w] && label[i - w] < 0) { label[i - w] = id; stack[sp++] = i - w; }
      if (y < h - 1 && m[i + w] && label[i + w] < 0) { label[i + w] = id; stack[sp++] = i + w; }
    }
    blobs.push(b);
  }
  if (!blobs.length) return;
  let main = 0;
  for (let k = 1; k < blobs.length; k++) if (blobs[k].size > blobs[main].size) main = k;
  const M = blobs[main];
  const padX = w * near, padY = h * near;
  const keep = blobs.map((b, k) => {
    if (k === main) return true;
    if (b.size < M.size * keepFrac || b.edge) return false;
    // elongation: ratio of the principal variances (a speedline is a long thin streak)
    const n = b.size, mx = b.sx / n, my = b.sy / n;
    const vxx = b.sxx / n - mx * mx, vyy = b.syy / n - my * my, vxy = b.sxy / n - mx * my;
    const tr = vxx + vyy, det = vxx * vyy - vxy * vxy;
    const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const l1 = tr / 2 + disc, l2 = Math.max(1e-6, tr / 2 - disc);
    if (l1 / l2 > 30) return false;
    // floating: no overlap with the body's box grown by `near`
    return !(b.x1 < M.x0 - padX || b.x0 > M.x1 + padX || b.y1 < M.y0 - padY || b.y0 > M.y1 + padY);
  });
  for (let i = 0; i < N; i++) if (m[i] && !keep[label[i]]) m[i] = 0;
}
