// Battle field renderer: animated backdrop, a pre-rendered 2.5D lit tile set (cached per stage),
// portals, flowing route energy, depth-sorted units with contact shadows, ambient particles and a
// dynamic light map driven by units, portals and FX.
import { TAU, hexA, rotateOffset, DIRS, mulberry32 } from '../core/util.js';
import { W, H, text, poly, glow } from './draw.js';
import { drawBackground } from './backgrounds.js';
import { drawToken } from './characters.js';
import { drawEcho } from './echoes.js';
import { TILE, FIELD_X, FIELD_Y, px, py } from './layout.js';
import { LightMap } from './lighting.js';
import { isMelee } from '../data/operators.js';

export const LIFT = 16; // high-ground block height in px

export const THEMES = {
  loop: {
    bg: 'battle_loop', ambient: '#7a719c',
    ground: ['#140d1c', '#0b0712'], groundLine: '#2a1b36',
    path: ['#3a2032', '#22121e'], pathSeam: '#120a10', pathEdge: '#ff2a4a', accent: '#e5001d',
    top: ['#4a3b66', '#30244a'], side: ['#1c1430', '#0c0818'], trim: '#ff3355', prop: 'rail',
    spawn: '#b36bff', goal: '#5fd9ff', mote: '#ff9fb4',
  },
  static: {
    bg: 'battle_static', ambient: '#6a8892',
    ground: ['#08161a', '#040b0e'], groundLine: '#10303a',
    path: ['#123a40', '#0a2328'], pathSeam: '#04161a', pathEdge: '#00e0c6', accent: '#00e0c6',
    top: ['#2b4d60', '#1a3242'], side: ['#0c1e28', '#050f14'], trim: '#00ffd5', prop: 'rack',
    spawn: '#b36bff', goal: '#5fd9ff', mote: '#7ffff0',
  },
  palace: {
    bg: 'battle_palace', ambient: '#8a7680',
    ground: ['#1a0810', '#0d0408'], groundLine: '#3a1420',
    path: ['#6a1626', '#3e0a16'], pathSeam: '#1e050a', pathEdge: '#ffd24a', accent: '#ffd24a',
    top: ['#5a5068', '#3c3448'], side: ['#221a2a', '#100a14'], trim: '#ffd24a', prop: 'candle',
    spawn: '#ff4a8a', goal: '#ffe9a0', mote: '#ffe6a0',
  },
};

const lin = (ctx, x0, y0, x1, y1, a, b) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
};

const isPathTile = (t) => t === 'p' || t === 'S' || t === 'E';

// ------------------------------------------------------------------ static field (cached)
const cache = new Map();

