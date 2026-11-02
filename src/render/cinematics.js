// Scripted full-screen cinematics. Each has { dur, draw(ctx, t) } with t in seconds.
import { TAU, clamp, easeOutBack, easeOutCubic, easeInOutCubic, pulse, mulberry32 } from '../core/util.js';
import { W, H, RED, text, starburst, speedLines, halftone, glow, vignette, poly } from './draw.js';
import { drawBackground } from './backgrounds.js';
import { drawPersona } from './personas.js';
import { drawPortrait } from './characters.js';

function slam(ctx, str, x, y, t, t0, o = {}) {
  const k = pulse(t, t0, t0 + 0.35);
  if (k <= 0) return;
  const s = 1 + (1 - easeOutBack(k)) * 1.6;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  text(ctx, str, 0, 0, { ...o, alpha: (o.alpha ?? 1) * Math.min(1, k * 2.5) });
  ctx.restore();
}

function fadeBlack(ctx, a) {
  if (a <= 0) return;
  ctx.fillStyle = `rgba(0,0,0,${clamp(a, 0, 1)})`;
  ctx.fillRect(0, 0, W, H);
}

function zoomed(ctx, k, cx, cy, fn) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.translate(-cx, -cy);
  fn();
  ctx.restore();
}

function letterbox(ctx, amt = 70) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, amt);
  ctx.fillRect(0, H - amt, W, amt);
}

