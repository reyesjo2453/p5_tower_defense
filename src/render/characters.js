// Painterly procedural characters: cel-shaded busts (dialogue, cut-ins, menus) and animated
// full-body chibi tokens (battle). Designs come from src/data/looks.js (original designs).
// Lighting model: warm key light from the upper left, accent-coloured rim light from the right,
// ink outlines, hair "angel ring" highlights. Any image in assets/manifest.json overrides a bust.
import { LOOKS } from '../data/looks.js';
import { OPERATORS, CLASSES } from '../data/operators.js';
import { assets } from '../core/assets.js';
import { TAU, hexA, clamp } from '../core/util.js';

const INK = '#140c18';

// ---------------------------------------------------------------- shading primitives
function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [k, c] of stops) g.addColorStop(k, c);
  return g;
}

/** Fill a path, then shade inside it: cel shadow (fn), rim light (right), key light (left), ink. */
function part(ctx, path, o) {
  if (o.inkUnder) {
    // stroke first: overlapping sub-shapes (hair strands) then read as one silhouette
    path();
    ctx.strokeStyle = INK;
    ctx.lineWidth = o.inkUnder * 2;
    ctx.stroke();
  }
  path();
  ctx.fillStyle = o.fill;
  ctx.fill(o.rule || 'nonzero');
  if (o.shadow || o.rim || o.key) {
    ctx.save();
    path();
    ctx.clip(o.rule || 'nonzero');
    if (o.shadow) {
      ctx.fillStyle = o.shadow;
      o.shadowFn();
    }
    if (o.key) {
      ctx.strokeStyle = lin(ctx, o.x0, 0, o.x1, 0, [[0, o.key], [0.45, hexA('#ffffff', 0)], [1, hexA('#ffffff', 0)]]);
      ctx.lineWidth = o.keyW || o.rimW;
      path();
      ctx.stroke();
    }
    if (o.rim) {
      ctx.strokeStyle = lin(ctx, o.x0, 0, o.x1, 0, [[0, hexA(o.rim, 0)], [0.62, hexA(o.rim, 0)], [1, o.rim]]);
      ctx.lineWidth = o.rimW;
      path();
      ctx.stroke();
    }
    ctx.restore();
  }
  if (o.ink) {
    path();
    ctx.strokeStyle = INK;
    ctx.lineWidth = o.ink;
    ctx.stroke();
  }
}

/** A tapered hair strand / leaf from (x, y) in direction a. */
function strand(ctx, x, y, a, len, w, bend = 0) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const nx = -sa;
  const ny = ca;
  const tx = x + ca * len + nx * bend;
  const ty = y + sa * len + ny * bend;
  const mx = x + ca * len * 0.5 + nx * bend * 0.6;
  const my = y + sa * len * 0.5 + ny * bend * 0.6;
  ctx.moveTo(x + nx * w, y + ny * w);
  ctx.quadraticCurveTo(mx + nx * w * 0.9, my + ny * w * 0.9, tx, ty);
  ctx.quadraticCurveTo(mx - nx * w * 0.9, my - ny * w * 0.9, x - nx * w, y - ny * w);
  ctx.closePath();
}

// ---------------------------------------------------------------- hair
// All hair coordinates are relative to the head centre; u = head unit.
function hairBackPath(ctx, H, u) {
  ctx.beginPath();
  switch (H.style) {
    case 'long':
      ctx.moveTo(-2.1 * u, -1 * u);
      ctx.bezierCurveTo(-2.9 * u, 3 * u, -3.0 * u, 6.5 * u, -2.2 * u, 8.6 * u);
      ctx.lineTo(2.2 * u, 8.6 * u);
      ctx.bezierCurveTo(3.0 * u, 6.5 * u, 2.9 * u, 3 * u, 2.1 * u, -1 * u);
      ctx.closePath();
      break;
    case 'bob':
      ctx.moveTo(-2.3 * u, -1.2 * u);
      ctx.bezierCurveTo(-2.7 * u, 1.2 * u, -2.6 * u, 2.6 * u, -2.0 * u, 3.0 * u);
      ctx.lineTo(2.2 * u, 2.7 * u);
      ctx.bezierCurveTo(2.7 * u, 2.2 * u, 2.7 * u, 1.0 * u, 2.3 * u, -1.2 * u);
      ctx.closePath();
      break;
    case 'braid':
      ctx.moveTo(-2.15 * u, -1 * u);
      ctx.bezierCurveTo(-2.6 * u, 2 * u, -2.5 * u, 4 * u, -2.0 * u, 5 * u);
      ctx.lineTo(2.0 * u, 5 * u);
      ctx.bezierCurveTo(2.5 * u, 4 * u, 2.6 * u, 2 * u, 2.15 * u, -1 * u);
      ctx.closePath();
      break;
    case 'shag':
      ctx.moveTo(-2.3 * u, -1 * u);
      for (let i = 0; i <= 8; i++) {
        const k = i / 8;
        const x = -2.5 * u + k * 5 * u;
        ctx.lineTo(x, 2.2 * u + (i % 2 ? 0.7 * u : 0));
      }
      ctx.lineTo(2.3 * u, -1 * u);
      ctx.closePath();
      break;
    case 'idol':
      for (const sx of [-1, 1]) {
        ctx.moveTo(sx * 1.9 * u, -0.6 * u);
        ctx.bezierCurveTo(sx * 3.0 * u, 0.6 * u, sx * 3.1 * u, 2.6 * u, sx * 2.6 * u, 4.2 * u);
        ctx.bezierCurveTo(sx * 2.3 * u, 2.6 * u, sx * 2.0 * u, 1.4 * u, sx * 1.5 * u, 0.2 * u);
        ctx.closePath();
      }
      break;
    case 'crown':
      ctx.moveTo(-2.1 * u, -0.8 * u);
      ctx.bezierCurveTo(-2.5 * u, 1.2 * u, -2.3 * u, 2.4 * u, -1.8 * u, 2.8 * u);
      ctx.lineTo(1.8 * u, 2.8 * u);
      ctx.bezierCurveTo(2.3 * u, 2.4 * u, 2.5 * u, 1.2 * u, 2.1 * u, -0.8 * u);
      ctx.closePath();
      break;
    default:
      ctx.ellipse(0, -0.9 * u, 2.15 * u, 2.2 * u, 0, 0, TAU);
  }
}

function capPath(ctx, H, u) {
  ctx.beginPath();
  const top = H.style === 'crop' ? -2.55 : H.style === 'slick' ? -2.6 : -2.75;
  ctx.moveTo(-2.12 * u, 0.1 * u);
  ctx.bezierCurveTo(-2.3 * u, -1.6 * u, -1.4 * u, top * u, 0, top * u);
  ctx.bezierCurveTo(1.4 * u, top * u, 2.3 * u, -1.6 * u, 2.12 * u, 0.1 * u);
  ctx.bezierCurveTo(1.6 * u, -1.0 * u, -1.6 * u, -1.0 * u, -2.12 * u, 0.1 * u);
  ctx.closePath();
}

