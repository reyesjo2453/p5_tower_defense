// Procedural backgrounds for cutscenes and the battle field.
import { TAU, hexA, mulberry32 } from '../core/util.js';
import { W, H, poly, halftone, glow, vignette } from './draw.js';
import { assets } from '../core/assets.js';

function sky(ctx, top, bot) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function skyline(ctx, seed, base, color, minH, maxH, lit = '#ffd98a', t = 0) {
  const rng = mulberry32(seed);
  ctx.fillStyle = color;
  for (let x = -20; x < W + 40; ) {
    const w = 50 + rng() * 80;
    const h = minH + rng() * (maxH - minH);
    ctx.fillRect(x, base - h, w, h + 400);
    for (let wy = base - h + 12; wy < base - 10; wy += 20) {
      for (let wx = x + 8; wx < x + w - 10; wx += 16) {
        if (rng() > 0.62) {
          ctx.fillStyle = rng() > 0.97 ? '#fff' : hexA(lit, 0.35 + 0.4 * rng());
          ctx.fillRect(wx, wy, 7, 10);
        }
      }
    }
    ctx.fillStyle = color;
    x += w + 2;
  }
}

function staffLines(ctx, t, color, y0, count = 5, gap = 14, amp = 20) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 24) {
      const y = y0 + i * gap + Math.sin(x * 0.01 + t * 0.8 + i * 0.1) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function notes(ctx, t, color, n = 18, seed = 5) {
  const rng = mulberry32(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = (rng() * W + t * (10 + rng() * 25)) % (W + 80) - 40;
    const y = (rng() * H + Math.sin(t + i) * 12) % H;
    ctx.beginPath();
    ctx.ellipse(x, y, 7, 5, -0.4, 0, TAU);
    ctx.fill();
    ctx.fillRect(x + 5, y - 22, 2.5, 22);
  }
}

const BG = {
  crossing_dusk(ctx, t) {
    sky(ctx, '#2b1245', '#ff6a3d');
    glow(ctx, W * 0.7, H * 0.55, 420, '#ffb36b', 0.55);
    skyline(ctx, 11, H * 0.78, '#150a24', 140, 360, '#ffd98a', t);
    skyline(ctx, 12, H * 0.9, '#0c0615', 60, 200, '#ff9ecb', t);
    // crossing stripes
    ctx.fillStyle = '#0a0610';
    ctx.fillRect(0, H * 0.86, W, H);
    ctx.fillStyle = '#e9e2f5';
    for (let i = 0; i < 14; i++) {
      poly(ctx, [[i * 110 - 40, H], [i * 110 + 20, H * 0.88], [i * 110 + 70, H * 0.88], [i * 110 + 40, H]]);
      ctx.fill();
    }
    // billboards
    ctx.fillStyle = '#ff2e63';
    ctx.fillRect(160, 190, 150, 80);
    ctx.fillStyle = '#1fc8c0';
    ctx.fillRect(880, 150, 200, 110);
  },
  station_platform(ctx, t) {
    sky(ctx, '#101520', '#1d2733');
    ctx.fillStyle = '#2a3340';
    ctx.fillRect(0, H * 0.7, W, H * 0.3);
    ctx.fillStyle = '#e9d84a';
    ctx.fillRect(0, H * 0.74, W, 8);
    // pillars with flickering lights
    for (let i = 0; i < 5; i++) {
      const x = 120 + i * 260;
      ctx.fillStyle = '#171d28';
      ctx.fillRect(x, 0, 46, H * 0.72);
      const on = Math.sin(t * 9 + i * 3.1) > -0.7;
      ctx.fillStyle = on ? '#dff6ff' : '#445';
      ctx.fillRect(x - 70, 40, 186, 10);
      if (on) glow(ctx, x + 23, 60, 200, '#9fe6ff', 0.3);
    }
    // stopped clock
    ctx.fillStyle = '#e9e9e9';
    ctx.beginPath();
    ctx.arc(W / 2, 110, 46, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(W / 2, 110);
    ctx.lineTo(W / 2, 78);
    ctx.moveTo(W / 2, 110);
    ctx.lineTo(W / 2 + 22, 124);
    ctx.stroke();
    // train
    ctx.fillStyle = '#394252';
    ctx.fillRect(0, H * 0.46, W, H * 0.24);
    ctx.fillStyle = '#0e131b';
    for (let i = 0; i < 8; i++) ctx.fillRect(40 + i * 160, H * 0.5, 110, H * 0.12);
    halftone(ctx, 0, 0, W, H, 18, 'rgba(255,255,255,0.03)');
  },
  attic_night(ctx, t) {
    sky(ctx, '#1a1330', '#3b2a44');
    ctx.fillStyle = '#2a1e38';
    poly(ctx, [[0, 0], [W, 0], [W, H * 0.25], [W / 2, 0]]);
    ctx.fillStyle = '#4d3340';
    ctx.fillRect(0, H * 0.76, W, H * 0.24);
    glow(ctx, 300, 260, 380, '#ffb870', 0.5 + Math.sin(t * 2) * 0.03);
    ctx.fillStyle = '#0e0a18';
    ctx.fillRect(850, 140, 220, 190);
    skyline(ctx, 4, 330, '#06040c', 20, 90, '#ffd98a');
    ctx.fillStyle = '#1b132b';
    ctx.fillRect(90, H * 0.6, 420, 80);
  },
  train_interior(ctx, t) {
    sky(ctx, '#161a26', '#252c3d');
    // rushing window lights
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 100, W, 320);
    for (let i = 0; i < 40; i++) {
      const x = ((i * 97 - t * 900) % (W + 200) + W + 200) % (W + 200) - 100;
      ctx.fillStyle = hexA(i % 3 ? '#ffd98a' : '#9fe6ff', 0.8);
      ctx.fillRect(x, 150 + (i * 53) % 240, 90, 5);
    }
    ctx.fillStyle = '#313a4d';
    for (let i = 0; i < 5; i++) ctx.fillRect(i * 280 - 10, 90, 22, 340);
    ctx.fillStyle = '#4a5368';
    ctx.fillRect(0, 430, W, 290);
    ctx.fillStyle = '#7a1f2b';
    ctx.fillRect(0, 500, W, 80);
  },
  loop_void(ctx, t) {
    sky(ctx, '#12031a', '#3a0620');
    halftone(ctx, 0, 0, W, H, 22, 'rgba(229,0,29,0.18)', (x, y) => 0.4 + 0.6 * y);
    staffLines(ctx, t, 'rgba(255,255,255,0.28)', 140);
    staffLines(ctx, t * 1.2, 'rgba(229,0,29,0.5)', 400, 5, 16, 28);
    notes(ctx, t, 'rgba(255,255,255,0.5)');
    glow(ctx, W / 2, H / 2, 520, '#e5001d', 0.25);
  },
  static_tunnel(ctx, t) {
    sky(ctx, '#06161a', '#0c2b30');
    const rng = mulberry32(Math.floor(t * 8));
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = hexA(rng() > 0.5 ? '#00e0c6' : '#ff2e63', 0.1 + rng() * 0.2);
      ctx.fillRect(0, rng() * H, W, 2 + rng() * 10);
    }
    // perspective tunnel
    ctx.strokeStyle = 'rgba(0,224,198,0.5)';
    ctx.lineWidth = 3;
    for (let i = 1; i < 9; i++) {
      const k = ((i + t * 0.8) % 9) / 9;
      const w = 80 + k * k * 1300;
      const h = 50 + k * k * 800;
      ctx.strokeRect(W / 2 - w / 2, H / 2 - h / 2, w, h);
    }
    notes(ctx, t, 'rgba(0,224,198,0.5)', 12, 8);
    halftone(ctx, 0, 0, W, H, 26, 'rgba(0,0,0,0.25)');
  },
  palace_gate(ctx, t) {
    sky(ctx, '#1a0508', '#4a0a14');
    halftone(ctx, 0, 0, W, H, 20, 'rgba(255,210,74,0.1)');
    // gilded doors
    ctx.fillStyle = '#2b0a10';
    ctx.fillRect(W / 2 - 330, 90, 660, H);
    ctx.fillStyle = '#7a1424';
    ctx.fillRect(W / 2 - 310, 110, 300, H);
    ctx.fillRect(W / 2 + 10, 110, 300, H);
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 6;
    ctx.strokeRect(W / 2 - 310, 110, 300, H);
    ctx.strokeRect(W / 2 + 10, 110, 300, H);
    ctx.fillStyle = '#ffd24a';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(W / 2 + sx * 50, 400, 20, 0, TAU);
      ctx.fill();
    }
    // theater arch lights
    for (let i = 0; i < 17; i++) {
      const a = Math.PI + (i / 16) * Math.PI;
      glow(ctx, W / 2 + Math.cos(a) * 360, 130 + Math.sin(a) * 100, 40 + 10 * Math.sin(t * 4 + i), '#ffd24a', 0.8);
    }
    staffLines(ctx, t, 'rgba(255,210,74,0.3)', 20, 5, 10, 8);
  },
  stage_hall(ctx, t) {
    sky(ctx, '#0b0206', '#35060f');
    // curtains
    for (const sx of [0, 1]) {
      ctx.fillStyle = '#7a0f1f';
      const x0 = sx ? W - 260 : 0;
      ctx.fillRect(x0, 0, 260, H);
      ctx.fillStyle = '#5b0a17';
      for (let i = 0; i < 6; i++) ctx.fillRect(x0 + i * 44 + 6, 0, 14, H);
    }
    // spotlight
    const g = ctx.createLinearGradient(W / 2, 0, W / 2, H);
    g.addColorStop(0, 'rgba(255,240,200,0.5)');
    g.addColorStop(1, 'rgba(255,240,200,0.0)');
    ctx.fillStyle = g;
    poly(ctx, [[W / 2 - 40, 0], [W / 2 + 40, 0], [W / 2 + 330, H], [W / 2 - 330, H]]);
    ctx.fill();
    ctx.fillStyle = '#1a0a10';
    ctx.fillRect(0, H * 0.82, W, H * 0.18);
    notes(ctx, t, 'rgba(255,210,74,0.5)', 14, 21);
  },
  white_void(ctx, t) {
    sky(ctx, '#f2f2f5', '#c9c9d4');
    halftone(ctx, 0, 0, W, H, 16, 'rgba(0,0,0,0.08)');
    staffLines(ctx, t, 'rgba(0,0,0,0.25)', 300);
  },
  battle_loop(ctx, t) {
    sky(ctx, '#0b0310', '#240512');
    halftone(ctx, 0, 0, W, H, 24, 'rgba(229,0,29,0.1)', (x, y) => 1 - y);
    staffLines(ctx, t, 'rgba(255,255,255,0.07)', 560, 5, 18, 10);
    notes(ctx, t, 'rgba(255,255,255,0.12)', 10, 3);
  },
  battle_static: null,
  battle_palace: null,
};
BG.battle_static = (ctx, t) => {
  sky(ctx, '#031014', '#06242a');
  const rng = mulberry32(Math.floor(t * 6));
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = hexA('#00e0c6', 0.05 + rng() * 0.07);
    ctx.fillRect(0, rng() * H, W, 2 + rng() * 6);
  }
  notes(ctx, t, 'rgba(0,224,198,0.15)', 10, 9);
};
BG.battle_palace = (ctx, t) => {
  sky(ctx, '#16050a', '#3a0a14');
  halftone(ctx, 0, 0, W, H, 24, 'rgba(255,210,74,0.07)', (x, y) => 1 - y);
  staffLines(ctx, t, 'rgba(255,210,74,0.12)', 560, 5, 18, 10);
  notes(ctx, t, 'rgba(255,210,74,0.18)', 12, 11);
};

export function drawBackground(ctx, key, t = 0) {
  const img = assets.get(`bg.${key}`);
  if (img) {
    ctx.drawImage(img, 0, 0, W, H);
    return;
  }
  (BG[key] || BG.loop_void)(ctx, t);
}

export { vignette };

export const BACKGROUND_KEYS = Object.keys(BG);
