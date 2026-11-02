// Draws the battle field: tiles, operators, echoes and overlays.
import { TAU, hexA, rotateOffset, DIRS } from '../core/util.js';
import { W, H, text, poly, glow } from './draw.js';
import { drawBackground } from './backgrounds.js';
import { drawToken } from './characters.js';
import { drawEcho } from './echoes.js';
import { TILE, FIELD_X, FIELD_Y, px, py } from './layout.js';
import { isMelee } from '../data/operators.js';

const THEMES = {
  loop: { bg: 'battle_loop', path: '#2c1020', pathEdge: '#e5001d', high: '#3b2a52', highSide: '#170d24', accent: '#e5001d' },
  static: { bg: 'battle_static', path: '#0d2b30', pathEdge: '#00e0c6', high: '#1f3a49', highSide: '#0a1a22', accent: '#00e0c6' },
  palace: { bg: 'battle_palace', path: '#3a0f18', pathEdge: '#ffd24a', high: '#52303a', highSide: '#22101a', accent: '#ffd24a' },
};

function tilePath(ctx, c, r, theme, t) {
  const x = px(c);
  const y = py(r);
  ctx.fillStyle = theme.path;
  ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
  ctx.strokeStyle = hexA(theme.pathEdge, 0.35);
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
}

function tileHigh(ctx, c, r, theme) {
  const x = px(c);
  const y = py(r);
  ctx.fillStyle = theme.highSide;
  ctx.fillRect(x + 4, y + 14, TILE - 8, TILE - 14);
  ctx.fillStyle = theme.high;
  ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 20);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x + 4, y + 4, TILE - 8, 4);
}

function routeArrows(ctx, b, theme, t) {
  ctx.fillStyle = hexA(theme.pathEdge, 0.5);
  for (const corners of Object.values(b.stage.routes)) {
    for (let i = 0; i < corners.length - 1; i++) {
      const [ax, ay] = corners[i];
      const [bx, by] = corners[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      const dx = Math.sign(bx - ax);
      const dy = Math.sign(by - ay);
      for (let s = 0; s < len; s++) {
        const k = (s + ((t * 0.8) % 1)) / len;
        if (k > 1) continue;
        const cx = px(ax + 0.5 + dx * s + dx * ((t * 0.8) % 1));
        const cy = py(ay + 0.5 + dy * s + dy * ((t * 0.8) % 1));
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.atan2(dy, dx));
        poly(ctx, [[-6, -8], [6, 0], [-6, 8]]);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

function rangeOverlay(ctx, def, c, r, dir, color) {
  ctx.fillStyle = hexA(color, 0.22);
  ctx.strokeStyle = hexA(color, 0.8);
  ctx.lineWidth = 2;
  for (const [dx, dy] of def.range) {
    const [rx, ry] = rotateOffset(dx, dy, dir);
    const x = px(c + rx);
    const y = py(r + ry);
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
  }
}

function bar(ctx, x, y, w, h, k, fg, bg = 'rgba(0,0,0,0.7)') {
  ctx.fillStyle = bg;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, k)), h);
}

function aura(ctx, u, x, y, t) {
  if (!u.skill.active) return;
  const id = u.def.skill.id;
  ctx.save();
  if (id === 'kidd_thunder') {
    ctx.strokeStyle = '#ffe933';
    ctx.shadowColor = '#ffe933';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) {
      const a = t * 9 + i * 1.6;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 24, y + Math.sin(a) * 24);
      ctx.lineTo(x + Math.cos(a + 0.4) * 44, y + Math.sin(a + 0.4) * 44 - 4);
      ctx.lineTo(x + Math.cos(a + 0.2) * 54, y + Math.sin(a + 0.2) * 54);
      ctx.stroke();
    }
  } else if (id === 'goemon_diamond') {
    ctx.strokeStyle = '#bff3ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#29b6f6';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 40, 14, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(223,250,255,0.9)';
    for (let i = 0; i < 6; i++) ctx.fillRect(x - 36 + ((i * 29 + t * 30) % 72), y - 40 + ((i * 17 + t * 40) % 70), 3, 3);
  } else if (id === 'milady_aegis') {
    ctx.strokeStyle = 'rgba(255,217,232,0.9)';
    ctx.fillStyle = 'rgba(255,123,176,0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 50 + Math.sin(t * 8) * 2, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else if (id === 'alazif_scan') {
    ctx.strokeStyle = 'rgba(255,159,28,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = t * 1.5 + (i / 6) * TAU;
      ctx.lineTo(x + Math.cos(a) * 46, y + Math.sin(a) * 28);
    }
    ctx.closePath();
    ctx.stroke();
  } else if (id === 'anat_atomic' && u.charging) {
    glow(ctx, x, y, 80, '#c58bff', 0.8);
  }
  ctx.restore();
}