function buildField(b, th) {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const rng = mulberry32(b.cols * 131 + b.rows * 7 + th.bg.length);
  const tileAt = (c, r) => (r >= 0 && r < b.rows && c >= 0 && c < b.cols ? b.map[r][c] : '#');
  const fw = b.cols * TILE;
  const fh = b.rows * TILE;
  // ground slab with soft edge
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = lin(ctx, 0, FIELD_Y, 0, FIELD_Y + fh, th.ground[0], th.ground[1]);
  ctx.fillRect(FIELD_X, FIELD_Y, fw, fh);
  ctx.restore();
  // ground detail: grid scratches, debris, props
  for (let r = 0; r < b.rows; r++) {
    for (let c = 0; c < b.cols; c++) {
      if (b.map[r][c] !== '#') continue;
      const x = px(c);
      const y = py(r);
      ctx.strokeStyle = hexA(th.groundLine, 0.7);
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.02 + rng() * 0.04})`;
        ctx.fillRect(x + rng() * TILE, y + rng() * TILE, 1 + rng() * 3, 1 + rng() * 2);
      }
      const roll = rng();
      if (roll < 0.28) drawProp(ctx, th, x, y, rng);
    }
  }
  // path floor
  for (let r = 0; r < b.rows; r++) {
    for (let c = 0; c < b.cols; c++) {
      if (!isPathTile(b.map[r][c])) continue;
      const x = px(c);
      const y = py(r);
      ctx.fillStyle = lin(ctx, x, y, x + TILE, y + TILE, th.path[0], th.path[1]);
      ctx.fillRect(x, y, TILE, TILE);
      // sub-tiles and seams
      ctx.strokeStyle = th.pathSeam;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + TILE / 2, y);
      ctx.lineTo(x + TILE / 2, y + TILE);
      ctx.moveTo(x, y + TILE / 2);
      ctx.lineTo(x + TILE, y + TILE / 2);
      ctx.stroke();
      // glossy sheen
      const sh = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
      sh.addColorStop(0, 'rgba(255,255,255,0.10)');
      sh.addColorStop(0.5, 'rgba(255,255,255,0.0)');
      sh.addColorStop(1, 'rgba(0,0,0,0.15)');
      ctx.fillStyle = sh;
      ctx.fillRect(x, y, TILE, TILE);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.03 + rng() * 0.04})`;
        ctx.fillRect(x + 6 + rng() * (TILE - 12), y + 6 + rng() * (TILE - 12), 2 + rng() * 8, 1);
      }
      // emissive trims on borders facing non-path tiles
      for (const [dc, dr, ex, ey, ew, eh] of [[0, -1, 0, 0, TILE, 3], [0, 1, 0, TILE - 3, TILE, 3], [-1, 0, 0, 0, 3, TILE], [1, 0, TILE - 3, 0, 3, TILE]]) {
        if (!isPathTile(tileAt(c + dc, r + dr))) {
          ctx.fillStyle = hexA(th.pathEdge, 0.85);
          ctx.fillRect(x + ex, y + ey, ew, eh);
          ctx.fillStyle = hexA(th.pathEdge, 0.18);
          ctx.fillRect(x + ex - (dc < 0 ? 0 : dc > 0 ? 6 : 0) + (dc < 0 ? 3 : 0), y + ey - (dr > 0 ? 6 : 0) + (dr < 0 ? 3 : 0), dc ? 6 : ew, dr ? 6 : eh);
        }
      }
    }
  }
  // high-ground blocks: cast shadows first, then blocks top-to-bottom
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.filter = 'blur(6px)';
  for (let r = 0; r < b.rows; r++) {
    for (let c = 0; c < b.cols; c++) if (b.map[r][c] === 'h') ctx.fillRect(px(c) + 10, py(r) + 12, TILE - 6, TILE - 4);
  }
  ctx.restore();
  for (let r = 0; r < b.rows; r++) {
    for (let c = 0; c < b.cols; c++) if (b.map[r][c] === 'h') drawBlock(ctx, th, c, r, rng, tileAt);
  }
  // field frame
  ctx.strokeStyle = hexA(th.accent, 0.5);
  ctx.lineWidth = 2;
  ctx.strokeRect(FIELD_X + 1, FIELD_Y + 1, fw - 2, fh - 2);
  return cv;
}

function drawBlock(ctx, th, c, r, rng, tileAt) {
  const x = px(c) + 3;
  const y = py(r) + 3;
  const w = TILE - 6;
  const h = TILE - 6;
  const topH = h - LIFT;
  const joinR = tileAt(c + 1, r) === 'h';
  const joinD = tileAt(c, r + 1) === 'h';
  // front face (only where the block below is not also high ground)
  if (!joinD) {
    ctx.fillStyle = lin(ctx, 0, y + topH, 0, y + h, th.side[0], th.side[1]);
    ctx.fillRect(x, y + topH, w + (joinR ? 6 : 0), LIFT);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 1; i < 6; i++) ctx.fillRect(x + (i * w) / 6, y + topH + 3, 1, LIFT - 5);
    ctx.fillStyle = hexA(th.trim, 0.9);
    ctx.fillRect(x, y + topH, w + (joinR ? 6 : 0), 2);
  }
  // top face
  const tw = w + (joinR ? 6 : 0);
  const thh = topH + (joinD ? LIFT + 6 : 0);
  ctx.fillStyle = lin(ctx, x, y, x + w, y + topH, th.top[0], th.top[1]);
  ctx.fillRect(x, y, tw, thh);
  // panel inlay
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 8.5, y + 7.5, w - 17, topH - 15);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 10.5, y + 9.5, w - 21, topH - 19);
  // bevel highlights (key light from upper-left)
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  if (tileAt(c, r - 1) !== 'h') ctx.fillRect(x, y, tw, 2);
  if (tileAt(c - 1, r) !== 'h') ctx.fillRect(x, y, 2, thh);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  if (!joinR) ctx.fillRect(x + w - 2, y, 2, thh);
  // emissive rivets
  ctx.fillStyle = hexA(th.trim, 0.55);
  for (const [ox, oy] of [[6, 5], [w - 8, 5], [6, topH - 7], [w - 8, topH - 7]]) ctx.fillRect(x + ox, y + oy, 2, 2);
  if (rng() < 0.3) {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.moveTo(x + 14 + rng() * 20, y + 12);
    ctx.lineTo(x + 24 + rng() * 20, y + topH * 0.5);
    ctx.lineTo(x + 18 + rng() * 30, y + topH - 12);
    ctx.stroke();
  }
}

