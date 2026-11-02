// Procedural character portraits / battle tokens (stand-in art, swap via assets manifest).
import { LOOKS } from '../data/looks.js';
import { OPERATORS, CLASSES } from '../data/operators.js';
import { assets } from '../core/assets.js';
import { TAU, hexA } from '../core/util.js';
import { poly } from './draw.js';

function hairBack(ctx, L, u) {
  ctx.fillStyle = L.hair;
  switch (L.style) {
    case 'twin':
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * 2.4 * u, -3.2 * u, 0.9 * u, 2.6 * u, sx * 0.15, 0, TAU);
        ctx.fill();
      }
      break;
    case 'long':
    case 'wavy':
      ctx.beginPath();
      ctx.ellipse(0, -4 * u, 2.6 * u, 3.3 * u, 0, 0, TAU);
      ctx.fill();
      break;
    case 'bob':
      ctx.beginPath();
      ctx.ellipse(0, -4.8 * u, 2.3 * u, 2.7 * u, 0, 0, TAU);
      ctx.fill();
      break;
    case 'slick':
      ctx.beginPath();
      ctx.ellipse(0, -5.6 * u, 2.1 * u, 2.5 * u, 0, 0, TAU);
      ctx.fill();
      break;
    default:
  }
}

function hairFront(ctx, L, u, hy) {
  ctx.fillStyle = L.hair;
  const rx = 1.95 * u;
  switch (L.style) {
    case 'curly':
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rx * 0.95, hy - 0.5 * u + Math.sin(a) * 2.0 * u, 0.7 * u, 0, TAU);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(0, hy - 0.9 * u, rx, 1.5 * u, 0, Math.PI, TAU);
      ctx.fill();
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(-1.5 * u + i * 0.75 * u, hy - 0.9 * u + (i % 2) * 0.35 * u, 0.5 * u, 0, TAU);
        ctx.fill();
      }
      break;
    case 'spiky':
      ctx.beginPath();
      ctx.ellipse(0, hy - 0.8 * u, rx, 1.4 * u, 0, Math.PI, TAU);
      ctx.fill();
      for (let i = 0; i < 7; i++) {
        const x = -1.9 * u + i * 0.63 * u;
        poly(ctx, [[x - 0.4 * u, hy - 1.6 * u], [x + 0.1 * u, hy - 3.1 * u - (i % 2) * 0.5 * u], [x + 0.6 * u, hy - 1.6 * u]]);
        ctx.fill();
      }
      break;
    case 'twin':
    case 'bob':
    case 'long':
    case 'wavy':
    case 'idol':
    case 'straight':
    case 'slick': {
      ctx.beginPath();
      ctx.ellipse(0, hy - 0.8 * u, rx, 1.5 * u, 0, Math.PI, TAU);
      ctx.fill();
      // bangs
      const bangs = L.style === 'slick' ? 3 : 5;
      for (let i = 0; i < bangs; i++) {
        const x = -1.7 * u + (i / (bangs - 1)) * 3.4 * u;
        poly(ctx, [[x - 0.55 * u, hy - 1.2 * u], [x + 0.2 * u, hy + 0.35 * u + (i % 2) * 0.4 * u], [x + 0.65 * u, hy - 1.2 * u]]);
        ctx.fill();
      }
      if (L.style === 'straight' || L.style === 'idol' || L.style === 'bob') {
        for (const sx of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(sx * 1.85 * u, hy + 0.5 * u, 0.5 * u, 1.9 * u, 0, 0, TAU);
          ctx.fill();
        }
      }
      if (L.style === 'idol') {
        ctx.fillStyle = '#e9e9f2';
        ctx.fillRect(-2.2 * u, hy - 0.8 * u, 4.4 * u, 0.35 * u);
        for (const sx of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(sx * 2.15 * u, hy + 0.25 * u, 0.55 * u, 0.85 * u, 0, 0, TAU);
          ctx.fillStyle = L.trim;
          ctx.fill();
        }
      }
      break;
    }
    default:
  }
}