export const CINEMATICS = {
  opening: {
    dur: 14,
    draw(ctx, t) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      if (t < 4.6) {
        zoomed(ctx, 1 + t * 0.03, W * 0.7, H * 0.5, () => drawBackground(ctx, 'crossing_dusk', t));
        slam(ctx, 'ONE SUMMER AFTER', 110, 520, t, 0.9, { size: 62, fill: '#fff', stroke: '#000', lw: 8, skew: -0.2 });
        slam(ctx, 'THEY STOLE THE WORLD’S DISTORTED HEARTS.', 110, 590, t, 1.8, { size: 38, fill: RED, stroke: '#000', lw: 6, skew: -0.2 });
        fadeBlack(ctx, t < 0.8 ? 1 - t / 0.8 : (t - 4) / 0.6);
      } else if (t < 8.4) {
        const k = t - 4.6;
        drawBackground(ctx, 'train_interior', t);
        zoomed(ctx, 1.1 - k * 0.03, W / 2, H / 2, () => {
          drawPortrait(ctx, 'joker', W / 2, H + 40, 640, { t, emote: 'neutral' });
        });
        vignette(ctx, 0.75);
        slam(ctx, 'THEN THE TRAINS', W - 60, 200, t, 5.3, { size: 58, fill: '#fff', stroke: '#000', lw: 8, align: 'right', skew: -0.2 });
        slam(ctx, 'STOPPED LEAVING.', W - 60, 270, t, 6.1, { size: 58, fill: RED, stroke: '#000', lw: 8, align: 'right', skew: -0.2 });
        fadeBlack(ctx, t < 5 ? (5 - t) * 1.5 : t > 8 ? (t - 8) / 0.4 : 0);
      } else {
        const k = t - 8.4;
        drawBackground(ctx, 'loop_void', t);
        speedLines(ctx, W / 2, H / 2, t, 'rgba(255,255,255,0.18)', 60, 200, 1000);
        const p = pulse(k, 0.2, 0.6);
        ctx.save();
        ctx.translate(W / 2, H / 2 - 20);
        ctx.rotate(-0.06);
        ctx.scale(0.6 + easeOutBack(p) * 0.4, 0.6 + easeOutBack(p) * 0.4);
        ctx.globalAlpha = p;
        starburst(ctx, 0, 0, 260, 470, 18, k * 0.15, 'rgba(229,0,29,0.9)', '#000');
        ctx.restore();
        slam(ctx, 'ENCORE', W / 2, H / 2 + 30, t, 9.2, { size: 210, fill: '#fff', stroke: '#000', lw: 18, align: 'center', skew: -0.2, shadow: '#000' });
        slam(ctx, 'PROTOCOL', W / 2 + 150, H / 2 + 130, t, 9.8, { size: 100, fill: RED, stroke: '#000', lw: 12, align: 'center', skew: -0.2, shadow: '#000' });
        slam(ctx, 'A PERSONA 5 FAN TALE', W / 2, H - 110, t, 10.8, { size: 34, fill: '#fff', stroke: '#000', lw: 5, align: 'center' });
        if (k < 0.2) {
          ctx.fillStyle = `rgba(255,255,255,${1 - k / 0.2})`;
          ctx.fillRect(0, 0, W, H);
        }
        fadeBlack(ctx, (t - 13) / 1);
      }
      letterbox(ctx, 52);
    },
  },

  palace_gate: {
    dur: 7,
    draw(ctx, t) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      const z = 1 + easeInOutCubic(clamp(t / 5.5, 0, 1)) * 0.55;
      zoomed(ctx, z, W / 2, 360, () => drawBackground(ctx, 'palace_gate', t));
      // doors swing open with light spilling out
      const open = easeInOutCubic(pulse(t, 3.2, 5.6));
      if (open > 0) {
        glow(ctx, W / 2, 380, 100 + open * 700, '#fff3c4', open);
        ctx.fillStyle = `rgba(255,243,196,${open * 0.8})`;
        poly(ctx, [[W / 2 - 20 - open * 60, 110], [W / 2 + 20 + open * 60, 110], [W / 2 + 20 + open * 60, H], [W / 2 - 20 - open * 60, H]]);
        ctx.fill();
      }
      vignette(ctx, 0.55);
      slam(ctx, 'ENCORE THEATRE', W / 2, 220, t, 0.7, { size: 120, fill: '#ffd24a', stroke: '#000', lw: 14, align: 'center', skew: -0.18 });
      slam(ctx, 'PALACE OF THE MAESTRO', W / 2, 290, t, 1.4, { size: 40, fill: '#fff', stroke: '#000', lw: 6, align: 'center' });
      fadeBlack(ctx, t < 0.4 ? 1 - t / 0.4 : (t - 6.2) / 0.8);
      letterbox(ctx, 52);
    },
  },

  maestro_reveal: {
    dur: 8,
    draw(ctx, t) {
      drawBackground(ctx, 'stage_hall', t);
      const rise = easeOutCubic(pulse(t, 1.0, 3.4));
      ctx.save();
      ctx.globalAlpha = 0.85 * rise;
      drawPersona(ctx, 'maestro', W / 2, H * 0.62 + (1 - rise) * 80, 360, t, '#ffd24a');
      ctx.restore();
      if (t > 3.4) {
        const k = pulse(t, 3.4, 4.6);
        drawPortrait(ctx, 'maestro', W / 2, H + 120 - (1 - easeOutCubic(k)) * 120, 880, { t, alpha: k, emote: 'smirk' });
      }
      glow(ctx, W / 2, 140, 380, '#fff3c4', 0.4);
      vignette(ctx, 0.65);
      const rng = mulberry32(5);
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(255,224,150,${0.3 + 0.4 * Math.sin(t * 2 + i)})`;
        ctx.fillRect((rng() * W + t * 20) % W, (rng() * H - t * 30 + H * 2) % H, 3, 3);
      }
      slam(ctx, 'THE MAESTRO', W / 2, 180, t, 4.6, { size: 140, fill: '#fff', stroke: '#000', lw: 14, align: 'center', skew: -0.18, shadow: '#7a1424' });
      slam(ctx, 'SOREN KUGA · SOVEREIGN OF THE ENCORE', W / 2, 232, t, 5.2, { size: 34, fill: '#ffd24a', stroke: '#000', lw: 5, align: 'center' });
      fadeBlack(ctx, t < 0.6 ? 1 - t / 0.6 : (t - 7.2) / 0.8);
      letterbox(ctx, 52);
    },
  },

  encore_loop: {
    dur: 4.5,
    draw(ctx, t) {
      drawBackground(ctx, 'loop_void', t);
      const rng = mulberry32(Math.floor(t * 14));
      for (let i = 0; i < 8; i++) {
        const y = rng() * H;
        ctx.drawImage(ctx.canvas, 0, y, W, 30 + rng() * 60, (rng() - 0.5) * 120, y, W, 30);
      }
      speedLines(ctx, W / 2, H / 2, t, 'rgba(255,255,255,0.35)', 70, 120, 1100);
      slam(ctx, 'ENCORE!', W / 2, H / 2 + 60, t, 0.4, { size: 240, fill: '#ffd24a', stroke: '#000', lw: 20, align: 'center', skew: -0.2 });
      halftone(ctx, 0, 0, W, H, 18, 'rgba(0,0,0,0.2)');
      fadeBlack(ctx, (t - 3.8) / 0.7);
      letterbox(ctx, 52);
    },
  },
};