function drawProp(ctx, th, x, y, rng) {
  const cx = x + 20 + rng() * 40;
  const cy = y + 30 + rng() * 30;
  ctx.save();
  switch (th.prop) {
    case 'rail':
      ctx.fillStyle = '#0a0610';
      ctx.fillRect(x + 4, cy - 2, TILE - 8, 6);
      ctx.fillStyle = 'rgba(160,140,190,0.25)';
      ctx.fillRect(x + 4, cy - 2, TILE - 8, 1.5);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#1c1426';
        ctx.fillRect(x + 8 + i * 18, cy - 8, 6, 18);
      }
      break;
    case 'rack':
      ctx.fillStyle = '#06141a';
      ctx.fillRect(cx - 14, cy - 22, 28, 36);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = rng() < 0.5 ? 'rgba(0,255,213,0.5)' : 'rgba(255,80,120,0.4)';
        ctx.fillRect(cx - 10, cy - 18 + i * 7, 3, 2);
      }
      break;
    case 'candle':
      ctx.fillStyle = '#2a0e16';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 10, 14, 5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#c9a24a';
      ctx.fillRect(cx - 2, cy - 14, 4, 24);
      break;
    default:
  }
  ctx.restore();
}

function fieldFor(b, th) {
  const key = `${b.stage.id}|${b.stage.theme}`;
  let cv = cache.get(key);
  if (!cv) {
    cv = buildField(b, th);
    cache.set(key, cv);
  }
  return cv;
}