/** The fringe: list of strands [x, y, angle, len, width, bend] per style. */
function fringeStrands(H, u, t) {
  const sway = Math.sin(t * 2.1) * 0.04;
  const S = [];
  const add = (x, y, a, len, w, bend = 0) => S.push([x * u, y * u, a + sway, len * u, w * u * 1.55, bend * u]);
  switch (H.style) {
    case 'swept':
      // a few bold locks sweeping across the brow to the right
      add(-1.9, -1.9, 0.95, 2.6, 0.55, 0.9);
      add(-1.1, -2.2, 0.9, 2.9, 0.6, 0.9);
      add(-0.2, -2.3, 0.85, 2.8, 0.58, 0.8);
      add(0.7, -2.1, 0.8, 2.4, 0.52, 0.6);
      add(1.5, -1.6, 1.0, 2.2, 0.45, 0.3);
      add(-2.05, -0.9, 1.75, 2.0, 0.4, -0.2);
      add(2.0, -0.9, 1.4, 2.1, 0.4, 0.3);
      add(-1.0, -2.5, -2.5, 1.1, 0.4, 0.4);
      break;
    case 'crop':
      for (let i = 0; i < 6; i++) add(-1.5 + i * 0.6, -2.0, 1.45 - i * 0.05, 1.3, 0.38, 0.2);
      for (let i = 0; i < 5; i++) add(-1.4 + i * 0.7, -2.2, -1.6 - 0.25 + i * 0.12, 0.9, 0.32, 0);
      add(-2.0, -0.6, 1.7, 1.0, 0.3, 0);
      add(2.0, -0.6, 1.45, 1.0, 0.3, 0);
      break;
    case 'bob':
      for (let i = 0; i < 9; i++) add(-1.9 + i * 0.47, -2.1, 1.57 - 0.25 + i * 0.05, 1.9 + (i === 6 ? 0.6 : 0), 0.34, 0.2);
      add(-2.1, -1.0, 1.65, 3.6, 0.42, 0.3);
      add(2.1, -1.0, 1.5, 3.4, 0.42, -0.3);
      break;
    case 'long':
      for (let i = 0; i < 4; i++) add(-0.2 - i * 0.45, -2.3, 1.95 + i * 0.05, 2.0 + i * 0.3, 0.38, -0.2);
      for (let i = 0; i < 4; i++) add(0.2 + i * 0.45, -2.3, 1.2 - i * 0.05, 2.0 + i * 0.3, 0.38, 0.2);
      add(-2.15, -0.8, 1.62, 4.6, 0.42, 0.25);
      add(2.15, -0.8, 1.52, 4.6, 0.42, -0.25);
      break;
    case 'shag':
      for (let i = 0; i < 10; i++) add(-2.0 + i * 0.45, -2.2 + Math.sin(i * 1.7) * 0.15, 1.57 + Math.sin(i * 2.3) * 0.4, 1.4 + (i % 3) * 0.3, 0.32, Math.sin(i) * 0.4);
      for (let i = 0; i < 6; i++) add(-1.6 + i * 0.65, -2.6, -1.57 + Math.sin(i * 1.3) * 0.7, 0.9, 0.28, 0.2);
      add(-2.2, -0.6, 1.9, 1.8, 0.34, 0);
      add(2.2, -0.6, 1.25, 1.8, 0.34, 0);
      break;
    case 'crown':
      for (let i = 0; i < 5; i++) add(-1.6 + i * 0.4, -2.0, 0.55 + i * 0.05, 1.6, 0.34, 0.4);
      add(-2.05, -0.5, 1.68, 2.9, 0.3, 0.5);
      add(2.05, -0.5, 1.46, 2.9, 0.3, -0.5);
      break;
    case 'braid':
      for (let i = 0; i < 7; i++) add(1.6 - i * 0.5, -2.2, 2.2 + i * 0.03, 2.0 + (i % 2) * 0.4, 0.38, -0.5);
      add(2.1, -0.8, 1.5, 2.8, 0.36, -0.2);
      add(-2.15, -0.9, 1.7, 2.4, 0.34, 0.2);
      break;
    case 'cap':
      for (let i = 0; i < 6; i++) add(-1.2 + i * 0.5, -1.4, 1.35 + i * 0.04, 1.2, 0.3, 0.2);
      break;
    case 'idol':
      for (let i = 0; i < 8; i++) add(-1.8 + i * 0.5, -2.1, 1.57 - 0.2 + i * 0.04, 1.6 + (i % 2) * 0.3, 0.33, 0.1);
      add(-2.1, -0.7, 1.62, 2.6, 0.32, 0.2);
      add(2.1, -0.7, 1.52, 2.6, 0.32, -0.2);
      break;
    case 'slick':
      add(1.0, -2.3, 1.2, 1.6, 0.18, 0.5);
      break;
    default:
      for (let i = 0; i < 7; i++) add(-1.7 + i * 0.55, -2.1, 1.5, 1.6, 0.35, 0.1);
  }
  return S;
}

function fringePath(ctx, S, dy = 0) {
  ctx.beginPath();
  for (const [x, y, a, len, w, bend] of S) strand(ctx, x, y + dy, a, len, w, bend);
}

function hairExtras(ctx, L, u, t, front) {
  const H = L.hair;
  if (!front) {
    if (H.style === 'idol') {
      for (const sx of [-1, 1]) {
        part(ctx, () => { ctx.beginPath(); ctx.arc(sx * 1.55 * u, -2.6 * u, 0.85 * u, 0, TAU); }, { fill: H.c, shadow: H.sh, shadowFn: () => ctx.fillRect(sx * 1.55 * u, -3.4 * u, 2 * u, 2 * u), ink: 0.1 * u });
      }
    }
    if (H.style === 'crown') {
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * 1.08 + (i / 8) * Math.PI * 0.84;
        const x = Math.cos(a) * 2.0 * u;
        const y = -0.9 * u + Math.sin(a) * 2.0 * u;
        part(ctx, () => { ctx.beginPath(); ctx.ellipse(x, y, 0.5 * u, 0.36 * u, a + 1.57, 0, TAU); }, { fill: H.c, shadow: H.sh, shadowFn: () => ctx.fillRect(x - 0.1 * u, y - u, u, 2 * u), ink: 0.08 * u });
      }
    }
    return;
  }
  if (H.style === 'braid') {
    // braid falling over the right shoulder
    for (let i = 0; i < 7; i++) {
      const x = 1.9 * u + Math.sin(i * 0.5) * 0.3 * u;
      const y = 1.0 * u + i * 0.85 * u;
      part(ctx, () => { ctx.beginPath(); ctx.ellipse(x, y, 0.55 * u * (1 - i * 0.06), 0.5 * u, 0.4, 0, TAU); }, { fill: i % 2 ? H.c : H.streak || H.c, shadow: H.sh, shadowFn: () => ctx.fillRect(x, y - u, u, 2 * u), ink: 0.08 * u });
    }
  }
  if (H.style === 'cap') {
    // soft aviator cap with ear flaps
    const C = L.outfit;
    part(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-2.25 * u, 0.9 * u);
      ctx.bezierCurveTo(-2.5 * u, -2.2 * u, -1.2 * u, -3.0 * u, 0, -3.0 * u);
      ctx.bezierCurveTo(1.2 * u, -3.0 * u, 2.5 * u, -2.2 * u, 2.25 * u, 0.9 * u);
      ctx.lineTo(1.7 * u, 1.0 * u);
      ctx.bezierCurveTo(1.6 * u, -1.3 * u, -1.6 * u, -1.3 * u, -1.7 * u, 1.0 * u);
      ctx.closePath();
    }, { fill: lin(ctx, -2 * u, -3 * u, 2 * u, 1 * u, [[0, '#6b4a2c'], [1, '#3c2816']]), rim: L.accent, rimW: 0.35 * u, x0: -2.3 * u, x1: 2.3 * u, ink: 0.11 * u, shadow: 'rgba(0,0,0,0.25)', shadowFn: () => ctx.fillRect(0.6 * u, -3 * u, 2 * u, 5 * u) });
    ctx.strokeStyle = '#e9d6b0';
    ctx.lineWidth = 0.18 * u;
    ctx.beginPath();
    ctx.moveTo(-1.7 * u, -1.1 * u);
    ctx.bezierCurveTo(-1.0 * u, -1.5 * u, 1.0 * u, -1.5 * u, 1.7 * u, -1.1 * u);
    ctx.stroke();
    void C;
  }
}

