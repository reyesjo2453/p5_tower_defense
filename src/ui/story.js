// Comic-panel story player for src/story/script.js. Every beat is a torn panel: the speaker's cut-in
// art slams in from its side, a jagged speech box types the line out, and narration sits in black
// caption boxes. Title cards slam in ransom-note style. Tap / Space / Enter advances (the first tap
// finishes the typing); SKIP ends the scene.
import { SPEAKERS } from '../story/script.js';

const $ = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const svgURL = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// --------------------------------------------------------------------- built-in art for non-cast speakers
/** The house: rows of faceless heads with white eye-slits, lit red from below. */
function audienceArt() {
  let heads = '';
  for (let row = 0; row < 4; row++) {
    const y = 120 + row * 70;
    const n = 7 + row;
    for (let i = 0; i < n; i++) {
      const x = 30 + (i + (row % 2) * 0.5) * (540 / n);
      const r = 26 + row * 5;
      heads += `<g transform="translate(${x.toFixed(1)},${y})"><ellipse rx="${r}" ry="${r * 1.15}" fill="#050505" stroke="#e8002d" stroke-width="2"/>`
        + `<path d="M${-r * 0.55},-4 l${r * 0.4},-5 l2,6 z M${r * 0.55},-4 l${-r * 0.4},-5 l-2,6 z" fill="#fff"/></g>`;
    }
  }
  return svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420"><defs><radialGradient id="g" cx="50%" cy="100%" r="80%"><stop offset="0" stop-color="#e8002d" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><rect width="600" height="420" fill="url(#g)"/>${heads}</svg>`);
}

/** The Impresario: a top hat of torn tickets over a grin made of applause (rows of clapping hands). */
function impresarioArt() {
  let tickets = '';
  for (let i = 0; i < 14; i++) {
    const x = 190 + (i % 7) * 32 + (i > 6 ? 16 : 0);
    const y = 40 + (i > 6 ? 90 : 0) + (i % 3) * 8;
    tickets += `<rect x="${x}" y="${y}" width="34" height="80" fill="${i % 2 ? '#e8002d' : '#f4f0e6'}" stroke="#050505" stroke-width="3" transform="rotate(${(i * 37) % 17 - 8} ${x + 17} ${y + 40})"/>`;
  }
  let teeth = '';
  for (let i = 0; i < 11; i++) teeth += `<path d="M${180 + i * 22},300 l11,26 l11,-26 z" fill="#f4f0e6" stroke="#050505" stroke-width="2"/>`;
  return svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420">
    <rect x="160" y="230" width="280" height="22" fill="#050505" stroke="#e8002d" stroke-width="4"/>
    ${tickets}
    <path d="M150,290 Q300,400 450,290 Q300,340 150,290 z" fill="#050505" stroke="#e8002d" stroke-width="5"/>${teeth}
    <path d="M200,270 l40,-14 l6,14 z M400,270 l-40,-14 l-6,14 z" fill="#fff"/></svg>`);
}

/** The prompt box at the lip of the stage: a hatch with two yellow eyes in the dark. */
function promptBoxArt() {
  return svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
    <path d="M40,260 Q200,40 360,260 z" fill="#050505" stroke="#ffd400" stroke-width="6"/>
    <path d="M70,260 Q200,80 330,260" fill="none" stroke="#f4f0e6" stroke-width="3" stroke-dasharray="10 8"/>
    <g fill="#ffd400"><path d="M150,190 q18,-22 36,0 q-18,10 -36,0 z"/><path d="M214,190 q18,-22 36,0 q-18,10 -36,0 z"/></g>
    <g fill="#050505"><rect x="165" y="178" width="5" height="16"/><rect x="229" y="178" width="5" height="16"/></g>
    <rect x="20" y="258" width="360" height="16" fill="#e8002d"/></svg>`);
}

export class StoryPlayer {
  /** portraits: { cutin: { id: url } } from assets/resolve.js. */
  constructor(root, portraits) {
    this.root = root;
    this.portraits = portraits;
    this.art = { audience: audienceArt(), impresario: impresarioArt(), promptbox: promptBoxArt() };
    this.playing = false;
    this.played = [];
  }

