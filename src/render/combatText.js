// Floating combat text over the 3D board (DOM, projected each frame):
//   damage(p, amount, kind, opts)  bold number that pops up with an elastic bounce, arcs outward and
//                                  fades over 650 ms. kind: 'physical' (yellow/white), 'magic'
//                                  (orange/red), 'heal' (green).
//   callout(p, text)               comic badge ("WEAK!", "CRITICAL!") with an ink border and a pop-in punch.
// Pooled and capped so a crowded wave can't flood the DOM on a phone.
import * as THREE from 'three';

export const DAMAGE_T = 0.65;
const CALLOUT_T = 0.8;
const MAX = 36;

// elastic ease-out (overshoots, rings, settles at 1)
const elastic = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);
const easeOut = (k) => 1 - (1 - k) * (1 - k);

export class CombatText {
  constructor(root, camera) {
    this.camera = camera;
    this.layer = document.createElement('div');
    this.layer.className = 'ctext';
    root.appendChild(this.layer);
    this.items = [];
    this.count = { damage: 0, callout: 0 };
    this._v = new THREE.Vector3();
  }

  spawn(cls, html, p, life, extra) {
    if (this.items.length >= MAX) this.kill(this.items[0]);
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = html;
    this.layer.appendChild(el);
    const it = { el, p: p.clone(), t: 0, life, ...extra };
    this.items.push(it);
    this.place(it);
    return it;
  }

  /** Damage / heal number. `crit` makes it bigger and adds a jolt. */
  damage(p, amount, kind = 'physical', { crit = false } = {}) {
    const n = Math.max(1, Math.round(amount));
    const big = crit || n >= 200;
    const side = Math.random() < 0.5 ? -1 : 1;
    this.count.damage++;
    return this.spawn(`dmg ${kind}${big ? ' big' : ''}`, kind === 'heal' ? `+${n}` : String(n), p, DAMAGE_T, {
      kind: 'damage', dx: side * (14 + Math.random() * 22), rise: 46 + Math.random() * 14, size: big ? 1.35 : 1,
    });
  }

  callout(p, text) {
    this.count.callout++;
    const cls = text.startsWith('CRIT') ? 'callout crit' : 'callout weak';
    return this.spawn(cls, `<span>${text}</span>`, p, CALLOUT_T, { kind: 'callout', dx: 0, rise: 34, size: 1 });
  }

  kill(it) {
    it.el.remove();
    const i = this.items.indexOf(it);
    if (i >= 0) this.items.splice(i, 1);
  }

  clear() {
    for (const it of [...this.items]) this.kill(it);
  }

  /** Project + animate. Called every frame with the world dt (so hit-stop / bullet-time apply). */
  update(dt) {
    for (const it of [...this.items]) {
      it.t += dt;
      if (it.t >= it.life) {
        this.kill(it);
        continue;
      }
      this.place(it);
    }
  }

  place(it) {
    const v = this._v.copy(it.p).project(this.camera);
    if (v.z > 1) {
      it.el.style.opacity = '0';
      return;
    }
    const w = this.layer.clientWidth || innerWidth;
    const h = this.layer.clientHeight || innerHeight;
    const k = it.t / it.life;
    let x = ((v.x + 1) / 2) * w;
    let y = ((1 - v.y) / 2) * h;
    let s, o;
    if (it.kind === 'damage') {
      // pop upward on an elastic curve, drift outward in a slight arc, fade out over the last 40%
      x += it.dx * easeOut(k);
      y -= it.rise * elastic(Math.min(1, k * 1.5)) - k * k * 10; // starts falling back a touch at the end
      s = it.size * (k < 0.12 ? 0.5 + (k / 0.12) * 0.85 : 1.35 - 0.35 * Math.min(1, (k - 0.12) / 0.18));
      o = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    } else {
      // badge: punch in big, snap to size, hang, then lift and fade
      y -= it.rise + k * 16;
      s = k < 0.1 ? 1.8 - (k / 0.1) * 0.95 : k < 0.2 ? 0.85 + ((k - 0.1) / 0.1) * 0.15 : 1;
      o = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }
    it.el.style.opacity = String(Math.max(0, o));
    it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${s.toFixed(3)})`;
  }
}