function drawOperator(ctx, u, t, ui) {
  const x = px(u.x);
  const y = py(u.y);
  aura(ctx, u, x, y, t);
  const hit = u.flash > 0;
  ctx.save();
  if (hit) ctx.globalAlpha = 0.7;
  drawToken(ctx, u.id, x, y - 2, TILE * 1.05, { dir: u.dir, t, phase: u.uid });
  ctx.restore();
  const w = 56;
  bar(ctx, x - w / 2, y + 38, w, 6, u.hp / u.def.hp, '#44e07a');
  const sk = u.def.skill;
  const spK = u.skill.active ? u.skill.t / (sk.duration || 1) : u.sp / sk.spCost;
  bar(ctx, x - w / 2, y + 46, w, 4, spK, u.skill.active ? '#ffd24a' : '#59c8ff');
  if (u.buffs.some((b) => b.key === 'baton')) text(ctx, '▲', x + 30, y - 30, { size: 22, fill: '#ff5577', stroke: '#000', lw: 4, align: 'center' });
  if (ui.selected === u) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(px(u.c) + 3, py(u.r) + 3, TILE - 6, TILE - 6);
    ctx.setLineDash([]);
  }
  if (u.sp >= sk.spCost && !u.skill.active && !u.charging) {
    const a = 0.6 + 0.4 * Math.sin(t * 8);
    text(ctx, 'SKILL', x, y - 54, { size: 20, fill: `rgba(255,255,255,${a})`, stroke: '#e5001d', lw: 5, align: 'center', skew: -0.2 });
  }
}

function drawEnemy(ctx, e, t) {
  const x = px(e.x);
  const y = py(e.y) + 24;
  const def = e.def;
  const size = def.id === 'maestro' ? 170 : def.id === 'conductor' ? 130 : def.id === 'bulwark' ? 92 : 74;
  const heading = e.seg < e.route.length ? Math.sign(e.route[e.seg].x - e.x) || 1 : 1;
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
  if (e.stagger > 0 && e.down <= 0) bar(ctx, x - w / 2, by + 8, w, 3, e.stagger / def.staggerMax, '#ffe933');
  if (e.down > 0) {
    text(ctx, 'DOWN', x, by - 6, { size: 24, fill: '#ffe933', stroke: '#000', lw: 5, align: 'center', skew: -0.2 });
  } else if (e.stun > 0) {
    text(ctx, '✦', x, by - 4, { size: 26, fill: '#fff3a6', stroke: '#000', lw: 4, align: 'center' });
  }
  if (e.buffs.some((b) => b.key === 'analyze')) {
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 28, y - size * 0.9, 56, size * 0.9);
  }
  if (e.burn) text(ctx, '🔥', x + w / 2 + 6, by + 4, { size: 18, align: 'center' });
  if (e.buffs.some((b) => b.key === 'slow')) text(ctx, '❄', x - w / 2 - 8, by + 6, { size: 16, fill: '#bff3ff', align: 'center' });
  if (def.boss) text(ctx, def.name.toUpperCase(), x, by - 24, { size: 18, fill: '#fff', stroke: '#000', lw: 4, align: 'center' });
}