  artFor(sp, beat) {
    if (beat.off) return this.art.promptbox;
    return this.portraits.cutin[sp.art] || this.art[sp.art] || null;
  }

  /** Play a beat list; resolves when it ends or is skipped. vars: { perf }. */
  play(beats, vars = {}, id = '') {
    if (!beats?.length) return Promise.resolve();
    this.playing = true;
    this.played.push(id);
    const fill = (s) => (s ?? '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
    const el = $(`<div class="story" role="dialog" aria-label="Story">
      <div class="st-bg"></div><div class="st-stage"></div>
      <button class="st-skip live" aria-label="Skip scene">SKIP ▶▶</button>
      <div class="st-tap">TAP ▶</div>
    </div>`);
    this.root.appendChild(el);
    const stage = el.querySelector('.st-stage');
    this.el = el;
    return new Promise((resolve) => {
      let i = -1;
      let typing = null;
      let lastSpeaker = null;
      const finish = () => {
        cleanup();
        el.classList.add('out');
        setTimeout(() => el.remove(), 280);
        this.playing = false;
        this.el = null;
        resolve();
      };
      const show = () => {
        i++;
        if (i >= beats.length) return finish();
        const b = beats[i];
        el.dataset.fx = b.fx || '';
        if (b.fx) {
          el.classList.remove('fx');
          void el.offsetWidth;
          el.classList.add('fx');
        }
        stage.innerHTML = '';
        if (b.title) {
          stage.appendChild($(`<div class="st-title"><b>${esc(fill(b.title))}</b>${b.sub ? `<small>${esc(fill(b.sub))}</small>` : ''}</div>`));
          lastSpeaker = null;
          typing = null;
          return;
        }
        if (b.n) {
          const cap = $(`<div class="st-cap"><p></p></div>`);
          stage.appendChild(cap);
          typing = type(cap.querySelector('p'), fill(b.n));
          lastSpeaker = null;
          return;
        }
        const sp = SPEAKERS[b.s] || { name: b.s.toUpperCase(), side: 'L', color: '#fff' };
        const art = this.artFor(sp, b);
        const same = lastSpeaker === `${b.s}${b.off ? ':off' : ''}`;
        lastSpeaker = `${b.s}${b.off ? ':off' : ''}`;
        const side = sp.side;
        const panel = $(`<div class="st-panel side-${side}${same ? ' same' : ''}${b.off ? ' off' : ''}${sp.unmasked ? ' unmasked' : ''} sp-${b.s}">
          ${art ? `<div class="st-art"><img alt="" src="${art}"></div>` : ''}
          <div class="st-box"><span class="st-name" style="--c:${sp.color}">${esc(sp.name)}${b.off ? ' <i>(OFFSTAGE)</i>' : ''}</span><p></p></div>
        </div>`);
        stage.appendChild(panel);
        typing = type(panel.querySelector('p'), fill(b.t));
      };
      const type = (p, text) => {
        // typewriter at ~55 chars/s; resolves early on tap
        let k = 0;
        const t = { done: false };
        const step = () => {
          if (t.done) return;
          k = Math.min(text.length, k + 2);
          p.textContent = text.slice(0, k);
          if (k >= text.length) t.done = true;
          else t.id = setTimeout(step, 36);
        };
        t.finish = () => {
          clearTimeout(t.id);
          t.done = true;
          p.textContent = text;
        };
        step();
        return t;
      };
      const advance = () => {
        if (typing && !typing.done) typing.finish();
        else show();
      };
      const onKey = (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          e.stopImmediatePropagation();
          advance();
        } else if (e.key === 'Escape') {
          e.stopImmediatePropagation();
          finish();
        }
      };
      const onTap = (e) => {
        if (e.target.closest('.st-skip')) return;
        advance();
      };
      const cleanup = () => {
        typing?.finish?.();
        window.removeEventListener('keydown', onKey, true);
        el.removeEventListener('click', onTap);
      };
      el.querySelector('.st-skip').addEventListener('click', (e) => {
        e.stopPropagation();
        finish();
      });
      el.addEventListener('click', onTap);
      window.addEventListener('keydown', onKey, true);
      this.skip = finish;
      show();
    });
  }
}
