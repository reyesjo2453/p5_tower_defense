// Dynamic 2D lighting: a half-resolution light map is filled with the ambient colour, lights are
// added on top ('lighter'), and the result multiplies the lit scene. Bright cores are then re-added
// additively so lights read as glowing sources (and feed the bloom pass).
import { W, H } from './draw.js';
import { hexA } from '../core/util.js';

const SCALE = 0.5;
const SPRITE = 128;
const sprites = new Map();

/** Cached radial light sprite per colour (much cheaper than a gradient per light per frame). */
function sprite(color) {
  let c = sprites.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = SPRITE;
  const g = c.getContext('2d');
  const r = SPRITE / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, hexA(color, 0.85));
  gr.addColorStop(0.35, hexA(color, 0.4));
  gr.addColorStop(1, hexA(color, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, SPRITE, SPRITE);
  sprites.set(color, c);
  return c;
}

export class LightMap {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W * SCALE;
    this.canvas.height = H * SCALE;
    this.ctx = this.canvas.getContext('2d');
    this.lights = [];
  }

  begin() {
    this.lights.length = 0;
  }

  /** Queue a light: (x, y) px, radius px, colour hex, intensity 0..~1.5 */
  add(x, y, r, color, intensity = 1) {
    if (intensity <= 0.01 || r <= 1) return;
    this.lights.push(x, y, r, color, intensity);
  }

  /** Multiply the scene by ambient + lights, then add soft source glow. */
  apply(ctx, ambient, { glow = 0.35, region = [0, 0, W, H] } = {}) {
    const c = this.ctx;
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = ambient;
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    const L = this.lights;
    for (let i = 0; i < L.length; i += 5) {
      const x = L[i];
      const y = L[i + 1];
      const r = L[i + 2];
      const k = L[i + 4];
      const spr = sprite(L[i + 3]);
      for (let pass = k; pass > 0; pass -= 1) {
        c.globalAlpha = Math.min(1, pass);
        c.drawImage(spr, x - r, y - r, r * 2, r * 2);
      }
    }
    c.globalAlpha = 1;
    const [rx, ry, rw, rh] = region;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.canvas, rx * SCALE, ry * SCALE, rw * SCALE, rh * SCALE, rx, ry, rw, rh);
    if (glow > 0) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < L.length; i += 5) {
        const rr = L[i + 2] * 0.45;
        ctx.globalAlpha = Math.min(1, glow * L[i + 4]);
        ctx.drawImage(sprite(L[i + 3]), L[i] - rr, L[i + 1] - rr, rr * 2, rr * 2);
      }
    }
    ctx.restore();
  }
}
