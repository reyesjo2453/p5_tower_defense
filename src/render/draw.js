// Shared 2D drawing helpers for the stylised red/black/white look.
import { TAU, hexA } from '../core/util.js';

export const W = 1280;
export const H = 720;
export const FONT = '"Anton", "Bebas Neue", Impact, "Arial Narrow Bold", sans-serif';
export const FONT_BODY = '"Barlow Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
export const RED = '#e5001d';

export function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

export function text(ctx, str, x, y, o = {}) {
  const { size = 40, fill = '#fff', stroke = null, lw = 6, font = FONT, align = 'left', skew = 0, rot = 0, alpha = 1, shadow = null, baseline = 'alphabetic', italic = false } = o;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (skew) ctx.transform(1, 0, skew, 1, 0, 0);
  ctx.globalAlpha *= alpha;
  ctx.font = `${italic ? 'italic ' : ''}${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = 'round';
  if (shadow) {
    ctx.fillStyle = shadow;
    ctx.fillText(str, 4, 5);
  }
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, 0, 0);
  }
  ctx.fillStyle = fill;
  ctx.fillText(str, 0, 0);
  ctx.restore();
}

/** Wrap text into lines that fit maxW using the current ctx font. */
export function wrap(ctx, str, maxW) {
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function halftone(ctx, x, y, w, h, step, color, fade = (px, py) => 1) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = color;
  for (let j = 0, py = y; py < y + h + step; py += step, j++) {
    for (let px = x + (j % 2) * (step / 2); px < x + w + step; px += step) {
      const r = (step / 2) * 0.9 * fade((px - x) / w, (py - y) / h);
      if (r > 0.3) {
        ctx.beginPath();
        ctx.arc(px, py, r, 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

export function speedLines(ctx, cx, cy, t, color = '#fff', count = 46, inner = 220, outer = 1200, seed = 3) {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = ((i + Math.sin(i * 12.9898 + seed) * 0.5) / count) * TAU + t * 0.4;
    const len = outer * (0.55 + 0.45 * Math.abs(Math.sin(i * 7.13 + t * 6)));
    const w = 0.012 + 0.02 * Math.abs(Math.sin(i * 3.7));
    const r0 = inner + 60 * Math.abs(Math.sin(i * 1.9 + t * 9));
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0);
    ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    ctx.lineTo(cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0);
    ctx.fill();
  }
  ctx.restore();
}

export function starburst(ctx, x, y, r1, r2, n, rot, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r1 : r2;
    const a = rot + (i / (n * 2)) * TAU;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 4; ctx.stroke(); }
}

export function glow(ctx, x, y, r, color, a = 0.8) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(color, a));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function vignette(ctx, a = 0.6) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function lightning(ctx, x0, y0, x1, y1, color, width, seed = 1) {
  const segs = 9;
  ctx.save();
  ctx.lineJoin = 'round';
  for (const pass of [[width * 3, hexA(color, 0.35)], [width, '#ffffff']]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i < segs; i++) {
      const k = i / segs;
      const j = (Math.sin(seed * 91.7 + i * 12.3) * 0.5) * 36;
      ctx.lineTo(x0 + (x1 - x0) * k + j, y0 + (y1 - y0) * k + Math.cos(seed * 57.1 + i * 7.7) * 18);
    }
    ctx.lineTo(x1, y1);
    ctx.lineWidth = pass[0];
    ctx.strokeStyle = pass[1];
    ctx.stroke();
  }
  ctx.restore();
}
