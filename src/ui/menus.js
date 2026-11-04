// Menus between the fights: Settings, Pause, the Playbill (stage select, stars, scene replay), the
// Green Room (bond scenes and the Persona loadout) and Rehearsal (tiers + the daily stage).
// Each is a full-screen overlay built from plain DOM; `ctx` supplies the game-side callbacks.
import { CAMPAIGN, UNITS, BONDS, BOND_COST, DIFFICULTY, MODIFIERS } from '../sim/data.js';
import { bondPoints } from '../story/save.js';
import { BOND_SCENES } from '../story/bonds.js';
import { SCENES } from '../story/script.js';
import { dailySpec } from '../sim/campaign.js';

const $ = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const ACTS = [[0, 4, 'ACT I · OPENING NIGHT'], [5, 9, 'ACT II · INTERMISSION'], [10, 14, 'ACT III · CURTAIN CALL']];
const starStr = (n) => `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`;

/** Apply the accessibility settings to the page (text size, colour-blind palette, reduced motion). */
export function applySettings(settings) {
  const root = document.documentElement;
  root.style.setProperty('--text-scale', String(settings.textSize ?? 1));
  root.classList.toggle('cb', !!settings.colorblind);
  root.classList.toggle('calm', !!settings.reduceMotion);
}

export class Menus {
  /**
   * ctx: { root, save, writeSave, audio, story, playScene(beats, id), startStage(i), startRehearsal(spec),
   * title(), resume(), retry(), canRetry(), onSettings() }
   */
  constructor(ctx) {
    this.c = ctx;
    this.el = null;
  }

  open(html, cls = '') {
    this.close();
    this.el = $(`<div class="overlay menu ${cls}">${html}</div>`);
    this.c.root.appendChild(this.el);
    return this.el;
  }

  close() {
    this.el?.remove();
    this.el = null;
  }

  get isOpen() {
    return !!this.el;
  }

