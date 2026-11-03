// Lesson runner for src/story/lessons.js: a Prompter "coach" bubble, a spotlight on the HUD element
// or board unit to use, and an optional hold that freezes the simulation until the player acts.
import * as THREE from 'three';
import { LESSONS } from '../story/lessons.js';

const $ = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

export class Tutor {
  /**
   * opts: { ctx() -> { game, state }, avatar(revealed) -> url, revealed() -> bool, world(unit) ->
   * THREE.Vector3 of a unit's figure, onDone(chapterId) }
   */
  constructor(root, camera, opts) {
    this.root = root;
    this.camera = camera;
    this.o = opts;
    this.steps = [];
    this.i = 0;
    this.chapter = null;
    this.seen = new Set();
    this.shown = false;
    this.coach = $(`<div class="coach" style="display:none" aria-live="polite"><img alt=""><div><b>PROMPTER</b><p></p></div></div>`);
    this.marker = $('<div class="tut-marker" style="display:none"><i></i></div>');
    root.appendChild(this.marker);
    root.appendChild(this.coach);
    this.focused = null;
    this._v = new THREE.Vector3();
  }

  /** Start the lessons for a chapter (no-op if there are none or they were already completed). */
  begin(chapterId, done = false) {
    this.clear();
    this.chapter = chapterId;
    this.steps = done ? [] : (LESSONS[chapterId] ?? []);
    this.i = 0;
  }

  clear() {
    this.steps = [];
    this.i = 0;
    this.hide();
  }

  get active() {
    return this.i < this.steps.length;
  }

  /** The simulation should stand still while a holding step is on screen. */
  get hold() {
    const s = this.steps[this.i];
    return !!(s && s.hold && this.shown);
  }

  onEvent(ev) {
    if (!this.active) return;
    this.seen.add(ev.t);
    if (ev.t === 'hit' && ev.weak) this.seen.add('weak');
  }

  ctx() {
    return { ...this.o.ctx(), seen: this.seen };
  }

  update() {
    if (!this.active) return;
    const s = this.steps[this.i];
    const c = this.ctx();
    if (!this.shown) {
      if (s.when && !s.when(c)) return;
      this.seen = new Set();
      s.setup?.(c);
      this.show(s);
      return;
    }
    const doneNow = s.ms ? performance.now() - this.t0 >= s.ms : s.until?.(c);
    if (doneNow) {
      this.hide();
      this.i++;
      if (!this.active) this.o.onDone?.(this.chapter);
      return;
    }
    this.place(s);
  }

  show(s) {
    this.shown = true;
    this.t0 = performance.now();
    const img = this.coach.querySelector('img');
    const src = this.o.avatar(this.o.revealed());
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    this.coach.querySelector('b').textContent = this.o.revealed() ? 'PROMPTER' : 'PROMPTER (OFFSTAGE)';
    this.coach.querySelector('p').textContent = s.text;
    this.coach.style.display = '';
    this.coach.classList.remove('pop');
    void this.coach.offsetWidth;
    this.coach.classList.add('pop');
    this.coach.classList.toggle('hold', !!s.hold);
    this.place(s);
  }

  hide() {
    this.shown = false;
    this.coach.style.display = 'none';
    this.marker.style.display = 'none';
    this.focused?.classList.remove('tut-focus');
    this.focused = null;
  }

  /** Keep the spotlight on its target (HUD element or a unit on the board). */
  place(s) {
    const f = s.focus;
    if (f?.sel) {
      const el = document.querySelector(f.sel);
      if (el !== this.focused) {
        this.focused?.classList.remove('tut-focus');
        this.focused = el;
        el?.classList.add('tut-focus');
      }
    }
    if (f?.unit) {
      const { game } = this.o.ctx();
      const u = f.unit === 'baton-target'
        ? game.units.find((x) => game.baton && x !== game.baton.from)
        : game.onStage(f.unit);
      const p = u && this.o.world(u);
      if (p) {
        const v = this._v.copy(p).project(this.camera);
        this.marker.style.display = v.z < 1 ? '' : 'none';
        this.marker.style.transform = `translate3d(${(((v.x + 1) / 2) * innerWidth).toFixed(1)}px, ${(((1 - v.y) / 2) * innerHeight).toFixed(1)}px, 0)`;
      } else this.marker.style.display = 'none';
    } else this.marker.style.display = 'none';
  }
}