function drawHairFront(ctx, L, u, t) {
  const H = L.hair;
  const S = fringeStrands(H, u, t);
  const fill = lin(ctx, -2 * u, -3 * u, 1.5 * u, 2 * u, [[0, H.hl], [0.35, H.c], [1, H.sh]]);
  const silhouette = () => {
    if (H.style !== 'cap') capPath(ctx, H, u);
    else ctx.beginPath();
    for (const [x, y, a, len, w, bend] of S) strand(ctx, x, y, a, len, w, bend);
  };
  part(ctx, silhouette, {
    fill, inkUnder: 0.09 * u, rim: L.accent, rimW: 0.4 * u, x0: -2.2 * u, x1: 2.4 * u,
    shadow: hexA(H.sh, 0.6), shadowFn: () => { ctx.fillRect(0.5 * u, -3 * u, 3 * u, 7 * u); },
  });
  // strand separation lines (painted, not inked)
  ctx.save();
  silhouette();
  ctx.clip();
  ctx.strokeStyle = hexA(H.sh, 0.35);
  ctx.lineWidth = 0.06 * u;
  for (const [x, y, a, len, , bend] of S.filter((_, i) => i % 2 === 0)) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 - Math.sin(a) * bend * 0.6, y + Math.sin(a) * len * 0.5 + Math.cos(a) * bend * 0.6, x + Math.cos(a) * len * 0.85 - Math.sin(a) * bend, y + Math.sin(a) * len * 0.85 + Math.cos(a) * bend);
    ctx.stroke();
  }
  ctx.restore();
  if (H.style === 'slick') {
    ctx.strokeStyle = hexA(H.sh, 0.8);
    ctx.lineWidth = 0.08 * u;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-1.6 * u + i * 0.6 * u, -1.4 * u);
      ctx.bezierCurveTo(-1.2 * u + i * 0.5 * u, -2.3 * u, -0.4 * u + i * 0.4 * u, -2.5 * u, 0.4 * u + i * 0.3 * u, -2.5 * u);
      ctx.stroke();
    }
  }
  // coloured streak / tips
  if (H.streak) {
    ctx.save();
    ctx.beginPath();
    const [x, y, a, len, w, bend] = S[H.style === 'braid' ? 1 : H.style === 'swept' ? 4 : 2];
    strand(ctx, x, y, a, len, w * 1.05, bend);
    ctx.fillStyle = H.streak;
    ctx.fill();
    ctx.restore();
  }
  if (H.tips) {
    ctx.save();
    fringePath(ctx, S);
    ctx.clip();
    ctx.fillStyle = hexA(H.tips, 0.85);
    ctx.fillRect(-3 * u, -0.3 * u, 6 * u, 3 * u);
    ctx.restore();
  }
  // angel-ring highlight
  ctx.save();
  capPath(ctx, H, u);
  if (H.style === 'cap') ctx.rect(-3 * u, -1.6 * u, 6 * u, 1.5 * u);
  ctx.clip();
  ctx.strokeStyle = hexA(H.hl, 0.75);
  ctx.lineWidth = 0.22 * u;
  ctx.lineWidth = 0.28 * u;
  ctx.beginPath();
  ctx.ellipse(0, -1.0 * u, 1.75 * u, 1.05 * u, 0, Math.PI * 1.15, Math.PI * 1.6);
  ctx.stroke();
  ctx.restore();
  hairExtras(ctx, L, u, t, true);
}

// ---------------------------------------------------------------- face
function facePath(ctx, u) {
  ctx.beginPath();
  ctx.moveTo(-1.86 * u, -0.7 * u);
  ctx.bezierCurveTo(-1.95 * u, 0.9 * u, -1.1 * u, 2.05 * u, 0, 2.3 * u);
  ctx.bezierCurveTo(1.1 * u, 2.05 * u, 1.95 * u, 0.9 * u, 1.86 * u, -0.7 * u);
  ctx.bezierCurveTo(1.82 * u, -2.5 * u, -1.82 * u, -2.5 * u, -1.86 * u, -0.7 * u);
  ctx.closePath();
}