  // ---------------------------------------------------------------- settings
  settings(back) {
    const { save, audio } = this.c;
    const st = save.settings;
    const vol = (k) => Math.round((audio.bgm && k === 'bgm' ? audio.bgm.volume : audio.sfx.volume) * 100);
    const el = this.open(`
      <div class="mhead"><b>SETTINGS</b></div>
      <div class="mbody">
        <label class="row"><span>MUSIC</span><input type="range" min="0" max="100" value="${vol('bgm')}" data-s="bgm"></label>
        <label class="row"><span>SOUND FX</span><input type="range" min="0" max="100" value="${vol('sfx')}" data-s="sfx"></label>
        <div class="row"><span>DIFFICULTY</span><div class="seg" data-s="difficulty">${Object.entries(DIFFICULTY).map(([k, d]) => `<button class="live ${save.difficulty === k ? 'on' : ''}" data-v="${k}">${d.name}</button>`).join('')}</div></div>
        <div class="row"><span>TEXT SIZE</span><div class="seg" data-s="textSize">${[[0.9, 'S'], [1, 'M'], [1.2, 'L'], [1.4, 'XL']].map(([v, l]) => `<button class="live ${st.textSize === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div></div>
        <div class="row"><span>GAME SPEED</span><div class="seg" data-s="speed">${[1, 2].map((v) => `<button class="live ${st.speed === v ? 'on' : ''}" data-v="${v}">${v}×</button>`).join('')}</div></div>
        <label class="row"><span>COLOUR-BLIND PALETTE</span><input type="checkbox" data-s="colorblind" ${st.colorblind ? 'checked' : ''}></label>
        <label class="row"><span>REDUCE MOTION</span><input type="checkbox" data-s="reduceMotion" ${st.reduceMotion ? 'checked' : ''}></label>
        <p class="note">Difficulty applies from the next stage. Story: more Treasure HP and ¥, softer Shadows. Hard: the opposite.</p>
      </div>
      <button class="startbtn live mback"><span>BACK</span></button>`);
    for (const r of el.querySelectorAll('input[type=range]')) {
      r.addEventListener('input', () => audio.setVolume(r.dataset.s, Number(r.value) / 100));
    }
    for (const seg of el.querySelectorAll('.seg')) {
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        for (const x of seg.children) x.classList.toggle('on', x === b);
        const k = seg.dataset.s;
        if (k === 'difficulty') save.difficulty = b.dataset.v;
        else st[k] = Number(b.dataset.v);
        this.c.writeSave(save);
        this.c.onSettings();
      });
    }
    for (const cb of el.querySelectorAll('input[type=checkbox]')) {
      cb.addEventListener('change', () => {
        st[cb.dataset.s] = cb.checked;
        this.c.writeSave(save);
        this.c.onSettings();
      });
    }
    el.querySelector('.mback').addEventListener('click', () => back());
  }

  // ---------------------------------------------------------------- pause
  pause() {
    const el = this.open(`
      <div class="logo"><div class="a">PAUSED</div></div>
      <div class="mlist">
        <button class="startbtn live" data-m="resume"><span>RESUME</span></button>
        ${this.c.canRetry() ? '<button class="startbtn live" data-m="retry"><span>FROM THE TOP</span></button>' : ''}
        <button class="startbtn live" data-m="settings"><span>SETTINGS</span></button>
        <button class="startbtn live" data-m="title"><span>TITLE</span></button>
      </div>`, 'paused');
    el.addEventListener('click', (e) => {
      const m = e.target.closest('[data-m]')?.dataset.m;
      if (m === 'resume') { this.close(); this.c.resume(); }
      else if (m === 'retry') { this.close(); this.c.retry(); }
      else if (m === 'settings') this.settings(() => this.pause());
      else if (m === 'title') { this.close(); this.c.title(); }
    });
  }

  // ---------------------------------------------------------------- playbill
  /** Every stage reached so far: replay it (stars kept at your best) or rewatch its scene. */
  playbill(back) {
    const { save } = this.c;
    const top = save.finished ? CAMPAIGN.length - 1 : save.best;
    const acts = ACTS.map(([a, b, name]) => {
      const rows = CAMPAIGN.slice(a, b + 1).map((ch, k) => {
        const i = a + k;
        const open = i <= top;
        const stars = save.stars[ch.id] ?? 0;
        return `<div class="pb-row ${open ? '' : 'locked'}">
          <span class="pl">${ch.label}</span><span class="pt">${open ? ch.title.toUpperCase() : '· · ·'}</span>
          <span class="ps">${open ? starStr(stars) : ''}</span>
          ${open ? `<button class="live" data-play="${i}">PLAY</button>${SCENES[ch.id] && save.seen.includes(ch.id) ? `<button class="live ghost" data-scene="${ch.id}">SCENE</button>` : ''}` : ''}
        </div>`;
      }).join('');
      return `<div class="pb-act"><h4>${name}</h4>${rows}</div>`;
    }).join('');
    const total = Object.values(save.stars).reduce((x, y) => x + y, 0);
    const el = this.open(`
      <div class="mhead"><b>PLAYBILL</b><small>${total} / ${CAMPAIGN.length * 3} ★</small></div>
      <div class="mbody pb">${acts}${save.finished ? '<div class="pb-row"><span class="pl">ENDING</span><span class="pt">THE SHOW\'S OVER</span><span class="ps"></span><button class="live ghost" data-scene="ending">SCENE</button></div>' : ''}</div>
      <button class="startbtn live mback"><span>BACK</span></button>`, 'wide');
    el.addEventListener('click', async (e) => {
      const p = e.target.closest('[data-play]');
      const sc = e.target.closest('[data-scene]');
      if (p) { this.close(); this.c.startStage(Number(p.dataset.play)); }
      else if (sc) {
        el.style.display = 'none';
        await this.c.playScene(SCENES[sc.dataset.scene], sc.dataset.scene);
        el.style.display = '';
      } else if (e.target.closest('.mback')) back();
    });
  }

  // ---------------------------------------------------------------- green room
  /** Bond scenes (paid in stars) and the Persona loadout. */
  greenRoom(back) {
    const { save } = this.c;
    const pts = bondPoints(save, BOND_COST);
    const reached = save.finished ? CAMPAIGN.length : save.best;
    const cards = Object.keys(UNITS).map((id) => {
      const def = UNITS[id];
      const b = BOND_SCENES[id];
      const met = reached >= b.after;
      const lvl = save.bonds[id] ?? 0;
      if (!met) return `<div class="gr-card locked"><b>???</b><small>Not in the cast yet</small></div>`;
      const nextOpen = lvl < 2 && (lvl === 0 || reached >= b.after2);
      const cost = BOND_COST[lvl];
      const loadB = save.loadout[id] === 'B';
      const alt = def.personaAlt;
      return `<div class="gr-card accent-${id}">
        <div class="gr-top"><b>${def.name}</b><span class="bond">${'♥'.repeat(lvl)}${'♡'.repeat(2 - lvl)}</span></div>
        <div class="gr-perk ${lvl >= 1 ? 'on' : ''}"><i>PERK</i> ${BONDS[id].perk.name}: ${BONDS[id].perk.blurb}</div>
        <div class="gr-skills">
          <button class="live ${!loadB ? 'on' : ''}" data-load="${id}:A">${def.persona.skill}</button>
          <button class="live ${loadB ? 'on' : ''} ${lvl >= 2 ? '' : 'lockd'}" data-load="${id}:B" ${lvl >= 2 ? '' : 'disabled'}>${lvl >= 2 ? alt.skill : '🔒 BOND 2'}</button>
        </div>
        ${lvl < 2 ? `<button class="live gr-watch ${nextOpen && pts >= cost ? '' : 'poor'}" data-bond="${id}" ${nextOpen ? '' : 'disabled'}>${nextOpen ? `SCENE · ${b.title[lvl]} · ${cost}★` : 'LATER IN THE STORY'}</button>` : `<button class="live gr-watch ghost" data-rewatch="${id}">REWATCH SCENES</button>`}
      </div>`;
    }).join('');
    const el = this.open(`
      <div class="mhead"><b>THE GREEN ROOM</b><small>${pts} ★ TO SPEND</small></div>
      <p class="note">Stars from the Playbill pay for time with the cast. Bond 1 unlocks a perk; bond 2 a second Persona skill to pick before each stage.</p>
      <div class="mbody gr">${cards}</div>
      <button class="startbtn live mback"><span>BACK</span></button>`, 'wide');
    el.addEventListener('click', async (e) => {
      const ld = e.target.closest('[data-load]');
      const bd = e.target.closest('[data-bond]');
      const rw = e.target.closest('[data-rewatch]');
      if (ld && !ld.disabled) {
        const [id, v] = ld.dataset.load.split(':');
        save.loadout[id] = v;
        this.c.writeSave(save);
        this.greenRoom(back);
      } else if (bd && !bd.disabled) {
        const id = bd.dataset.bond;
        const lvl = save.bonds[id] ?? 0;
        if (bondPoints(save, BOND_COST) < BOND_COST[lvl]) return;
        el.style.display = 'none';
        await this.c.playScene(BOND_SCENES[id].scenes[lvl], `bond-${id}-${lvl}`);
        save.bonds[id] = lvl + 1;
        if (lvl + 1 >= 2) save.loadout[id] = 'B';
        this.c.writeSave(save);
        this.greenRoom(back);
      } else if (rw) {
        el.style.display = 'none';
        for (const sc of BOND_SCENES[rw.dataset.rewatch].scenes) await this.c.playScene(sc, null);
        el.style.display = '';
      } else if (e.target.closest('.mback')) back();
    });
  }

  // ---------------------------------------------------------------- rehearsal
  rehearsal(back, { unlockAll = false } = {}) {
    const { save } = this.c;
    const top = unlockAll || save.finished ? 5 : Math.max(1, Math.min(5, 1 + Math.floor(save.best / 3)));
    const lanes = ['', '1 LANE', '2 LANES', '2 LANES', '3 LANES', '3 LANES · BOSS'];
    const d = dailySpec();
    const doneToday = save.daily?.day === d.day ? save.daily.stars : 0;
    const el = this.open(`
      <div class="logo"><div class="a">REHEARSAL</div><div class="b">A NEW STAGE EVERY TIME</div></div>
      <div class="tierpick">${[1, 2, 3, 4, 5].map((t) => `<button class="live" data-t="${t}" ${t > top ? 'disabled style="opacity:.35"' : ''}>TIER ${ROMAN[t]}<small>${lanes[t]}</small></button>`).join('')}</div>
      <div class="daily">
        <b>TODAY'S STAGE · TIER ${ROMAN[d.tier]}</b>
        <span>${d.modifiers.map((m) => `<i title="${MODIFIERS[m].blurb}">${MODIFIERS[m].name}</i>`).join(' + ')}</span>
        <small>${d.modifiers.map((m) => MODIFIERS[m].blurb).join(' ')}</small>
        <button class="live" data-daily="1">${doneToday ? `BEST ${starStr(doneToday)} · AGAIN` : 'PLAY TODAY\'S STAGE'}</button>
      </div>
      <button class="startbtn live mback"><span>BACK</span></button>`);
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-t]');
      if (t && !t.disabled) { this.close(); this.c.startRehearsal({ tier: Number(t.dataset.t), seed: 1 + Math.floor(Math.random() * 99999) }); }
      else if (e.target.closest('[data-daily]')) { this.close(); this.c.startRehearsal({ ...d, daily: true }); }
      else if (e.target.closest('.mback')) back();
    });
  }
}
