// Procedural Echo (enemy) sprites. (x, y) = foot centre; s = nominal height in pixels.
import { TAU, hexA } from '../core/util.js';
import { poly, glow } from './draw.js';

const INK = '#0b0714';

function body(ctx, color, flash) {
  ctx.fillStyle = flash > 0 ? '#fff' : INK;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
}

function eyes(ctx, x, y, r, color, down) {
  ctx.fillStyle = down ? '#888' : color;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + sx * r * 1.6, y, r, r * (down ? 0.2 : 0.7), sx * 0.3, 0, TAU);
    ctx.fill();
  }
}

const SHAPES = {
  blob(ctx, s, t, def, st) {
    const wob = Math.sin(t * 6) * s * 0.03;
    body(ctx, def.color, st.flash);
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, 0);
    ctx.bezierCurveTo(-s * 0.45, -s * 0.5, -s * 0.3, -s * 0.85 + wob, 0, -s * 0.85);
    ctx.bezierCurveTo(s * 0.3, -s * 0.85 + wob, s * 0.45, -s * 0.5, s * 0.32, 0);
    for (let i = 0; i < 5; i++) ctx.lineTo(s * 0.32 - ((i + 1) / 5) * s * 0.64, (i % 2 ? 0 : -s * 0.12) + Math.sin(t * 5 + i) * 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // mask
    ctx.fillStyle = '#eee';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.55, s * 0.22, s * 0.2, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, 0, -s * 0.57, s * 0.045, def.color, st.down);
  },
  hound(ctx, s, t, def, st) {
    const run = Math.sin(t * 14) * s * 0.04;
    body(ctx, def.color, st.flash);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.3 + run, s * 0.42, s * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(st.dir < 0 ? -s * 0.32 : s * 0.32, -s * 0.42 + run, s * 0.17, s * 0.15, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    poly(ctx, [[s * 0.22, -s * 0.55 + run], [s * 0.3, -s * 0.78 + run], [s * 0.4, -s * 0.55 + run]]);
    ctx.fill();
    for (const lx of [-0.28, -0.1, 0.1, 0.28]) {
      ctx.beginPath();
      ctx.moveTo(lx * s, -s * 0.14);
      ctx.lineTo(lx * s + Math.sin(t * 14 + lx * 9) * s * 0.08, 0);
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    eyes(ctx, st.dir < 0 ? -s * 0.36 : s * 0.36, -s * 0.44 + run, s * 0.03, def.color, st.down);
  },
  bulwark(ctx, s, t, def, st) {
    body(ctx, def.color, st.flash);
    ctx.beginPath();
    ctx.rect(-s * 0.4, -s * 0.8, s * 0.8, s * 0.8);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = hexA(def.color, 0.7);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.beginPath();
        ctx.arc(-s * 0.2 + i * s * 0.4, -s * 0.55 + j * s * 0.3, s * 0.11, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-s * 0.2 + i * s * 0.4, -s * 0.55 + j * s * 0.3, s * 0.03, 0, TAU);
        ctx.fillStyle = def.color;
        ctx.fill();
      }
    }
    ctx.fillStyle = INK;
    eyes(ctx, 0, -s * 0.9, s * 0.04, def.color, st.down);
    ctx.fillStyle = st.flash > 0 ? '#fff' : INK;
    ctx.fillRect(-s * 0.18, -s * 0.98, s * 0.36, s * 0.16);
    eyes(ctx, 0, -s * 0.9, s * 0.04, def.color, st.down);
  },
  seer(ctx, s, t, def, st) {
    const hover = Math.sin(t * 3) * s * 0.04;
    body(ctx, def.color, st.flash);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.95 + hover);
    ctx.bezierCurveTo(s * 0.45, -s * 0.7 + hover, s * 0.4, -s * 0.2 + hover, s * 0.3, -s * 0.05 + hover);
    for (let i = 0; i < 5; i++) ctx.lineTo(s * 0.3 - ((i + 1) / 5) * s * 0.6, -s * 0.05 + hover + (i % 2) * s * 0.12);
    ctx.bezierCurveTo(-s * 0.4, -s * 0.2 + hover, -s * 0.45, -s * 0.7 + hover, 0, -s * 0.95 + hover);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.6 + hover, s * 0.17, s * 0.1, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = st.down ? '#888' : def.color;
    ctx.beginPath();
    ctx.arc(0, -s * 0.6 + hover, s * 0.06, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + (i / 3) * TAU;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * s * 0.5, -s * 0.5 + hover + Math.sin(a) * s * 0.15, s * 0.045, 0, TAU);
      ctx.fillStyle = def.color;
      ctx.fill();
    }
  },
  conductor(ctx, s, t, def, st) {
    body(ctx, def.color, st.flash);
    poly(ctx, [[-s * 0.35, 0], [-s * 0.22, -s * 0.8], [s * 0.22, -s * 0.8], [s * 0.35, 0]]);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -s * 0.95, s * 0.17, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(s * 0.3, -s * 0.6);
    ctx.rotate(Math.sin(t * 5) * 0.5 - 0.6);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-2, -s * 0.5, 4, s * 0.5);
    ctx.restore();
    ctx.fillStyle = '#eee';
    ctx.fillRect(-s * 0.12, -s * 1.0, s * 0.24, s * 0.1);
    eyes(ctx, 0, -s * 0.95, s * 0.035, def.color, st.down);
  },
  maestro(ctx, s, t, def, st) {
    const sway = Math.sin(t * 2) * s * 0.02;
    // floating staves
    ctx.strokeStyle = hexA(def.color, 0.55);
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.9, -s * 0.5 + i * 8);
      ctx.bezierCurveTo(-s * 0.3, -s * 0.7 + Math.sin(t * 3 + i) * 12 + i * 8, s * 0.3, -s * 0.3 + i * 8, s * 0.9, -s * 0.55 + i * 8);
      ctx.stroke();
    }
    body(ctx, def.color, st.flash);
    poly(ctx, [[-s * 0.45, 0], [-s * 0.18 + sway, -s * 0.85], [s * 0.18 + sway, -s * 0.85], [s * 0.45, 0], [s * 0.15, -s * 0.25], [-s * 0.15, -s * 0.25]]);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sway, -s * 1.0, s * 0.16, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f4f0e6';
    ctx.beginPath();
    ctx.ellipse(sway - s * 0.05, -s * 1.0, s * 0.11, s * 0.14, 0.1, 0, TAU);
    ctx.fill();
    glow(ctx, 0, -s * 0.6, s * 0.9, def.color, 0.18 + 0.05 * Math.sin(t * 4));
    ctx.save();
    ctx.translate(s * 0.35, -s * 0.55);
    ctx.rotate(Math.sin(t * 4) * 0.4 - 0.7);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-2, -s * 0.6, 4, s * 0.6);
    ctx.restore();
    eyes(ctx, sway, -s * 1.0, s * 0.03, def.color, st.down);
  },
};

export function drawEcho(ctx, def, x, y, s, t, st = {}) {
  const fn = SHAPES[def.shape] || SHAPES.blob;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = def.color;
  ctx.shadowBlur = st.down ? 0 : 14;
  fn(ctx, s, t, def, { flash: st.flash || 0, down: st.down || false, dir: st.dir ?? 1 });
  ctx.restore();
}
