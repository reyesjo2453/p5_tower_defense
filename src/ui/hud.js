// DOM HUD + comic overlays. Pure presentation: the main loop calls update() every frame and the
// cut-in methods return Promises so the game can freeze while they play.
import { UNITS } from '../sim/data.js';
import { burstClip, starURL, splatterURL, speedlinesURL, tornClip, tornClipV, rng } from './comic.js';

const $ = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// jagged comic-card outline shared by the deploy cards (white frame + inset ink face)
const JAG = 'polygon(0% 4%, 9% 0%, 21% 3%, 37% 0%, 55% 3%, 71% 0%, 88% 2%, 100% 0%, 97% 18%, 100% 37%, 96% 58%, 100% 79%, 98% 100%, 83% 96%, 66% 100%, 47% 97%, 30% 100%, 13% 96%, 0% 100%, 3% 80%, 0% 60%, 4% 39%, 0% 20%)';
const BURST = burstClip(12, 0.64, 9);
// speaker glyph for the mute toggle (the waves hide and a slash shows when muted, via CSS)
const SPEAKER = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/><path class="wv" d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path class="x" d="M15 9l6 6M21 9l-6 6" stroke="#e8002d" stroke-width="2.8" stroke-linecap="round"/></svg>';
// one-time generated comic textures
const TEX = {
  speedOne: speedlinesURL({ w: 900, h: 220, fx: 0.24, fy: 0.55, n: 90, seed: 11 }),
  speedDeploy: speedlinesURL({ w: 900, h: 200, fx: 0.18, fy: 0.5, n: 80, accent: '#ffe600', seed: 14 }),
  tornDeploy: tornClip(21, 6, 30),
  speedPanel: speedlinesURL({ w: 300, h: 700, fx: 0.5, fy: 0.42, n: 64, ink: '#050505', accent: '#fff', seed: 12, inner: 0.12 }),
  speedPanelK: speedlinesURL({ w: 300, h: 700, fx: 0.5, fy: 0.42, n: 64, ink: '#e8002d', accent: '#fff', seed: 13, inner: 0.12 }),
  speedSplash: speedlinesURL({ w: 1000, h: 700, fx: 0.3, fy: 0.55, n: 120, ink: '#050505', accent: '#fff', seed: 14, inner: 0.1 }),
  torn: tornClip(21, 9, 40),
  tornBack: tornClip(22, 5, 40),
  tornV: [0, 1, 2].map((i) => tornClipV(31 + i, 7, 24)),
  stars: [0, 1, 2, 3, 4].map((i) => starURL(40 + i, i % 2 ? ['#fff', '#ffe600'] : ['#ffe600', '#fff'])),
  inkK: [0, 1, 2].map((i) => splatterURL('#050505', 50 + i)),
  inkR: [0, 1].map((i) => splatterURL('#a8001f', 60 + i)),
};

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
        <div class="chip cash"><span><i class="yen" style="clip-path:${BURST}">¥</i><b data-k="cash">0</b></span></div>
        <button class="iconbtn live" data-act="speed"><span>1×</span></button>
        <button class="iconbtn live" data-act="pause"><span>❚❚</span></button>
        <button class="iconbtn live mute" data-act="mute" aria-label="Mute audio" aria-pressed="false"><span>${SPEAKER}</span></button>
      </div>
    </div>`);
    r.appendChild(this.top);
    this.deck = $('<div class="deck"></div>');
    for (const def of Object.values(UNITS)) {
      const c = $(`<button class="card accent-${def.id}" data-unit="${def.id}">
        <span class="frame" style="clip-path:${JAG}"></span>
        <span class="face" style="clip-path:${JAG}">${this.portraits.card[def.id] ? `<img alt="" src="${this.portraits.card[def.id]}">` : ''}<i class="shade"></i></span>
        <span class="meta"><span class="row"><span class="role">${def.role.toUpperCase()}</span><span class="cost"><small>¥</small>${def.cost}</span></span><span class="nm">${def.name.toUpperCase()}</span></span>
      </button>`);
      c.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.h.cardDown(def.id, e);
      });
      this.deck.appendChild(c);
    }
    r.appendChild(this.deck);
    this.panel = $(`<div class="unitpanel"><img class="pv" alt="" data-k="pimg"><h3 data-k="pname">UNIT</h3><p data-k="pdesc"></p>
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
    const pv = this.q('pimg');
    const src = this.portraits.card[u.type] || '';
    if (pv.getAttribute('src') !== src) pv.setAttribute('src', src);
    pv.style.display = src ? '' : 'none';
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

  /** Reflect the audio mute state on the top-right toggle. */
  setMuted(m) {
    const b = this.top.querySelector('[data-act="mute"]');
    b.classList.toggle('off', m);
    b.setAttribute('aria-pressed', String(m));
    b.setAttribute('aria-label', m ? 'Unmute audio' : 'Mute audio');
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

  // ---------------------------------------------------------------- deploy cut-in
  /**
   * Fire-and-forget deploy flourish: a diagonal torn band with sliced borders and speedlines, the
   * unit's cut-in art, red/green/yellow confetti and a 150 ms impact shake. Never blocks input;
   * a new deploy replaces one still playing.
   */
  deployCutIn(unitId) {
    const def = UNITS[unitId];
    if (!def) return;
    this.root.querySelector('.deploy')?.remove();
    this.lastDeploy = unitId;
    const R = rng(Date.now() & 0xffff);
    const colors = ['#e8002d', '#39ff88', '#ffe600'];
    let bits = '';
    for (let i = 0; i < 26; i++) {
      const a = (R() - 0.5) * Math.PI * 1.3 - 0.35; // mostly fanning right/up along the band
      const d = 120 + R() * 260;
      const shape = i % 3 === 0 ? 'star' : i % 3 === 1 ? 'dia' : 'chip';
      bits += `<i class="bit ${shape}" style="--c:${colors[i % 3]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d * 0.7}px;--r:${(R() * 720 - 360) | 0}deg;--s:${(0.6 + R() * 0.9).toFixed(2)};animation-delay:${(60 + R() * 90) | 0}ms"></i>`;
    }
    const art = this.portraits.cutin[unitId];
    const el = $(`<div class="deploy accent-${def.id}" data-unit="${def.id}">
      <div class="slices"><i class="s1"></i><i class="s2"></i><i class="s3"></i></div>
      <div class="band" style="clip-path:${TEX.tornDeploy}">
        <div class="lines" style="background-image:url(&quot;${TEX.speedDeploy}&quot;)"></div>
      </div>
      ${art ? `<img class="art" alt="" src="${art}">` : ''}
      <div class="txt"><b>${def.name.toUpperCase()}</b><small>${def.role.toUpperCase()} · DEPLOYED!</small></div>
      <div class="bits">${bits}</div>
    </div>`);
    this.root.appendChild(el);
    this.impact(150);
    setTimeout(() => el.classList.add('out'), 620);
    setTimeout(() => el.remove(), 900);
  }

  /** Short screen bounce on the whole stage (skipped for reduced motion). */
  impact(ms = 150) {
    const stage = this.root.parentElement;
    if (!stage || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stage.classList.remove('impact');
    void stage.offsetWidth; // restart the animation
    stage.style.setProperty('--impact-ms', `${ms}ms`);
    stage.classList.add('impact');
    clearTimeout(this.impactT);
    this.impactT = setTimeout(() => stage.classList.remove('impact'), ms + 20);
  }

  // ---------------------------------------------------------------- 1-MORE screen-slice
  async oneMore(unitId, chain) {
    this.root.querySelector('.onemore')?.remove();
    const el = $(`<div class="onemore">
      <div class="back" style="clip-path:${TEX.tornBack}"></div>
      <div class="band" style="clip-path:${TEX.torn}">
        <div class="ben"></div>
        <div class="lines" style="background-image:url(&quot;${TEX.speedOne}&quot;)"></div>
      </div>
      ${this.portraits.cutin[unitId] ? `<img class="sil" alt="" src="${this.portraits.cutin[unitId]}">` : ''}
      <div class="slash"></div>
      <img class="star" alt="" src="${TEX.stars[0]}">
      <div class="badge">1 MORE!</div>
      <div class="sub">${chain > 1 ? `CHAIN ×${chain} · ` : ''}BATON READY</div>
    </div>`);
    this.root.appendChild(el);
    await wait(900);
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
      ${ids.map((id, i) => `<div class="panel" style="clip-path:${TEX.tornV[i]}"><div class="in" style="clip-path:${TEX.tornV[i]}">
        <div class="sp" style="background-image:url(&quot;${i === 1 ? TEX.speedPanelK : TEX.speedPanel}&quot;)"></div>
        ${this.portraits.cutin[id] ? `<img alt="" src="${this.portraits.cutin[id]}">` : ''}<div class="lbl">${UNITS[id].name.toUpperCase()}</div></div></div>`).join('')}
      <div class="title">ALL-OUT ATTACK</div>
    </div>`);
    this.root.appendChild(el);
    await wait(1600);
    // shatter the frozen frame (comic panels + arena) into shards that fly apart over the splash
    const splash = $(`<div class="splash"><div class="sp" style="background-image:url(&quot;${TEX.speedSplash}&quot;)"></div></div>`);
    splash.appendChild(splashArt(this.portraits.finisher));
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

/** Hero + comic accents for THE SHOW'S OVER: accent cuts, ink, stars, the leader, fluttering cards. */
function splashArt(heroURL) {
  const r = rng(77);
  const art = document.createElement('div');
  art.className = 'art';
  let html = '';
  // bold yellow / white accent cuts slicing across behind everything
  const cuts = [[18, -16, 'y', 22], [34, -18, 'w', 9], [62, -14, 'y', 12], [80, -20, 'w', 26], [90, -15, 'y', 7]];
  cuts.forEach(([top, rot, c, hgt], i) => {
    html += `<i class="cut ${c}" style="top:${top}%;height:${hgt}px;transform:rotate(${rot}deg);animation-delay:${0.05 + i * 0.06}s"></i>`;
  });
  // ink splatters
  const inks = [[6, 8, 'K', 0, 34], [70, 70, 'K', 1, 30], [44, 2, 'R', 0, 26], [84, 6, 'K', 2, 22], [20, 72, 'R', 1, 28], [56, 40, 'K', 0, 14]];
  inks.forEach(([x, y, k, n, sz], i) => {
    const src = k === 'K' ? TEX.inkK[n] : TEX.inkR[n];
    html += `<img class="ink" alt="" src="${src}" style="left:${x}%;top:${y}%;width:${sz}vmin;animation-delay:${0.1 + i * 0.05}s;--r:${Math.floor(r() * 360)}deg">`;
  });
  // the hero
  if (heroURL) html += `<img class="hero" alt="" src="${heroURL}">`;
  // exploding comic stars around the title and the hero
  const stars = [[52, 18, 26, 0], [86, 58, 22, 1], [30, 62, 16, 2], [62, 76, 18, 3], [12, 28, 13, 4], [94, 22, 12, 1]];
  stars.forEach(([x, y, sz, n], i) => {
    html += `<img class="star" alt="" src="${TEX.stars[n]}" style="left:${x}%;top:${y}%;width:${sz}vmin;animation-delay:${0.15 + i * 0.07}s;--r:${Math.floor(r() * 60 - 30)}deg">`;
  });
  // fluttering black-and-red calling cards
  for (let i = 0; i < 18; i++) {
    const red = i % 3 === 0;
    html += `<i class="ccard${red ? ' red' : ''}" style="left:${(r() * 100).toFixed(1)}%;--d:${(1.6 + r() * 1.6).toFixed(2)}s;--dl:${(r() * 0.9).toFixed(2)}s;--sx:${(r() * 160 - 80).toFixed(0)}px;--rz:${(r() * 720 - 360).toFixed(0)}deg;--s:${(0.7 + r() * 0.7).toFixed(2)}"></i>`;
  }
  art.innerHTML = html;
  return art;
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
