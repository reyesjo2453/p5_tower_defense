// Battle scene: input, HUD, pacing, cut-ins and result flow.
import { Battle, RUSH_MAX } from '../sim/battle.js';
import { STAGES } from '../data/stages.js';
import { OPERATORS, CLASSES, ELEMENTS, isMelee } from '../data/operators.js';
import { ENEMIES } from '../data/enemies.js';
import { drawBattle } from '../render/battleRender.js';
import { Fx } from '../render/fx.js';
import { CutIn } from '../render/cutin.js';
import { toTile, TILE, px, py } from '../render/layout.js';
import { W, H, text } from '../render/draw.js';
import { DIRS, rotateOffset } from '../core/util.js';
import { portraitCanvas } from './hub.js';
import { CutsceneScene } from './cutscene.js';

const SLOWMO = 0.12;

export class BattleScene {
  constructor(game) {
    this.game = game;
  }

  enter({ stageIdx }) {
    const g = this.game;
    this.stageIdx = stageIdx;
    this.stage = STAGES[stageIdx];
    this.battle = new Battle(this.stage, g.save.squad);
    this.fx = new Fx(g.save.settings);
    this.cutin = new CutIn(g.save.settings);
    this.t = 0;
    this.ui = { placing: null, placeTile: null, dir: 0, hover: null, selected: null };
    this.cardIdxPlacing = -1;
    this.paused = false;
    this.speed = 1;
    this.ended = false;
    this.sub = null;
    this.dragging = false;
    this.sfxClock = {};
    this.mountHud();
    g.audio.playMusic(this.stage.music);
    this.banner(this.stage.name.toUpperCase());
    this.onWinUp = () => { this.dragging = false; };
    window.addEventListener('pointerup', this.onWinUp);
  }

  exit() {
    window.removeEventListener('pointerup', this.onWinUp);
  }

