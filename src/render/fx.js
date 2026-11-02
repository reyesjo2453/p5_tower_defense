// Turns sim events into short-lived visual effects and draws them.
import { TAU, hexA, easeOutCubic, clamp, mulberry32 } from '../core/util.js';
import { text, starburst, lightning, glow, W } from './draw.js';
import { px, py, TILE } from './layout.js';
import { ELEMENTS } from '../data/operators.js';
import { SKILL_FX } from './skillfx.js';

export class Fx {
  constructor(settings) {
    this.list = [];
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#fff';
    this.settings = settings;
    this.seed = 1;
  }

  add(e) {
    e.age = 0;
    this.list.push(e);
    return e;
  }

  doShake(a) {
    if (this.settings.screenShake) this.shake = Math.max(this.shake, a);
  }

  doFlash(a, color = '#fff') {
    if (this.settings.reduceFlash) a *= 0.25;
    this.flash = Math.max(this.flash, a);
    this.flashColor = color;
  }

  handle(ev) {
    switch (ev.t) {
      case 'deploy':
        this.add({ type: 'puff', x: px(ev.x), y: py(ev.y), dur: 0.5, color: '#ffffff' });
        break;
      case 'retreat':
        this.add({ type: 'puff', x: px(ev.x), y: py(ev.y), dur: 0.4, color: '#7fe3ff' });
        break;
      case 'shot': {
        const color = ELEMENTS[ev.element]?.color || '#fff';
        const a = { x: px(ev.from.x), y: py(ev.from.y) - 14 };
        const b = { x: px(ev.to.x), y: py(ev.to.y) - 20 };
        if (ev.kind === 'melee') this.add({ type: 'slash', x: b.x, y: b.y, dur: 0.22, color, rot: Math.atan2(b.y - a.y, b.x - a.x) });
        else if (ev.kind === 'heal') this.add({ type: 'heal', a, b, dur: 0.5, color: '#9dffc0' });
        else this.add({ type: 'bolt', a, b, dur: 0.16, color, big: ev.big });
        break;
      }
      case 'estrike': {
        const a = { x: px(ev.from.x), y: py(ev.from.y) - 20 };
        const b = { x: px(ev.to.x), y: py(ev.to.y) - 20 };
        if (ev.ranged) this.add({ type: 'bolt', a, b, dur: 0.2, color: ev.color });
        else this.add({ type: 'slash', x: b.x, y: b.y, dur: 0.2, color: ev.color, rot: Math.atan2(b.y - a.y, b.x - a.x) + Math.PI });
        break;
      }
      case 'chain': {
        const pts = ev.points.map((p) => ({ x: px(p.x), y: py(p.y) - 20 }));
        this.add({ type: 'chain', pts, dur: 0.3, color: '#ffe933' });
        break;
      }
      case 'dmg': {
        const color = ev.op ? '#ff6f6f' : ev.weak ? '#ffe933' : ev.resist ? '#8a8a9a' : '#fff';
        this.add({ type: 'num', x: px(ev.x) + (Math.random() - 0.5) * 20, y: py(ev.y) - 40, v: ev.v, dur: 0.8, color, big: ev.weak || ev.down, weak: ev.weak });
        if (ev.weak) this.add({ type: 'burst', x: px(ev.x), y: py(ev.y) - 20, dur: 0.3, color: ELEMENTS[ev.element]?.color || '#fff' });
        break;
      }
      case 'heal':
        this.add({ type: 'num', x: px(ev.x), y: py(ev.y) - 50, v: `+${ev.v}`, dur: 0.8, color: '#7dff9c' });
        break;
      case 'down':
        this.add({ type: 'text', x: px(ev.x), y: py(ev.y) - 70, str: 'DOWN!', dur: 1.2, color: '#ffe933', size: ev.boss ? 64 : 46 });
        this.doShake(ev.boss ? 8 : 4);
        break;
      case 'kill':
        this.add({ type: 'death', x: px(ev.x), y: py(ev.y), dur: 0.6, boss: ev.boss });
        if (ev.boss) { this.doShake(14); this.doFlash(0.6); }
        break;
      case 'oplost':
        this.add({ type: 'text', x: px(ev.x), y: py(ev.y) - 70, str: 'DOWN', dur: 1, color: '#ff3b5c', size: 40 });
        this.add({ type: 'puff', x: px(ev.x), y: py(ev.y), dur: 0.5, color: '#ff3b5c' });
        break;
      case 'leak':
        this.doShake(10);
        this.doFlash(0.45, '#ff1a3c');
        this.add({ type: 'text', x: px(ev.x) - 60, y: py(ev.y), str: `-${ev.cost}`, dur: 1.2, color: '#ff3b5c', size: 60 });
        break;
      case 'phase':
        this.add({ type: 'text', x: px(ev.x), y: py(ev.y) - 120, str: ev.text, dur: 1.6, color: ev.color || '#fff', size: 70 });
        if (ev.ring) this.add({ type: 'ring', x: px(ev.x), y: py(ev.y), r: ev.ring * TILE, dur: 0.8, color: ev.color });
        this.doShake(9);
        break;
      case 'baton':
        for (const t of ev.to) this.add({ type: 'baton', a: { x: px(ev.from.x), y: py(ev.from.y) - 20 }, b: { x: px(t.x), y: py(t.y) - 20 }, dur: 0.9 });
        this.add({ type: 'text', x: px(ev.from.x), y: py(ev.from.y) - 90, str: 'BATON PASS', dur: 1.1, color: '#ff5577', size: 30 });
        break;
      case 'spawn':
        this.add({ type: 'puff', x: px(ev.x), y: py(ev.y), dur: 0.5, color: ev.boss ? '#ffd24a' : '#b36bff' });
        break;
      case 'skill': {
        const def = SKILL_FX[ev.id];
        if (!def) break;
        const e = {
          type: 'skill', id: ev.id, dur: def.dur, x: px(ev.x), y: py(ev.y) - 10, dir: ev.dir, color: '#fff',
          targets: (ev.targets || []).map((t) => ({ x: px(t.x), y: py(t.y) - 20 })),
          allies: (ev.allies || []).map((t) => ({ x: px(t.x), y: py(t.y) - 20 })),
          center: ev.center ? { x: px(ev.center.x), y: py(ev.center.y) } : null,
          radius: (ev.radius || 1.5) * TILE,
        };
        this.add(e);
        this.doShake(ev.id === 'milady_aegis' ? 12 : 6);
        break;
      }
      case 'impact':
        this.add({ type: 'skill', id: 'anat_impact', dur: SKILL_FX.anat_impact.dur, x: px(ev.x), y: py(ev.y), targets: [], radius: ev.radius * TILE });
        this.doShake(20);
        break;
      default:
    }
  }

