// Roster viewer and settings.
import { OPERATORS, OPERATOR_ORDER, CLASSES, ELEMENTS } from '../data/operators.js';
import { drawBackground } from '../render/backgrounds.js';
import { drawPortrait } from '../render/characters.js';
import { drawPersona } from '../render/personas.js';
import { text, vignette, poly } from '../render/draw.js';
import { portraitCanvas, unlockedOperators } from './hub.js';

export class RosterScene {
  constructor(game) {
    this.grade = 'menu';
    this.game = game;
  }

  enter() {
    this.t = 0;
    this.sel = 'joker';
    this.render();
  }

  render() {
    const g = this.game;
    const avail = unlockedOperators(g.save);
    g.ui.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'screen';
    const def = OPERATORS[this.sel];
    const locked = !avail.includes(this.sel);
    const sk = def.skill;
    el.innerHTML = `
      <button class="btn alt back" data-act="back"><span>◂ Back</span></button>
      <div class="roster-grid" style="position:absolute;left:30px;top:100px;width:400px;grid-template-columns:repeat(2,1fr);max-height:560px"></div>
      <div class="panel detail">
        <div class="ttl">${locked ? 'Locked' : def.title} · ${CLASSES[def.class].label}</div>
        <h3>${locked ? '???' : def.name.toUpperCase()}</h3>
        <div class="stat-grid">
          <div><b>${def.hp}</b><span>HP</span></div><div><b>${def.atk}</b><span>ATK</span></div>
          <div><b>${def.def}</b><span>DEF</span></div><div><b>${def.res}</b><span>RES</span></div>
          <div><b>${def.cost}</b><span>COST</span></div><div><b>${def.block || '-'}</b><span>BLOCK</span></div>
          <div><b>${def.interval}s</b><span>INTERVAL</span></div><div><b style="color:${ELEMENTS[def.element].color}">${ELEMENTS[def.element].label}</b><span>ELEMENT</span></div>
        </div>
        <div>${locked ? 'Clear earlier stages to recruit.' : def.bio}</div>
        <div class="skill-box"><b>Passive · ${def.passive.name}</b><br/>${def.passive.desc}</div>
        <div class="skill-box"><span class="sn">${sk.name}</span><br/>${sk.desc}<br/><small>SP ${sk.spCost} · ${sk.spType === 'attack' ? 'by attacking' : 'over time'} · Persona: ${def.personaName}</small></div>
      </div>`;
    el.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (act === 'back') g.go('title');
      const pk = e.target.closest('[data-pick]');
      if (pk) {
        this.sel = pk.dataset.pick;
        this.render();
      }
    });
    const grid = el.querySelector('.roster-grid');
    for (const id of OPERATOR_ORDER) {
      const d = document.createElement('div');
      const lk = !avail.includes(id);
      d.className = `rc ${id === this.sel ? 'picked' : ''} ${lk ? '' : ''}`;
      d.dataset.pick = id;
      d.appendChild(portraitCanvas(id));
      d.insertAdjacentHTML('beforeend', `<div class="nm">${lk ? OPERATORS[id].name + ' 🔒' : OPERATORS[id].name}</div>`);
      grid.appendChild(d);
    }
    g.ui.appendChild(el);
  }

  update(dt) {
    this.t += dt;
  }

  pointer() {}

  draw(ctx) {
    drawBackground(ctx, 'loop_void', this.t);
    const def = OPERATORS[this.sel];
    ctx.save();
    ctx.globalAlpha = 0.5;
    drawPersona(ctx, def.persona, 790, 330, 260, this.t, def.color);
    ctx.restore();
    drawPortrait(ctx, this.sel, 470, 740, 640, { t: this.t, emote: 'smirk' });
    vignette(ctx, 0.5);
  }
}

export class SettingsScene {
  constructor(game) {
    this.grade = 'menu';
    this.game = game;
  }

  enter() {
    this.t = 0;
    const g = this.game;
    const s = g.save.settings;
    const el = document.createElement('div');
    el.className = 'screen';
    el.innerHTML = `
      <button class="btn alt back" data-act="back"><span>◂ Back</span></button>
      <div class="panel settings">
        <h2>Settings</h2>
        <label>Music <input type="range" min="0" max="1" step="0.05" value="${s.music}" data-k="music" /></label>
        <label>Sound effects <input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-k="sfx" /></label>
        <label>Text speed <input type="range" min="15" max="120" step="5" value="${s.textSpeed}" data-k="textSpeed" /></label>
        <label>Screen shake <input type="checkbox" ${s.screenShake ? 'checked' : ''} data-k="screenShake" /></label>
        <label>Reduce flashing (accessibility) <input type="checkbox" ${s.reduceFlash ? 'checked' : ''} data-k="reduceFlash" /></label>
        <label>Graphics quality <select data-k="quality">
          ${['auto', 'high', 'low', 'off'].map((q) => `<option value="${q}" ${s.quality === q ? 'selected' : ''}>${{ auto: 'Auto (adapts to your device)', high: 'High (bloom, lighting, grain)', low: 'Low (lighting only)', off: 'Off (fastest)' }[q]}</option>`).join('')}
        </select></label>
        <label>Auto-advance dialogue <input type="checkbox" ${s.autoAdvance ? 'checked' : ''} data-k="autoAdvance" /></label>
        <div class="hint">Keyboard: Space = pause, F = speed, S = skill, R = retreat, 1–6 = select operator, Esc = cancel.</div>
      </div>`;
    el.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      s[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.tagName === 'SELECT' ? e.target.value : Number(e.target.value);
      if (k === 'quality') g.post.quality = s.quality === 'auto' ? 'high' : s.quality;
      g.audio.setVolumes(s.music, s.sfx);
      g.persist();
    });
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-act="back"]')) g.go('title');
    });
    g.ui.appendChild(el);
  }

  update(dt) {
    this.t += dt;
  }

  pointer() {}

  draw(ctx) {
    drawBackground(ctx, 'loop_void', this.t);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, 1280, 720);
    vignette(ctx, 0.5);
  }
}

export const _text = text;
export const _poly = poly;