  // ------------------------------------------------------------------ HUD
  mountHud() {
    const g = this.game;
    const b = this.battle;
    const el = document.createElement('div');
    el.className = 'screen hud';
    el.innerHTML = `
      <div class="hud-top">
        <div class="hud-stage">${this.stage.id} ${this.stage.name.toUpperCase()}<small>${this.stage.subtitle}</small></div>
        <div class="lives" data-lives></div>
        <div class="cnt" data-count></div>
        <div class="rush" data-rush><div class="lbl">RUSH GAUGE</div><div class="meter"><i></i></div><button data-act="allout">ALL-OUT RUSH! [A]</button></div>
        <div class="hud-spacer"></div>
        <div class="dp"><small>DEPLOY POINTS</small><b data-dp>0</b><div class="bar"><i data-dpbar></i></div></div>
        <div class="hud-btns">
          <button class="mini" data-act="pause">❚❚ PAUSE</button>
          <button class="mini" data-act="speed">▶ 1x</button>
          <button class="mini" data-act="quit">✕ QUIT</button>
        </div>
      </div>
      <div class="tip" data-tip></div>
      <div class="bottom">
        <div class="cards" data-cards></div>
        <div class="unit-panel" data-unit>
          <div class="un" data-un></div><div class="uc" data-uc></div>
          <div class="sk" data-sk></div>
          <div class="uc" data-hp></div>
          <div class="acts"><button class="skill" data-act="skill">SKILL [S]</button><button data-act="retreat">RETREAT [R]</button></div>
        </div>
      </div>`;
    this.hud = el;
    this.q = (s) => el.querySelector(s);
    const cards = this.q('[data-cards]');
    this.cardEls = b.cards.map((c, i) => {
      const d = document.createElement('div');
      d.className = 'ocard';
      d.appendChild(portraitCanvas(c.id));
      d.insertAdjacentHTML('beforeend', `<div class="cost">${c.def.cost}</div><div class="nm">${c.def.name}</div><div class="key">${i + 1}</div><div class="cd"></div>`);
      d.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        g.audio.resume();
        this.selectCard(i);
        this.dragging = true;
      });
      cards.appendChild(d);
      return d;
    });
    el.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      g.audio.sfx('click');
      if (act === 'pause') this.togglePause();
      else if (act === 'speed') this.toggleSpeed();
      else if (act === 'quit') this.quit();
      else if (act === 'skill') this.useSkill(this.ui.selected);
      else if (act === 'retreat') this.retreat(this.ui.selected);
      else if (act === 'allout') this.allOut();
    });
    g.ui.appendChild(el);
  }

  banner(str) {
    const d = document.createElement('div');
    d.className = 'banner';
    d.textContent = str;
    this.hud.appendChild(d);
    setTimeout(() => d.remove(), 2300);
  }

  showTip(str) {
    const tip = this.q('[data-tip]');
    tip.textContent = str;
    tip.classList.add('show');
    clearTimeout(this.tipTimer);
    this.tipTimer = setTimeout(() => tip.classList.remove('show'), 6500);
  }

  updateHud() {
    const b = this.battle;
    this.q('[data-dp]').textContent = Math.floor(b.dp);
    this.q('[data-dpbar]').style.width = `${b.dpAcc * 100}%`;
    const lives = this.q('[data-lives]');
    let html = '';
    for (let i = 0; i < this.stage.lives; i++) html += `<span class="heart ${i < b.lives ? '' : 'lost'}"></span>`;
    if (lives.dataset.v !== html) { lives.innerHTML = html; lives.dataset.v = html; }
    this.q('[data-count]').textContent = `ECHOES ${b.kills}/${b.totalEnemies + Math.max(0, b.kills + b.leaked - b.spawnIdx)}`;
    const rush = this.q('[data-rush]');
    rush.querySelector('i').style.width = `${(b.rush / RUSH_MAX) * 100}%`;
    rush.classList.toggle('ready', b.canAllOut());
    b.cards.forEach((c, i) => {
      const d = this.cardEls[i];
      const cooling = !c.unit && c.cd > 0;
      d.classList.toggle('cooling', cooling);
      d.querySelector('.cd').textContent = cooling ? Math.ceil(c.cd) : '';
      d.classList.toggle('deployed', !!c.unit);
      d.classList.toggle('off', !c.unit && !cooling && b.dp < c.def.cost);
      d.classList.toggle('sel', this.ui.placing === c);
    });
    const u = this.ui.selected;
    const panel = this.q('[data-unit]');
    if (u && !u.dead) {
      panel.classList.add('show');
      const sk = u.def.skill;
      this.q('[data-un]').textContent = `${u.def.name.toUpperCase()} · ${u.def.personaName}`;
      this.q('[data-uc]').textContent = `${CLASSES[u.def.class].label} · ${ELEMENTS[u.def.element].label}`;
      this.q('[data-sk]').textContent = `${sk.name}: ${sk.desc}`;
      this.q('[data-hp]').textContent = `HP ${Math.ceil(u.hp)}/${u.def.hp}   SP ${Math.floor(u.sp)}/${sk.spCost}${u.skill.active ? '   ACTIVE ' + Math.ceil(u.skill.t) + 's' : ''}`;
      const sb = panel.querySelector('.skill');
      const ok = this.battle.canSkill(u);
      sb.disabled = !ok;
      sb.classList.toggle('ready', ok);
    } else {
      panel.classList.remove('show');
      this.ui.selected = null;
    }
  }

  // ------------------------------------------------------------------ actions
  togglePause() {
    this.paused = !this.paused;
    this.hud.querySelector('[data-act="pause"]').textContent = this.paused ? '▶ RESUME' : '❚❚ PAUSE';
  }

  toggleSpeed() {
    this.speed = this.speed === 1 ? 2 : 1;
    this.hud.querySelector('[data-act="speed"]').textContent = `▶ ${this.speed}x`;
  }

  quit() {
    this.game.go('hub');
  }

  selectCard(i) {
    const b = this.battle;
    const c = b.cards[i];
    if (!c || c.unit || c.cd > 0) return;
    if (b.dp < c.def.cost) {
      this.showTip('Not enough DP yet.');
      return;
    }
    this.ui.placing = this.ui.placing === c ? null : c;
    this.ui.placeTile = null;
    this.ui.selected = null;
    this.cardIdxPlacing = b.cards.indexOf(c);
    this.game.audio.sfx('click');
  }

  cancel() {
    this.ui.placing = null;
    this.ui.placeTile = null;
    this.ui.selected = null;
  }

  bestDir(card, c, r) {
    let best = 0;
    let bestScore = -1;
    for (let d = 0; d < 4; d++) {
      let score = 0;
      for (const [dx, dy] of card.def.range) {
        const [rx, ry] = rotateOffset(dx, dy, d);
        const t = this.battle.tileAt(c + rx, r + ry);
        if (t === 'p' || t === 'S' || t === 'E') score++;
      }
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  useSkill(u) {
    const b = this.battle;
    if (!u || !b.canSkill(u) || this.cutin.active) return;
    this.cutin.playSkill(u.id, u.def.skill.name).then(() => {
      if (!u.dead) b.activateSkill(u);
    });
    this.game.audio.sfx('cutin');
  }

  retreat(u) {
    if (!u || u.dead) return;
    this.battle.retreat(u);
    this.ui.selected = null;
  }

  allOut() {
    const b = this.battle;
    if (!b.canAllOut() || this.cutin.active) return;
    this.game.audio.sfx('allout');
    this.cutin.playAllOut(b.operators.map((o) => o.id)).then(() => {
      this.fx.doFlash(1);
      this.fx.doShake(22);
      b.useAllOut();
    });
  }

  // ------------------------------------------------------------------ input
  pointer(type, x, y) {
    if (this.sub) return this.sub.pointer?.(type, x, y);
    if (this.cutin.active || this.ended) return;
    const b = this.battle;
    const { c, r } = toTile(x, y);
    const inField = c >= 0 && r >= 0 && c < b.cols && r < b.rows && y >= 80 && y < 80 + b.rows * TILE;
    if (type === 'move') {
      this.ui.hover = inField ? { c, r } : null;
      if (this.ui.placeTile) {
        const cx = px(this.ui.placeTile.c + 0.5);
        const cy = py(this.ui.placeTile.r + 0.5);
        const dx = x - cx;
        const dy = y - cy;
        if (Math.hypot(dx, dy) > 28) this.ui.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3;
      }
      return;
    }
    if (type === 'context') {
      this.cancel();
      return;
    }
    if ((type === 'down' && !this.dragging) || (type === 'up' && this.dragging)) {
      this.dragging = false;
      if (this.ui.placeTile) {
        this.confirmDeploy();
        return;
      }
      if (this.ui.placing) {
        if (inField && b.validTile(this.ui.placing, c, r)) {
          this.ui.placeTile = { c, r };
          this.ui.dir = this.bestDir(this.ui.placing, c, r);
          this.game.audio.sfx('click');
        } else if (type === 'down') this.cancel();
        return;
      }
      if (type === 'down') {
        const u = inField ? b.unitAt(c, r) : null;
        this.ui.selected = u === this.ui.selected ? null : u;
        if (u) this.game.audio.sfx('click');
      }
    }
  }

  confirmDeploy() {
    const b = this.battle;
    const { c, r } = this.ui.placeTile;
    const idx = this.cardIdxPlacing;
    const u = b.deploy(idx, c, r, this.ui.dir);
    if (u) {
      this.game.audio.sfx('deploy');
      this.ui.selected = u;
    }
    this.ui.placing = null;
    this.ui.placeTile = null;
  }

  key(e) {
    if (this.sub) return this.sub.key?.(e);
    if (this.ended) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { e.preventDefault(); this.togglePause(); }
    else if (k === 'f') this.toggleSpeed();
    else if (k === 'escape') this.cancel();
    else if (k === 's') this.useSkill(this.ui.selected);
    else if (k === 'r') this.retreat(this.ui.selected);
    else if (k === 'a') this.allOut();
    else if (/^[1-8]$/.test(k)) this.selectCard(Number(k) - 1);
  }

  // ------------------------------------------------------------------ loop
  update(dt) {
    if (this.sub) {
      this.sub.update(dt);
      return;
    }
    this.t += dt;
    this.cutin.update(dt);
    this.hud.style.visibility = this.cutin.active ? 'hidden' : '';
    this.fx.update(dt * 0.5);
    if (this.cutin.active || this.ended) {
      this.updateHud();
      return;
    }
    let scale = this.paused ? 0 : this.speed;
    if (this.ui.placing || this.ui.placeTile) scale *= SLOWMO;
    let rem = dt * scale;
    const b = this.battle;
    while (rem > 1e-6 && b.state === 'running') {
      const step = Math.min(rem, 1 / 30);
      b.update(step);
      this.fx.update(step * 0.5);
      rem -= step;
      this.processEvents();
      if (this.sub || this.cutin.active) break;
    }
    this.processEvents();
    if (this.ui.selected?.dead) this.ui.selected = null;
    this.updateHud();
  }

  sfx(name, gapMs = 0) {
    const now = performance.now();
    if (gapMs && now - (this.sfxClock[name] || 0) < gapMs) return;
    this.sfxClock[name] = now;
    this.game.audio.sfx(name);
  }

  processEvents() {
    const b = this.battle;
    for (const ev of b.takeEvents()) {
      this.fx.handle(ev);
      switch (ev.t) {
        case 'shot': this.sfx(ev.kind === 'heal' ? 'heal' : ev.kind === 'melee' ? 'hit' : 'shot', 70); break;
        case 'dmg': if (ev.weak) this.sfx('weak', 90); break;
        case 'down': this.sfx('down'); break;
        case 'kill': this.sfx(ev.boss ? 'boom' : 'kill', 60); break;
        case 'leak': this.sfx('leak'); break;
        case 'skill': this.sfx('skill'); break;
        case 'impact': this.sfx('boom'); break;
        case 'tip': this.showTip(ev.text); break;
        case 'scene': this.startMidScene(ev.id); break;
        case 'won': this.finish(true, ev.stars); break;
        case 'lost': this.finish(false, 0); break;
        default:
      }
    }
  }

  startMidScene(id) {
    const g = this.game;
    if (g.save.seen[id]) return;
    g.save.seen[id] = true;
    g.persist();
    this.hud.style.display = 'none';
    this.sub = new CutsceneScene(g);
    this.sub.enter({
      id,
      onDone: () => {
        this.sub.exit();
        this.sub = null;
        this.hud.style.display = '';
        g.audio.playMusic(this.stage.music);
      },
    });
  }

  finish(won, stars) {
    if (this.ended) return;
    this.ended = true;
    this.q('[data-tip]').classList.remove('show');
    const g = this.game;
    const save = g.save;
    g.audio.sfx(won ? 'win' : 'lose');
    const el = document.createElement('div');
    el.className = 'result';
    let unlocked = [];
    if (won) {
      const prev = save.cleared[this.stage.id];
      if (!prev) unlocked = Object.values(OPERATORS).filter((o) => o.unlock === this.stage.id);
      save.cleared[this.stage.id] = { stars: Math.max(stars, prev?.stars || 0) };
      g.persist();
    }
    el.innerHTML = `
      <h1 class="${won ? '' : 'lose'}">${won ? 'MISSION COMPLETE' : 'MISSION FAILED'}</h1>
      ${won ? `<div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>` : ''}
      <div class="info">Echoes defeated: ${this.battle.kills} · Time ${Math.floor(this.battle.time)}s</div>
      ${unlocked.length ? `<div class="info" style="color:#ffd24a">NEW OPERATOR: ${unlocked.map((o) => o.name.toUpperCase()).join(', ')}</div>` : ''}
      <div class="row">
        ${won ? '<button class="btn" data-act="next"><span>Continue</span></button>' : ''}
        <button class="btn alt" data-act="retry"><span>Retry</span></button>
        <button class="btn alt" data-act="hub"><span>Stages</span></button>
      </div>`;
    el.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      g.audio.sfx('click');
      if (act === 'retry') g.go('battle', { stageIdx: this.stageIdx });
      else if (act === 'hub') g.go('hub');
      else if (act === 'next') g.playScene(this.stage.scenes.post, () => g.go('hub'));
    });
    setTimeout(() => this.hud && this.hud.appendChild(el), won ? 900 : 600);
  }

  draw(ctx) {
    if (this.sub) return this.sub.draw(ctx);
    const b = this.battle;
    ctx.save();
    if (this.fx.shake > 0) ctx.translate((Math.random() - 0.5) * this.fx.shake, (Math.random() - 0.5) * this.fx.shake);
    drawBattle(ctx, b, this.t, this.ui);
    this.fx.draw(ctx, this.t);
    ctx.restore();
    if (this.fx.flash > 0) {
      ctx.fillStyle = this.fx.flashColor;
      ctx.globalAlpha = Math.min(1, this.fx.flash);
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    this.cutin.draw(ctx, this.t);
    if (this.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 80, W, 480);
      text(ctx, 'PAUSED', W / 2, 340, { size: 110, fill: '#fff', stroke: '#e5001d', lw: 14, align: 'center', skew: -0.2 });
    }
    if (this.ui.placing && !this.ui.placeTile) {
      text(ctx, isMelee(this.ui.placing.def) ? 'DEPLOY ON A PATH TILE' : 'DEPLOY ON HIGH GROUND', W / 2, 108, { size: 26, fill: '#7dffa8', stroke: '#000', lw: 5, align: 'center' });
    } else if (this.ui.placeTile) {
      text(ctx, 'MOVE TO CHOOSE FACING · CLICK TO DEPLOY', W / 2, 108, { size: 26, fill: '#fff', stroke: '#000', lw: 5, align: 'center' });
    }
  }
}

export const _enemies = ENEMIES;
export const _dirs = DIRS;
