// DOM HUD + comic overlays. Pure presentation: the main loop calls update() every frame and the
// cut-in methods return Promises so the game can freeze while they play.
import { UNITS } from '../sim/data.js';

const $ = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Hud {
  constructor(root, portraits, handlers) {
    this.root = root;
    this.portraits = portraits;
    this.h = handlers;
    this.selectedCard = null;
    this.build();
  }

  build() {
    const r = this.root;
    r.innerHTML = '';
    this.top = $(`<div class="hud-top">
      <div class="hud-left">
        <div class="chip red"><span>WAVE <b data-k="wave">0</b>/<span data-k="waves">0</span></span></div>
        <div class="chip treasure"><span><span class="ico">♛</span> <span class="lbl">TREASURE</span></span><div class="tbar"><i data-k="tbar" style="width:100%"></i></div></div>
      </div>
      <div class="hud-right">
        <div class="chip"><span>¥ <b data-k="cash">0</b></span></div>
        <button class="iconbtn live" data-act="speed"><span>1×</span></button>
        <button class="iconbtn live" data-act="pause"><span>❚❚</span></button>
      </div>
    </div>`);
    r.appendChild(this.top);
    this.deck = $('<div class="deck"></div>');
    for (const def of Object.values(UNITS)) {
      const c = $(`<button class="card accent-${def.id}" data-unit="${def.id}">
        ${this.portraits[def.id] ? `<img alt="" src="${this.portraits[def.id]}">` : ''}
        <span class="nm">${def.name}</span><span class="role">${def.role.toUpperCase()}</span><span class="cost">${def.cost}</span>
      </button>`);
      c.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.h.cardDown(def.id, e);
      });
      this.deck.appendChild(c);
    }
    r.appendChild(this.deck);
    this.panel = $(`<div class="unitpanel"><h3 data-k="pname">UNIT</h3><p data-k="pdesc"></p>
      <button class="live baton" data-act="baton">BATON PASS ▶</button><button class="live" data-act="sell">SELL</button><button class="live" data-act="close">✕</button></div>`);
    r.appendChild(this.panel);
    this.hintEl = $('<div class="hint" style="display:none"></div>');
    r.appendChild(this.hintEl);
    r.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act) this.h.action(act);
    });
    this.allOutBtn = null;
  }

  q(k) {
    return this.root.querySelector(`[data-k="${k}"]`);
  }

  setSelectedCard(id) {
    this.selectedCard = id;
    for (const c of this.deck.children) c.classList.toggle('sel', c.dataset.unit === id);
  }

  showUnit(u, canBaton) {
    if (!u) {
      this.panel.classList.remove('show');
      return;
    }
    this.q('pname').textContent = `${u.def.name} · ${u.def.role.toUpperCase()}`;
    this.q('pdesc').textContent = u.def.blurb;
    this.panel.querySelector('[data-act="baton"]').style.display = canBaton ? '' : 'none';
    this.panel.querySelector('[data-act="sell"]').textContent = `SELL +${Math.floor(u.def.cost / 2)}`;
    this.panel.classList.add('show');
  }

  hint(text, ms = 3200) {
    clearTimeout(this.hintT);
    this.hintEl.textContent = text;
    this.hintEl.style.display = text ? '' : 'none';
    if (text && ms) this.hintT = setTimeout(() => (this.hintEl.style.display = 'none'), ms);
  }

  setSpeed(s) {
    this.top.querySelector('[data-act="speed"] span').textContent = `${s}×`;
  }

  setPaused(p) {
    this.top.querySelector('[data-act="pause"] span').textContent = p ? '▶' : '❚❚';
  }

  update(game) {
    this.q('wave').textContent = Math.max(0, game.waveIdx + 1);
    this.q('waves').textContent = game.waves.length;
    this.q('cash').textContent = Math.floor(game.cash);
    this.q('tbar').style.width = `${(game.treasure / game.rules.treasureHp) * 100}%`;
    for (const c of this.deck.children) c.classList.toggle('poor', game.cash < UNITS[c.dataset.unit].cost);
    const ready = game.allOutReady && !this.suppress;
    if (ready && !this.allOutBtn) {
      this.allOutBtn = $('<button class="allout-btn live" data-act="allout"><span><small>TAP · FINISHER</small>ALL-OUT ATTACK</span></button>');
      this.root.appendChild(this.allOutBtn);
    } else if (!ready && this.allOutBtn) {
      this.allOutBtn.remove();
      this.allOutBtn = null;
    }
  }

  centerMsg(text, ms = 1400) {
    const el = $(`<div class="center-msg">${text}</div>`);
    this.root.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  startButton(label, onTap) {
    const b = $(`<button class="startbtn live"><span>${label}</span></button>`);
    b.addEventListener('click', () => {
      b.remove();
      onTap();
    });
    this.root.appendChild(b);
    return b;
  }

  // ---------------------------------------------------------------- 1-MORE screen-slice
  async oneMore(unitId, chain) {
    this.root.querySelector('.onemore')?.remove();
    const el = $(`<div class="onemore">
      <div class="border"></div><div class="band"></div><div class="lines"></div>
      ${this.portraits[unitId] ? `<img class="sil" alt="" src="${this.portraits[unitId]}">` : ''}
      <div class="slash"></div>
      <div class="badge">1-MORE!</div>
      <div class="sub">${chain > 1 ? `CHAIN ×${chain} · ` : ''}BATON READY</div>
    </div>`);
    this.root.appendChild(el);
    await wait(850);
    el.classList.add('out');
    await wait(350);
    el.remove();
  }

  // ---------------------------------------------------------------- ALL-OUT ATTACK
  /**
   * Plays the finisher. `freezeFrame` is an image (canvas) of the arena at the moment of the tap;
   * `impact` is called at the shatter moment (apply damage, rain calling cards).
   */
  async allOut(freezeFrame, fx2d, impact) {
    this.suppress = true;
    this.allOutBtn?.remove();
    this.allOutBtn = null;
    const ids = ['jester', 'queen', 'oracle'];
    const el = $(`<div class="allout">
      ${ids.map((id) => `<div class="panel">${this.portraits[id] ? `<img alt="" src="${this.portraits[id]}">` : ''}<div class="lbl">${UNITS[id].name}</div></div>`).join('')}
      <div class="title">ALL-OUT ATTACK</div>
    </div>`);
    this.root.appendChild(el);
    await wait(1600);
    // shatter the frozen frame (comic panels + arena) into shards that fly apart over the splash
    const splash = $(`<div class="splash"></div>`);
    const words = "THE SHOW'S OVER".split(' ');
    const ransom = $('<div class="ransom"></div>');
    let n = 0;
    for (const w of words) {
      const wd = $('<div class="w"></div>');
      for (const ch of w) {
        const f = (n * 7 + ch.charCodeAt(0)) % 5;
        const rot = ((n * 37) % 15) - 7;
        const s = $(`<span class="f${f}" style="transform:rotate(${rot}deg);animation-delay:${0.25 + n * 0.05}s">${ch}</span>`);
        wd.appendChild(s);
        n++;
      }
      ransom.appendChild(wd);
    }
    splash.appendChild(ransom);
    const snap = snapshot(freezeFrame, el);
    el.remove();
    this.root.appendChild(splash);
    impact();
    await shatter(fx2d, snap, 900);
    await wait(1300);
    splash.style.transition = 'opacity .35s, transform .35s';
    splash.style.opacity = '0';
    splash.style.transform = 'scale(1.1) rotate(-3deg)';
    await wait(380);
    splash.remove();
    this.suppress = false;
  }

  overlay(html) {
    this.root.querySelector('.overlay')?.remove();
    const el = $(`<div class="overlay">${html}</div>`);
    this.root.appendChild(el);
    return el;
  }
}

