// Full-screen skill / All-Out Rush cut-ins, drawn procedurally on the main canvas.
import { TAU, clamp, easeOutCubic, easeOutBack, easeInCubic, pulse, hexA } from '../core/util.js';
import { W, H, RED, FONT, poly, text, halftone, speedLines, starburst, glow } from './draw.js';
import { drawPortrait } from './characters.js';
import { drawPersona } from './personas.js';
import { OPERATORS } from '../data/operators.js';

export const SKILL_CUTIN_DUR = 1.45;

export class CutIn {
  constructor(settings) {
    this.settings = settings;
    this.spec = null;
    this.age = 0;
    this.dur = 0;
    this.done = null;
  }

  get active() {
    return !!this.spec;
  }

  playSkill(opId, skillName) {
    const def = OPERATORS[opId];
    return new Promise((res) => {
      this.spec = { kind: 'skill', opId, def, skillName };
      this.age = 0;
      this.dur = this.settings.reduceFlash ? 1.1 : SKILL_CUTIN_DUR;
      this.done = res;
    });
  }

  playAllOut(opIds) {
    return new Promise((res) => {
      this.spec = { kind: 'allout', ops: opIds };
      this.age = 0;
      this.per = 0.32;
      this.dur = 0.5 + opIds.length * this.per + 1.35;
      this.done = res;
    });
  }

  skip() {
    if (this.spec) this.age = this.dur;
  }

  update(dt) {
    if (!this.spec) return;
    this.age += dt;
    if (this.age >= this.dur) {
      const d = this.done;
      this.spec = null;
      this.done = null;
      d?.();
    }
  }

  draw(ctx, t) {
    if (!this.spec) return;
    if (this.spec.kind === 'skill') this.drawSkill(ctx, t);
    else this.drawAllOut(ctx, t);
  }

