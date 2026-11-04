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
        <div class="chip red act"><span><b data-k="act">PROLOGUE</b><small data-k="ctitle"></small></span></div>
        <div class="chip perf" data-k="perfchip" style="display:none"><span>PERF <b>#<i data-k="perf">46</i></b></span></div>
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
      const c = $(`<button class="card locked accent-${def.id}" data-unit="${def.id}">
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
    // shared SP gauge + one Persona button per Phantom on stage (hidden until summons unlock)
    this.spbar = $(`<div class="spbar" style="display:none">
      <div class="sp"><b>SP</b><div class="gauge"><i data-k="spfill"></i><u></u><u></u><u></u></div><small data-k="sptxt">0</small></div>
      <div class="personas" data-k="personas"></div>
    </div>`);
    r.appendChild(this.spbar);
    this.waveChip = $('<div class="wavechip" style="display:none"><span data-k="wavetxt">WAVE 1/3</span><button class="live call" data-act="call">CALL ▶</button></div>');
    r.appendChild(this.waveChip);
    this.panel = $(`<div class="unitpanel"><img class="pv" alt="" data-k="pimg"><h3 data-k="pname">UNIT</h3><div class="pips" data-k="prank"></div><p data-k="pdesc"></p>
      <div class="pbtns"><button class="live baton" data-act="baton">BATON PASS ▶</button><button class="live rank" data-act="rank">RANK UP</button><button class="live move" data-act="move">MOVE</button><button class="live" data-act="sell">SELL</button><button class="live" data-act="close">✕</button></div></div>`);
    r.appendChild(this.panel);
    this.hintEl = $('<div class="hint" style="display:none"></div>');
    r.appendChild(this.hintEl);
    r.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (el) this.h.action(el.dataset.act, el);
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

  showUnit(u, canBaton, game = null) {
    this.panelUnit = u;
    this.panelGame = game;
    if (!u) {
      this.panel.classList.remove('show');
      return;
    }
    this.refreshPanel();
    this.q('pname').textContent = `${u.def.name} · ${u.def.role.toUpperCase()}`;
    const pv = this.q('pimg');
    const src = this.portraits.card[u.type] || '';
    if (pv.getAttribute('src') !== src) pv.setAttribute('src', src);
    pv.style.display = src ? '' : 'none';
    const p = game?.persona?.(u);
    this.q('pdesc').textContent = `${u.def.blurb}${p && game.mech.has('summon') ? ` · PERSONA ${p.name}: ${p.skill} (${p.cost} SP)` : ''}`;
    this.q('pname').textContent = `${u.def.name} · ${u.def.role.toUpperCase()} · ${u.def.elem.toUpperCase()}`;
    this.panel.querySelector('[data-act="baton"]').style.display = canBaton ? '' : 'none';
    this.panel.classList.add('show');
  }

  /** Rank pips, RANK UP cost / availability, MOVE cooldown and the sell refund (called each frame). */
  refreshPanel() {
    const u = this.panelUnit;
    const g = this.panelGame;
    if (!u || !g) return;
    const pips = `${'★'.repeat(u.rank)}${'☆'.repeat(3 - u.rank)}`;
    const pr = this.q('prank');
    if (pr.textContent !== pips) pr.textContent = pips;
    const rb = this.panel.querySelector('[data-act="rank"]');
    const cost = g.rankCost(u);
    rb.style.display = g.mech.has('rank') && u.rank < 3 ? '' : 'none';
    const rl = cost != null ? `RANK UP ¥${cost}` : 'MAX RANK';
    if (rb.textContent !== rl) rb.textContent = rl;
    rb.classList.toggle('poor', cost == null || g.cash < cost);
    const mb = this.panel.querySelector('[data-act="move"]');
    mb.style.display = g.mech.has('blocking') ? '' : 'none';
    const ml = u.moveCd > 0 ? `MOVE ${Math.ceil(u.moveCd)}s` : 'MOVE';
    if (mb.textContent !== ml) mb.textContent = ml;
    mb.classList.toggle('poor', u.moveCd > 0);
    const sl = `SELL +${Math.floor(u.spent * g.rules.sellRefund)}`;
    const sb = this.panel.querySelector('[data-act="sell"]');
    if (sb.textContent !== sl) sb.textContent = sl;
  }

  /** Performance counter (shown once the Prompter has revealed the loop). */
  setPerformance(n, show) {
    this.q('perfchip').style.display = show ? '' : 'none';
    this.q('perf').textContent = n;
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

  update(game, ui = {}) {
    const ch = game.title ?? game.chapter;
    if (ch && (this.q('act').textContent !== ch.label || this.q('ctitle').textContent !== ch.title.toUpperCase())) {
      this.q('act').textContent = ch.label;
      this.q('ctitle').textContent = ch.title.toUpperCase();
    }
    this.spGauge(game, ui.aiming);
    this.waveInfo(game);
    if (game.state !== 'ready') this.root.querySelector(':scope > .startbtn')?.remove(); // started some other way
    // the cast: a card appears when its Phantom joins the story; a Phantom on stage greys its card
    for (const c of this.deck.children) {
      const id = c.dataset.unit;
      const open = game.unlocked.has(id);
      if (open && c.classList.contains('locked')) {
        c.classList.remove('locked');
        c.classList.add('new');
        setTimeout(() => c.classList.remove('new'), 1400);
      } else if (!open) c.classList.add('locked');
      c.classList.toggle('onstage', !!game.onStage(id));
    }
    if (this.panelUnit) this.refreshPanel();
    this.q('cash').textContent = Math.floor(game.cash);
    this.q('tbar').style.width = `${(game.treasure / game.rules.treasureHp) * 100}%`;
    for (const c of this.deck.children) c.classList.toggle('poor', !game.onStage(c.dataset.unit) && game.cash < UNITS[c.dataset.unit].cost);
    this.batonPrompt(game);
    const ready = game.allOutReady && !this.suppress;
    if (ready && !this.allOutBtn) {
      this.allOutBtn = $('<button class="allout-btn live" data-act="allout"><span><small>SP FULL · FINISHER</small>ALL-OUT ATTACK</span></button>');
      this.root.appendChild(this.allOutBtn);
    } else if (!ready && this.allOutBtn) {
      this.allOutBtn.remove();
      this.allOutBtn = null;
    }
  }

  // ---------------------------------------------------------------- SP gauge + Personas
  /** The SP gauge and the Persona buttons (one per Phantom on stage; lit when affordable). */
  spGauge(game, aiming) {
    const on = game.mech.has('summon') || game.mech.has('allout');
    this.spbar.style.display = on ? '' : 'none';
    if (!on) return;
    const max = game.rules.spMax;
    this.q('spfill').style.transform = `scaleX(${(game.sp / max).toFixed(3)})`;
    const txt = String(Math.floor(game.sp));
    if (this.q('sptxt').textContent !== txt) this.q('sptxt').textContent = txt;
    this.spbar.classList.toggle('full', game.sp >= max && game.mech.has('allout'));
    const box = this.q('personas');
    const ids = game.mech.has('summon') ? game.units.map((u) => u.type) : [];
    const key = ids.join(',') + (game.personaWhole ? '+' : '');
    if (box.dataset.key !== key) {
      box.dataset.key = key;
      box.innerHTML = ids.map((id) => {
        const u = game.onStage(id);
        const p = game.persona(u);
        return `<button class="persona-btn live accent-${id}" data-act="persona" data-p="${id}" title="${p.skill}: ${p.blurb}">
          ${this.portraits.card[id] ? `<img alt="" src="${this.portraits.card[id]}">` : ''}<span class="pn">${p.name}</span><span class="pc">${p.cost}</span></button>`;
      }).join('');
    }
    for (const b of box.children) {
      const id = b.dataset.p;
      const u = game.onStage(id);
      if (!u) continue;
      b.classList.toggle('ready', game.sp >= u.def.persona.cost && game.state === 'running');
      b.classList.toggle('aim', aiming === id);
    }
  }

  /** Wave counter; between waves a countdown with CALL (bring the next wave now). */
  waveInfo(game) {
    const show = game.state === 'running';
    this.waveChip.style.display = show ? '' : 'none';
    if (!show) return;
    const total = game.waves.length;
    const between = game.breakT != null;
    const txt = between ? `NEXT WAVE ${game.waveIdx + 2}/${total} · ${Math.ceil(game.breakT)}s` : `WAVE ${game.waveIdx + 1}/${total}`;
    const el = this.q('wavetxt');
    if (el.textContent !== txt) el.textContent = txt;
    this.waveChip.classList.toggle('between', between);
  }

  /** Persona summon flourish: a torn band with the Persona's name and skill over the board. */
  summonCutIn(unitId, persona) {
    const def = UNITS[unitId];
    this.root.querySelector('.summon-cut')?.remove();
    const art = this.portraits.cutin[unitId];
    const el = $(`<div class="summon-cut accent-${unitId}">
      <div class="band" style="clip-path:${TEX.tornDeploy}"><div class="lines" style="background-image:url(&quot;${TEX.speedDeploy}&quot;)"></div></div>
      ${art ? `<img class="art" alt="" src="${art}">` : ''}
      <div class="txt"><small>${def.name.toUpperCase()} · PERSONA!</small><b>${persona.name}</b><i>${persona.skill}</i></div>
    </div>`);
    this.root.appendChild(el);
    this.impact(180);
    setTimeout(() => el.classList.add('out'), 900);
    setTimeout(() => el.remove(), 1200);
  }

  // ---------------------------------------------------------------- Baton Pass prompt (bullet-time)
  /**
   * While a Baton Pass window is open: a circular depletion gauge with the seconds left, and a comic
   * speedline vignette on the screen borders that fades with the bullet-time factor.
   */
  batonPrompt(game) {
    const b = game.baton;
    if (!this.vignette) {
      this.vignette = $('<div class="bt-vignette" aria-hidden="true"></div>');
      this.root.prepend(this.vignette);
    }
    const slow = game.rules.bulletTime < 1 ? (1 - game.timeScale) / (1 - game.rules.bulletTime) : 0;
    this.vignette.style.opacity = String(Math.max(0, Math.min(1, slow)).toFixed(3));
    this.vignette.style.display = slow > 0.01 ? '' : 'none';
    if (b && !this.batonEl) {
      const C = (2 * Math.PI * 26).toFixed(2);
      this.batonEl = $(`<div class="baton-prompt live" role="button" data-act="batonpass" aria-live="polite">
        <svg viewBox="0 0 64 64" class="gauge"><circle class="bg" cx="32" cy="32" r="26"/><circle class="fg" cx="32" cy="32" r="26" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
        <b data-bt="secs">3.5</b>
        <div class="txt"><span>BATON PASS</span><small data-bt="to">TAP TO PASS</small></div>
        <i class="bar"><i data-bt="bar"></i></i>
      </div>`);
      this.batonEl.dataset.c = C;
      this.root.appendChild(this.batonEl);
    } else if (!b && this.batonEl) {
      const el = this.batonEl;
      this.batonEl = null;
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
    }
    if (b && this.batonEl) {
      const frac = Math.max(0, Math.min(1, b.t / (b.max || game.rules.batonWindow)));
      const el = this.batonEl;
      el.querySelector('.fg').setAttribute('stroke-dashoffset', (el.dataset.c * (1 - frac)).toFixed(2));
      el.querySelector('[data-bt="secs"]').textContent = Math.max(0, b.t).toFixed(1);
      el.querySelector('[data-bt="bar"]').style.transform = `scaleX(${frac.toFixed(3)})`;
      el.classList.toggle('low', frac < 0.3);
      const to = game.batonTarget();
      const lbl = to ? `TAP · TO ${to.def.name}` : 'TAP TO PASS';
      const tl = el.querySelector('[data-bt="to"]');
      if (tl.textContent !== lbl) tl.textContent = lbl;
    }
  }

  /** A cast member's line over the fight: small comic bubble, top left, gone in ~2.6 s. */
  bark(speaker, text, img = null, name = null) {
    this.root.querySelector('.bark')?.remove();
    const nm = name ?? UNITS[speaker]?.name ?? speaker.toUpperCase();
    const el = $(`<div class="bark sp-${speaker}">${img ? `<img alt="" src="${img}">` : '<i class="mask"></i>'}<div><b>${nm}</b><p></p></div></div>`);
    el.querySelector('p').textContent = text;
    this.root.appendChild(el);
    clearTimeout(this.barkT);
    this.barkT = setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 250);
    }, 2600);
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
  async oneMore(unitId, chain, baton = true) {
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
      <div class="sub">${chain > 1 ? `CHAIN ×${chain} · ` : ''}${baton ? 'BATON READY' : 'ACT AGAIN'}</div>
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
  async allOut(freezeFrame, fx2d, impact, cast = ['jester', 'queen', 'oracle']) {
    this.suppress = true;
    this.allOutBtn?.remove();
    this.allOutBtn = null;
    // one torn panel per Phantom on stage (up to five), alternating drop-down / rise-up
    const ids = cast.length ? cast : ['jester'];
    const np = ids.length;
    const pw = 100 / np + 12;
    const el = $(`<div class="allout n${np}">
      ${ids.map((id, i) => `<div class="panel${i % 2 ? ' up' : ''}" style="left:${(-6 + i * (112 / np)).toFixed(1)}%;width:${pw.toFixed(1)}%;animation-delay:${(i * 0.16).toFixed(2)}s;clip-path:${TEX.tornV[i % 3]}"><div class="in" style="clip-path:${TEX.tornV[i % 3]}">
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
