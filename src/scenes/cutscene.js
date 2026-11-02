// Visual-novel style cutscene player with cinematics, camera FX and typed dialogue.
import { SCENES } from '../data/story.js';
import { LOOKS } from '../data/looks.js';
import { CINEMATICS } from '../render/cinematics.js';
import { drawBackground } from '../render/backgrounds.js';
import { drawPortrait } from '../render/characters.js';
import { W, H, RED, FONT, FONT_BODY, text, wrap, poly, vignette, halftone, speedLines } from '../render/draw.js';
import { clamp, easeOutCubic, easeOutBack, pulse, hexA } from '../core/util.js';
import { audio } from '../core/audio.js';

const POS = { 'far-left': 0.13, left: 0.28, center: 0.5, right: 0.72, 'far-right': 0.87 };

export class CutsceneScene {
  constructor(game) {
    this.game = game;
  }

  enter({ id, onDone, music = true }) {
    this.id = id;
    this.steps = SCENES[id] || [];
    this.onDone = onDone;
    this.i = 0;
    this.t = 0;
    this.bg = 'loop_void';
    this.prevBg = null;
    this.bgFade = 0;
    this.cast = new Map();
    this.mode = 'idle';
    this.say = null;
    this.card = null;
    this.cine = null;
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#fff';
    this.glitch = 0;
    this.wait = 0;
    this.autoT = 0;
    this.finished = false;
    this.bars = 0;
    this.mountUi();
    this.next();
  }

  mountUi() {
    const ui = this.game.ui;
    this.root = document.createElement('div');
    this.root.className = 'cs-controls';
    this.root.innerHTML = `<button data-act="auto" class="mini">AUTO</button><button data-act="skip" class="mini">SKIP ▸▸</button>`;
    this.root.addEventListener('click', (e) => {
      const act = e.target.dataset?.act;
      if (act === 'skip') this.finish();
      if (act === 'auto') {
        const s = this.game.save.settings;
        s.autoAdvance = !s.autoAdvance;
        this.refreshUi();
      }
      e.stopPropagation();
    });
    ui.appendChild(this.root);
    this.refreshUi();
  }

  refreshUi() {
    const b = this.root.querySelector('[data-act="auto"]');
    b.classList.toggle('on', !!this.game.save.settings.autoAdvance);
  }

  exit() {
    this.root?.remove();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.onDone?.();
  }

  setBg(key) {
    if (key === this.bg) return;
    this.prevBg = this.bg;
    this.bg = key;
    this.bgFade = 1;
  }

  next() {
    while (!this.finished) {
      const st = this.steps[this.i++];
      if (!st) return this.finish();
      if (st.bg) this.setBg(st.bg);
      else if (st.music) audio.playMusic(st.music);
      else if (st.enter) {
        const c = this.cast.get(st.enter) || { x: POS[st.at || 'center'] * W + (st.at && st.at.includes('right') ? 200 : -200), alpha: 0 };
        c.pos = st.at || 'center';
        c.emote = st.emote || 'neutral';
        this.cast.set(st.enter, c);
      } else if (st.exit) {
        if (st.exit === 'all') this.cast.clear();
        else this.cast.delete(st.exit);
      } else if (st.fx) {
        this.doFx(st.fx);
      } else if (st.sfx) {
        audio.sfx(st.sfx);
      } else if (st.say) {
        const c = this.cast.get(st.say);
        if (c && st.emote) c.emote = st.emote;
        this.say = { who: st.say, text: st.text, shown: 0, name: LOOKS[st.say]?.name || st.say };
        this.mode = 'say';
        this.autoT = 0;
        return;
      } else if (st.narr) {
        this.say = { who: null, text: st.narr, shown: 0 };
        this.mode = 'narr';
        this.autoT = 0;
        return;
      } else if (st.card) {
        this.card = { title: st.card, sub: st.sub || '', t: 0 };
        this.mode = 'card';
        audio.sfx('card');
        return;
      } else if (st.cine) {
        this.cine = { def: CINEMATICS[st.cine], t: 0 };
        this.mode = 'cine';
        audio.sfx('cutin');
        return;
      } else if (st.wait) {
        this.wait = st.wait;
        this.mode = 'wait';
        return;
      }
    }
  }