function drawEye(ctx, L, u, sx, emote, blink, look) {
  const ex = sx * 0.82 * u;
  const ey = 0.25 * u;
  const closed = blink < 0.3 || emote === 'laugh';
  ctx.lineCap = 'round';
  if (closed) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.17 * u;
    ctx.beginPath();
    if (emote === 'laugh') ctx.arc(ex, ey + 0.2 * u, 0.42 * u, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(ex, ey - 0.15 * u, 0.45 * u, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    return;
  }
  const open = emote === 'smirk' ? 0.72 : emote === 'angry' ? 0.66 : emote === 'shock' ? 1.12 : 1;
  const rx = 0.5 * u;
  const ry = 0.42 * u * open;
  ctx.save();
  // white
  ctx.beginPath();
  ctx.ellipse(ex, ey, rx, ry, 0, 0, TAU);
  ctx.fillStyle = '#fbf8f6';
  ctx.fill();
  ctx.clip();
  // iris
  const ir = (emote === 'shock' ? 0.24 : 0.33) * u;
  const ix = ex + look * 0.12 * u - sx * 0.02 * u;
  const g = ctx.createLinearGradient(0, ey - ir, 0, ey + ir);
  g.addColorStop(0, INK);
  g.addColorStop(0.45, L.eyes);
  g.addColorStop(1, hexA('#ffffff', 0.9));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(ix, ey + 0.02 * u, ir, ir * 1.22, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(ix, ey + 0.02 * u, ir * 0.45, ir * 0.6, 0, 0, TAU);
  ctx.fill();
  // upper lid shadow
  ctx.fillStyle = 'rgba(60,30,40,0.25)';
  ctx.fillRect(ex - rx, ey - ry, rx * 2, ry * 0.5);
  ctx.restore();
  // catchlights
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ix - 0.12 * u, ey - 0.12 * u, 0.1 * u, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ix + 0.12 * u, ey + 0.16 * u, 0.05 * u, 0, TAU);
  ctx.fill();
  // lash line
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.2 * u;
  ctx.beginPath();
  const tilt = emote === 'angry' ? sx * 0.12 * u : emote === 'sad' ? -sx * 0.1 * u : 0;
  ctx.moveTo(ex - rx * 1.08, ey - ry * 0.25 + (sx < 0 ? -tilt : tilt));
  ctx.quadraticCurveTo(ex, ey - ry * 1.35, ex + rx * 1.12, ey - ry * 0.3 + (sx < 0 ? tilt : -tilt));
  ctx.stroke();
  ctx.lineWidth = 0.07 * u;
  ctx.beginPath();
  ctx.arc(ex, ey - ry * 0.2, rx * 0.95, Math.PI * 0.25, Math.PI * 0.75);
  ctx.stroke();
}

function drawBrows(ctx, L, u, emote) {
  ctx.strokeStyle = L.hair.sh;
  ctx.lineWidth = 0.2 * u;
  ctx.lineCap = 'round';
  for (const sx of [-1, 1]) {
    const inner = emote === 'angry' ? 0.25 : emote === 'sad' || emote === 'shock' ? -0.3 : 0;
    const outer = emote === 'smirk' && sx > 0 ? -0.15 : 0;
    ctx.beginPath();
    ctx.moveTo(sx * 0.35 * u, -0.55 * u + inner * u);
    ctx.quadraticCurveTo(sx * 0.85 * u, -0.85 * u, sx * 1.3 * u, -0.6 * u + outer * u);
    ctx.stroke();
  }
}

function drawMouth(ctx, u, emote, talking, t) {
  const my = 1.45 * u;
  const open = talking ? Math.max(0, Math.sin(t * 16)) : 0;
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#7a2230';
  ctx.lineWidth = 0.12 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (emote === 'laugh' || open > 0.35) {
    const h = emote === 'laugh' ? 0.55 : 0.35 * open;
    ctx.moveTo(-0.4 * u, my - 0.05 * u);
    ctx.quadraticCurveTo(0, my - 0.12 * u, 0.4 * u, my - 0.05 * u);
    ctx.quadraticCurveTo(0, my + h * u * 1.2, -0.4 * u, my - 0.05 * u);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e8828c';
    ctx.beginPath();
    ctx.ellipse(0, my + h * u * 0.6, 0.18 * u, 0.1 * u, 0, 0, TAU);
    ctx.fill();
  } else if (emote === 'shock') {
    ctx.ellipse(0, my, 0.2 * u, 0.26 * u, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else if (emote === 'smirk') {
    ctx.moveTo(-0.3 * u, my + 0.05 * u);
    ctx.quadraticCurveTo(0.15 * u, my + 0.15 * u, 0.45 * u, my - 0.18 * u);
    ctx.stroke();
  } else if (emote === 'angry') {
    ctx.moveTo(-0.35 * u, my + 0.12 * u);
    ctx.quadraticCurveTo(0, my - 0.14 * u, 0.35 * u, my + 0.12 * u);
    ctx.stroke();
  } else if (emote === 'sad') {
    ctx.moveTo(-0.28 * u, my + 0.1 * u);
    ctx.quadraticCurveTo(0, my - 0.06 * u, 0.28 * u, my + 0.1 * u);
    ctx.stroke();
  } else {
    ctx.moveTo(-0.25 * u, my);
    ctx.quadraticCurveTo(0, my + 0.08 * u, 0.25 * u, my);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- masks (original designs)
const EYE_HOLES = (ctx, u, r = 0.66) => {
  for (const sx of [-1, 1]) {
    ctx.moveTo(sx * 0.82 * u + r * u, 0.25 * u);
    ctx.ellipse(sx * 0.82 * u, 0.25 * u, r * u, r * 0.78 * u, 0, 0, TAU);
  }
};

function drawMask(ctx, L, u, t) {
  const M = L.mask;
  const ink = 0.1 * u;
  switch (M.kind) {
    case 'shard':
      part(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-2.05 * u, 0.15 * u);
        ctx.lineTo(-2.9 * u, -0.55 * u);
        ctx.lineTo(-1.6 * u, -0.5 * u);
        ctx.lineTo(0, -0.35 * u);
        ctx.lineTo(1.9 * u, -0.45 * u);
        ctx.lineTo(1.6 * u, 0.9 * u);
        ctx.lineTo(0.3 * u, 0.75 * u);
        ctx.lineTo(0, 1.05 * u);
        ctx.lineTo(-0.5 * u, 0.8 * u);
        ctx.lineTo(-1.8 * u, 1.1 * u);
        ctx.closePath();
        EYE_HOLES(ctx, u, 0.58);
      }, { rule: 'evenodd', fill: lin(ctx, -2 * u, -1 * u, 2 * u, 1 * u, [[0, '#3a3a48'], [1, M.c]]), rim: M.edge, rimW: 0.3 * u, key: 'rgba(255,255,255,0.5)', keyW: 0.2 * u, x0: -2.5 * u, x1: 2 * u, ink });
      ctx.strokeStyle = M.edge;
      ctx.lineWidth = 0.1 * u;
      ctx.beginPath();
      ctx.moveTo(-2.75 * u, -0.5 * u);
      ctx.lineTo(-1.5 * u, -0.35 * u);
      ctx.stroke();
      break;
    case 'plate':
      part(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-2.1 * u, -0.45 * u);
        ctx.lineTo(2.1 * u, -0.55 * u);
        ctx.lineTo(2.0 * u, 0.85 * u);
        ctx.lineTo(-2.0 * u, 0.95 * u);
        ctx.closePath();
      }, { fill: lin(ctx, 0, -0.5 * u, 0, u, [[0, '#8a8f9c'], [0.5, M.c], [1, '#22242b']]), rim: M.edge, rimW: 0.3 * u, key: 'rgba(255,255,255,0.6)', keyW: 0.25 * u, x0: -2 * u, x1: 2 * u, ink });
      ctx.save();
      ctx.shadowColor = M.edge;
      ctx.shadowBlur = 0.8 * u;
      ctx.fillStyle = M.edge;
      ctx.fillRect(-1.5 * u, 0.15 * u, 3 * u, 0.18 * u);
      ctx.fillStyle = '#fff8c0';
      ctx.fillRect(-1.2 * u + Math.sin(t * 2) * 0.6 * u, 0.17 * u, 0.6 * u, 0.13 * u);
      ctx.restore();
      for (const sx of [-1, 1]) {
        ctx.fillStyle = '#c9ccd4';
        ctx.beginPath();
        ctx.arc(sx * 1.75 * u, 0.2 * u, 0.13 * u, 0, TAU);
        ctx.fill();
      }
      break;
    case 'petal':
      for (const sx of [-1, 1]) {
        part(ctx, () => {
          ctx.beginPath();
          for (let i = 0; i < 5; i++) strand(ctx, sx * 0.82 * u, 0.25 * u, (sx > 0 ? -0.2 : Math.PI + 0.2) + (i - 2) * 0.42 * sx - (sx > 0 ? 0.3 : -0.3), (1.25 + (i === 1 ? 0.45 : 0)) * u, 0.42 * u, 0.15 * u * sx);
          EYE_HOLES(ctx, u, 0.56);
        }, { rule: 'evenodd', fill: lin(ctx, 0, -u, 0, u, [[0, M.edge], [1, M.c]]), ink: 0.08 * u, rim: '#ffffff', rimW: 0.2 * u, x0: -2 * u, x1: 2 * u });
      }
      break;
    case 'goggles':
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(-2.2 * u, -0.05 * u, 4.4 * u, 0.5 * u);
      for (const sx of [-1, 1]) {
        part(ctx, () => { ctx.beginPath(); ctx.arc(sx * 0.85 * u, 0.25 * u, 0.82 * u, 0, TAU); EYE_HOLES(ctx, u, 0.62); }, { rule: 'evenodd', fill: lin(ctx, 0, -0.6 * u, 0, u, [[0, '#d7dde6'], [1, '#6c7380']]), ink, key: 'rgba(255,255,255,0.8)', keyW: 0.2 * u, x0: -2 * u, x1: 2 * u });
        ctx.fillStyle = hexA(M.edge, 0.22);
        ctx.beginPath();
        ctx.arc(sx * 0.82 * u, 0.25 * u, 0.62 * u, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.ellipse(sx * 0.82 * u - 0.25 * u, 0.0, 0.18 * u, 0.09 * u, -0.6, 0, TAU);
        ctx.fill();
      }
      break;
    case 'crescent':
      part(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(0.05 * u, -1.9 * u);
        ctx.bezierCurveTo(2.6 * u, -1.6 * u, 2.6 * u, 1.6 * u, 0.3 * u, 2.0 * u);
        ctx.bezierCurveTo(1.6 * u, 1.0 * u, 1.5 * u, -1.0 * u, 0.05 * u, -1.9 * u);
        ctx.moveTo(0.82 * u + 0.5 * u, 0.25 * u);
        ctx.ellipse(0.82 * u, 0.25 * u, 0.5 * u, 0.4 * u, 0, 0, TAU);
      }, { rule: 'evenodd', fill: lin(ctx, 0, -2 * u, 0, 2 * u, [[0, '#ffffff'], [1, '#c9d9e6']]), rim: M.edge, rimW: 0.3 * u, x0: 0, x1: 2.2 * u, ink });
      ctx.strokeStyle = M.edge;
      ctx.lineWidth = 0.09 * u;
      ctx.beginPath();
      ctx.arc(1.55 * u, -0.9 * u, 0.25 * u, 0, TAU);
      ctx.stroke();
      break;
    case 'circuit': {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = M.c;
      ctx.shadowColor = M.c;
      ctx.shadowBlur = 0.6 * u;
      ctx.lineWidth = 0.1 * u;
      const pulseK = 0.6 + 0.4 * Math.sin(t * 4);
      ctx.globalAlpha *= pulseK;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * 0.2 * u, -0.25 * u);
        ctx.lineTo(sx * 1.4 * u, -0.25 * u);
        ctx.lineTo(sx * 1.75 * u, 0.2 * u);
        ctx.lineTo(sx * 1.75 * u, 0.9 * u);
        ctx.lineTo(sx * 1.2 * u, 1.2 * u);
        ctx.stroke();
        ctx.fillStyle = M.edge;
        ctx.beginPath();
        ctx.arc(sx * 1.2 * u, 1.2 * u, 0.12 * u, 0, TAU);
        ctx.arc(sx * 1.75 * u, 0.2 * u, 0.1 * u, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'veil':
      ctx.save();
      ctx.globalAlpha *= 0.82;
      part(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-2.0 * u, -0.5 * u);
        ctx.bezierCurveTo(-0.8 * u, -0.8 * u, 0.8 * u, -0.8 * u, 2.0 * u, -0.5 * u);
        ctx.lineTo(1.85 * u, 0.9 * u);
        for (let i = 0; i <= 8; i++) ctx.lineTo(1.85 * u - (i / 8) * 3.7 * u, 0.9 * u + (i % 2) * 0.25 * u);
        ctx.closePath();
      }, { fill: hexA(M.c, 0.72), ink: 0.07 * u, rim: M.edge, rimW: 0.25 * u, x0: -2 * u, x1: 2 * u });
      ctx.restore();
      ctx.strokeStyle = M.edge;
      ctx.lineWidth = 0.12 * u;
      ctx.beginPath();
      ctx.moveTo(-2.0 * u, -0.5 * u);
      ctx.bezierCurveTo(-0.8 * u, -0.8 * u, 0.8 * u, -0.8 * u, 2.0 * u, -0.5 * u);
      ctx.stroke();
      ctx.fillStyle = M.edge;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(-1.6 * u + i * 0.8 * u, 1.25 * u + Math.sin(t * 3 + i) * 0.05 * u, 0.09 * u, 0, TAU);
        ctx.fill();
      }
      break;
    case 'band':
      part(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-2.2 * u, -0.25 * u);
        ctx.lineTo(2.3 * u, -0.6 * u);
        ctx.lineTo(2.2 * u, 0.55 * u);
        ctx.lineTo(-2.1 * u, 0.85 * u);
        ctx.closePath();
      }, { fill: lin(ctx, -2 * u, 0, 2 * u, 0, [[0, hexA(M.c, 0.75)], [1, hexA(M.edge, 0.55)]]), ink: 0.09 * u, rim: M.edge, rimW: 0.3 * u, x0: -2 * u, x1: 2.3 * u });
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 0.08 * u;
      ctx.beginPath();
      ctx.moveTo(-1.8 * u, -0.08 * u);
      ctx.lineTo(1.9 * u, -0.38 * u);
      ctx.stroke();
      break;
    case 'opera':
      part(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-2.0 * u, -1.6 * u);
        ctx.bezierCurveTo(-0.6 * u, -2.0 * u, 0.6 * u, -2.0 * u, 2.0 * u, -1.6 * u);
        ctx.bezierCurveTo(2.2 * u, 0.2 * u, 1.6 * u, 1.2 * u, 0.6 * u, 1.0 * u);
        ctx.lineTo(0, 0.6 * u);
        ctx.lineTo(-0.6 * u, 1.0 * u);
        ctx.bezierCurveTo(-1.6 * u, 1.2 * u, -2.2 * u, 0.2 * u, -2.0 * u, -1.6 * u);
        ctx.closePath();
        EYE_HOLES(ctx, u, 0.55);
      }, { rule: 'evenodd', fill: lin(ctx, 0, -2 * u, 0, u, [[0, '#ffffff'], [1, M.c]]), rim: M.edge, rimW: 0.32 * u, key: 'rgba(255,255,255,0.7)', keyW: 0.2 * u, x0: -2 * u, x1: 2 * u, ink, shadow: 'rgba(120,100,80,0.25)', shadowFn: () => ctx.fillRect(0.4 * u, -2 * u, 2 * u, 4 * u) });
      ctx.strokeStyle = M.edge;
      ctx.lineWidth = 0.08 * u;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * 0.3 * u, -1.0 * u);
        ctx.bezierCurveTo(sx * 0.9 * u, -1.6 * u, sx * 1.6 * u, -1.2 * u, sx * 1.7 * u, -0.6 * u);
        ctx.stroke();
      }
      break;
    default:
  }
}