function drawCatHead(ctx, u, hy, emote, t) {
  ctx.fillStyle = '#12121a';
  for (const sx of [-1, 1]) poly(ctx, [[sx * 0.7 * u, hy - 1.7 * u], [sx * 2.2 * u, hy - 3.7 * u], [sx * 2.2 * u, hy - 0.7 * u]]), ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, hy, 2.4 * u, 2.0 * u, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f4f4f4';
  ctx.beginPath();
  ctx.ellipse(0, hy + 0.8 * u, 1.2 * u, 0.9 * u, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#3aa0ff';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * 0.9 * u, hy - 0.2 * u, 0.42 * u, emote === 'smirk' ? 0.25 * u : 0.5 * u, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ff6f91';
  ctx.beginPath();
  ctx.arc(0, hy + 0.35 * u, 0.2 * u, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 0.12 * u;
  ctx.beginPath();
  ctx.moveTo(0, hy + 0.55 * u);
  ctx.quadraticCurveTo(-0.5 * u, hy + 1.1 * u, -0.9 * u, hy + 0.8 * u);
  ctx.moveTo(0, hy + 0.55 * u);
  ctx.quadraticCurveTo(0.5 * u, hy + 1.1 * u, 0.9 * u, hy + 0.8 * u);
  ctx.stroke();
  // scarf
  ctx.fillStyle = '#f2c200';
  ctx.fillRect(-1.4 * u, hy + 1.8 * u, 2.8 * u, 0.7 * u);
}

function drawMask(ctx, L, u, hy) {
  const m = L.mask;
  if (m === 'none') return;
  ctx.fillStyle = m === 'skull' ? '#f0f0f0' : m === 'cat' ? '#b0102e' : m === 'opera' ? '#f4f0e6' : m === 'lace' ? '#2a1020' : '#f6f6f6';
  if (m === 'domino') {
    ctx.beginPath();
    ctx.ellipse(0, hy + 0.1 * u, 1.9 * u, 0.85 * u, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0006';
    poly(ctx, [[-0.2 * u, hy - 0.2 * u], [0.2 * u, hy - 0.2 * u], [0.9 * u, hy + 0.9 * u], [-0.9 * u, hy + 0.9 * u]]);
    ctx.fillStyle = '#f6f6f6';
    poly(ctx, [[-0.35 * u, hy + 0.5 * u], [0.35 * u, hy + 0.5 * u], [0, hy + 1.5 * u]]);
    ctx.fill();
  } else if (m === 'skull') {
    ctx.beginPath();
    ctx.ellipse(0, hy + 0.9 * u, 1.45 * u, 1.1 * u, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#111';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 0.65 * u, hy + 0.5 * u, 0.33 * u, 0.4 * u, 0, 0, TAU); ctx.fill(); }
    ctx.fillRect(-0.7 * u, hy + 1.45 * u, 1.4 * u, 0.15 * u);
  } else if (m === 'cat') {
    ctx.beginPath();
    ctx.ellipse(0, hy + 0.1 * u, 1.85 * u, 0.9 * u, 0, 0, TAU);
    ctx.fill();
    for (const sx of [-1, 1]) { poly(ctx, [[sx * 1.2 * u, hy - 0.5 * u], [sx * 1.9 * u, hy - 1.4 * u], [sx * 1.9 * u, hy - 0.1 * u]]); ctx.fill(); }
  } else if (m === 'fox') {
    ctx.beginPath();
    ctx.ellipse(-0.1 * u, hy + 0.1 * u, 1.85 * u, 1.0 * u, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d22';
    ctx.fillRect(-1.8 * u, hy - 0.45 * u, 3.4 * u, 0.2 * u);
    poly(ctx, [[1.1 * u, hy - 0.7 * u], [2.0 * u, hy - 1.7 * u], [1.9 * u, hy - 0.3 * u]]);
    ctx.fill();
  } else if (m === 'visor') {
    ctx.fillStyle = hexA(L.accent, 0.8);
    ctx.fillRect(-1.9 * u, hy - 0.45 * u, 3.8 * u, 1.0 * u);
    ctx.fillStyle = '#fff6';
    ctx.fillRect(-1.7 * u, hy - 0.3 * u, 1.2 * u, 0.2 * u);
  } else if (m === 'lace') {
    ctx.beginPath();
    ctx.ellipse(0, hy + 0.15 * u, 1.9 * u, 0.7 * u, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd9e8';
    ctx.beginPath();
    ctx.ellipse(0, hy + 0.15 * u, 1.65 * u, 0.5 * u, 0, 0, TAU);
    ctx.fill();
  } else if (m === 'opera') {
    ctx.beginPath();
    ctx.ellipse(-0.9 * u, hy + 0.5 * u, 1.1 * u, 1.5 * u, 0.1, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = L.accent;
    ctx.lineWidth = 0.15 * u;
    ctx.stroke();
  }
}

function drawEyes(ctx, L, u, hy, emote, t) {
  const blink = Math.sin(t * 1.3) > 0.985 ? 0.15 : 1;
  const masked = L.mask === 'domino' || L.mask === 'cat' || L.mask === 'fox' || L.mask === 'lace';
  for (const sx of [-1, 1]) {
    const ex = sx * 0.85 * u;
    ctx.fillStyle = masked ? '#111' : '#fff';
    ctx.beginPath();
    ctx.ellipse(ex, hy + 0.1 * u, 0.5 * u, 0.42 * u * blink * (emote === 'shock' ? 1.3 : 1), 0, 0, TAU);
    ctx.fill();
    if (!masked) {
      ctx.fillStyle = L.mask === 'visor' ? '#222' : L.accent;
      ctx.beginPath();
      ctx.arc(ex, hy + 0.1 * u, 0.27 * u, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(ex, hy + 0.1 * u, 0.14 * u, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex - 0.12 * u, hy - 0.05 * u, 0.1 * u, 0, TAU);
      ctx.fill();
    }
  }
  // brows
  ctx.strokeStyle = L.hair === '#d9d9e6' ? '#999' : L.hair;
  ctx.lineWidth = 0.2 * u;
  ctx.lineCap = 'round';
  const tilt = emote === 'angry' ? 0.45 * u : emote === 'sad' ? -0.35 * u : 0;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 0.35 * u, hy - 0.65 * u + tilt * (sx < 0 ? 0.5 : 0.5));
    ctx.lineTo(sx * 1.35 * u, hy - 0.7 * u - tilt * 0.5 + (emote === 'shock' ? -0.3 * u : 0));
    ctx.stroke();
  }
  // mouth
  ctx.strokeStyle = '#7a2b2b';
  ctx.fillStyle = '#7a2b2b';
  ctx.lineWidth = 0.14 * u;
  const my = hy + 1.35 * u;
  ctx.beginPath();
  switch (emote) {
    case 'smirk':
      ctx.moveTo(-0.5 * u, my);
      ctx.quadraticCurveTo(0.2 * u, my + 0.2 * u, 0.7 * u, my - 0.25 * u);
      ctx.stroke();
      break;
    case 'laugh':
      ctx.ellipse(0, my, 0.7 * u, 0.5 * u, 0, 0, Math.PI);
      ctx.fill();
      break;
    case 'shock':
      ctx.ellipse(0, my + 0.1 * u, 0.28 * u, 0.4 * u, 0, 0, TAU);
      ctx.fill();
      break;
    case 'angry':
      ctx.moveTo(-0.6 * u, my + 0.15 * u);
      ctx.lineTo(0.6 * u, my - 0.05 * u);
      ctx.stroke();
      break;
    case 'sad':
      ctx.moveTo(-0.5 * u, my + 0.2 * u);
      ctx.quadraticCurveTo(0, my - 0.2 * u, 0.5 * u, my + 0.2 * u);
      ctx.stroke();
      break;
    default:
      ctx.moveTo(-0.4 * u, my);
      ctx.lineTo(0.4 * u, my);
      ctx.stroke();
  }
}

/**
 * Draw a character bust. (x, y) = bottom-centre; s = bust height in pixels.
 * o: { emote, flip, alpha, t, talking, tint }
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
  const emote = o.emote || 'neutral';
  const hy = -5.2 * u + (o.talking ? Math.sin(t * 14) * 0.04 * u : 0);
  ctx.save();
  ctx.translate(x, y);
  if (o.flip) ctx.scale(-1, 1);
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  hairBack(ctx, L, u);
  // body (cats are just a scarf + dark body)
  ctx.fillStyle = L.outfit;
  poly(ctx, [[-3.8 * u, 0], [-3.2 * u, -2.4 * u], [-1.2 * u, -3.1 * u], [1.2 * u, -3.1 * u], [3.2 * u, -2.4 * u], [3.8 * u, 0]]);
  ctx.fill();
  // collar / trim
  ctx.fillStyle = L.trim;
  poly(ctx, [[-1.3 * u, -3.1 * u], [0, -1.6 * u], [1.3 * u, -3.1 * u], [0.8 * u, -3.1 * u], [0, -2.1 * u], [-0.8 * u, -3.1 * u]]);
  ctx.fill();
  if (L.style === 'slick') {
    ctx.fillStyle = '#f4f0e6';
    poly(ctx, [[-0.7 * u, -3.1 * u], [0, -1.2 * u], [0.7 * u, -3.1 * u]]);
    ctx.fill();
    ctx.fillStyle = L.accent;
    ctx.beginPath();
    ctx.arc(0, -2.3 * u, 0.2 * u, 0, TAU);
    ctx.fill();
  }
  if (L.style === 'cat') {
    drawCatHead(ctx, u, hy + 0.6 * u, emote, t);
    ctx.restore();
    return;
  }
  // neck + head
  ctx.fillStyle = L.skin;
  ctx.fillRect(-0.55 * u, -3.4 * u, 1.1 * u, 1.0 * u);
  ctx.beginPath();
  ctx.ellipse(0, hy, 1.85 * u, 2.2 * u, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,90,70,0.13)';
  ctx.beginPath();
  ctx.ellipse(0, hy + 1.5 * u, 1.5 * u, 0.8 * u, 0, 0, TAU);
  ctx.fill();
  if (L.mask === 'visor' || L.mask === 'opera') {
    drawEyes(ctx, L, u, hy, emote, t);
    drawMask(ctx, L, u, hy);
  } else {
    drawMask(ctx, L, u, hy);
    drawEyes(ctx, L, u, hy, emote, t);
  }
  if (L.glasses) {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 0.14 * u;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.rect(sx * 0.85 * u - 0.65 * u, hy - 0.4 * u, 1.3 * u, 1.0 * u);
      ctx.stroke();
    }
  }
  hairFront(ctx, L, u, hy);
  if (L.style === 'long') {
    // headset
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.3 * u;
    ctx.beginPath();
    ctx.arc(0, hy - 0.3 * u, 2.15 * u, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = L.accent;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * 2.1 * u, hy + 0.1 * u, 0.55 * u, 0, TAU);
      ctx.fill();
    }
  }
  if (L.style === 'wavy') {
    ctx.fillStyle = L.trim;
    ctx.beginPath();
    ctx.arc(1.4 * u, hy - 1.7 * u, 0.55 * u, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export const CLASS_GLYPH = { vanguard: '⚑', guard: '⚔', defender: '⛨', caster: '✦', sniper: '➶', artillery: '◉', medic: '✚', support: '❖' };

/** Battle token: portrait bust on a coloured base, with facing indicator. */
export function drawToken(ctx, id, x, y, size, o = {}) {
  const def = OPERATORS[id];
  const L = LOOKS[id];
  const t = o.t || 0;
  const bob = Math.sin(t * 3 + (o.phase || 0)) * size * 0.015;
  ctx.save();
  ctx.translate(x, y);
  // base plate
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(0, size * 0.28, size * 0.36, size * 0.13, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, size * 0.28, size * 0.36, size * 0.13, 0, 0, TAU);
  ctx.stroke();
  // facing wedge
  if (o.dir != null) {
    const a = [0, Math.PI / 2, Math.PI, -Math.PI / 2][o.dir];
    ctx.save();
    ctx.translate(0, size * 0.28);
    ctx.scale(1, 0.4);
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * size * 0.62, Math.sin(a) * size * 0.62);
    ctx.lineTo(Math.cos(a + 2.5) * size * 0.34, Math.sin(a + 2.5) * size * 0.34);
    ctx.lineTo(Math.cos(a - 2.5) * size * 0.34, Math.sin(a - 2.5) * size * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  drawPortrait(ctx, id, 0, size * 0.34 + bob, size * (o.big ? 1.0 : 0.82), { emote: o.emote, t, flip: o.dir === 2 });
  // class tag
  if (!o.noTag) {
    ctx.fillStyle = '#000c';
    ctx.beginPath();
    ctx.arc(-size * 0.33, size * 0.05, size * 0.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = def.color;
    ctx.font = `${size * 0.14}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(CLASS_GLYPH[def.class] || '•', -size * 0.33, size * 0.06);
  }
  ctx.restore();
  return L;
}

export const classLabel = (def) => CLASSES[def.class].label;
