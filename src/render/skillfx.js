// One unique animated effect per operator skill. Each draw(ctx, e, k, t) gets:
//   e: { x, y (pixels), targets: [{x,y}], center, radius (px), color, dir, age, dur }  k = age/dur (0..1)
import { TAU, clamp, easeOutCubic, easeOutBack, pulse, hexA, mulberry32 } from '../core/util.js';
import { W, H, poly, glow, lightning, speedLines, halftone } from './draw.js';
import { drawPersona } from './personas.js';
import { FIELD_Y, TILE } from './layout.js';

const ringStroke = (ctx, x, y, r, w, color) => {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
};

function hexGrid(ctx, x0, y0, w, h, size, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (let row = 0; row * size * 0.87 < h + size; row++) {
    for (let col = 0; col * size * 1.5 < w + size; col++) {
      const cx = x0 + col * size * 1.5;
      const cy = y0 + row * size * 1.74 + (col % 2) * size * 0.87;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        ctx.lineTo(cx + Math.cos(a) * size * 0.9, cy + Math.sin(a) * size * 0.9);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
}

export const SKILL_FX = {
  // Joker: Arsène bursts out, crimson X-slashes on every target
  arsene_eiha: {
    dur: 1.3,
    draw(ctx, e, k, t) {
      const age = e.age;
      // red dim
      ctx.fillStyle = `rgba(40,0,10,${0.5 * Math.sin(Math.min(1, k * 1.2) * Math.PI)})`;
      ctx.fillRect(0, 0, W, H);
      // Arsène rising behind
      const rise = easeOutCubic(pulse(age, 0, 0.5));
      ctx.save();
      ctx.globalAlpha = (1 - pulse(age, 0.7, 1.3)) * 0.95;
      drawPersona(ctx, 'arsene', e.x, e.y - 40 - rise * 110, 90 + rise * 90, t, '#e8002d');
      ctx.restore();
      ringStroke(ctx, e.x, e.y, e.radius * easeOutCubic(pulse(age, 0.1, 0.7)), 8 * (1 - k), hexA('#e8002d', 1 - k));
      for (const [i, tg] of e.targets.entries()) {
        const p = pulse(age, 0.25 + i * 0.05, 0.5 + i * 0.05);
        if (p <= 0) continue;
        const fade = 1 - pulse(age, 0.6, 1.2);
        ctx.save();
        ctx.translate(tg.x, tg.y);
        ctx.globalAlpha = fade;
        ctx.lineCap = 'round';
        for (const [sx, sy, ex, ey] of [[-46, -46, 46, 46], [46, -46, -46, 46]]) {
          const q = pulse(p, 0, 1);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 7;
          ctx.shadowColor = '#e8002d';
          ctx.shadowBlur = 22;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + (ex - sx) * q, sy + (ey - sy) * q);
          ctx.stroke();
        }
        ctx.restore();
      }
    },
  },

  // Skull: lightning cascades from the sky
  kidd_thunder: {
    dur: 1.1,
    draw(ctx, e, k, t) {
      const age = e.age;
      const flash = Math.max(0, 1 - age / 0.25);
      ctx.fillStyle = `rgba(255,240,120,${0.35 * flash})`;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(10,10,30,${0.35 * (1 - k)})`;
      ctx.fillRect(0, 0, W, H);
      for (const [i, tg] of e.targets.entries()) {
        const on = age > i * 0.12 && age < i * 0.12 + 0.5;
        if (on) lightning(ctx, tg.x + (i - 1) * 30, 0, tg.x, tg.y, '#ffe933', 6 * (1 - (age - i * 0.12) / 0.5) + 2, Math.floor(age * 30) + i);
        if (age > i * 0.12) ringStroke(ctx, tg.x, tg.y, 70 * easeOutCubic(pulse(age, i * 0.12, i * 0.12 + 0.5)), 5, hexA('#ffe933', 1 - k));
      }
      // Captain Kidd sails in on a ghost ship (small, over the caster)
      ctx.save();
      ctx.globalAlpha = Math.sin(Math.min(1, k) * Math.PI) * 0.9;
      drawPersona(ctx, 'kidd', e.x, e.y - 90, 70, t, '#f2c200');
      ctx.restore();
    },
  },

  // Panther: telegraph, then a pillar of fire
  carmen_agneyastra: {
    dur: 1.9,
    draw(ctx, e, k, t) {
      const c = e.center;
      if (!c) return;
      const age = e.age;
      const r = e.radius;
      // Carmen flourish at caster
      ctx.save();
      ctx.globalAlpha = Math.sin(clamp(age / 0.8, 0, 1) * Math.PI);
      drawPersona(ctx, 'carmen', e.x, e.y - 70, 70, t, '#ff2e63');
      ctx.restore();
      // telegraph
      if (age < 0.6) {
        ctx.setLineDash([12, 10]);
        ringStroke(ctx, c.x, c.y, r * (0.6 + 0.4 * (age / 0.6)), 4, '#ff5a2a');
        ctx.setLineDash([]);
        ctx.fillStyle = hexA('#ff5a2a', 0.15 + 0.1 * Math.sin(age * 30));
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, TAU);
        ctx.fill();
      }
      const rise = pulse(age, 0.55, 0.85);
      if (rise > 0) {
        const fall = 1 - pulse(age, 1.2, 1.9);
        const hgt = c.y * easeOutCubic(rise);
        const w = r * 0.95 * (0.92 + 0.08 * Math.sin(age * 40));
        for (const [scale, col] of [[1, '#ff3d1a'], [0.72, '#ff8a2a'], [0.42, '#ffe29a']]) {
          const g = ctx.createLinearGradient(0, c.y - hgt, 0, c.y);
          g.addColorStop(0, hexA(col, 0));
          g.addColorStop(0.35, hexA(col, 0.9 * fall));
          g.addColorStop(1, hexA(col, fall));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(c.x - w * scale, c.y);
          for (let i = 0; i <= 10; i++) {
            const k2 = i / 10;
            const sway = Math.sin(age * 18 + i * 1.7) * 12 * k2;
            ctx.lineTo(c.x - w * scale * (1 - k2 * 0.55) + sway, c.y - hgt * k2 * (0.85 + 0.15 * Math.sin(age * 25 + i)));
          }
          for (let i = 10; i >= 0; i--) {
            const k2 = i / 10;
            const sway = Math.sin(age * 18 + i * 1.3 + 2) * 12 * k2;
            ctx.lineTo(c.x + w * scale * (1 - k2 * 0.55) + sway, c.y - hgt * k2 * (0.85 + 0.15 * Math.sin(age * 25 + i + 3)));
          }
          ctx.closePath();
          ctx.fill();
        }
        glow(ctx, c.x, c.y, r * 2.2, '#ff7a2a', 0.8 * fall);
        for (let i = 0; i < 4; i++) ringStroke(ctx, c.x, c.y, r * (0.4 + easeOutCubic(pulse(age, 0.55 + i * 0.1, 1.5)) * 1.2), 6 * fall, hexA('#ffcf6a', fall));
        const rng = mulberry32(9);
        for (let i = 0; i < 26; i++) {
          const ex = c.x + (rng() - 0.5) * r * 1.8;
          const ey = c.y - ((age * 160 * (0.5 + rng()) + rng() * 200) % 360);
          ctx.fillStyle = hexA('#ffd27a', fall * 0.9);
          ctx.fillRect(ex, ey, 4, 4);
        }
      }
    },
  },

  // Fox: spinning katana arc, ice shards fly outward
  goemon_diamond: {
    dur: 1.1,
    draw(ctx, e, k, t) {
      const age = e.age;
      ctx.save();
      ctx.globalAlpha = Math.sin(Math.min(1, k * 1.1) * Math.PI) * 0.9;
      drawPersona(ctx, 'goemon', e.x, e.y - 90, 60, t, '#29b6f6');
      ctx.restore();
      const sweep = pulse(age, 0, 0.45);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(-1.2);
      ctx.lineCap = 'round';
      ctx.strokeStyle = hexA('#bff3ff', 1 - pulse(age, 0.5, 1));
      ctx.shadowColor = '#29b6f6';
      ctx.shadowBlur = 24;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(0, 0, 90, 0, TAU * sweep);
      ctx.stroke();
      ctx.restore();
      const rng = mulberry32(14);
      for (let i = 0; i < 18; i++) {
        const a = rng() * TAU;
        const d = 40 + easeOutCubic(pulse(age, 0.2, 1)) * (80 + rng() * 80);
        ctx.save();
        ctx.translate(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d);
        ctx.rotate(a);
        ctx.fillStyle = hexA('#d9f8ff', 1 - pulse(age, 0.5, 1));
        poly(ctx, [[-10, 0], [0, -4], [14, 0], [0, 4]]);
        ctx.fill();
        ctx.restore();
      }
      ringStroke(ctx, e.x, e.y, 110 * easeOutCubic(pulse(age, 0, 0.7)), 5, hexA('#7fe3ff', 1 - k));
    },
  },

  // Queen: charge phase (reticle + orb). The impact is a separate effect.
  anat_atomic: {
    dur: 1.4,
    draw(ctx, e, k, t) {
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.5 * k;
      drawPersona(ctx, 'johanna', e.x, e.y - 85, 52, t, '#b266ff');
      ctx.restore();
      glow(ctx, e.x, e.y - 10, 20 + k * 90, '#c58bff', 0.5 + 0.4 * k);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(e.x, e.y - 10, 6 + k * 18, 0, TAU);
      ctx.fill();
      const tg = e.targets[0];
      if (tg) {
        for (let i = 0; i < 3; i++) {
          ringStroke(ctx, tg.x, tg.y, (140 - i * 30) * (1.15 - k * 0.6), 3, hexA('#a6ff3d', 0.5 + 0.4 * k));
        }
        ctx.strokeStyle = '#a6ff3d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(tg.x - 150, tg.y);
        ctx.lineTo(tg.x + 150, tg.y);
        ctx.moveTo(tg.x, tg.y - 150);
        ctx.lineTo(tg.x, tg.y + 150);
        ctx.stroke();
        ctx.strokeStyle = hexA('#b266ff', 0.35 * k);
        ctx.lineWidth = 2 + k * 4;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y - 10);
        ctx.lineTo(tg.x, tg.y);
        ctx.stroke();
      }
    },
  },

  anat_impact: {
    dur: 1.6,
    draw(ctx, e, k, t) {
      const age = e.age;
      const fall = 1 - pulse(age, 0.6, 1.6);
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - age / 0.35)})`;
      ctx.fillRect(0, 0, W, H);
      const colW = 70 * (1 - pulse(age, 0.1, 0.9)) + 12;
      const g = ctx.createLinearGradient(0, 0, 0, e.y);
      g.addColorStop(0, hexA('#e9ffb3', 0));
      g.addColorStop(1, hexA('#ffffff', fall));
      ctx.fillStyle = g;
      ctx.fillRect(e.x - colW, 0, colW * 2, e.y);
      for (let i = 0; i < 3; i++) ringStroke(ctx, e.x, e.y, e.radius * easeOutCubic(pulse(age, i * 0.1, 0.9 + i * 0.1)) * 1.4, 10 * fall, hexA('#a6ff3d', fall));
      glow(ctx, e.x, e.y, e.radius * 2.4, '#a6ff3d', 0.8 * fall);
      speedLines(ctx, e.x, e.y, t, `rgba(220,255,160,${0.5 * fall})`, 40, 40, 700);
    },
  },

  // Mona: a green gale sweeps the whole field, leaving healing motes on allies
  zorro_mediarama: {
    dur: 1.6,
    draw(ctx, e, k, t) {
      const age = e.age;
      ctx.save();
      ctx.globalAlpha = Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.9;
      drawPersona(ctx, 'zorro', e.x, e.y - 85, 60, t, '#3aa0ff');
      ctx.restore();
      const front = W * 1.25 * pulse(age, 0, 1.0) - 150;
      const rng = mulberry32(31);
      for (let i = 0; i < 14; i++) {
        const y0 = FIELD_Y + rng() * (6 * TILE);
        const x = front - rng() * 360;
        const len = 160 + rng() * 240;
        ctx.strokeStyle = hexA(i % 3 ? '#9dffc0' : '#e8fff0', 0.75 * (1 - pulse(age, 1.0, 1.6)));
        ctx.lineWidth = 3 + rng() * 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - len, y0 + 24);
        ctx.bezierCurveTo(x - len * 0.5, y0 - 26, x - len * 0.2, y0 + 30, x, y0);
        ctx.stroke();
      }
      for (const a of e.allies || []) {
        if (a.x > front) continue;
        const q = pulse(age, 0.2, 1.5);
        ringStroke(ctx, a.x, a.y, 30 + q * 40, 4, hexA('#9dffc0', 1 - q));
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = hexA('#d6ffe4', 1 - q);
          ctx.fillRect(a.x - 24 + i * 9, a.y - q * 70 - (i % 3) * 8, 4, 12);
        }
      }
    },
  },

  // Oracle: radar sweep + hex grid over the field
  alazif_scan: {
    dur: 1.6,
    draw(ctx, e, k, t) {
      const age = e.age;
      const sweepX = W * easeOutCubic(pulse(age, 0, 1.0));
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, FIELD_Y, sweepX, 6 * TILE);
      ctx.clip();
      hexGrid(ctx, 0, FIELD_Y, W, 6 * TILE, 34, hexA('#ff9f1c', 0.55 * (1 - pulse(age, 1.0, 1.6))));
      ctx.fillStyle = hexA('#ff9f1c', 0.1 * (1 - pulse(age, 1.0, 1.6)));
      ctx.fillRect(0, FIELD_Y, W, 6 * TILE);
      ctx.restore();
      const g = ctx.createLinearGradient(sweepX - 120, 0, sweepX, 0);
      g.addColorStop(0, hexA('#ffd9a0', 0));
      g.addColorStop(1, hexA('#ffd9a0', 0.9));
      ctx.fillStyle = g;
      ctx.fillRect(sweepX - 120, FIELD_Y, 120, 6 * TILE);
      ctx.save();
      ctx.globalAlpha = Math.sin(Math.min(1, k * 1.2) * Math.PI);
      drawPersona(ctx, 'alazif', e.x, e.y - 90, 70, t, '#ff9f1c');
      ctx.restore();
      for (const tg of e.targets) {
        if (tg.x > sweepX) continue;
        const q = pulse(age, 0.3, 1.2);
        ctx.strokeStyle = hexA('#ffcf6a', 1 - q * 0.5);
        ctx.lineWidth = 3;
        const s = 34 - q * 6;
        ctx.strokeRect(tg.x - s, tg.y - s - 20, s * 2, s * 2);
      }
    },
  },

  // Noir: great axe slams down, shockwave, hex shield
  milady_aegis: {
    dur: 1.4,
    draw(ctx, e, k, t) {
      const age = e.age;
      const drop = easeOutCubic(pulse(age, 0, 0.3));
      if (age < 0.6) {
        ctx.save();
        ctx.translate(e.x + 26, e.y - 330 * (1 - drop) - 26);
        ctx.rotate(0.35);
        ctx.fillStyle = '#0a0a10';
        ctx.strokeStyle = '#ff7bb0';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#c8326e';
        ctx.shadowBlur = 20;
        poly(ctx, [[-5, 70], [-5, -90], [5, -90], [5, 70]]);
        ctx.fill();
        ctx.stroke();
        poly(ctx, [[5, -90], [70, -110], [62, -30], [5, -45]]);
        ctx.fill();
        ctx.stroke();
        poly(ctx, [[-5, -90], [-70, -110], [-62, -30], [-5, -45]]);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      if (age > 0.28) {
        const q = pulse(age, 0.28, 1.0);
        ringStroke(ctx, e.x, e.y + 10, 150 * easeOutCubic(q), 10 * (1 - q), hexA('#ffd9e8', 1 - q));
        ringStroke(ctx, e.x, e.y + 10, 90 * easeOutCubic(q), 6 * (1 - q), hexA('#ff7bb0', 1 - q));
        ctx.save();
        ctx.beginPath();
        ctx.arc(e.x, e.y, 70 + 6 * Math.sin(age * 20), 0, TAU);
        ctx.clip();
        ctx.fillStyle = hexA('#ff7bb0', 0.18 * (1 - k));
        ctx.fillRect(e.x - 90, e.y - 90, 180, 180);
        hexGrid(ctx, e.x - 90, e.y - 90, 180, 180, 16, hexA('#ffd9e8', 0.8 * (1 - k)));
        ctx.restore();
        ringStroke(ctx, e.x, e.y, 70, 3, hexA('#ffd9e8', 1 - k));
      }
      for (const tg of e.targets) {
        if (age > 0.28) ringStroke(ctx, tg.x, tg.y, 50 * pulse(age, 0.28, 0.8), 6, hexA('#fff3a6', 1 - k));
      }
      halftone(ctx, e.x - 140, e.y - 140, 280, 280, 14, hexA('#c8326e', 0.25 * (1 - k)));
    },
  },
};
