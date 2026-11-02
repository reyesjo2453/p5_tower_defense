// Chapter hub: stage list + squad selection.
import { STAGES } from '../data/stages.js';
import { OPERATORS, OPERATOR_ORDER, CLASSES } from '../data/operators.js';
import { drawBackground } from '../render/backgrounds.js';
import { drawPortrait } from '../render/characters.js';
import { vignette } from '../render/draw.js';

export const MAX_SQUAD = 6;

export function unlockedOperators(save) {
  return OPERATOR_ORDER.filter((id) => {
    const u = OPERATORS[id].unlock;
    return !u || save.cleared[u];
  });
}

export function stageUnlocked(save, idx) {
  return idx === 0 || !!save.cleared[STAGES[idx - 1].id];
}

export function portraitCanvas(id, size = 200) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const x = c.getContext('2d');
  drawPortrait(x, id, size / 2, size + size * 0.02, size * 1.05, { t: 0 });
  return c;
}

export class HubScene {
  constructor(game) {
    this.grade = 'menu';
    this.game = game;
  }

  enter() {
    this.t = 0;
    this.game.audio.playMusic('calm');
    this.selStage = null;
    this.render();
  }

  render() {
    const g = this.game;
    const save = g.save;
    this.game.ui.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'screen';
    const stageHtml = STAGES.map((s, i) => {
      const un = stageUnlocked(save, i);
      const st = save.cleared[s.id]?.stars || 0;
      return `<button class="stage-card" data-stage="${i}" ${un ? '' : 'disabled'}>
        <span class="id">${s.id}</span><span class="nm">${s.name}</span><span class="sb">${s.subtitle}</span>
        <span class="stars">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span></button>`;
    }).join('');
    el.innerHTML = `
      <button class="btn alt back" data-act="back"><span>◂ Title</span></button>
      <div class="hub-title" style="top:80px">CHAPTER 1 · REPLAY</div>
      <div class="hub-sub" style="top:166px">Select a stage</div>
      <div class="stage-list" style="top:230px">${stageHtml}</div>
      <div class="panel squad-panel" style="display:${this.selStage == null ? 'none' : 'block'}">
        <h2>Squad</h2>
        <div class="hint">Choose up to ${MAX_SQUAD} operators. Click a slot to remove.</div>
        <div class="squad-slots"></div>
        <div class="roster-grid"></div>
        <div class="go-row">
          <button class="btn" data-act="go"><span>Deploy</span></button>
          <button class="btn alt" data-act="rec"><span>Recommended</span></button>
          <button class="btn alt" data-act="replay"><span>Story</span></button>
        </div>
      </div>`;
    el.addEventListener('click', (e) => this.onClick(e));
    this.game.ui.appendChild(el);
    this.el = el;
    if (this.selStage != null) this.renderSquad();
  }

  renderSquad() {
    const save = this.game.save;
    const avail = unlockedOperators(save);
    save.squad = save.squad.filter((id) => avail.includes(id)).slice(0, MAX_SQUAD);
    const slots = this.el.querySelector('.squad-slots');
    slots.innerHTML = '';
    for (let i = 0; i < MAX_SQUAD; i++) {
      const id = save.squad[i];
      const d = document.createElement('div');
      d.className = `slot ${id ? 'filled' : ''}`;
      if (id) {
        d.dataset.remove = id;
        d.appendChild(portraitCanvas(id));
        d.insertAdjacentHTML('beforeend', `<div class="nm">${OPERATORS[id].name}</div>`);
      }
      slots.appendChild(d);
    }
    const grid = this.el.querySelector('.roster-grid');
    grid.innerHTML = '';
    for (const id of OPERATOR_ORDER) {
      const def = OPERATORS[id];
      const locked = !avail.includes(id);
      const d = document.createElement('div');
      d.className = `rc ${save.squad.includes(id) ? 'picked' : ''} ${locked ? 'locked' : ''}`;
      if (!locked) d.dataset.pick = id;
      d.appendChild(portraitCanvas(id));
      d.insertAdjacentHTML('beforeend', `<div class="nm">${locked ? '???' : def.name}</div><div class="cl">${CLASSES[def.class].label} · ${def.cost}</div>`);
      grid.appendChild(d);
    }
    this.el.querySelector('[data-act="go"]').disabled = save.squad.length === 0;
  }

  onClick(e) {
    const g = this.game;
    const save = g.save;
    const t = e.target;
    const stageBtn = t.closest('[data-stage]');
    if (stageBtn) {
      g.audio.sfx('click');
      this.selStage = Number(stageBtn.dataset.stage);
      this.el.querySelector('.squad-panel').style.display = 'block';
      this.renderSquad();
      return;
    }
    const rm = t.closest('[data-remove]');
    if (rm) {
      save.squad = save.squad.filter((x) => x !== rm.dataset.remove);
      g.persist();
      this.renderSquad();
      return;
    }
    const pk = t.closest('[data-pick]');
    if (pk) {
      const id = pk.dataset.pick;
      g.audio.sfx('click');
      if (save.squad.includes(id)) save.squad = save.squad.filter((x) => x !== id);
      else if (save.squad.length < MAX_SQUAD) save.squad.push(id);
      g.persist();
      this.renderSquad();
      return;
    }
    const act = t.closest('button')?.dataset.act;
    if (act === 'back') g.go('title');
    else if (act === 'rec') {
      const avail = unlockedOperators(save);
      save.squad = STAGES[this.selStage].recommended.filter((id) => avail.includes(id)).slice(0, MAX_SQUAD);
      g.persist();
      this.renderSquad();
    } else if (act === 'go') {
      g.persist();
      const stage = STAGES[this.selStage];
      g.playScene(stage.scenes.pre, () => g.go('battle', { stageIdx: this.selStage }));
    } else if (act === 'replay') {
      const stage = STAGES[this.selStage];
      g.playScene(stage.scenes.pre, () => g.go('hub'), { force: true });
    }
  }

  update(dt) {
    this.t += dt;
  }

  pointer() {}

  draw(ctx) {
    drawBackground(ctx, 'crossing_dusk', this.t);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 1280, 720);
    vignette(ctx, 0.6);
  }
}