  update(dt) {
    for (const e of this.list) e.age += dt;
    this.list = this.list.filter((e) => e.age < e.dur);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  draw(ctx, t) {
    for (const e of this.list) {
      const k = clamp(e.age / e.dur, 0, 1);
      ctx.save();
      switch (e.type) {
        case 'puff':
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + 0.4;
            const d = easeOutCubic(k) * 46;
            ctx.fillStyle = hexA(e.color, 1 - k);
            ctx.beginPath();
            ctx.arc(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d * 0.6, 6 * (1 - k) + 1, 0, TAU);
            ctx.fill();
          }
          ctx.strokeStyle = hexA(e.color, 1 - k);
          ctx.lineWidth = 4 * (1 - k);
          ctx.beginPath();
          ctx.ellipse(e.x, e.y + 12, 18 + 40 * k, (18 + 40 * k) * 0.45, 0, 0, TAU);
          ctx.stroke();
          break;
        case 'slash':
          ctx.translate(e.x, e.y);
          ctx.rotate(e.rot);
          ctx.strokeStyle = hexA(e.color, 1 - k);
          ctx.shadowColor = e.color;
          ctx.shadowBlur = 12;
          ctx.lineWidth = 7 * (1 - k) + 1;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(-6, 0, 30 + k * 12, -0.9, 0.9);
          ctx.stroke();
          break;
        case 'bolt': {
          const q = easeOutCubic(Math.min(1, k * 2.2));
          const hx = e.a.x + (e.b.x - e.a.x) * q;
          const hy = e.a.y + (e.b.y - e.a.y) * q;
          ctx.strokeStyle = hexA(e.color, 1 - k);
          ctx.lineWidth = e.big ? 7 : 3.5;
          ctx.shadowColor = e.color;
          ctx.shadowBlur = 14;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(e.a.x + (hx - e.a.x) * Math.max(0, k * 1.6 - 0.6), e.a.y + (hy - e.a.y) * Math.max(0, k * 1.6 - 0.6));
          ctx.lineTo(hx, hy);
          ctx.stroke();
          if (k > 0.45) {
            ctx.fillStyle = hexA(e.color, 1 - k);
            ctx.beginPath();
            ctx.arc(e.b.x, e.b.y, (e.big ? 26 : 12) * (k - 0.2), 0, TAU);
            ctx.fill();
          }
          break;
        }
        case 'chain':
          for (let i = 0; i < e.pts.length - 1; i++) {
            ctx.globalAlpha = 1 - k;
            lightning(ctx, e.pts[i].x, e.pts[i].y, e.pts[i + 1].x, e.pts[i + 1].y, e.color, 3, Math.floor(e.age * 40) + i);
          }
          break;
        case 'heal':
          for (let i = 0; i < 5; i++) {
            const q = clamp(k * 1.3 - i * 0.1, 0, 1);
            ctx.fillStyle = hexA(e.color, 1 - q);
            ctx.fillRect(e.a.x + (e.b.x - e.a.x) * q - 3, e.a.y + (e.b.y - e.a.y) * q - 3 - Math.sin(q * 6) * 10, 7, 7);
          }
          break;
        case 'baton': {
          const q = easeOutCubic(Math.min(1, k * 1.5));
          ctx.strokeStyle = hexA('#ff5577', 1 - k);
          ctx.lineWidth = 5;
          ctx.setLineDash([14, 8]);
          ctx.beginPath();
          ctx.moveTo(e.a.x, e.a.y);
          ctx.lineTo(e.a.x + (e.b.x - e.a.x) * q, e.a.y + (e.b.y - e.a.y) * q);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = hexA('#fff', 1 - k);
          ctx.beginPath();
          ctx.arc(e.a.x + (e.b.x - e.a.x) * q, e.a.y + (e.b.y - e.a.y) * q, 9, 0, TAU);
          ctx.fill();
          break;
        }
        case 'num': {
          const rise = easeOutCubic(k) * 40;
          const sz = (e.big ? 40 : 28) * (k < 0.15 ? 1 + (0.15 - k) * 3 : 1);
          ctx.globalAlpha = 1 - clamp((k - 0.6) / 0.4, 0, 1);
          text(ctx, String(e.v), e.x, e.y - rise, { size: sz, fill: e.color, stroke: '#000', lw: 6, align: 'center', skew: e.weak ? -0.25 : 0 });
          if (e.weak) text(ctx, 'WEAK', e.x, e.y - rise - sz, { size: 18, fill: '#ff5577', stroke: '#000', lw: 4, align: 'center' });
          break;
        }
        case 'text': {
          const pop = easeOutCubic(clamp(k * 5, 0, 1));
          ctx.globalAlpha = 1 - clamp((k - 0.7) / 0.3, 0, 1);
          ctx.translate(e.x, e.y - k * 30);
          ctx.rotate(-0.06);
          ctx.scale(0.5 + pop * 0.5, 0.5 + pop * 0.5);
          text(ctx, e.str, 0, 0, { size: e.size, fill: e.color, stroke: '#000', lw: e.size / 5, align: 'center', skew: -0.2 });
          break;
        }
        case 'burst':
          starburst(ctx, e.x, e.y, 8 + k * 14, 26 + k * 24, 8, k * 2, hexA(e.color, 1 - k));
          ctx.fill();
          break;
        case 'ring':
          ctx.strokeStyle = hexA(e.color, 1 - k);
          ctx.lineWidth = 10 * (1 - k);
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r * easeOutCubic(k), 0, TAU);
          ctx.stroke();
          break;
        case 'death': {
          const rng = mulberry32(Math.floor(e.x + e.y));
          const n = e.boss ? 40 : 14;
          for (let i = 0; i < n; i++) {
            const a = rng() * TAU;
            const d = easeOutCubic(k) * (30 + rng() * (e.boss ? 160 : 60));
            ctx.fillStyle = hexA(i % 3 ? '#b36bff' : '#ffffff', 1 - k);
            ctx.fillRect(e.x + Math.cos(a) * d, e.y - 24 + Math.sin(a) * d, 5, 5);
          }
          if (e.boss) glow(ctx, e.x, e.y, 200 * k, '#ffd24a', 1 - k);
          break;
        }
        case 'skill': {
          const def = SKILL_FX[e.id];
          def.draw(ctx, e, k, t);
          break;
        }
        default:
      }
      ctx.restore();
    }
  }
}

export const _W = W;
