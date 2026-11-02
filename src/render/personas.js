// Summoned spirits used in skill cut-ins, skill FX, the title and the roster.
// ORIGINAL designs for this project: ethereal, light-built forms with one motif each,
// rendered as a dark core + additive energy edges so they bloom under the post-processing pass.
// drawPersona(ctx, id, cx, cy, s, t, color, alpha): s = pixels per unit; forms span roughly ±1.2 s.
import { TAU, hexA } from '../core/util.js';
import { glow } from './draw.js';

const CORE = '#07060c';

/** Dark translucent body with a glowing double edge. */
function ether(ctx, path, c, s, o = {}) {
  ctx.save();
  path();
  const g = ctx.createLinearGradient(0, -s * 1.2, 0, s * 1.2);
  g.addColorStop(0, hexA(CORE, 0.95));
  g.addColorStop(0.7, hexA(CORE, 0.85));
  g.addColorStop(1, hexA(CORE, o.fade ? 0 : 0.6));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // inner energy wash from the bottom
  const w = ctx.createLinearGradient(0, s * 1.2, 0, -s * 0.6);
  w.addColorStop(0, hexA(c, 0.55));
  w.addColorStop(1, hexA(c, 0));
  ctx.fillStyle = w;
  ctx.fillRect(-s * 3, -s * 3, s * 6, s * 6);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  path();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = hexA(c, 0.45);
  ctx.lineWidth = Math.max(3, s * 0.05);
  ctx.stroke();
  path();
  ctx.strokeStyle = hexA('#ffffff', 0.85);
  ctx.lineWidth = Math.max(1, s * 0.012);
  ctx.stroke();
  ctx.restore();
}

function lightLines(ctx, c, s, lines) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = hexA(c, 0.9);
  ctx.lineWidth = Math.max(1, s * 0.015);
  ctx.lineCap = 'round';
  for (const pts of lines) {
    ctx.beginPath();
    ctx.moveTo(pts[0] * s, pts[1] * s);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * s, pts[i + 1] * s);
    ctx.stroke();
  }
  ctx.restore();
}

/** Glowing mask-face: a blank oval with two slit eyes (shared motif of every spirit). */
function face(ctx, x, y, r, c, t, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = '#efeaf4';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.8, r, 0, 0, TAU);
  ctx.fill();
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, hexA(c, 0.45));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = c;
  ctx.shadowColor = c;
  ctx.shadowBlur = r * 0.8;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * r * 0.32, -r * 0.05, r * 0.24, r * 0.07, sx * 0.35, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = hexA(c, 0.6);
  ctx.fillRect(-r * 0.02, r * 0.25, r * 0.04, r * 0.5 + Math.sin(t * 3) * r * 0.05);
  ctx.restore();
}