  doFx(name) {
    const reduce = this.game.save.settings.reduceFlash;
    if (name === 'shake' && this.game.save.settings.screenShake) this.shake = 16;
    else if (name === 'flash') { this.flash = reduce ? 0.3 : 1; this.flashColor = '#fff'; audio.sfx('boom'); }
    else if (name === 'redflash') { this.flash = reduce ? 0.3 : 0.8; this.flashColor = RED; audio.sfx('cutin'); }
    else if (name === 'glitch') { this.glitch = reduce ? 0.2 : 0.6; audio.sfx('weak'); }
  }

  advance() {
    if (this.mode === 'say' || this.mode === 'narr') {
      if (this.say.shown < this.say.text.length) {
        this.say.shown = this.say.text.length;
      } else {
        this.next();
      }
    } else if (this.mode === 'card') {
      if (this.card.t > 0.8) this.next();
    } else if (this.mode === 'cine') {
      if (this.cine.t > 1.2) this.next();
    }
  }

  pointer(type) {
    if (type === 'down') this.advance();
  }

  key(e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      this.advance();
    } else if (e.code === 'Escape') {
      this.finish();
    }
  }

  update(dt) {
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.glitch = Math.max(0, this.glitch - dt);
    if (this.bgFade > 0) this.bgFade = Math.max(0, this.bgFade - dt * 2.2);
    for (const [id, c] of this.cast) {
      const tx = POS[c.pos] * W;
      c.x += (tx - c.x) * Math.min(1, dt * 9);
      c.alpha = Math.min(1, c.alpha + dt * 5);
    }
    if (this.mode === 'say' || this.mode === 'narr') {
      const sp = this.game.save.settings.textSpeed;
      const before = Math.floor(this.say.shown);
      this.say.shown = Math.min(this.say.text.length, this.say.shown + dt * sp);
      if (Math.floor(this.say.shown) !== before && Math.floor(this.say.shown) % 3 === 0 && this.mode === 'say') audio.sfx('blip');
      if (this.say.shown >= this.say.text.length && this.game.save.settings.autoAdvance) {
        this.autoT += dt;
        if (this.autoT > 1.4 + this.say.text.length * 0.02) this.next();
      }
    } else if (this.mode === 'card') {
      this.card.t += dt;
      if (this.card.t > 3.2) this.next();
    } else if (this.mode === 'cine') {
      this.cine.t += dt;
      if (this.cine.t >= this.cine.def.dur) this.next();
    } else if (this.mode === 'wait') {
      this.wait -= dt;
      if (this.wait <= 0) this.next();
    }
  }

  draw(ctx) {
    const t = this.t;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    if (this.mode === 'cine' && this.cine) {
      this.cine.def.draw(ctx, this.cine.t);
    } else {
      this.drawStage(ctx, t);
    }
    ctx.restore();
    if (this.glitch > 0) this.drawGlitch(ctx);
    if (this.flash > 0) {
      ctx.fillStyle = hexA(this.flashColor.startsWith('#') && this.flashColor.length === 7 ? this.flashColor : '#e5001d', this.flash);
      ctx.fillRect(0, 0, W, H);
    }
  }

  drawGlitch(ctx) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const y = Math.random() * H;
      const h = 12 + Math.random() * 60;
      const dx = (Math.random() - 0.5) * 120 * this.glitch;
      ctx.drawImage(ctx.canvas, 0, y, W, h, dx, y, W, h);
    }
    ctx.fillStyle = `rgba(0,255,255,${0.08 * this.glitch})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawStage(ctx, t) {
    if (this.mode === 'card') return this.drawCard(ctx, t);
    drawBackground(ctx, this.bg, t);
    if (this.bgFade > 0 && this.prevBg) {
      ctx.save();
      ctx.globalAlpha = this.bgFade;
      drawBackground(ctx, this.prevBg, t);
      ctx.restore();
    }
    const speaker = this.mode === 'say' ? this.say.who : null;
    const list = [...this.cast.entries()].sort((a, b) => a[1].x - b[1].x);
    for (const [id, c] of list) {
      const active = !speaker || id === speaker;
      const bob = active && speaker ? Math.sin(t * 6) * 3 : 0;
      ctx.save();
      ctx.globalAlpha = c.alpha * (active ? 1 : 0.55);
      const flip = c.pos.includes('right') || c.pos === 'right';
      drawPortrait(ctx, id, c.x, H - 30 + bob - (active && speaker ? 8 : 0), 700 * (active && speaker ? 1.04 : 1), {
        t, emote: c.emote, flip, talking: active && speaker && this.say.shown < this.say.text.length,
      });
      ctx.restore();
    }
    vignette(ctx, 0.5);
    // cinematic bars
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, 48);
    ctx.fillRect(0, H - 48, W, 48);
    if (this.mode === 'say' || this.mode === 'narr') this.drawDialogue(ctx, t);
    if (this.mode === 'wait') return;
  }

  drawDialogue(ctx, t) {
    const s = this.say;
    const isNarr = this.mode === 'narr';
    const y = H - 228;
    const accent = !isNarr ? LOOKS[s.who]?.accent || RED : '#ffffff';
    ctx.save();
    // box
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    poly(ctx, [[60, y + 12], [W - 40, y - 8], [W - 70, y + 168], [30, y + 178]]);
    ctx.fill();
    ctx.strokeStyle = isNarr ? '#fff' : accent;
    ctx.lineWidth = 5;
    ctx.stroke();
    halftone(ctx, 60, y, W - 120, 170, 12, 'rgba(255,255,255,0.04)');
    if (!isNarr) {
      ctx.fillStyle = accent;
      poly(ctx, [[40, y - 34], [330, y - 44], [310, y + 12], [26, y + 20]]);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.stroke();
      text(ctx, s.name.toUpperCase(), 70, y + 2, { size: 40, fill: '#fff', stroke: '#000', lw: 6, skew: -0.15 });
    }
    ctx.font = `${isNarr ? 'italic ' : ''}34px ${FONT_BODY}`;
    const shown = s.text.slice(0, Math.floor(s.shown));
    const lines = wrap(ctx, s.text, W - 230);
    let count = 0;
    lines.forEach((ln, i) => {
      const part = shown.slice(count, count + ln.length + 1).slice(0, ln.length);
      count += ln.length + 1;
      text(ctx, part, 100, y + 56 + i * 42, { size: 34, font: FONT_BODY, fill: isNarr ? '#e8e8f4' : '#fff', italic: isNarr });
    });
    if (s.shown >= s.text.length) {
      const bounce = Math.sin(t * 7) * 4;
      ctx.fillStyle = accent;
      poly(ctx, [[W - 120, y + 140 + bounce], [W - 96, y + 140 + bounce], [W - 108, y + 156 + bounce]]);
      ctx.fill();
    }
    ctx.restore();
  }

  drawCard(ctx, t) {
    const c = this.card;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    halftone(ctx, 0, 0, W, H, 18, 'rgba(229,0,29,0.18)', (x, y) => 1 - Math.abs(y - 0.5) * 1.6);
    const k = easeOutBack(pulse(c.t, 0, 0.5));
    speedLines(ctx, W / 2, H / 2, c.t, 'rgba(255,255,255,0.06)', 50, 260, 1200);
    ctx.save();
    ctx.translate(W / 2, H / 2 - 20);
    ctx.rotate(-0.05);
    ctx.scale(0.5 + k * 0.5, 0.5 + k * 0.5);
    ctx.globalAlpha = Math.min(1, c.t * 4) * (1 - pulse(c.t, 2.8, 3.2));
    ctx.fillStyle = RED;
    poly(ctx, [[-W * 0.46, -90], [W * 0.46, -110], [W * 0.44, 70], [-W * 0.48, 90]]);
    ctx.fill();
    text(ctx, c.title, 0, 30, { size: 130, fill: '#fff', stroke: '#000', lw: 14, align: 'center', skew: -0.2 });
    ctx.restore();
    if (c.sub) {
      text(ctx, c.sub, W / 2 + 80, H / 2 + 130, { size: 66, fill: '#fff', stroke: RED, lw: 10, align: 'center', skew: -0.2, alpha: pulse(c.t, 0.5, 0.9) * (1 - pulse(c.t, 2.8, 3.2)) });
    }
  }
}