/** Draw the frozen arena plus a crude red/black panel impression into one canvas. */
function snapshot(freezeFrame, panelsEl) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w / 2);
  c.height = Math.ceil(h / 2);
  const g = c.getContext('2d');
  g.scale(0.5, 0.5);
  if (freezeFrame) g.drawImage(freezeFrame, 0, 0, w, h);
  // echo the three skewed comic panels on top of the frame so they shatter too
  const cols = ['#e8002d', '#050505', '#e8002d'];
  for (let i = 0; i < 3; i++) {
    g.save();
    g.translate(w * (-0.06 + i * 0.36), 0);
    g.transform(1, 0, -0.21, 1, 0, 0);
    g.fillStyle = cols[i];
    g.fillRect(0, -h * 0.1, w * 0.4, h * 1.2);
    g.strokeStyle = '#fff';
    g.lineWidth = 6;
    g.strokeRect(0, -h * 0.1, w * 0.4, h * 1.2);
    g.restore();
  }
  for (const img of panelsEl.querySelectorAll('img')) {
    const r = img.getBoundingClientRect();
    try { g.drawImage(img, r.left, r.top, r.width, r.height); } catch { /* not decoded yet */ }
  }
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate(-0.17);
  g.font = `${Math.min(130, w * 0.11)}px Anton, Impact, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = '#000';
  g.strokeText('ALL-OUT ATTACK', 0, 0);
  g.fillStyle = '#fff';
  g.fillText('ALL-OUT ATTACK', 0, 0);
  g.restore();
  return c;
}

/** Glass-shatter: cut the snapshot into triangles that spin and fall away. */
function shatter(canvas, snap, ms) {
  return new Promise((resolve) => {
    const w = (canvas.width = window.innerWidth);
    const h = (canvas.height = window.innerHeight);
    const g = canvas.getContext('2d');
    const cx = w * 0.5;
    const cy = h * 0.5;
    const pieces = [];
    const rings = [0, 0.16, 0.42, 0.85, 1.4];
    const spokes = 9;
    const pt = (ri, si) => {
      const a = (si / spokes) * Math.PI * 2 + (ri % 2) * 0.2 + Math.sin(si * 7.1 + ri) * 0.12;
      const r = rings[ri] * Math.max(w, h) * (1 + Math.sin(si * 3.3 + ri * 5) * 0.08);
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };
    for (let ri = 0; ri < rings.length - 1; ri++) {
      for (let si = 0; si < spokes; si++) {
        const a = pt(ri, si);
        const b = pt(ri, si + 1);
        const c = pt(ri + 1, si);
        const d = pt(ri + 1, si + 1);
        for (const tri of [[a, b, c], [b, d, c]]) {
          const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
          const my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
          const dx = mx - cx;
          const dy = my - cy;
          const len = Math.hypot(dx, dy) || 1;
          const sp = 500 + Math.random() * 900;
          pieces.push({ tri, mx, my, vx: (dx / len) * sp, vy: (dy / len) * sp - 200, vr: (Math.random() - 0.5) * 8, delay: (len / Math.max(w, h)) * 0.18 });
        }
      }
    }
    const t0 = performance.now();
    const frame = (now) => {
      const t = (now - t0) / 1000;
      g.clearRect(0, 0, w, h);
      for (const p of pieces) {
        const tt = Math.max(0, t - p.delay);
        const ox = p.vx * tt;
        const oy = p.vy * tt + 1400 * tt * tt;
        g.save();
        g.translate(p.mx + ox, p.my + oy);
        g.rotate(p.vr * tt);
        g.translate(-p.mx, -p.my);
        g.beginPath();
        g.moveTo(p.tri[0][0], p.tri[0][1]);
        g.lineTo(p.tri[1][0], p.tri[1][1]);
        g.lineTo(p.tri[2][0], p.tri[2][1]);
        g.closePath();
        g.save();
        g.clip();
        g.drawImage(snap, 0, 0, w, h);
        g.restore();
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = 2;
        g.stroke();
        g.restore();
      }
      if (t * 1000 < ms) requestAnimationFrame(frame);
      else {
        g.clearRect(0, 0, w, h);
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}
