import { drawBackground } from '../render/backgrounds.js';
import { drawPortrait } from '../render/characters.js';
import { drawPersona } from '../render/personas.js';
import { W, H, RED, text, poly, halftone, speedLines, starburst, vignette } from '../render/draw.js';
import { easeOutCubic, easeOutBack, pulse } from '../core/util.js';
import { resetSave } from '../core/storage.js';

export class TitleScene {
  constructor(game) {
    this.grade = 'title';
    this.game = game;
  }

  enter() {
    this.t = 0;
    this.game.audio.playMusic('title');
    const started = this.game.save.started;
    const el = document.createElement('div');
    el.className = 'screen';
    el.innerHTML = `
      <div class="title-tag">PERSONA 5 FAN TALE</div>
      <div class="title-menu">
        <button class="btn" data-act="play"><span>${started ? 'Continue' : 'New Game'}</span></button>
        ${started ? '<button class="btn alt" data-act="new"><span>New Game</span></button>' : ''}
        <button class="btn alt" data-act="roster"><span>Roster</span></button>
        <button class="btn alt" data-act="settings"><span>Settings</span></button>
      </div>
      <div class="title-foot">Unofficial, non-commercial fan project. Not affiliated with or endorsed by ATLUS or SEGA.<br/>Persona is a trademark of ATLUS. All character designs and art here are original.</div>`;
    el.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      this.game.audio.sfx('click');
      const g = this.game;
      if (act === 'play') {
        if (!g.save.started) {
          g.save.started = true;
          g.persist();
          g.playScene('opening', () => g.go('hub'));
        } else g.go('hub');
      } else if (act === 'new') {
        if (confirm('Erase your save and start over?')) {
          resetSave();
          location.reload();
        }
      } else if (act === 'roster') g.go('roster');
      else if (act === 'settings') g.go('settings');
    });
    this.game.ui.appendChild(el);
  }

  update(dt) {
    this.t += dt;
  }

  pointer() {}

  draw(ctx) {
    const t = this.t;
    drawBackground(ctx, 'loop_void', t);
    // volumetric light shafts behind the hero
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const a = -1.95 + i * 0.13 + Math.sin(t * 0.3 + i) * 0.02;
      const g = ctx.createLinearGradient(W * 0.8, -40, W * 0.8 + Math.cos(a) * 900, -40 - Math.sin(a) * 900);
      g.addColorStop(0, 'rgba(255,60,90,0.16)');
      g.addColorStop(1, 'rgba(255,60,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(W * 0.8, -40);
      ctx.lineTo(W * 0.8 + Math.cos(a - 0.04) * 1100, -40 - Math.sin(a - 0.04) * 1100);
      ctx.lineTo(W * 0.8 + Math.cos(a + 0.04) * 1100, -40 - Math.sin(a + 0.04) * 1100);
      ctx.fill();
    }
    ctx.restore();
    // summoned spirit behind the hero
    const k = easeOutCubic(pulse(t, 0.1, 1.4));
    ctx.save();
    ctx.globalAlpha = 0.95 * k;
    starburst(ctx, W * 0.76, 300, 140, 560, 18, t * 0.06, 'rgba(255,255,255,0.05)');
    drawPersona(ctx, 'arsene', W * 0.79, 300 + (1 - k) * 80, 270, t, '#ff2a4a');
    ctx.restore();
    // big red slab with halftone and ink edge
    ctx.save();
    const sg = ctx.createLinearGradient(0, 0, W * 0.6, H);
    sg.addColorStop(0, '#ff1a35');
    sg.addColorStop(1, '#9e0016');
    ctx.fillStyle = sg;
    poly(ctx, [[-40, 0], [W * 0.56, 0], [W * 0.42, H], [-40, H]]);
    ctx.fill();
    halftone(ctx, 0, 0, W * 0.56, H, 14, 'rgba(0,0,0,0.22)', (x, y) => Math.max(0, x * 1.2 - 0.1 + y * 0.2));
    ctx.fillStyle = '#000';
    poly(ctx, [[W * 0.56, 0], [W * 0.585, 0], [W * 0.445, H], [W * 0.42, H]]);
    ctx.fill();
    ctx.fillStyle = '#fff';
    poly(ctx, [[W * 0.585, 0], [W * 0.592, 0], [W * 0.452, H], [W * 0.445, H]]);
    ctx.fill();
    ctx.restore();
    // hero
    drawPortrait(ctx, 'joker', W * 0.74 + (1 - k) * 160, H + 20, 600, { t, emote: 'smirk' });
    speedLines(ctx, W * 0.74, 280, t, 'rgba(255,255,255,0.045)', 40, 300, 1200);
    // drifting shards
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const x = ((i * 173 + t * (20 + (i % 4) * 9)) % (W + 100)) - 50;
      const y = (i * 97) % H + Math.sin(t + i) * 20;
      ctx.translate(x, y);
      ctx.rotate(t * (0.5 + (i % 3) * 0.3) + i);
      ctx.fillStyle = i % 3 ? 'rgba(255,255,255,0.5)' : 'rgba(255,40,70,0.8)';
      poly(ctx, [[0, -9], [4, 0], [0, 9], [-4, 0]]);
      ctx.fill();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.restore();
    // logo
    const lk = easeOutBack(pulse(t, 0.2, 0.8));
    ctx.save();
    ctx.translate(70, 230);
    ctx.rotate(-0.07);
    ctx.scale(0.5 + 0.5 * lk, 0.5 + 0.5 * lk);
    ctx.globalAlpha = Math.min(1, lk * 1.5);
    text(ctx, 'ENCORE', 0, 0, { size: 190, fill: '#fff', stroke: '#000', lw: 20, skew: -0.2, shadow: '#000' });
    text(ctx, 'PROTOCOL', 130, 110, { size: 100, fill: '#000', stroke: '#fff', lw: 12, skew: -0.2 });
    // logo glint
    const gx = ((t * 500) % 2400) - 400;
    ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createLinearGradient(gx - 60, 0, gx + 60, 0);
    gl.addColorStop(0, 'rgba(255,255,255,0)');
    gl.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(-40, -170, 700, 300);
    ctx.restore();
    text(ctx, 'A TOWER DEFENSE OF REGRET', 100, 400, { size: 28, fill: '#fff', stroke: '#000', lw: 5, skew: -0.2, alpha: pulse(t, 1, 1.5) });
    vignette(ctx, 0.35);
  }
}