/** Head centred at (0,0). Draws ears, face, features, mask and fringe (not the back hair). */
function drawHead(ctx, L, u, o) {
  const { emote = 'neutral', t = 0, talking = false } = o;
  const blink = Math.sin(t * 1.3 + (o.phase || 0)) > 0.985 ? 0.1 : 1;
  const look = Math.sin(t * 0.6 + (o.phase || 0)) * 0.4;
  const S = L.skin;
  // ears
  for (const sx of [-1, 1]) {
    part(ctx, () => { ctx.beginPath(); ctx.ellipse(sx * 1.85 * u, 0.25 * u, 0.32 * u, 0.55 * u, 0, 0, TAU); }, { fill: S.c, ink: 0.09 * u, shadow: S.sh, shadowFn: () => ctx.fillRect(sx * 1.85 * u - 0.1 * u, -u, 0.5 * u, 2 * u) });
  }
  // face with cel shadow on the right and hair-cast shadow
  const H = L.hair;
  const S2 = fringeStrands(H, u, t);
  part(ctx, () => facePath(ctx, u), {
    fill: lin(ctx, -2 * u, -2 * u, 2 * u, 2 * u, [[0, '#fff3ea'], [0.4, S.c], [1, S.c]]),
    ink: 0.11 * u,
    rim: L.accent, rimW: 0.35 * u, x0: -1.9 * u, x1: 1.9 * u,
    shadow: S.sh,
    shadowFn: () => {
      ctx.beginPath();
      ctx.moveTo(0.9 * u, -2.5 * u);
      ctx.bezierCurveTo(1.7 * u, -0.5 * u, 1.2 * u, 1.5 * u, 0.2 * u, 2.6 * u);
      ctx.lineTo(3 * u, 3 * u);
      ctx.lineTo(3 * u, -3 * u);
      ctx.fill();
      fringePath(ctx, S2, 0.35 * u);
      ctx.fill();
      capPath(ctx, H, u);
      ctx.save();
      ctx.translate(0, 0.35 * u);
      ctx.fill();
      ctx.restore();
    },
  });
  // blush
  ctx.fillStyle = 'rgba(255,120,130,0.18)';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * 1.05 * u, 0.95 * u, 0.42 * u, 0.2 * u, 0, 0, TAU);
    ctx.fill();
  }
  const hidesEyes = L.mask.kind === 'plate';
  if (!hidesEyes) {
    drawEye(ctx, L, u, -1, emote, blink, look);
    drawEye(ctx, L, u, 1, emote, blink, look);
  }
  // nose
  ctx.strokeStyle = hexA(S.sh, 0.9);
  ctx.lineWidth = 0.09 * u;
  ctx.beginPath();
  ctx.moveTo(0.05 * u, 0.7 * u);
  ctx.lineTo(0.15 * u, 0.95 * u);
  ctx.stroke();
  drawMouth(ctx, u, emote, talking, t);
  drawMask(ctx, L, u, t);
  if (!hidesEyes && L.mask.kind !== 'opera' && L.mask.kind !== 'shard') drawBrows(ctx, L, u, emote);
  drawHairFront(ctx, L, u, t);
}

// ---------------------------------------------------------------- outfits (bust)
function torsoPath(ctx, u) {
  ctx.beginPath();
  ctx.moveTo(-4.4 * u, 0.3 * u);
  ctx.bezierCurveTo(-4.3 * u, -1.9 * u, -3.6 * u, -2.75 * u, -1.35 * u, -3.25 * u);
  ctx.lineTo(1.35 * u, -3.25 * u);
  ctx.bezierCurveTo(3.6 * u, -2.75 * u, 4.3 * u, -1.9 * u, 4.4 * u, 0.3 * u);
  ctx.closePath();
}