function particles(ctx, c, s, t, n, spread = 1.2, seed = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = c;
  for (let i = 0; i < n; i++) {
    const k = ((i * 0.618 + seed) % 1);
    const life = (t * (0.3 + k * 0.4) + k * 7) % 1;
    const x = Math.sin(i * 12.9 + seed) * spread * s;
    const y = s * 1.1 - life * s * 2.6;
    ctx.globalAlpha = Math.sin(life * Math.PI) * 0.9;
    ctx.beginPath();
    ctx.arc(x + Math.sin(t * 2 + i) * s * 0.05, y, Math.max(1, s * 0.012 * (1 + k)), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

const SPIRITS = {
  // Crimson Regalia: a crowned wraith whose cloak is a column of rising flame-ribbons, ringed by six blade shards.
  arsene(ctx, s, t, c) {
    for (let i = 0; i < 6; i++) {
      const a = t * 0.8 + (i / 6) * TAU;
      ctx.save();
      ctx.translate(Math.cos(a) * s * 1.05, -s * 0.2 + Math.sin(a) * s * 0.35);
      ctx.rotate(a + Math.PI / 2);
      ether(ctx, () => { ctx.beginPath(); ctx.moveTo(0, -s * 0.28); ctx.lineTo(s * 0.06, 0); ctx.lineTo(0, s * 0.12); ctx.lineTo(-s * 0.06, 0); ctx.closePath(); }, c, s);
      ctx.restore();
    }
    ether(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.95);
      ctx.bezierCurveTo(s * 0.5, -s * 0.8, s * 0.55, -s * 0.3, s * 0.75, s * 0.2);
      for (let i = 0; i <= 10; i++) {
        const k = i / 10;
        const x = s * 0.75 - k * s * 1.5;
        ctx.lineTo(x, s * 1.15 + Math.sin(t * 4 + i * 1.3) * s * 0.08 - (i % 2) * s * 0.25);
      }
      ctx.bezierCurveTo(-s * 0.55, -s * 0.3, -s * 0.5, -s * 0.8, 0, -s * 0.95);
      ctx.closePath();
    }, c, s, { fade: true });
    lightLines(ctx, c, s, [[-0.3, -0.4, -0.1, 0.4, -0.2, 1.0], [0.3, -0.4, 0.1, 0.4, 0.25, 1.0], [0, -0.3, 0, 0.9]]);
    // crown of shards
    ether(ctx, () => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * s * 0.12;
        ctx.moveTo(x - s * 0.05, -s * 1.0);
        ctx.lineTo(x, -s * (1.22 + (i === 2 ? 0.12 : 0) + Math.abs(Math.sin(i)) * 0.04));
        ctx.lineTo(x + s * 0.05, -s * 1.0);
      }
    }, c, s);
    face(ctx, 0, -s * 0.72, s * 0.2, c, t);
    particles(ctx, c, s, t, 26, 0.8, 1);
  },
  // Storm Titan: a broad torso of stacked plates around a caged lightning core; huge floating fists.
  kidd(ctx, s, t, c) {
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.translate(sx * s * 0.95, s * 0.15 + Math.sin(t * 2 + sx) * s * 0.06);
      ether(ctx, () => { ctx.beginPath(); ctx.roundRect(-s * 0.2, -s * 0.22, s * 0.4, s * 0.44, s * 0.08); }, c, s);
      lightLines(ctx, c, s, [[-0.12, -0.05, 0.12, -0.05], [-0.12, 0.07, 0.12, 0.07]]);
      ctx.restore();
    }
    ether(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.75, -s * 0.55);
      ctx.lineTo(s * 0.75, -s * 0.55);
      ctx.lineTo(s * 0.55, s * 0.2);
      ctx.lineTo(s * 0.3, s * 1.0);
      ctx.lineTo(-s * 0.3, s * 1.0);
      ctx.lineTo(-s * 0.55, s * 0.2);
      ctx.closePath();
    }, c, s, { fade: true });
    lightLines(ctx, c, s, [[-0.7, -0.3, 0.7, -0.3], [-0.6, -0.05, 0.6, -0.05], [-0.5, 0.2, 0.5, 0.2]]);
    glow(ctx, 0, -s * 0.1, s * 0.5, c, 0.8);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.5, s * 0.02);
    ctx.shadowColor = c;
    ctx.shadowBlur = s * 0.1;
    for (let i = 0; i < 4; i++) {
      const a = t * 7 + i * 1.7;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.1);
      for (let j = 1; j <= 4; j++) ctx.lineTo(Math.cos(a + j * 0.3) * s * 0.1 * j + Math.sin(t * 40 + j) * s * 0.03, -s * 0.1 + Math.sin(a + j * 0.3) * s * 0.08 * j);
      ctx.stroke();
    }
    ctx.restore();
    face(ctx, 0, -s * 0.78, s * 0.2, c, t);
    particles(ctx, c, s, t, 18, 1.0, 2);
  },
  // Phoenix Bloom: a firebird whose wings are layered petals and whose tail trails embers.
  carmen(ctx, s, t, c) {
    const flap = Math.sin(t * 3) * 0.12;
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.translate(sx * s * 0.15, -s * 0.35);
        ctx.rotate(sx * (-0.9 + i * 0.32 + flap));
        ctx.scale(sx, 1);
        ether(ctx, () => { ctx.beginPath(); ctx.ellipse(s * 0.55, 0, s * (0.6 - i * 0.04), s * 0.12, 0, 0, TAU); }, i % 2 ? c : '#ffb46b', s);
        ctx.restore();
      }
    }
    ether(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.8);
      ctx.bezierCurveTo(s * 0.25, -s * 0.5, s * 0.22, s * 0.1, 0, s * 0.35);
      ctx.bezierCurveTo(-s * 0.22, s * 0.1, -s * 0.25, -s * 0.5, 0, -s * 0.8);
      ctx.closePath();
    }, c, s);
    for (let i = 0; i < 3; i++) {
      ether(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(0, s * 0.3);
        ctx.bezierCurveTo((i - 1) * s * 0.4, s * 0.7, (i - 1) * s * 0.2 + Math.sin(t * 3 + i) * s * 0.1, s * 1.0, (i - 1) * s * 0.35, s * 1.3);
        ctx.lineTo((i - 1) * s * 0.3, s * 1.3);
        ctx.bezierCurveTo((i - 1) * s * 0.1, s * 1.0, (i - 1) * s * 0.2, s * 0.7, 0, s * 0.35);
      }, c, s, { fade: true });
    }
    face(ctx, 0, -s * 0.62, s * 0.15, '#ffd0a0', t);
    particles(ctx, '#ffb46b', s, t, 34, 1.2, 3);
  },
  // Gale Ray: a manta-kite gliding on wind rings, trailing long streamers.
  zorro(ctx, s, t, c) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = hexA(c, 0.5 - i * 0.12);
      ctx.lineWidth = Math.max(2, s * 0.025);
      ctx.beginPath();
      ctx.ellipse(0, s * 0.6, s * (0.5 + i * 0.3 + (t % 1) * 0.2), s * (0.12 + i * 0.06), 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    const w = Math.sin(t * 2.5) * s * 0.12;
    ether(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.75);
      ctx.bezierCurveTo(s * 0.4, -s * 0.6, s * 0.8, -s * 0.3 + w, s * 1.25, -s * 0.05 + w);
      ctx.bezierCurveTo(s * 0.8, s * 0.05, s * 0.4, s * 0.15, 0, s * 0.45);
      ctx.bezierCurveTo(-s * 0.4, s * 0.15, -s * 0.8, s * 0.05, -s * 1.25, -s * 0.05 + w);
      ctx.bezierCurveTo(-s * 0.8, -s * 0.3 + w, -s * 0.4, -s * 0.6, 0, -s * 0.75);
      ctx.closePath();
    }, c, s);
    lightLines(ctx, c, s, [[0, -0.6, 0, 0.35], [-0.2, -0.3, -0.9, -0.05], [0.2, -0.3, 0.9, -0.05]]);
    for (const sx of [-1, 0, 1]) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(c, 0.7);
      ctx.lineWidth = Math.max(1.5, s * 0.02);
      ctx.beginPath();
      ctx.moveTo(sx * s * 0.15, s * 0.4);
      for (let k = 1; k <= 8; k++) ctx.lineTo(sx * s * 0.15 + Math.sin(t * 4 + k * 0.8 + sx) * s * 0.08 * k * 0.4, s * 0.4 + k * s * 0.11);
      ctx.stroke();
      ctx.restore();
    }
    face(ctx, 0, -s * 0.38, s * 0.16, c, t);
    particles(ctx, '#e8fff6', s, t, 20, 1.3, 4);
  },
  // Frost Crane: a long-necked crane assembled from ice crystals, wings raised.
  goemon(ctx, s, t, c) {
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        ctx.save();
        ctx.translate(sx * s * 0.2, -s * 0.15);
        ctx.rotate(sx * (-1.2 + i * 0.16) + Math.sin(t * 1.5) * 0.05 * sx);
        ctx.scale(sx, 1);
        ether(ctx, () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * (0.9 - i * 0.05), -s * 0.06); ctx.lineTo(s * (1.05 - i * 0.06), 0); ctx.lineTo(s * (0.9 - i * 0.05), s * 0.06); ctx.closePath(); }, c, s);
        ctx.restore();
      }
    }
    ether(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(0, s * 0.1, s * 0.28, s * 0.4, 0, 0, TAU);
    }, c, s);
    ether(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.05, -s * 0.2);
      ctx.bezierCurveTo(-s * 0.15, -s * 0.6, s * 0.15, -s * 0.8, 0, -s * 1.05);
      ctx.lineTo(s * 0.06, -s * 1.02);
      ctx.bezierCurveTo(s * 0.22, -s * 0.8, -s * 0.05, -s * 0.6, s * 0.06, -s * 0.2);
      ctx.closePath();
    }, c, s);
    ether(ctx, () => { ctx.beginPath(); ctx.moveTo(0, -s * 1.12); ctx.lineTo(s * 0.32, -s * 1.02); ctx.lineTo(0, -s * 0.98); ctx.closePath(); }, c, s);
    for (const sx of [-1, 1]) lightLines(ctx, c, s, [[sx * 0.08, 0.45, sx * 0.12, 1.15]]);
    face(ctx, 0.02 * s, -s * 1.05, s * 0.1, c, t);
    particles(ctx, '#eaffff', s, t, 30, 1.2, 5);
  },
  // Lattice Oracle: a rotating wire-frame polyhedron with an eye at its heart and data streams.
  alazif(ctx, s, t, c) {
    const pts = [];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
      const th = Math.PI * (1 + Math.sqrt(5)) * i + t * 0.7;
      const x = Math.cos(th) * Math.sin(phi);
      const y = Math.cos(phi);
      const z = Math.sin(th) * Math.sin(phi);
      pts.push([x * s * 0.85, y * s * 0.85 - s * 0.1, z]);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1, s * 0.012);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
        if (d < s * 0.75) {
          ctx.strokeStyle = hexA(c, 0.25 + 0.35 * ((pts[i][2] + pts[j][2] + 2) / 4));
          ctx.beginPath();
          ctx.moveTo(pts[i][0], pts[i][1]);
          ctx.lineTo(pts[j][0], pts[j][1]);
          ctx.stroke();
        }
      }
    }
    ctx.fillStyle = '#fff';
    for (const [x, y, z] of pts) {
      ctx.globalAlpha = 0.5 + z * 0.4;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.5, s * 0.025), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ether(ctx, () => { ctx.beginPath(); ctx.ellipse(0, -s * 0.1, s * 0.32, s * 0.2, 0, 0, TAU); }, c, s);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, -s * 0.1, s * 0.35, c, 0.9);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(Math.sin(t) * s * 0.06, -s * 0.1, s * 0.07, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hexA(c, 0.8);
    for (let i = 0; i < 14; i++) {
      const x = (i - 7) * s * 0.11;
      const y = s * 0.85 + ((t * 0.9 + i * 0.37) % 1) * s * 0.5;
      ctx.fillRect(x, y - s * 0.6, Math.max(1, s * 0.012), s * 0.06);
    }
    ctx.restore();
  },
  // Bastion Queen: a towering armoured figure with a halo, whose skirt is a fan of interlocking shields.
  milady(ctx, s, t, c) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA('#ffd9e8', 0.8);
    ctx.lineWidth = Math.max(2, s * 0.03);
    ctx.shadowColor = c;
    ctx.shadowBlur = s * 0.1;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.95, s * 0.35, s * 0.09, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 7; i++) {
      const a = -0.9 + (i / 6) * 1.8;
      ctx.save();
      ctx.translate(0, s * 0.05);
      ctx.rotate(a * 0.5);
      ether(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-s * 0.13, s * 0.15);
        ctx.lineTo(s * 0.13, s * 0.15);
        ctx.lineTo(s * 0.13, s * 0.95);
        ctx.lineTo(0, s * 1.1);
        ctx.lineTo(-s * 0.13, s * 0.95);
        ctx.closePath();
      }, c, s);
      ctx.restore();
    }
    ether(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, -s * 0.45);
      ctx.bezierCurveTo(-s * 0.3, -s * 0.6, s * 0.3, -s * 0.6, s * 0.45, -s * 0.45);
      ctx.lineTo(s * 0.25, s * 0.2);
      ctx.lineTo(-s * 0.25, s * 0.2);
      ctx.closePath();
    }, c, s);
    for (const sx of [-1, 1]) ether(ctx, () => { ctx.beginPath(); ctx.ellipse(sx * s * 0.48, -s * 0.45, s * 0.2, s * 0.12, sx * 0.3, 0, TAU); }, '#ffd9e8', s);
    lightLines(ctx, '#ffd9e8', s, [[0, -0.5, 0, 0.15], [-0.2, -0.2, 0.2, -0.2]]);
    face(ctx, 0, -s * 0.7, s * 0.15, c, t);
    particles(ctx, '#ffd9e8', s, t, 22, 1.0, 6);
  },
  // Orbital Lance: a crystalline spear-craft orbited by rotating rings, dragging a comet tail.
  johanna(ctx, s, t, c) {
    ctx.save();
    ctx.rotate(-0.5);
    const tail = ctx.createLinearGradient(0, 0, 0, s * 1.4);
    tail.addColorStop(0, hexA(c, 0.8));
    tail.addColorStop(1, hexA(c, 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, s * 0.2);
    ctx.lineTo(s * 0.18, s * 0.2);
    ctx.lineTo(0, s * 1.5);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ether(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.15);
      ctx.lineTo(s * 0.16, -s * 0.2);
      ctx.lineTo(s * 0.1, s * 0.35);
      ctx.lineTo(-s * 0.1, s * 0.35);
      ctx.lineTo(-s * 0.16, -s * 0.2);
      ctx.closePath();
    }, c, s);
    for (const sx of [-1, 1]) ether(ctx, () => { ctx.beginPath(); ctx.moveTo(sx * s * 0.15, -s * 0.1); ctx.lineTo(sx * s * 0.5, s * 0.25); ctx.lineTo(sx * s * 0.12, s * 0.2); ctx.closePath(); }, c, s);
    lightLines(ctx, c, s, [[0, -1.0, 0, 0.3]]);
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(i === 1 ? '#ffffff' : c, 0.8);
      ctx.lineWidth = Math.max(1.5, s * 0.02);
      ctx.beginPath();
      ctx.ellipse(0, -s * (0.1 + i * 0.25), s * (0.45 - i * 0.08), s * 0.1, 0, t * (2 + i), t * (2 + i) + Math.PI * 1.4);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    glow(ctx, 0, 0, s * 0.6, c, 0.4);
    particles(ctx, c, s, t, 24, 0.9, 7);
  },
  // Grand Conductor (the Maestro's): a colossal faceless figure, baton raised, haloed by staff lines.
  maestro(ctx, s, t, c) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA(c, 0.5);
    ctx.lineWidth = Math.max(1.5, s * 0.012);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(0, -s * 0.6, s * (0.55 + i * 0.07), Math.PI * 1.05 + Math.sin(t + i) * 0.03, Math.PI * 1.95);
      ctx.stroke();
    }
    ctx.restore();
    ether(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.85);
      ctx.bezierCurveTo(s * 0.45, -s * 0.8, s * 0.5, -s * 0.4, s * 0.55, -s * 0.2);
      ctx.lineTo(s * 0.95, s * 1.2);
      ctx.lineTo(-s * 0.95, s * 1.2);
      ctx.lineTo(-s * 0.55, -s * 0.2);
      ctx.bezierCurveTo(-s * 0.5, -s * 0.4, -s * 0.45, -s * 0.8, 0, -s * 0.85);
      ctx.closePath();
    }, c, s, { fade: true });
    // raised baton arm
    const sw = Math.sin(t * 2.2) * 0.25;
    ctx.save();
    ctx.translate(s * 0.45, -s * 0.35);
    ctx.rotate(-1.0 + sw);
    ether(ctx, () => { ctx.beginPath(); ctx.roundRect(0, -s * 0.07, s * 0.6, s * 0.14, s * 0.06); }, c, s);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = c;
    ctx.shadowBlur = s * 0.12;
    ctx.lineWidth = Math.max(2, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(s * 0.55, 0);
    ctx.lineTo(s * 1.15, 0);
    ctx.stroke();
    ctx.restore();
    lightLines(ctx, c, s, [[0, -0.3, 0, 1.1], [-0.3, -0.1, -0.5, 1.1], [0.3, -0.1, 0.5, 1.1]]);
    // faceless: a smooth mask with a single golden line
    ctx.save();
    ctx.fillStyle = '#f4f0e6';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.62, s * 0.16, s * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = c;
    ctx.shadowColor = c;
    ctx.shadowBlur = s * 0.08;
    ctx.fillRect(-s * 0.12, -s * 0.64, s * 0.24, Math.max(1.5, s * 0.015));
    ctx.restore();
    particles(ctx, c, s, t, 30, 1.2, 8);
  },
};

/** Draw a summoned spirit centred at (cx, cy) scaled by s (pixels per unit). */
export function drawPersona(ctx, id, cx, cy, s, t = 0, color = '#e8002d', alpha = 1) {
  const fn = SPIRITS[id] || SPIRITS.arsene;
  ctx.save();
  ctx.translate(cx, cy + Math.sin(t * 1.4) * s * 0.03);
  ctx.globalAlpha *= alpha;
  ctx.lineJoin = 'round';
  fn(ctx, s, t, color);
  ctx.restore();
}

export const SPIRIT_IDS = Object.keys(SPIRITS);
