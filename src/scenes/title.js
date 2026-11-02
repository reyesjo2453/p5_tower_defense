import { drawBackground } from '../render/backgrounds.js';
import { drawPortrait } from '../render/characters.js';
import { drawPersona } from '../render/personas.js';
import { W, H, RED, text, poly, halftone, speedLines, starburst, vignette } from '../render/draw.js';
import { easeOutCubic, easeOutBack, pulse } from '../core/util.js';
import { resetSave } from '../core/storage.js';

export class TitleScene {
  constructor(game) {
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
      <div class="title-foot">Unofficial, non-commercial fan project. Not affiliated with or endorsed by ATLUS or SEGA.<br/>Persona is a trademark of ATLUS. All art here is original placeholder work.</div>`;
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
    // big red slab
    ctx.save();
    ctx.fillStyle = RED;
    poly(ctx, [[-40, 0], [W * 0.62, 0], [W * 0.46, H], [-40, H]]);
    ctx.fill();
    halftone(ctx, 0, 0, W * 0.6, H, 14, 'rgba(0,0,0,0.25)', (x, y) => 1 - x);
    ctx.fillStyle = '#000';
    poly(ctx, [[W * 0.62, 0], [W * 0.66, 0], [W * 0.5, H], [W * 0.46, H]]);
    ctx.fill();
    ctx.restore();
    // persona behind Joker
    const k = easeOutCubic(pulse(t, 0.1, 1.2));
    ctx.save();
    ctx.globalAlpha = 0.9 * k;
    starburst(ctx, W * 0.78, 330, 150, 520, 16, t * 0.1, 'rgba(255,255,255,0.08)');
    drawPersona(ctx, 'arsene', W * 0.78, 330 + (1 - k) * 60, 330, t, '#e8002d');
    ctx.restore();
    drawPortrait(ctx, 'joker', W * 0.72 + (1 - k) * 200, H + 10, 760, { t, emote: 'smirk' });
    speedLines(ctx, W * 0.72, 300, t, 'rgba(255,255,255,0.05)', 40, 260, 1200);
    // logo
    const lk = easeOutBack(pulse(t, 0.2, 0.8));
    ctx.save();
    ctx.translate(70, 230);
    ctx.rotate(-0.07);
    ctx.scale(0.5 + 0.5 * lk, 0.5 + 0.5 * lk);
    ctx.globalAlpha = Math.min(1, lk * 1.5);
    text(ctx, 'ENCORE', 0, 0, { size: 190, fill: '#fff', stroke: '#000', lw: 20, skew: -0.2, shadow: '#000' });
    text(ctx, 'PROTOCOL', 130, 110, { size: 100, fill: '#000', stroke: '#fff', lw: 12, skew: -0.2 });
    ctx.restore();
    text(ctx, 'A TOWER DEFENSE OF REGRET', 100, 400, { size: 28, fill: '#fff', stroke: '#000', lw: 5, skew: -0.2, alpha: pulse(t, 1, 1.5) });
    vignette(ctx, 0.5);
  }
}