  drawSkill(ctx, t) {
    const { def, skillName } = this.spec;
    const k = this.age / this.dur;
    const inK = easeOutCubic(pulse(k, 0, 0.16));
    const outK = easeInCubic(pulse(k, 0.86, 1));
    const env = inK * (1 - outK);
    const col = def.color;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.62 * env})`;
    ctx.fillRect(0, 0, W, H);

    // main diagonal band
    const bandY = 360;
    const shift = (1 - inK) * -W + outK * W;
    ctx.save();
    ctx.translate(shift, 0);
    ctx.fillStyle = '#000';
    poly(ctx, [[-60, bandY - 230], [W + 60, bandY - 290], [W + 60, bandY + 250], [-60, bandY + 300]]);
    ctx.fill();
    ctx.fillStyle = RED;
    poly(ctx, [[-60, bandY - 205], [W + 60, bandY - 265], [W + 60, bandY + 215], [-60, bandY + 265]]);
    ctx.fill();
    ctx.fillStyle = hexA(col, 0.55);
    poly(ctx, [[W * 0.35, bandY - 270], [W + 60, bandY - 265], [W + 60, bandY + 215], [W * 0.2, bandY + 262]]);
    ctx.fill();
    halftone(ctx, 0, bandY - 300, W, 600, 14, 'rgba(0,0,0,0.22)', (x) => 1 - x);
    // white edge
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-60, bandY - 205);
    ctx.lineTo(W + 60, bandY - 265);
    ctx.moveTo(-60, bandY + 265);
    ctx.lineTo(W + 60, bandY + 215);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    poly(ctx, [[0, bandY - 215], [W, bandY - 275], [W, bandY + 225], [0, bandY + 275]]);
    ctx.clip();
    ctx.translate(shift, 0);
    speedLines(ctx, W * 0.34, bandY, t, 'rgba(255,255,255,0.22)', 52, 160, 1300);
    // persona silhouette behind the portrait
    ctx.globalAlpha = 0.95 * env;
    const pk = easeOutCubic(pulse(k, 0.08, 0.5));
    drawPersona(ctx, def.persona, W * 0.7 - (1 - pk) * 160, bandY + 20, 230, t, '#fff');
    drawPersona(ctx, def.persona, W * 0.7 - (1 - pk) * 160, bandY + 20, 230, t, col);
    ctx.globalAlpha = 1;
    // portrait slides in from the right with slight overshoot
    const px = W * 0.3 + (1 - easeOutBack(pulse(k, 0.04, 0.34))) * 900 + outK * 400;
    glow(ctx, px, bandY, 360, col, 0.5);
    ctx.save();
    ctx.translate(px, bandY + 330);
    ctx.rotate(-0.06);
    drawPortrait(ctx, def.id, 0, 0, 780, { t, emote: 'smirk' });
    ctx.restore();
    ctx.restore();

    // typography
    const tk = easeOutBack(pulse(k, 0.2, 0.42));
    ctx.save();
    ctx.translate(W * 0.58 + (1 - tk) * 400, bandY - 90);
    ctx.rotate(-0.07);
    text(ctx, `${def.name.toUpperCase()}  /  ${def.personaName.toUpperCase()}`, 0, -66, { size: 34, fill: '#fff', stroke: '#000', lw: 6, skew: -0.2 });
    const parts = skillName.split('·');
    const main = (parts[1] || parts[0]).trim().toUpperCase();
    ctx.font = `86px ${FONT}`;
    const maxW = W - (W * 0.58 + 40);
    const size = Math.min(86, Math.floor((86 * maxW) / Math.max(1, ctx.measureText(main).width * 1.12)));
    text(ctx, main, 0, 30, { size, fill: '#fff', stroke: '#000', lw: 14, skew: -0.2, shadow: hexA('#000', 0.6) });
    text(ctx, main, 0, 30, { size, fill: '#fff', skew: -0.2 });
    text(ctx, (parts[0] || '').trim().toUpperCase(), 6, 86, { size: 40, fill: col, stroke: '#000', lw: 7, skew: -0.2 });
    ctx.restore();
    ctx.restore();
  }

  drawAllOut(ctx, t) {
    const { ops } = this.spec;
    const age = this.age;
    const per = this.per;
    const introEnd = 0.5;
    const slashEnd = introEnd + ops.length * per;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.78 * easeOutCubic(pulse(age, 0, 0.2))})`;
    ctx.fillRect(0, 0, W, H);
    // checker backdrop
    if (age < slashEnd) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      for (let i = -2; i < 22; i++) {
        ctx.fillStyle = i % 2 ? '#e5001d' : '#000';
        poly(ctx, [[i * 80 - ((t * 400) % 160), 0], [i * 80 + 60 - ((t * 400) % 160), 0], [i * 80 - 200 - ((t * 400) % 160), H], [i * 80 - 260 - ((t * 400) % 160), H]]);
        ctx.fill();
      }
      ctx.restore();
    }
    if (age < introEnd) {
      text(ctx, 'ALL-OUT RUSH', W / 2, H / 2 + 20, { size: 130 * (0.6 + 0.4 * easeOutBack(pulse(age, 0, 0.3))), fill: '#fff', stroke: '#000', lw: 14, align: 'center', skew: -0.2, rot: -0.05 });
    }
    // each operator strikes in turn
    ops.forEach((id, i) => {
      const s = introEnd + i * per;
      const q = pulse(age, s, s + per * 1.8);
      if (q <= 0 || age > slashEnd + 0.3) return;
      const def = OPERATORS[id];
      const dirx = i % 2 ? 1 : -1;
      const cx = W / 2 + dirx * (260 - i * 18);
      const cy = H / 2 + (i % 3 - 1) * 60;
      const appear = easeOutBack(pulse(age, s, s + 0.16));
      ctx.save();
      ctx.beginPath();
      poly(ctx, [[cx - 260, cy - 340], [cx + 280, cy - 300], [cx + 230, cy + 340], [cx - 300, cy + 300]]);
      ctx.clip();
      ctx.fillStyle = i % 2 ? '#000' : '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = hexA(def.color, 0.9);
      ctx.fillRect(cx - 300, cy - 380, 600, 760);
      halftone(ctx, cx - 300, cy - 380, 600, 760, 12, 'rgba(0,0,0,0.3)');
      ctx.translate(cx, cy + 290);
      ctx.scale(0.8 + appear * 0.25, 0.8 + appear * 0.25);
      drawPortrait(ctx, id, 0, 0, 720, { t, emote: 'laugh' });
      ctx.restore();
      // slash
      const sl = pulse(age, s + 0.05, s + 0.22);
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 10;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.moveTo(cx - 320, cy - 280);
      ctx.lineTo(cx - 320 + 640 * sl, cy - 280 + 560 * sl);
      ctx.stroke();
      ctx.restore();
      if (age - s < 0.06) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.8;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    });
    // finale
    if (age > slashEnd) {
      const f = pulse(age, slashEnd, slashEnd + 0.3);
      ctx.fillStyle = `rgba(229,0,29,${0.92 * f})`;
      ctx.fillRect(0, 0, W, H);
      speedLines(ctx, W / 2, H / 2, t, 'rgba(255,255,255,0.35)', 80, 100, 1200);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-0.05);
      starburst(ctx, 0, 0, 220, 520, 20, t * 0.5, '#000', '#fff');
      ctx.scale(0.7 + easeOutBack(f) * 0.4, 0.7 + easeOutBack(f) * 0.4);
      text(ctx, 'ALL-OUT', 0, -10, { size: 190, fill: '#fff', stroke: '#000', lw: 18, align: 'center', skew: -0.2 });
      text(ctx, 'RUSH!', 120, 120, { size: 150, fill: '#ffe933', stroke: '#000', lw: 16, align: 'center', skew: -0.2 });
      ctx.restore();
    }
    ctx.restore();
  }
}