export function drawBattle(ctx, b, t, ui) {
  const theme = THEMES[b.stage.theme] || THEMES.loop;
  drawBackground(ctx, theme.bg, t);
  // floor plate
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(FIELD_X, FIELD_Y, b.cols * TILE, b.rows * TILE);
  for (let r = 0; r < b.rows; r++) {
    for (let c = 0; c < b.cols; c++) {
      const tile = b.map[r][c];
      if (tile === 'p' || tile === 'S' || tile === 'E') tilePath(ctx, c, r, theme, t);
    }
  }
  routeArrows(ctx, b, theme, t);
  for (let r = 0; r < b.rows; r++) {
    for (let c = 0; c < b.cols; c++) {
      if (b.map[r][c] === 'h') tileHigh(ctx, c, r, theme);
    }
  }
  // spawn / goal markers
  for (let r = 0; r < b.rows; r++) {
    for (let c = 0; c < b.cols; c++) {
      const tile = b.map[r][c];
      if (tile === 'S') {
        glow(ctx, px(c + 0.5), py(r + 0.5), 70, '#b36bff', 0.7);
        text(ctx, 'ECHO GATE', px(c + 0.5), py(r) + 16, { size: 13, fill: '#e3caff', align: 'center', stroke: '#000', lw: 3 });
      } else if (tile === 'E') {
        glow(ctx, px(c + 0.5), py(r + 0.5), 70, '#5fd9ff', 0.8);
        text(ctx, 'SAFE ROOM', px(c + 0.5), py(r) + 16, { size: 13, fill: '#d8f7ff', align: 'center', stroke: '#000', lw: 3 });
      }
    }
  }

  // placement overlays
  if (ui.placing) {
    const card = ui.placing;
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        if (b.validTile(card, c, r)) {
          const a = 0.18 + 0.12 * Math.sin(t * 6);
          ctx.fillStyle = `rgba(80,255,150,${a})`;
          ctx.fillRect(px(c) + 3, py(r) + 3, TILE - 6, TILE - 6);
          ctx.strokeStyle = 'rgba(120,255,180,0.8)';
          ctx.lineWidth = 2;
          ctx.strokeRect(px(c) + 3, py(r) + 3, TILE - 6, TILE - 6);
        }
      }
    }
  }
  if (ui.placeTile && ui.placing) {
    const { c, r } = ui.placeTile;
    const dir = ui.dir ?? 0;
    rangeOverlay(ctx, ui.placing.def, c, r, dir, ui.placing.def.color);
    drawToken(ctx, ui.placing.id, px(c + 0.5), py(r + 0.5) - 2, TILE * 1.05, { dir, t, noTag: true });
    for (let d = 0; d < 4; d++) {
      const cx = px(c + 0.5) + DIRS[d].x * 62;
      const cy = py(r + 0.5) + DIRS[d].y * 62;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate([0, Math.PI / 2, Math.PI, -Math.PI / 2][d]);
      ctx.fillStyle = d === dir ? '#fff' : 'rgba(255,255,255,0.35)';
      poly(ctx, [[-10, -14], [14, 0], [-10, 14]]);
      ctx.fill();
      ctx.restore();
    }
  } else if (ui.hover && ui.placing && b.validTile(ui.placing, ui.hover.c, ui.hover.r)) {
    rangeOverlay(ctx, ui.placing.def, ui.hover.c, ui.hover.r, 0, ui.placing.def.color);
  }
  if (ui.selected && !ui.selected.dead) rangeOverlay(ctx, ui.selected.def, ui.selected.c, ui.selected.r, ui.selected.dir, '#ffffff');
  else if (ui.hover && !ui.placing) {
    const u = b.unitAt(ui.hover.c, ui.hover.r);
    if (u) rangeOverlay(ctx, u.def, u.c, u.r, u.dir, u.def.color);
  }

  // entities, depth-sorted
  const ents = [...b.operators.map((o) => ({ y: o.y, o })), ...b.enemies.map((e) => ({ y: e.y, e }))].sort((a, c) => a.y - c.y);
  for (const it of ents) {
    if (it.o) drawOperator(ctx, it.o, t, ui);
    else drawEnemy(ctx, it.e, t);
  }
}

export const _H = H;
export const _W = W;
export const _isMelee = isMelee;