function drawOutfit(ctx, L, u, t) {
  const C = L.outfit;
  const coatFill = lin(ctx, -4 * u, -3.4 * u, 3 * u, 0.5 * u, [[0, C.coat], [1, C.coat2]]);
  const cel = () => {
    ctx.beginPath();
    ctx.moveTo(1.2 * u, -3.4 * u);
    ctx.bezierCurveTo(2.6 * u, -2.2 * u, 1.8 * u, -0.8 * u, 2.4 * u, 0.5 * u);
    ctx.lineTo(5 * u, 0.5 * u);
    ctx.lineTo(5 * u, -3.4 * u);
    ctx.fill();
  };
  // back collar layers
  if (C.kind === 'longcoat' || C.kind === 'greatcoat') {
    for (const sx of [-1, 1]) {
      part(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(sx * 0.8 * u, -3.2 * u);
        ctx.lineTo(sx * 1.7 * u, -5.0 * u);
        ctx.lineTo(sx * 2.4 * u, -3.0 * u);
        ctx.lineTo(sx * 1.9 * u, -2.4 * u);
        ctx.closePath();
      }, { fill: C.coat2, ink: 0.1 * u, rim: C.inner, rimW: 0.3 * u, x0: -2.4 * u, x1: 2.4 * u });
    }
  }
  if (C.kind === 'hoodie' || C.kind === 'parka') {
    part(ctx, () => { ctx.beginPath(); ctx.ellipse(0, -3.4 * u, 2.9 * u, 1.3 * u, 0, Math.PI, TAU); ctx.lineTo(2.9 * u, -3.0 * u); ctx.lineTo(-2.9 * u, -3.0 * u); }, { fill: C.coat2, ink: 0.1 * u });
    if (C.kind === 'parka') {
      ctx.fillStyle = '#d8d2c4';
      for (let i = 0; i < 12; i++) {
        const a = Math.PI + (i / 11) * Math.PI;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 2.8 * u, -3.3 * u + Math.sin(a) * 1.25 * u, 0.32 * u, 0, TAU);
        ctx.fill();
      }
    }
  }
  // torso
  part(ctx, () => torsoPath(ctx, u), { fill: coatFill, ink: 0.12 * u, shadow: 'rgba(0,0,0,0.32)', shadowFn: cel, rim: L.accent, rimW: 0.45 * u, key: 'rgba(255,255,255,0.22)', keyW: 0.4 * u, x0: -4.4 * u, x1: 4.4 * u });
  // inner shirt / opening
  const opening = () => {
    ctx.beginPath();
    const deep = C.kind === 'tails' || C.kind === 'longcoat' || C.kind === 'greatcoat' ? 2.0 : C.kind === 'robe' ? 1.4 : 1.1;
    ctx.moveTo(-1.15 * u, -3.25 * u);
    ctx.lineTo(0, -3.25 * u + deep * u);
    ctx.lineTo(1.15 * u, -3.25 * u);
    ctx.closePath();
  };
  part(ctx, opening, { fill: C.inner, ink: 0.08 * u, shadow: 'rgba(0,0,0,0.25)', shadowFn: () => ctx.fillRect(0, -3.4 * u, 2 * u, 3 * u) });
  ctx.strokeStyle = C.trim;
  ctx.lineWidth = 0.14 * u;
  ctx.lineJoin = 'round';
  switch (C.kind) {
    case 'longcoat':
      ctx.beginPath();
      ctx.moveTo(-1.15 * u, -3.25 * u);
      ctx.lineTo(-0.2 * u, -1.0 * u);
      ctx.lineTo(-0.4 * u, 0.3 * u);
      ctx.moveTo(1.15 * u, -3.25 * u);
      ctx.lineTo(0.2 * u, -1.0 * u);
      ctx.lineTo(0.4 * u, 0.3 * u);
      ctx.stroke();
      ctx.fillStyle = C.inner;
      ctx.beginPath();
      ctx.moveTo(0, -1.25 * u);
      ctx.lineTo(0.25 * u, -0.95 * u);
      ctx.lineTo(0, -0.65 * u);
      ctx.lineTo(-0.25 * u, -0.95 * u);
      ctx.fill();
      break;
    case 'bomber':
      ctx.fillStyle = C.coat2;
      ctx.beginPath();
      ctx.ellipse(0, -3.2 * u, 1.6 * u, 0.42 * u, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0.15 * u, -2.2 * u);
      ctx.lineTo(0.25 * u, 0.3 * u);
      ctx.stroke();
      ctx.fillStyle = C.trim;
      ctx.fillRect(-3.4 * u, -1.6 * u, 1.1 * u, 0.5 * u);
      ctx.fillStyle = INK;
      ctx.fillRect(-3.3 * u, -1.5 * u, 0.9 * u, 0.12 * u);
      break;
    case 'capelet':
      part(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-1.2 * u, -3.3 * u);
        ctx.bezierCurveTo(-3.8 * u, -3.0 * u, -4.5 * u, -1.8 * u, -4.4 * u, -1.0 * u);
        for (let i = 0; i <= 8; i++) ctx.lineTo(-4.4 * u + (i / 8) * 8.8 * u, -1.0 * u + (i % 2 ? 0.55 * u : 0) + Math.sin(t * 3 + i) * 0.06 * u);
        ctx.bezierCurveTo(4.5 * u, -1.8 * u, 3.8 * u, -3.0 * u, 1.2 * u, -3.3 * u);
        ctx.closePath();
      }, { fill: lin(ctx, 0, -3.3 * u, 0, 0, [[0, C.inner], [1, '#5c0820']]), ink: 0.1 * u, rim: C.trim, rimW: 0.35 * u, x0: -4 * u, x1: 4 * u, shadow: 'rgba(0,0,0,0.3)', shadowFn: cel });
      ctx.fillStyle = C.trim;
      ctx.beginPath();
      ctx.arc(0, -2.9 * u, 0.3 * u, 0, TAU);
      ctx.fill();
      break;
    case 'flight':
      ctx.fillStyle = '#efe6d6';
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.arc(-2.4 * u + i * 0.6 * u, -3.0 * u + Math.abs(i - 4) * 0.12 * u, 0.42 * u, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(-2.9 * u, -1.9 * u, 0.9 * u, 0.3 * u);
      ctx.fillRect(-2.6 * u, -2.2 * u, 0.3 * u, 0.9 * u);
      ctx.strokeStyle = '#e8394d';
      ctx.lineWidth = 0.08 * u;
      ctx.strokeRect(-3.0 * u, -2.3 * u, 1.1 * u, 1.1 * u);
      break;
    case 'robe':
      ctx.beginPath();
      ctx.moveTo(-1.6 * u, -3.25 * u);
      ctx.lineTo(0.6 * u, 0.3 * u);
      ctx.moveTo(1.6 * u, -3.25 * u);
      ctx.lineTo(-0.2 * u, -1.4 * u);
      ctx.lineWidth = 0.32 * u;
      ctx.stroke();
      ctx.fillStyle = C.inner;
      ctx.fillRect(-4.3 * u, -0.6 * u, 8.6 * u, 0.55 * u);
      ctx.strokeStyle = C.trim;
      ctx.lineWidth = 0.08 * u;
      ctx.strokeRect(-4.3 * u, -0.6 * u, 8.6 * u, 0.55 * u);
      break;
    case 'hoodie':
      ctx.strokeStyle = '#e8e2d8';
      ctx.lineWidth = 0.1 * u;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * 0.6 * u, -2.6 * u);
        ctx.lineTo(sx * 0.7 * u + Math.sin(t * 2 + sx) * 0.05 * u, -1.1 * u);
        ctx.stroke();
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = C.inner;
      ctx.shadowColor = C.inner;
      ctx.shadowBlur = 0.6 * u;
      ctx.lineWidth = 0.12 * u;
      ctx.beginPath();
      ctx.ellipse(-2.6 * u, -1.4 * u, 0.6 * u, 0.6 * u, 0, t, t + 4.5);
      ctx.stroke();
      ctx.restore();
      break;
    case 'gown':
      for (const sx of [-1, 1]) {
        part(ctx, () => {
          ctx.beginPath();
          ctx.ellipse(sx * 3.1 * u, -2.3 * u, 1.45 * u, 0.95 * u, sx * 0.4, 0, TAU);
        }, { fill: lin(ctx, 0, -3.2 * u, 0, -1.4 * u, [[0, '#eef0f5'], [1, '#7c8090']]), ink: 0.1 * u, rim: C.trim, rimW: 0.3 * u, x0: -4.4 * u, x1: 4.4 * u });
        ctx.strokeStyle = C.trim;
        ctx.lineWidth = 0.12 * u;
        ctx.beginPath();
        ctx.ellipse(sx * 3.1 * u, -2.3 * u, 1.1 * u, 0.65 * u, sx * 0.4, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = C.trim;
      ctx.beginPath();
      ctx.moveTo(-0.5 * u, -2.0 * u);
      ctx.lineTo(0, -1.2 * u);
      ctx.lineTo(0.5 * u, -2.0 * u);
      ctx.lineTo(0, -2.4 * u);
      ctx.fill();
      break;
    case 'greatcoat':
      for (const sx of [-1, 1]) {
        ctx.fillStyle = C.trim;
        ctx.fillRect(sx > 0 ? 2.1 * u : -3.6 * u, -3.0 * u, 1.5 * u, 0.4 * u);
        for (let i = 0; i < 5; i++) ctx.fillRect((sx > 0 ? 2.15 : -3.55) * u + i * 0.3 * u, -2.6 * u, 0.1 * u, 0.45 * u);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = '#d9cfa8';
          ctx.beginPath();
          ctx.arc(sx * 0.9 * u, -2.0 * u + i * 0.8 * u, 0.15 * u, 0, TAU);
          ctx.fill();
        }
      }
      ctx.stroke();
      break;
    case 'idol':
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.ellipse(-1.8 * u + i * 0.6 * u, -3.1 * u, 0.4 * u, 0.25 * u, 0, 0, TAU);
        ctx.fill();
      }
      part(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(0, -2.6 * u);
        ctx.lineTo(-1.1 * u, -3.1 * u);
        ctx.lineTo(-1.0 * u, -2.0 * u);
        ctx.closePath();
        ctx.moveTo(0, -2.6 * u);
        ctx.lineTo(1.1 * u, -3.1 * u);
        ctx.lineTo(1.0 * u, -2.0 * u);
        ctx.closePath();
      }, { fill: C.inner, ink: 0.08 * u });
      break;
    case 'tails':
      ctx.fillStyle = '#f4f0e6';
      ctx.beginPath();
      ctx.moveTo(-0.9 * u, -3.25 * u);
      ctx.lineTo(0, -1.0 * u);
      ctx.lineTo(0.9 * u, -3.25 * u);
      ctx.fill();
      ctx.fillStyle = C.trim;
      ctx.beginPath();
      ctx.moveTo(0, -2.9 * u);
      ctx.lineTo(-0.55 * u, -3.2 * u);
      ctx.lineTo(-0.55 * u, -2.6 * u);
      ctx.closePath();
      ctx.moveTo(0, -2.9 * u);
      ctx.lineTo(0.55 * u, -3.2 * u);
      ctx.lineTo(0.55 * u, -2.6 * u);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'parka':
      ctx.beginPath();
      ctx.moveTo(0, -2.3 * u);
      ctx.lineTo(0, 0.3 * u);
      ctx.stroke();
      break;
    default:
  }
}

