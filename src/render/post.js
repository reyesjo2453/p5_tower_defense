// Full-screen post-processing for the 2D canvas: every scene renders into an offscreen buffer,
// then this pass composites it to the screen with
//   bloom (bright-pass + two blur radii, additive), colour grading (split-tone + contrast),
//   chromatic aberration on impacts, a vignette, animated film grain and a light scanline.
// Quality 'low' skips bloom/grain for weak GPUs; 'off' is a straight copy.
import { W, H } from './draw.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function supportsFilter(ctx) {
  try {
    ctx.filter = 'blur(2px)';
    const ok = ctx.filter === 'blur(2px)';
    ctx.filter = 'none';
    return ok;
  } catch {
    return false;
  }
}

/** Per-scene look presets; scenes can override any field each frame via scene.post. */
export const GRADES = {
  default: { bloom: 0.75, threshold: 4, shadows: '#1a0830', highlights: '#ffb08a', split: 0.16, contrast: 1.06, saturate: 1.08, vignette: 0.5 },
  battle: { bloom: 0.7, threshold: 3.6, shadows: '#0e0626', highlights: '#ffc4a0', split: 0.14, contrast: 1.08, saturate: 1.1, vignette: 0.42 },
  title: { bloom: 0.9, threshold: 3.6, shadows: '#200414', highlights: '#ff9c7a', split: 0.18, contrast: 1.1, saturate: 1.1, vignette: 0.55 },
  cutscene: { bloom: 0.8, threshold: 4, shadows: '#120a2a', highlights: '#ffcaa0', split: 0.16, contrast: 1.05, saturate: 1.05, vignette: 0.6 },
  menu: { bloom: 0.6, threshold: 4, shadows: '#140820', highlights: '#ffb8a0', split: 0.12, contrast: 1.04, saturate: 1.05, vignette: 0.45 },
};

export class Post {
  constructor(out) {
    this.out = out;
    this.scene = makeCanvas(W, H);
    this.sctx = this.scene.getContext('2d');
    this.small = makeCanvas(W / 4, H / 4);
    this.smallCtx = this.small.getContext('2d', { willReadFrequently: false });
    this.blurA = makeCanvas(W / 4, H / 4);
    this.blurACtx = this.blurA.getContext('2d');
    this.blurB = makeCanvas(W / 8, H / 8);
    this.blurBCtx = this.blurB.getContext('2d');
    this.chan = makeCanvas(W, H);
    this.chanCtx = this.chan.getContext('2d');
    this.filterOk = supportsFilter(this.smallCtx);
    this.grain = this.makeGrain();
    this.vig = null;
    this.vigA = -1;
    this.quality = 'high';
    this.frame = 0;
  }

  makeGrain() {
    const c = makeCanvas(256, 256);
    const g = c.getContext('2d');
    const img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  vignette(a) {
    if (this.vig && Math.abs(this.vigA - a) < 0.01) return this.vig;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const r = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.98);
    r.addColorStop(0, 'rgba(0,0,0,0)');
    r.addColorStop(0.6, `rgba(0,0,0,${a * 0.35})`);
    r.addColorStop(1, `rgba(0,0,0,${a})`);
    g.fillStyle = r;
    g.fillRect(0, 0, W, H);
    // baked CRT-ish scanlines (subtle)
    g.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    this.vig = c;
    this.vigA = a;
    return c;
  }

  /** Context the scene should draw into this frame. */
  begin() {
    const c = this.sctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.filter = 'none';
    c.clearRect(0, 0, W, H);
    return c;
  }

  end(grade = GRADES.default, extra = {}) {
    const o = { ...grade, ...extra };
    const ctx = this.out;
    const q = this.quality;
    this.frame++;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // base image (+ contrast/saturation) with optional chromatic aberration
    const ab = q === 'off' ? 0 : o.aberration || 0;
    const canFilter = this.filterOk && q !== 'off';
    if (ab > 0.05) this.drawAberrated(ctx, ab, canFilter ? `contrast(${o.contrast}) saturate(${o.saturate})` : 'none');
    else {
      if (canFilter) ctx.filter = `contrast(${o.contrast}) saturate(${o.saturate})`;
      ctx.drawImage(this.scene, 0, 0);
      ctx.filter = 'none';
    }
    if (q === 'off') {
      ctx.restore();
      return;
    }
    // split-tone grade: cool shadows (multiply-ish via soft-light) and warm highlights
    if (o.split > 0) {
      ctx.globalAlpha = o.split;
      ctx.globalCompositeOperation = 'soft-light';
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, o.highlights);
      g.addColorStop(1, o.shadows);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    // bloom
    if (q === 'high' && this.filterOk && o.bloom > 0) {
      const s = this.smallCtx;
      s.globalCompositeOperation = 'copy';
      s.filter = `brightness(0.5) contrast(${o.threshold}) brightness(1.7) saturate(1.3)`;
      s.drawImage(this.scene, 0, 0, W / 4, H / 4);
      s.filter = 'none';
      s.globalCompositeOperation = 'source-over';
      const a = this.blurACtx;
      a.globalCompositeOperation = 'copy';
      a.filter = 'blur(3px)';
      a.drawImage(this.small, 0, 0);
      a.filter = 'none';
      const b = this.blurBCtx;
      b.globalCompositeOperation = 'copy';
      b.filter = 'blur(4px)';
      b.drawImage(this.small, 0, 0, W / 8, H / 8);
      b.filter = 'none';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, o.bloom * 0.9);
      ctx.drawImage(this.blurA, 0, 0, W, H);
      ctx.globalAlpha = Math.min(1, o.bloom * 0.8);
      ctx.drawImage(this.blurB, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    // vignette
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.vignette(o.vignette), 0, 0);
    // grain + scanlines
    if (q === 'high') {
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.07;
      const ox = (this.frame * 97) % 256;
      const oy = (this.frame * 57) % 256;
      if (!this.grainPat) this.grainPat = ctx.createPattern(this.grain, 'repeat');
      ctx.translate(-ox, -oy);
      ctx.fillStyle = this.grainPat;
      ctx.fillRect(ox, oy, W, H);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // flash overlay (scene-provided)
    if (o.flash > 0) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.min(1, o.flash);
      ctx.fillStyle = o.flashColor || '#fff';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  drawAberrated(ctx, amount, filter) {
    const px = Math.min(6, 1 + amount * 6);
    const c = this.chanCtx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const channels = [['#ff0000', -px, 0], ['#00ff00', 0, 0], ['#0000ff', px, px * 0.3]];
    ctx.globalCompositeOperation = 'lighter';
    for (const [col, dx, dy] of channels) {
      c.globalCompositeOperation = 'copy';
      c.filter = filter;
      c.drawImage(this.scene, 0, 0);
      c.filter = 'none';
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = col;
      c.fillRect(0, 0, W, H);
      ctx.drawImage(this.chan, dx, dy);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