// ------------------------------------------------------------------ animated layers
function routeFlow(ctx, b, th, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const corners of Object.values(b.stage.routes)) {
    const pts = corners.map(([x, y]) => [px(x + 0.5), py(y + 0.5)]);
    const segs = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      segs.push([pts[i], pts[i + 1], total, len]);
      total += len;
    }
    const at = (d) => {
      for (const [a, c, s0, len] of segs) {
        if (d <= s0 + len) {
          const k = (d - s0) / len;
          return [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k, Math.atan2(c[1] - a[1], c[0] - a[0])];
        }
      }
      return null;
    };
    const spacing = 60;
    for (let d = ((t * 70) % spacing); d < total; d += spacing) {
      const p = at(d);
      if (!p) continue;
      const fade = Math.min(1, d / 80, (total - d) / 80);
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.rotate(p[2]);
      const g = ctx.createLinearGradient(-26, 0, 6, 0);
      g.addColorStop(0, hexA(th.pathEdge, 0));
      g.addColorStop(1, hexA(th.pathEdge, 0.55 * fade));
      ctx.fillStyle = g;
      poly(ctx, [[-26, -2], [0, -2], [7, 0], [0, 2], [-26, 2]]);
      ctx.fill();
      ctx.fillStyle = hexA('#ffffff', 0.35 * fade);
      poly(ctx, [[-4, -6], [4, 0], [-4, 6], [-1, 0]]);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

function portal(ctx, x, y, color, t, kind) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  if (kind === 'spawn') {
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = hexA(color, 0.55 - i * 0.1);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 30 - i * 6, 13 - i * 2.5, 0, t * (2 + i) + i, t * (2 + i) + i + 4.2);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const k = (t * 0.7 + i / 8) % 1;
      ctx.fillStyle = hexA(color, 0.8 * (1 - k));
      ctx.beginPath();
      ctx.arc(Math.cos(i * 2.4) * 22 * (1 - k), -k * 50, 2.5, 0, TAU);
      ctx.fill();
    }
  } else {
    const g = ctx.createLinearGradient(0, -90, 0, 10);
    g.addColorStop(0, hexA(color, 0));
    g.addColorStop(1, hexA(color, 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(-26, -90, 52, 100);
    ctx.strokeStyle = hexA(color, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 6, 30, 11, 0, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.6 + i / 3) % 1;
      ctx.strokeStyle = hexA(color, 0.7 * (1 - k));
      ctx.beginPath();
      ctx.ellipse(0, 6 - k * 70, 30 - k * 8, 11 - k * 3, 0, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.restore();
}

class Motes {
  constructor() {
    this.list = [];
    this.rng = mulberry32(99);
  }

  update(dt, color) {
    while (this.list.length < 70) {
      this.list.push({ x: this.rng() * W, y: FIELD_Y + this.rng() * 480, vx: (this.rng() - 0.5) * 10, vy: -6 - this.rng() * 14, life: 0, max: 4 + this.rng() * 6, s: 0.8 + this.rng() * 1.8, color });
    }
    for (const m of this.list) {
      m.life += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
    }
    this.list = this.list.filter((m) => m.life < m.max);
  }

  draw(ctx, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.list) {
      const a = Math.sin((m.life / m.max) * Math.PI) * 0.6;
      ctx.fillStyle = hexA(m.color, a);
      ctx.beginPath();
      ctx.arc(m.x + Math.sin(t + m.y * 0.02) * 4, m.y, m.s, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ units
function rangeOverlay(ctx, def, c, r, dir, color, t) {
  for (const [dx, dy] of def.range) {
    const [rx, ry] = rotateOffset(dx, dy, dir);
    const x = px(c + rx);
    const y = py(r + ry);
    ctx.fillStyle = hexA(color, 0.16 + 0.06 * Math.sin(t * 5 + rx + ry));
    ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
    ctx.strokeStyle = hexA(color, 0.85);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [ax, ay, bx2, by2] of [[4, 4, 18, 4], [4, 4, 4, 18], [TILE - 4, 4, TILE - 18, 4], [TILE - 4, 4, TILE - 4, 18], [4, TILE - 4, 18, TILE - 4], [4, TILE - 4, 4, TILE - 18], [TILE - 4, TILE - 4, TILE - 18, TILE - 4], [TILE - 4, TILE - 4, TILE - 4, TILE - 18]]) {
      ctx.moveTo(x + ax, y + ay);
      ctx.lineTo(x + bx2, y + by2);
    }
    ctx.stroke();
  }
}

function bar(ctx, x, y, w, h, k, fg, bg = 'rgba(0,0,0,0.75)') {
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x - 1.5, y - 1.5, w + 3, h + 3, 2);
  ctx.fill();
  const kk = Math.max(0, Math.min(1, k));
  ctx.fillStyle = lin(ctx, 0, y, 0, y + h, hexA('#ffffff', 0.9), fg);
  ctx.fillRect(x, y, w * kk, Math.max(1, h * 0.35));
  ctx.fillStyle = fg;
  ctx.fillRect(x, y + h * 0.35, w * kk, h * 0.65);
}

function aura(ctx, u, x, y, t) {
  if (!u.skill.active && !u.charging) return;
  const c = u.def.color;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // rising pillar of the operator's colour
  const g = ctx.createLinearGradient(0, y + 30, 0, y - 70);
  g.addColorStop(0, hexA(c, 0.45));
  g.addColorStop(1, hexA(c, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y + 28, 34, 12, 0, 0, Math.PI);
  ctx.lineTo(x - 26, y - 70);
  ctx.lineTo(x + 26, y - 70);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const k = (t * 0.9 + i / 6) % 1;
    ctx.fillStyle = hexA(c, 0.9 * (1 - k));
    ctx.fillRect(x - 24 + ((i * 37) % 48), y + 24 - k * 90, 2, 8);
  }
  ctx.strokeStyle = hexA(c, 0.8);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y + 28, 30 + Math.sin(t * 6) * 3, 11, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

const anim = new WeakMap();
function attackPulse(u, dt) {
  let a = anim.get(u);
  if (!a) anim.set(u, (a = { cd: u.atkCd, k: 0, hurt: 0, hp: u.hp }));
  if (u.atkCd > a.cd + 0.05) a.k = 1;
  if (u.hp < a.hp - 0.5) a.hurt = 1;
  a.cd = u.atkCd;
  a.hp = u.hp;
  a.k = Math.max(0, a.k - dt * 4.5);
  a.hurt = Math.max(0, a.hurt - dt * 4);
  return a;
}

function drawOperator(ctx, b, u, t, ui, dt) {
  const lift = b.map[u.r]?.[u.c] === 'h' ? LIFT / 2 : 0;
  const x = px(u.x);
  const y = py(u.y) - lift;
  const a = attackPulse(u, dt);
  aura(ctx, u, x, y, t);
  ctx.save();
  if (a.hurt > 0) ctx.translate(Math.sin(t * 80) * 2 * a.hurt, 0);
  drawToken(ctx, u.id, x, y - 4, TILE * 1.05, { dir: u.dir, t, phase: u.uid, atk: a.k, hurt: a.hurt > 0.3 });
  if (a.hurt > 0) {
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y - 10, 40, '#ff3b5c', 0.5 * a.hurt);
  }
  ctx.restore();
  const w = 56;
  bar(ctx, x - w / 2, y + 40, w, 6, u.hp / u.def.hp, u.hp / u.def.hp < 0.3 ? '#ff5a5a' : '#44e07a');
  const sk = u.def.skill;
  const ready = u.sp >= sk.spCost && !u.skill.active && !u.charging;
  const spK = u.skill.active ? 1 - u.skill.t / (sk.duration || 1) : u.sp / sk.spCost;
  bar(ctx, x - w / 2, y + 49, w, 4, u.skill.active ? u.skill.t / (sk.duration || 1) : spK, u.skill.active ? '#ffd24a' : ready ? '#ffffff' : '#59c8ff');
  if (u.buffs.some((bf) => bf.key === 'baton')) text(ctx, '▲', x + 30, y - 34, { size: 22, fill: '#ff5577', stroke: '#000', lw: 4, align: 'center' });
  if (ui.selected === u) {
    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 6);
    ctx.beginPath();
    ctx.ellipse(x, y + 28, 38, 14, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  if (ready) {
    const k = 0.6 + 0.4 * Math.sin(t * 8);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y - 64, 34, '#ff2a4a', 0.5 * k);
    ctx.restore();
    text(ctx, 'SKILL', x, y - 58, { size: 20, fill: `rgba(255,255,255,${k})`, stroke: '#e5001d', lw: 5, align: 'center', skew: -0.2 });
  }
}

function drawEnemy(ctx, e, t) {
  const x = px(e.x);
  const y = py(e.y) + 24;
  const def = e.def;
  const size = def.id === 'maestro' ? 170 : def.id === 'conductor' ? 130 : def.id === 'bulwark' ? 92 : 74;
  const heading = e.seg < e.route.length ? Math.sign(e.route[e.seg].x - e.x) || 1 : 1;
  // contact shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.36, size * 0.11, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.save();
  if (e.down > 0) {
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 20) * 0.04 + 0.12);
    ctx.translate(-x, -y);
  }
  drawEcho(ctx, def, x, y, size, t + e.uid, { flash: e.flash > 0 ? 1 : 0, down: e.down > 0, dir: heading });
  ctx.restore();
  const w = Math.max(48, size * 0.7);
  const by = y - size - (def.id === 'maestro' ? 16 : 6);
  bar(ctx, x - w / 2, by, w, 6, e.hp / def.hp, def.boss ? '#ffd24a' : '#ff4466');
  if (e.stagger > 0 && e.down <= 0) bar(ctx, x - w / 2, by + 9, w, 3, e.stagger / def.staggerMax, '#ffe933');
  if (e.down > 0) {
    text(ctx, 'DOWN', x, by - 6, { size: 24, fill: '#ffe933', stroke: '#000', lw: 5, align: 'center', skew: -0.2 });
  } else if (e.stun > 0) {
    text(ctx, '✦', x, by - 4, { size: 26, fill: '#fff3a6', stroke: '#000', lw: 4, align: 'center' });
  }
  if (e.buffs.some((bf) => bf.key === 'analyze')) {
    ctx.save();
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -t * 30;
    ctx.strokeRect(x - 30, y - size * 0.92, 60, size * 0.92);
    ctx.restore();
  }
  if (e.burn) text(ctx, '🔥', x + w / 2 + 6, by + 4, { size: 18, align: 'center' });
  if (e.buffs.some((bf) => bf.key === 'slow')) text(ctx, '❄', x - w / 2 - 8, by + 6, { size: 16, fill: '#bff3ff', align: 'center' });
  if (def.boss) text(ctx, def.name.toUpperCase(), x, by - 24, { size: 18, fill: '#fff', stroke: '#000', lw: 4, align: 'center' });
}

// ------------------------------------------------------------------ main entry
const lightmap = { lm: null };
const motes = new Motes();
let lastT = 0;

export function drawBattle(ctx, b, t, ui, fx = null, quality = 'high') {
  const th = THEMES[b.stage.theme] || THEMES.loop;
  const dt = Math.max(0, Math.min(0.05, t - lastT));
  lastT = t;
  drawBackground(ctx, th.bg, t);
  ctx.drawImage(fieldFor(b, th), 0, 0);
  routeFlow(ctx, b, th, t);
  // portals
  const portals = [];
  for (let r = 0; r < b.rows; r++) {
    for (let c = 0; c < b.cols; c++) {
      const tile = b.map[r][c];
      if (tile === 'S') portals.push(['spawn', px(c + 0.5), py(r + 0.5), th.spawn]);
      else if (tile === 'E') portals.push(['goal', px(c + 0.5), py(r + 0.5), th.goal]);
    }
  }
  for (const [kind, x, y, col] of portals) portal(ctx, x, y + 10, col, t, kind);

  // placement overlays
  if (ui.placing) {
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        if (!b.validTile(ui.placing, c, r)) continue;
        const lift = b.map[r][c] === 'h' ? LIFT : 0;
        const a = 0.16 + 0.1 * Math.sin(t * 6 + c * 0.5 + r * 0.3);
        ctx.fillStyle = `rgba(80,255,150,${a})`;
        ctx.fillRect(px(c) + 5, py(r) + 5, TILE - 10, TILE - 10 - lift);
        ctx.strokeStyle = 'rgba(120,255,180,0.85)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px(c) + 5, py(r) + 5, TILE - 10, TILE - 10 - lift);
      }
    }
  }
  if (ui.placeTile && ui.placing) {
    const { c, r } = ui.placeTile;
    const dir = ui.dir ?? 0;
    rangeOverlay(ctx, ui.placing.def, c, r, dir, ui.placing.def.color, t);
    ctx.save();
    ctx.globalAlpha = 0.85;
    drawToken(ctx, ui.placing.id, px(c + 0.5), py(r + 0.5) - 6, TILE * 1.05, { dir, t, noTag: true });
    ctx.restore();
    for (let d = 0; d < 4; d++) {
      const cx = px(c + 0.5) + DIRS[d].x * 62;
      const cy = py(r + 0.5) + DIRS[d].y * 62;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate([0, Math.PI / 2, Math.PI, -Math.PI / 2][d]);
      ctx.fillStyle = d === dir ? '#fff' : 'rgba(255,255,255,0.35)';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6;
      poly(ctx, [[-10, -14], [14, 0], [-10, 14]]);
      ctx.fill();
      ctx.restore();
    }
  } else if (ui.hover && ui.placing && b.validTile(ui.placing, ui.hover.c, ui.hover.r)) {
    rangeOverlay(ctx, ui.placing.def, ui.hover.c, ui.hover.r, 0, ui.placing.def.color, t);
  }
  if (ui.selected && !ui.selected.dead) rangeOverlay(ctx, ui.selected.def, ui.selected.c, ui.selected.r, ui.selected.dir, '#ffffff', t);
  else if (ui.hover && !ui.placing) {
    const u = b.unitAt(ui.hover.c, ui.hover.r);
    if (u) rangeOverlay(ctx, u.def, u.c, u.r, u.dir, u.def.color, t);
  }

  // entities, depth-sorted
  const ents = [...b.operators.map((o) => ({ y: o.y, o })), ...b.enemies.map((e) => ({ y: e.y + 0.3, e }))].sort((a, c) => a.y - c.y);
  for (const it of ents) {
    if (it.o) drawOperator(ctx, b, it.o, t, ui, dt);
    else drawEnemy(ctx, it.e, t);
  }

  // ambient motes
  motes.update(dt, th.mote);
  motes.draw(ctx, t);

  // dynamic lighting
  if (quality !== 'off') {
    if (!lightmap.lm) lightmap.lm = new LightMap();
    const lm = lightmap.lm;
    lm.begin();
    for (const [kind, x, y, col] of portals) lm.add(x, y, kind === 'spawn' ? 190 : 210, col, 1.0 + Math.sin(t * 3) * 0.1);
    for (const o of b.operators) {
      const lift = b.map[o.r]?.[o.c] === 'h' ? LIFT / 2 : 0;
      lm.add(px(o.x), py(o.y) - lift - 10, o.skill.active ? 200 : 120, o.def.color, o.skill.active ? 1.1 : 0.55);
    }
    for (const e of b.enemies) lm.add(px(e.x), py(e.y) - 10, e.def.boss ? 200 : 90, e.def.color || '#b36bff', e.def.boss ? 0.55 : 0.35);
    fx?.lights?.(lm, t);
    lm.apply(ctx, th.ambient, { glow: 0.28, region: [0, 0, W, H] });
  }
}

export const _H = H;
export const _W = W;
export const _isMelee = isMelee;