// ---------------------------------------------------------------- public: bust
/**
 * Draw a character bust. (x, y) = bottom-centre; s = bust height in pixels.
 * o: { emote, flip, alpha, t, talking, phase }
 */
export function drawPortrait(ctx, id, x, y, s, o = {}) {
  const img = assets.get(`portrait.${id}`);
  if (img) {
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.translate(x, y);
    if (o.flip) ctx.scale(-1, 1);
    const h = s * 1.15;
    ctx.drawImage(img, (-img.width * h) / img.height / 2, -h, (img.width * h) / img.height, h);
    ctx.restore();
    return;
  }
  const L = LOOKS[id];
  if (!L) return;
  const t = o.t || 0;
  const u = s / 10;
  const breathe = Math.sin(t * 1.6 + (o.phase || 0)) * 0.04 * u;
  const hy = -5.55 * u + breathe;
  ctx.save();
  ctx.translate(x, y);
  if (o.flip) ctx.scale(-1, 1);
  ctx.beginPath();
  ctx.rect(-20 * u, -20 * u, 40 * u, 20 * u);
  ctx.clip();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // back hair
  ctx.save();
  ctx.translate(0, hy);
  hairExtras(ctx, L, u, t, false);
  part(ctx, () => hairBackPath(ctx, L.hair, u), { fill: lin(ctx, 0, -2 * u, 0, 8 * u, [[0, L.hair.c], [1, L.hair.sh]]), inkUnder: 0.1 * u, rim: L.accent, rimW: 0.4 * u, x0: -3 * u, x1: 3 * u });
  ctx.restore();
  ctx.save();
  ctx.translate(0, breathe * 0.5);
  drawOutfit(ctx, L, u, t);
  ctx.restore();
  // neck
  part(ctx, () => { ctx.beginPath(); ctx.moveTo(-0.62 * u, hy + 1.4 * u); ctx.lineTo(-0.7 * u, -2.9 * u); ctx.lineTo(0.7 * u, -2.9 * u); ctx.lineTo(0.62 * u, hy + 1.4 * u); ctx.closePath(); }, { fill: L.skin.c, ink: 0.1 * u, shadow: L.skin.sh, shadowFn: () => { ctx.fillRect(-u, hy + 1.4 * u, 2 * u, 1.0 * u); ctx.fillRect(0.2 * u, hy, u, 4 * u); } });
  ctx.save();
  ctx.translate(0, hy);
  drawHead(ctx, L, u, { emote: o.emote || 'neutral', t, talking: o.talking, phase: o.phase });
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- public: battle token
export const CLASS_GLYPH = { vanguard: '⚑', guard: '⚔', defender: '⛨', caster: '✦', sniper: '➶', artillery: '◉', medic: '✚', support: '❖' };

function limb(ctx, x0, y0, x1, y1, w0, w1, fill) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
  ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
  ctx.arc(x1, y1, w1, a + Math.PI / 2, a - Math.PI / 2, true);
  ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
  ctx.arc(x0, y0, w0, a - Math.PI / 2, a + Math.PI / 2, true);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function weapon(ctx, kind, F, L, atk, t) {
  ctx.lineWidth = F * 0.018;
  ctx.strokeStyle = INK;
  const acc = L.accent;
  switch (kind) {
    case 'knives':
      ctx.rotate(-0.6 - atk * 1.8);
      ctx.fillStyle = '#e8edf5';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(F * 0.04, -F * 0.03);
      ctx.lineTo(F * 0.24, 0);
      ctx.lineTo(F * 0.04, F * 0.03);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = acc;
      ctx.fillRect(-F * 0.05, -F * 0.02, F * 0.06, F * 0.04);
      break;
    case 'hammer':
      ctx.rotate(-1.3 + atk * 2.2);
      ctx.fillStyle = '#5a4a3a';
      ctx.fillRect(-F * 0.02, -F * 0.3, F * 0.04, F * 0.36);
      ctx.fillStyle = '#9aa0ab';
      ctx.fillRect(-F * 0.09, -F * 0.38, F * 0.18, F * 0.1);
      ctx.strokeRect(-F * 0.09, -F * 0.38, F * 0.18, F * 0.1);
      ctx.fillStyle = acc;
      ctx.fillRect(-F * 0.09, -F * 0.345, F * 0.18, F * 0.025);
      break;
    case 'flame': {
      const r = F * (0.07 + atk * 0.05);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(F * 0.06, -F * 0.08, 0, F * 0.06, -F * 0.08, r * 2);
      g.addColorStop(0, '#fff3c0');
      g.addColorStop(0.35, '#ff8a2a');
      g.addColorStop(1, 'rgba(255,40,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(F * 0.06, -F * 0.08 - Math.sin(t * 8) * F * 0.01, r * 2, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'drone': {
      ctx.save();
      ctx.translate(F * 0.12, -F * 0.42 + Math.sin(t * 4) * F * 0.03);
      ctx.fillStyle = '#e8eef6';
      ctx.beginPath();
      ctx.ellipse(0, 0, F * 0.08, F * 0.04, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e8394d';
      ctx.fillRect(-F * 0.012, -F * 0.03, F * 0.024, F * 0.06);
      ctx.fillRect(-F * 0.03, -F * 0.012, F * 0.06, F * 0.024);
      ctx.strokeStyle = hexA(acc, 0.8);
      ctx.beginPath();
      ctx.ellipse(-F * 0.09, -F * 0.04, F * 0.05, F * 0.01, 0, 0, TAU);
      ctx.ellipse(F * 0.09, -F * 0.04, F * 0.05, F * 0.01, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'rifle':
      ctx.rotate(-0.1 - atk * 0.15);
      ctx.translate(-atk * F * 0.04, 0);
      ctx.fillStyle = '#d8dee8';
      ctx.fillRect(-F * 0.12, -F * 0.03, F * 0.46, F * 0.05);
      ctx.strokeRect(-F * 0.12, -F * 0.03, F * 0.46, F * 0.05);
      ctx.fillStyle = '#2a3346';
      ctx.fillRect(F * 0.02, -F * 0.07, F * 0.1, F * 0.04);
      ctx.fillStyle = acc;
      ctx.fillRect(F * 0.3, -F * 0.02, F * 0.04, F * 0.03);
      if (atk > 0.7) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#fff6c0';
        ctx.beginPath();
        ctx.arc(F * 0.37, -F * 0.005, F * 0.05 * atk, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      break;
    case 'tablet':
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hexA(acc, 0.35);
      ctx.strokeStyle = acc;
      ctx.beginPath();
      ctx.rect(F * 0.02, -F * 0.16, F * 0.16, F * 0.11);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hexA('#ffffff', 0.7);
      for (let i = 0; i < 3; i++) ctx.fillRect(F * 0.04, -F * 0.14 + i * F * 0.03, F * (0.05 + ((i * 37 + Math.floor(t * 6)) % 9) * 0.01), F * 0.012);
      ctx.globalCompositeOperation = 'source-over';
      break;
    case 'shield':
      ctx.fillStyle = lin(ctx, 0, -F * 0.3, 0, F * 0.1, [[0, '#eef0f5'], [1, '#6f7484']]);
      ctx.beginPath();
      ctx.moveTo(-F * 0.02, -F * 0.3);
      ctx.lineTo(F * 0.16, -F * 0.26);
      ctx.lineTo(F * 0.16, F * 0.0);
      ctx.lineTo(F * 0.07, F * 0.1);
      ctx.lineTo(-F * 0.02, F * 0.0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = acc;
      ctx.lineWidth = F * 0.014;
      ctx.beginPath();
      ctx.moveTo(F * 0.07, -F * 0.24);
      ctx.lineTo(F * 0.07, F * 0.04);
      ctx.moveTo(F * 0.01, -F * 0.12);
      ctx.lineTo(F * 0.13, -F * 0.12);
      ctx.stroke();
      break;
    case 'launcher':
      ctx.rotate(-0.35 - atk * 0.2);
      ctx.fillStyle = '#3a3e52';
      ctx.fillRect(-F * 0.14, -F * 0.07, F * 0.38, F * 0.09);
      ctx.strokeRect(-F * 0.14, -F * 0.07, F * 0.38, F * 0.09);
      ctx.fillStyle = acc;
      ctx.fillRect(F * 0.2, -F * 0.075, F * 0.05, F * 0.1);
      break;
    default:
  }
}

/**
 * Battle token: animated full-body chibi on a lit base. (x, y) = token centre.
 * o: { dir, t, phase, noTag, atk (0..1 attack swing), hurt, skill }
 */
export function drawToken(ctx, id, x, y, size, o = {}) {
  const def = OPERATORS[id];
  const L = LOOKS[id];
  const t = o.t || 0;
  const F = size;
  const atk = clamp(o.atk || 0, 0, 1);
  ctx.save();
  ctx.translate(x, y + F * 0.3);
  // base: soft contact shadow + class-coloured ring
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, F * 0.4);
  sh.addColorStop(0, 'rgba(0,0,0,0.6)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.save();
  ctx.scale(1, 0.38);
  ctx.beginPath();
  ctx.arc(0, 0, F * 0.42, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = hexA(def.color, 0.85);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, F * 0.34, F * 0.12, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = hexA(def.color, 0.3);
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();
  // facing wedge
  if (o.dir != null) {
    const a = [0, Math.PI / 2, Math.PI, -Math.PI / 2][o.dir];
    ctx.save();
    ctx.scale(1, 0.36);
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * F * 0.5, Math.sin(a) * F * 0.5);
    ctx.lineTo(Math.cos(a + 0.35) * F * 0.38, Math.sin(a + 0.35) * F * 0.38);
    ctx.lineTo(Math.cos(a - 0.35) * F * 0.38, Math.sin(a - 0.35) * F * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // figure
  const flip = o.dir === 2 ? -1 : 1;
  ctx.scale(flip, 1);
  const breathe = Math.sin(t * 3 + (o.phase || 0));
  const lunge = Math.sin(atk * Math.PI) * F * 0.08;
  ctx.translate(lunge, 0);
  if (L) {
    const C = L.outfit;
    ctx.lineWidth = F * 0.016;
    ctx.lineJoin = 'round';
    const hipY = -F * 0.22;
    const neckY = -F * 0.5 - breathe * F * 0.008;
    // legs
    const stride = Math.sin(atk * Math.PI) * F * 0.05;
    limb(ctx, -F * 0.05, hipY, -F * 0.07 - stride, -F * 0.01, F * 0.04, F * 0.032, '#1c1a24');
    limb(ctx, F * 0.05, hipY, F * 0.07 + stride, -F * 0.01, F * 0.04, F * 0.032, '#24222e');
    ctx.fillStyle = INK;
    ctx.fillRect(-F * 0.11 - stride, -F * 0.03, F * 0.08, F * 0.035);
    ctx.fillRect(F * 0.04 + stride, -F * 0.03, F * 0.09, F * 0.035);
    // back arm
    limb(ctx, -F * 0.1, neckY + F * 0.05, -F * 0.15, neckY + F * 0.2, F * 0.035, F * 0.03, C.coat2);
    // coat tails
    const long = ['longcoat', 'greatcoat', 'robe', 'gown', 'tails', 'capelet'].includes(C.kind);
    if (long) {
      const fl = Math.sin(t * 5 + (o.phase || 0)) * F * 0.02 - lunge * 0.5;
      ctx.beginPath();
      ctx.moveTo(-F * 0.12, neckY + F * 0.12);
      ctx.lineTo(-F * 0.18 + fl, -F * (C.kind === 'gown' ? 0.02 : 0.07));
      ctx.lineTo(F * (C.kind === 'gown' ? 0.18 : 0.02), -F * (C.kind === 'gown' ? 0.02 : 0.1));
      ctx.lineTo(F * 0.12, neckY + F * 0.12);
      ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, neckY, 0, 0, [[0, C.coat], [1, C.coat2]]);
      ctx.fill();
      ctx.stroke();
    }
    // torso
    part(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-F * 0.13, neckY + F * 0.03);
      ctx.quadraticCurveTo(-F * 0.15, hipY - F * 0.08, -F * 0.1, hipY + F * 0.02);
      ctx.lineTo(F * 0.1, hipY + F * 0.02);
      ctx.quadraticCurveTo(F * 0.15, hipY - F * 0.08, F * 0.13, neckY + F * 0.03);
      ctx.closePath();
    }, { fill: lin(ctx, -F * 0.13, neckY, F * 0.13, hipY, [[0, C.coat], [1, C.coat2]]), ink: F * 0.016, rim: L.accent, rimW: F * 0.05, x0: -F * 0.13, x1: F * 0.13, shadow: 'rgba(0,0,0,0.3)', shadowFn: () => ctx.fillRect(F * 0.03, neckY, F * 0.2, F * 0.4) });
    ctx.fillStyle = C.inner;
    ctx.beginPath();
    ctx.moveTo(-F * 0.045, neckY + F * 0.03);
    ctx.lineTo(0, neckY + F * 0.12);
    ctx.lineTo(F * 0.045, neckY + F * 0.03);
    ctx.fill();
    ctx.fillStyle = C.trim;
    ctx.fillRect(-F * 0.1, hipY - F * 0.02, F * 0.2, F * 0.025);
    // front arm + weapon
    const ax = F * 0.13;
    const ay = neckY + F * 0.05;
    const hx = ax + F * 0.06 + atk * F * 0.08;
    const hy = ay + F * 0.14 - atk * F * 0.05;
    limb(ctx, ax, ay, hx, hy, F * 0.038, F * 0.032, C.coat);
    ctx.save();
    ctx.translate(hx, hy);
    weapon(ctx, L.weapon, F, L, atk, t);
    ctx.restore();
    ctx.fillStyle = L.skin.c;
    ctx.beginPath();
    ctx.arc(hx, hy, F * 0.026, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // head
    const u = F * 0.072;
    ctx.save();
    ctx.translate(F * 0.01, neckY - 2.0 * u);
    ctx.rotate(-atk * 0.12);
    hairExtras(ctx, L, u, t, false);
    part(ctx, () => hairBackPath(ctx, L.hair, u), { fill: L.hair.c, ink: 0.14 * u });
    drawHead(ctx, L, u, { emote: o.hurt ? 'angry' : atk > 0.3 ? 'angry' : 'neutral', t, phase: o.phase });
    ctx.restore();
  }
  ctx.restore();
  // class tag
  if (!o.noTag) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#000c';
    ctx.beginPath();
    ctx.arc(-F * 0.36, F * 0.26, F * 0.1, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.font = `${F * 0.13}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(CLASS_GLYPH[def.class] || '•', -F * 0.36, F * 0.27);
    ctx.restore();
  }
  return L;
}

export const classLabel = (def) => CLASSES[def.class].label;
