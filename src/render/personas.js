// Persona silhouettes used in skill cut-ins. Procedural placeholder art, one unique shape each.
import { TAU, hexA } from '../core/util.js';
import { poly, glow } from './draw.js';

const DARK = '#07070b';

function finish(ctx, color) {
  ctx.fillStyle = DARK;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function eyes(ctx, x, y, r, color) {
  ctx.fillStyle = '#fff';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + sx * r * 1.2, y, r, r * 0.45, sx * -0.3, 0, TAU);
    ctx.fill();
  }
  glow(ctx, x, y, r * 4, color, 0.5);
}

const PERSONAS = {
  // Arsène: gentleman-thief with a tattered cape, horns and a glowing grin
  arsene(ctx, s, t, c) {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * 0.12 * s, -0.38 * s);
      ctx.bezierCurveTo(sx * 0.7 * s, -0.55 * s, sx * 1.15 * s, -0.1 * s, sx * 1.0 * s, 0.35 * s);
      for (let i = 0; i < 5; i++) ctx.lineTo(sx * (0.95 - i * 0.18) * s, (0.5 + (i % 2) * 0.14) * s + Math.sin(t * 4 + i) * 0.03 * s);
      ctx.lineTo(sx * 0.15 * s, 0.1 * s);
      ctx.closePath();
      finish(ctx, c);
    }
    // legs and torso
    poly(ctx, [[-0.16 * s, 0.1 * s], [-0.2 * s, 0.75 * s], [-0.06 * s, 0.75 * s], [0, 0.3 * s], [0.06 * s, 0.75 * s], [0.2 * s, 0.75 * s], [0.16 * s, 0.1 * s]]);
    finish(ctx, c);
    poly(ctx, [[-0.22 * s, -0.4 * s], [0.22 * s, -0.4 * s], [0.18 * s, 0.15 * s], [-0.18 * s, 0.15 * s]]);
    finish(ctx, c);
    // head, hat and horns
    ctx.beginPath();
    ctx.ellipse(0, -0.55 * s, 0.14 * s, 0.17 * s, 0, 0, TAU);
    finish(ctx, c);
    poly(ctx, [[-0.2 * s, -0.66 * s], [0.2 * s, -0.66 * s], [0.12 * s, -0.9 * s], [-0.12 * s, -0.9 * s]]);
    finish(ctx, c);
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * 0.12 * s, -0.7 * s);
      ctx.quadraticCurveTo(sx * 0.5 * s, -0.72 * s, sx * 0.42 * s, -1.08 * s);
      ctx.quadraticCurveTo(sx * 0.3 * s, -0.82 * s, sx * 0.1 * s, -0.78 * s);
      finish(ctx, c);
    }
    eyes(ctx, 0, -0.55 * s, 0.04 * s, c);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -0.5 * s, 0.07 * s, 0.15, Math.PI - 0.15);
    ctx.stroke();
  },

  // Captain Kidd: tricorn hat, billowing coat, ghost ship hull
  kidd(ctx, s, t, c) {
    ctx.beginPath();
    ctx.moveTo(-1 * s, 0.55 * s);
    ctx.quadraticCurveTo(0, 0.2 * s, 1 * s, 0.55 * s);
    ctx.lineTo(0.7 * s, 0.8 * s);
    ctx.lineTo(-0.7 * s, 0.8 * s);
    ctx.closePath();
    finish(ctx, c);
    poly(ctx, [[-0.5 * s, 0.3 * s], [-0.35 * s, -0.4 * s], [0.35 * s, -0.4 * s], [0.5 * s, 0.3 * s]]);
    finish(ctx, c);
    poly(ctx, [[-0.7 * s, -0.4 * s], [0, -0.95 * s], [0.7 * s, -0.4 * s], [0.4 * s, -0.5 * s], [0, -0.58 * s], [-0.4 * s, -0.5 * s]]);
    finish(ctx, c);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -0.72 * s, 0.06 * s, 0, TAU);
    ctx.fill();
    eyes(ctx, 0, -0.38 * s, 0.04 * s, c);
    // mast
    ctx.strokeStyle = c;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0.8 * s, 0.5 * s);
    ctx.lineTo(0.8 * s, -0.5 * s);
    ctx.stroke();
    poly(ctx, [[0.8 * s, -0.5 * s], [1.15 * s, -0.2 * s + Math.sin(t * 3) * 0.04 * s], [0.8 * s, 0.1 * s]]);
    finish(ctx, c);
  },

  // Carmen: dancer in a flame skirt, comb and fan
  carmen(ctx, s, t, c) {
    ctx.beginPath();
    ctx.moveTo(-0.15 * s, -0.55 * s);
    ctx.lineTo(0.15 * s, -0.55 * s);
    ctx.lineTo(0.2 * s, -0.1 * s);
    for (let i = 0; i <= 8; i++) {
      const x = 0.95 * s - (i / 8) * 1.9 * s;
      ctx.lineTo(x, 0.7 * s - (i % 2) * 0.28 * s - Math.sin(t * 6 + i) * 0.04 * s);
    }
    ctx.lineTo(-0.2 * s, -0.1 * s);
    ctx.closePath();
    finish(ctx, c);
    ctx.beginPath();
    ctx.arc(0, -0.7 * s, 0.17 * s, 0, TAU);
    finish(ctx, c);
    poly(ctx, [[-0.12 * s, -0.84 * s], [0, -1.15 * s], [0.12 * s, -0.84 * s]]);
    finish(ctx, c);
    // fan
    ctx.beginPath();
    ctx.moveTo(0.4 * s, -0.2 * s);
    for (let i = 0; i <= 5; i++) {
      const a = -1.2 + i * 0.4;
      ctx.lineTo(0.4 * s + Math.cos(a) * 0.8 * s, -0.2 * s + Math.sin(a) * 0.8 * s);
    }
    ctx.closePath();
    finish(ctx, c);
    eyes(ctx, 0, -0.7 * s, 0.035 * s, c);
  },

  // Goemon: samurai with a great kabuto crest and drawn katana
  goemon(ctx, s, t, c) {
    poly(ctx, [[-0.55 * s, 0.7 * s], [-0.45 * s, -0.25 * s], [0.45 * s, -0.25 * s], [0.55 * s, 0.7 * s]]);
    finish(ctx, c);
    poly(ctx, [[-0.65 * s, -0.25 * s], [-0.25 * s, -0.5 * s], [0.25 * s, -0.5 * s], [0.65 * s, -0.25 * s], [0.3 * s, -0.35 * s], [-0.3 * s, -0.35 * s]]);
    finish(ctx, c);
    ctx.beginPath();
    ctx.arc(0, -0.62 * s, 0.2 * s, 0, TAU);
    finish(ctx, c);
    poly(ctx, [[-0.75 * s, -0.85 * s], [-0.1 * s, -0.7 * s], [-0.05 * s, -1.2 * s], [0.05 * s, -1.2 * s], [0.1 * s, -0.7 * s], [0.75 * s, -0.85 * s], [0.2 * s, -0.55 * s], [-0.2 * s, -0.55 * s]]);
    finish(ctx, c);
    // katana
    ctx.save();
    ctx.translate(0.55 * s, -0.1 * s);
    ctx.rotate(-0.6);
    poly(ctx, [[-0.03 * s, 0.4 * s], [-0.03 * s, -1.0 * s], [0.03 * s, -1.05 * s], [0.03 * s, 0.4 * s]]);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
    eyes(ctx, 0, -0.62 * s, 0.04 * s, c);
  },

  // Johanna: rider on a motorbike
  johanna(ctx, s, t, c) {
    for (const wx of [-0.7, 0.7]) {
      ctx.beginPath();
      ctx.arc(wx * s, 0.4 * s, 0.38 * s, 0, TAU);
      ctx.lineWidth = 12;
      ctx.strokeStyle = c;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(wx * s, 0.4 * s, 0.38 * s, 0, TAU);
      ctx.fillStyle = DARK;
      ctx.fill();
    }
    poly(ctx, [[-0.7 * s, 0.4 * s], [-0.3 * s, 0.05 * s], [0.4 * s, 0.1 * s], [0.7 * s, 0.4 * s], [0.4 * s, 0.35 * s], [0, 0.35 * s]]);
    finish(ctx, c);
    poly(ctx, [[-0.3 * s, 0.05 * s], [-0.2 * s, -0.5 * s], [0.15 * s, -0.55 * s], [0.35 * s, 0.1 * s]]);
    finish(ctx, c);
    ctx.beginPath();
    ctx.arc(0.1 * s, -0.7 * s, 0.17 * s, 0, TAU);
    finish(ctx, c);
    poly(ctx, [[0.2 * s, -0.4 * s], [0.65 * s, -0.25 * s], [0.62 * s, -0.18 * s], [0.2 * s, -0.3 * s]]);
    finish(ctx, c);
    // exhaust glow
    glow(ctx, -0.95 * s, 0.4 * s, 0.35 * s, c, 0.6);
    eyes(ctx, 0.1 * s, -0.7 * s, 0.03 * s, c);
  },

  // Zorro: caped swordsman with cat-ear hat and rapier
  zorro(ctx, s, t, c) {
    ctx.beginPath();
    ctx.moveTo(-0.7 * s, 0.7 * s);
    ctx.quadraticCurveTo(-0.6 * s, -0.2 * s, -0.12 * s, -0.4 * s);
    ctx.lineTo(0.12 * s, -0.4 * s);
    ctx.quadraticCurveTo(0.6 * s, -0.2 * s, 0.7 * s + Math.sin(t * 3) * 0.05 * s, 0.7 * s);
    ctx.closePath();
    finish(ctx, c);
    ctx.beginPath();
    ctx.arc(0, -0.58 * s, 0.17 * s, 0, TAU);
    finish(ctx, c);
    poly(ctx, [[-0.4 * s, -0.62 * s], [-0.33 * s, -1.0 * s], [-0.1 * s, -0.75 * s], [0.1 * s, -0.75 * s], [0.33 * s, -1.0 * s], [0.4 * s, -0.62 * s], [0.15 * s, -0.7 * s], [-0.15 * s, -0.7 * s]]);
    finish(ctx, c);
    ctx.save();
    ctx.translate(-0.5 * s, -0.1 * s);
    ctx.rotate(0.9);
    poly(ctx, [[-0.015 * s, 0.1 * s], [-0.015 * s, -1.0 * s], [0.015 * s, -1.0 * s], [0.015 * s, 0.1 * s]]);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
    eyes(ctx, 0, -0.56 * s, 0.035 * s, c);
  },

  // Al Azif: floating core ringed by hex plates
  alazif(ctx, s, t, c) {
    for (let r = 0; r < 3; r++) {
      ctx.save();
      ctx.rotate(t * (r % 2 ? -0.8 : 0.9) + r);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const rad = (0.45 + r * 0.2) * s;
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad * 0.65);
      }
      ctx.closePath();
      ctx.lineWidth = 6;
      ctx.strokeStyle = hexA(c, 1 - r * 0.25);
      ctx.shadowColor = c;
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, 0.3 * s, 0, TAU);
    finish(ctx, c);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.18 * s, 0.09 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(0, 0, 0.06 * s, 0, TAU);
    ctx.fill();
    glow(ctx, 0, 0, 0.7 * s, c, 0.35);
  },

  // Milady: armoured queen with crown, a great axe and a round shield
  milady(ctx, s, t, c) {
    poly(ctx, [[-0.55 * s, 0.7 * s], [-0.4 * s, -0.2 * s], [0.4 * s, -0.2 * s], [0.55 * s, 0.7 * s]]);
    finish(ctx, c);
    ctx.beginPath();
    ctx.arc(0, -0.4 * s, 0.19 * s, 0, TAU);
    finish(ctx, c);
    poly(ctx, [[-0.22 * s, -0.55 * s], [-0.2 * s, -0.85 * s], [-0.08 * s, -0.68 * s], [0, -0.95 * s], [0.08 * s, -0.68 * s], [0.2 * s, -0.85 * s], [0.22 * s, -0.55 * s]]);
    finish(ctx, c);
    ctx.beginPath();
    ctx.arc(-0.55 * s, 0.1 * s, 0.38 * s, 0, TAU);
    finish(ctx, c);
    ctx.save();
    ctx.translate(0.62 * s, -0.1 * s);
    ctx.rotate(0.35);
    poly(ctx, [[-0.03 * s, 0.7 * s], [-0.03 * s, -0.8 * s], [0.03 * s, -0.8 * s], [0.03 * s, 0.7 * s]]);
    ctx.fillStyle = c;
    ctx.fill();
    poly(ctx, [[0.03 * s, -0.8 * s], [0.55 * s, -0.95 * s], [0.5 * s, -0.4 * s], [0.03 * s, -0.5 * s]]);
    finish(ctx, c);
    ctx.restore();
    eyes(ctx, 0, -0.4 * s, 0.035 * s, c);
  },

  // The Maestro's own shadow: a tall conductor with baton and staves
  maestro(ctx, s, t, c) {
    poly(ctx, [[-0.5 * s, 0.7 * s], [-0.25 * s, -0.4 * s], [0.25 * s, -0.4 * s], [0.5 * s, 0.7 * s], [0.2 * s, 0.3 * s], [-0.2 * s, 0.3 * s]]);
    finish(ctx, c);
    ctx.beginPath();
    ctx.arc(0, -0.58 * s, 0.17 * s, 0, TAU);
    finish(ctx, c);
    ctx.save();
    ctx.translate(0.3 * s, -0.2 * s);
    ctx.rotate(-0.8 + Math.sin(t * 5) * 0.2);
    poly(ctx, [[-0.01 * s, 0], [-0.01 * s, -0.9 * s], [0.01 * s, -0.9 * s], [0.01 * s, 0]]);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = hexA(c, 0.8);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-1.1 * s, -0.3 * s + i * 0.07 * s);
      ctx.bezierCurveTo(-0.6 * s, -0.5 * s + i * 0.05 * s, 0.6 * s, 0.1 * s, 1.1 * s, -0.2 * s + i * 0.07 * s);
      ctx.stroke();
    }
    eyes(ctx, 0, -0.58 * s, 0.035 * s, c);
  },
};

/** Draw a persona silhouette centred at (cx, cy) scaled by s (pixels per unit). */
export function drawPersona(ctx, id, cx, cy, s, t = 0, color = '#e8002d', alpha = 1) {
  const fn = PERSONAS[id] || PERSONAS.arsene;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha *= alpha;
  ctx.lineJoin = 'round';
  fn(ctx, s, t, color);
  ctx.restore();
}
