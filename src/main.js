// Entry point: renderer + scene setup, input (touch/drag/tap), game loop, cut-in orchestration.
import * as THREE from 'three';
import { Game } from './sim/game.js';
import { UNITS } from './sim/data.js';
import { buildArena, world } from './render/arena.js';
import { createPost } from './render/post.js';
import { Fx } from './render/fx.js';
import { View, CameraRig } from './render/view.js';
import { Hud } from './ui/hud.js';
import { buildPalace } from './render/palace.js';
import { silhouetteURL } from './ui/silhouettes.js';
import { modelURLs, portraitURLs, spriteURLs } from './assets/resolve.js';
import { loadUnitModels, hasUnitModel } from './render/gltfUnits.js';
import { loadUnitSprites } from './render/spriteUnits.js';
import { createAudio } from './audio/index.js';
import { CombatText } from './render/combatText.js';

const params = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const quality = params.get('q') || (coarse ? 'mobile' : 'high');

// ---------------------------------------------------------------- renderer / scene
const canvas = document.getElementById('gl');
const fx2d = document.getElementById('fx2d');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
} catch (err) {
  document.getElementById('ui').innerHTML = '<div class="overlay"><div class="logo"><div class="a">NO WEBGL</div></div><p class="tag">This showcase needs WebGL. Try a recent Chrome, Safari or Firefox.</p></div>';
  throw err;
}
let pixelRatio = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.5);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = quality !== 'low';
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0714);
scene.fog = new THREE.FogExp2(0x0c0714, 0.025); // velvet Palace haze
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 240);
const rig = new CameraRig(camera);

let game = new Game();
const palace = buildPalace(scene, { quality: quality === 'low' ? 'low' : 'high' });
const arena = buildArena(scene, game.board, { quality: quality === 'low' ? 'low' : 'high' });
const post = createPost(renderer, scene, camera, { quality: quality === 'low' ? 'low' : 'high' });
const fx = new Fx(scene);
// BGM and SFX live on separate buses; the soundtrack starts on the first gesture and never restarts
const audio = createAudio();
// floating damage numbers + WEAK!/CRITICAL! badges, projected over the canvas
const ctext = new CombatText(document.getElementById('app'), camera);
let view = new View(scene, fx, rig, audio.sfx, ctext);

// placement ghost: range ring + glowing plate following the finger
const ghost = new THREE.Group();
const ghostPlate = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.04, 0.86), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x39ff88).multiplyScalar(1.6), transparent: true, opacity: 0.6, toneMapped: false }));
ghostPlate.position.y = 0.09;
const ghostRing = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, toneMapped: false, depthWrite: false }));
ghostRing.rotation.x = -Math.PI / 2;
ghostRing.position.y = 0.26;
ghost.add(ghostPlate, ghostRing);
ghost.visible = false;
scene.add(ghost);

// ---------------------------------------------------------------- portraits + HUD
// drop-in PNGs (public/portraits[/custom]) win; the SVG silhouettes are the built-in fallback
const portraits = portraitURLs(silhouetteURL);
for (const key of portraits.png) {
  const [kind, id] = key.split(':');
  const img = new Image();
  img.decoding = 'async';
  img.src = kind === 'finisher' ? portraits.finisher : portraits[kind][id]; // warm the cache before the first cut-in
}
// drop-in glTF unit models (public/models[/custom]); units without one stand as a 2D billboard when
// they have a sprite/cut-in PNG, else keep their procedural figure
const assets = { portraits: [...portraits.png], models: null, sprites: null };
const assetsReady = loadUnitModels(modelURLs())
  .then((s) => {
    assets.models = s;
    const urls = Object.fromEntries(Object.entries(spriteURLs()).filter(([id]) => !hasUnitModel(id)));
    return loadUnitSprites(urls);
  })
  .then((s) => { assets.sprites = s; });
const state = { speed: 1, paused: false, cine: false, selected: null, card: null, dragging: false, freezeReq: null, firstBreak: true };
const hud = new Hud(document.getElementById('ui'), portraits, {
  cardDown(id) {
    if (state.cine) return;
    audio.sfx.tap();
    state.card = state.card === id && !state.dragging ? null : id;
    state.dragging = !!state.card;
    hud.setSelectedCard(state.card);
    select(null);
    if (state.card) hud.hint(`Drag ${UNITS[id].name} onto a glowing plate (or tap a plate) · ¥${UNITS[id].cost}`);
  },
  action(act) {
    if (act === 'mute') {
      audio.toggleMute();
      return;
    }
    audio.sfx.tap();
    if (act === 'pause') togglePause();
    else if (act === 'speed') {
      state.speed = state.speed === 1 ? 2 : 1;
      hud.setSpeed(state.speed);
    } else if (act === 'sell' && state.selected) {
      game.sell(state.selected);
      select(null);
    } else if (act === 'close') select(null);
    else if (act === 'baton' && state.selected) {
      if (game.batonPass(state.selected)) select(null);
    } else if (act === 'allout') requestAllOut();
  },
});

hud.setMuted(audio.muted);
audio.onMute((m) => hud.setMuted(m));

function select(u) {
  state.selected = u;
  hud.showUnit(u, !!(u && game.baton && game.baton.from !== u));
}

function togglePause(force) {
  state.paused = force ?? !state.paused;
  hud.setPaused(state.paused);
}

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1);
const hit = new THREE.Vector3();

function tileAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(ground, hit)) return null;
  return { x: Math.round(hit.x + 5), y: Math.round(hit.z + 5) };
}

function showGhost(tile) {
  if (!state.card || !tile) {
    ghost.visible = false;
    return;
  }
  const ok = game.canPlace(state.card, tile.x, tile.y);
  ghost.visible = game.board.slotSet.has(`${tile.x},${tile.y}`);
  ghost.position.copy(world(tile.x, tile.y));
  const r = UNITS[state.card].range;
  ghostRing.scale.setScalar(r);
  ghostPlate.material.color.set(ok ? 0x39ff88 : 0xff1a3d).multiplyScalar(1.6);
}

function tryPlace(tile) {
  if (!state.card || !tile) return false;
  if (game.place(state.card, tile.x, tile.y)) {
    audio.sfx.place(); // swoosh during the drop-in, thud as the sprite lands
    hud.deployCutIn(state.card);
    if (game.state === 'ready') hud.hint('Nice. Place a few more, then hit START.');
    state.card = null;
    hud.setSelectedCard(null);
    ghost.visible = false;
    return true;
  }
  if (game.board.slotSet.has(`${tile.x},${tile.y}`) && game.cash < UNITS[state.card].cost) hud.hint('Not enough ¥. Income ticks up every second; kills pay out.');
  return false;
}

// ---------------------------------------------------------------- camera framing input
// wheel / pinch zoom (damped in the rig), two-finger drag or right/middle-drag to pan, edge-pan while
// dragging a card, +/- and 0 on the keyboard. A pinch cancels the tap it started with.
const touches = new Map(); // pointerId -> {x, y}
let pinch = null; // { d, mx, my }
let dragPan = null; // { x, y } for right / middle mouse drag
function pinchState() {
  const [a, b] = [...touches.values()];
  return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
}
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (state.cine) return;
  const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  rig.zoomBy(Math.exp(THREE.MathUtils.clamp(px, -120, 120) * 0.0011)); // trackpads send many small steps
}, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

let downAt = null;
window.addEventListener('pointermove', (e) => {
  if (touches.has(e.pointerId)) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size === 2) {
      const n = pinchState();
      if (n.d > 10 && pinch.d > 10) rig.zoomBy(Math.pow(pinch.d / n.d, 1.15));
      rig.panBy(n.mx - pinch.mx, n.my - pinch.my, canvas.clientHeight);
      pinch = n;
      return;
    }
  }
  if (dragPan) {
    rig.panBy(e.clientX - dragPan.x, e.clientY - dragPan.y, canvas.clientHeight);
    dragPan = { x: e.clientX, y: e.clientY };
    return;
  }
  if (state.card) showGhost(tileAt(e.clientX, e.clientY));
  if (state.dragging && state.card) {
    // dragging a card toward a screen edge slides the shot that way so far plates stay reachable
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const ex = e.clientX < w * 0.08 ? -1 : e.clientX > w * 0.92 ? 1 : 0;
    const ey = e.clientY < h * 0.14 ? -1 : 0;
    if (ex || ey) rig.panBy(-ex * 9, -ey * 9, h);
  }
});
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && !state.dragging) {
      pinch = pinchState();
      downAt = null; // a pinch is never a tap
      return;
    }
  }
  if (e.button === 1 || e.button === 2) {
    dragPan = { x: e.clientX, y: e.clientY };
    return;
  }
  downAt = { x: e.clientX, y: e.clientY };
  if (state.card) showGhost(tileAt(e.clientX, e.clientY));
});
const endTouch = (e) => {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = null;
};
window.addEventListener('pointercancel', endTouch);
window.addEventListener('pointerup', (e) => {
  endTouch(e);
  if (dragPan) {
    dragPan = null;
    return;
  }
  if (pinch || touches.size) return; // still mid-gesture
  if (state.cine) return;
  const overCanvas = e.target === canvas;
  const tile = overCanvas ? tileAt(e.clientX, e.clientY) : null;
  if (state.dragging && state.card) {
    // released a dragged card over the arena -> place it
    state.dragging = false;
    if (tile && tryPlace(tile)) return;
    return;
  }
  if (!overCanvas || !downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 18) return;
  downAt = null;
  if (state.card) {
    tryPlace(tile);
    return;
  }
  const u = tile ? game.unitAt(tile.x, tile.y) : null;
  if (u && game.baton && game.baton.from !== u) {
    game.batonPass(u);
    select(null);
    return;
  }
  select(u);
});
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') togglePause();
  else if (e.key === 'a' || e.key === 'A') requestAllOut();
  else if (e.key === '+' || e.key === '=') rig.zoomBy(0.88);
  else if (e.key === '-' || e.key === '_') rig.zoomBy(1 / 0.88);
  else if (e.key === '0') rig.resetView();
  else if (e.key.startsWith('Arrow')) {
    const k = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key];
    rig.panBy(k[0], k[1], canvas.clientHeight);
  }
  else if (e.key === 'Escape') {
    state.card = null;
    hud.setSelectedCard(null);
    ghost.visible = false;
    select(null);
  }
});
document.addEventListener('visibilitychange', () => document.hidden && game.state === 'running' && togglePause(true));

// ---------------------------------------------------------------- cut-ins
async function playOneMore(unit, chain, baton) {
  if (state.cine) return;
  hud.oneMore(unit.type, chain, baton);
  if (baton && state.firstBreak) {
    state.firstBreak = false;
    hud.hint('POSTURE BREAK! Time slows: tap another unit before the gauge empties to BATON PASS.', 4200);
  }
}

function requestAllOut() {
  if (state.cine || !game.allOutReady) return;
  state.cine = true;
  state.freezeReq = true; // grab the next rendered frame, then start the sequence
}

async function runAllOut(frame) {
  await hud.allOut(frame, fx2d, () => {
    game.allOut();
    fx.cardsRain(110, 6.5);
    rig.shake = 2;
    post.halftone.uniforms.uFlash.value = 0.8;
  });
  state.cine = false;
}

// ---------------------------------------------------------------- flow
function newGame() {
  view.clear();
  game = new Game();
  view = new View(scene, fx, rig, audio.sfx, ctext);
  rig.resetView();
  state.speed = 1;
  hud.setSpeed(1);
  togglePause(false);
  select(null);
  rig.estGoal = 0; // glide down from the establishing shot into the battle framing
  hud.startButton('START SHOW', () => {
    game.start();
    hud.hint('Break posture (yellow bar) → 1-MORE → Baton Pass. Down 3 Shadows → ALL-OUT!', 5000);
  });
  hud.hint('Pick a Phantom below and drag it beside the crimson runway.', 0);
}

function titleScreen() {
  rig.estGoal = 1;
  const ov = hud.overlay(`
    <div class="logo"><div class="a">ENCORE<br>PROTOCOL</div><div class="b">PHANTOM SHOWCASE</div></div>
    <div class="howto">
      Shadows march down the crimson runway toward the <b>Treasure</b>.<br>
      Drag <b>JESTER</b>, <b>QUEEN</b> and <b>ORACLE</b> onto the plates beside it.<br>
      Empty a Shadow's <b>yellow posture bar</b> to shatter its mask → <b>1-MORE!</b><br>
      Then tap another unit to <b>BATON PASS</b>. Down three at once → <b>ALL-OUT ATTACK</b>.
    </div>
    <button class="startbtn live" style="position:static;transform:skewX(-12deg)"><span>ENTER</span></button>
    <div class="tag">Unofficial, non-commercial fan showcase inspired by the Persona series' style. Not affiliated with ATLUS or SEGA.
    Built-in models, designs and code are original.</div>`);
  ov.querySelector('button').addEventListener('click', async () => {
    ov.remove();
    await assetsReady; // models are tiny next to the title screen dwell time; never place before they're in
    newGame();
  });
}

function onEvents(events) {
  for (const ev of events) {
    view.onEvent(ev);
    switch (ev.t) {
      case 'wave':
        hud.centerMsg(ev.boss ? 'CURTAIN CALL' : `WAVE ${ev.n}`, 1500);
        break;
      case 'oneMore':
        playOneMore(ev.unit, ev.chain, ev.baton);
        break;
      case 'break':
        post.halftone.uniforms.uAberration.value = 1;
        break;
      case 'leak':
        post.halftone.uniforms.uFlash.value = 0.35;
        post.halftone.uniforms.uFlashColor.value.set(0xff1a3d);
        break;
      case 'baton':
        hud.centerMsg('BATON PASS', 900);
        break;
      case 'won': {
        const ov = hud.overlay(`<div class="logo"><div class="a">TREASURE<br>SECURED</div><div class="b">${game.treasure}/${game.rules.treasureHp} · ${game.kills} SHADOWS</div></div>
          <button class="startbtn live" style="position:static;transform:skewX(-12deg)"><span>ENCORE</span></button>`);
        ov.querySelector('button').addEventListener('click', () => { ov.remove(); newGame(); });
        fx.cardsRain(140, 7);
        rig.estGoal = 1;
        break;
      }
      case 'lost': {
        const ov = hud.overlay(`<div class="logo"><div class="a">CURTAIN<br>FALLS</div><div class="b">WAVE ${game.waveIdx + 1} · ${game.kills} SHADOWS</div></div>
          <button class="startbtn live" style="position:static;transform:skewX(-12deg)"><span>RETRY</span></button>`);
        ov.querySelector('button').addEventListener('click', () => { ov.remove(); newGame(); });
        rig.estGoal = 1;
        break;
      }
      default:
    }
  }
}

// ---------------------------------------------------------------- resize / adaptive resolution
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const deck = document.querySelector('.deck');
  const deckH = deck ? h - deck.getBoundingClientRect().top + 6 : 130;
  rig.fit(w, h, w < 620 || h < 500 ? 46 : 60, Math.min(deckH, h * 0.4));
  // when a narrow screen makes the camera back off, thin the haze so the board doesn't fog over
  scene.fog.density = 0.025 * Math.min(1, 13 / (rig.baseDist * 0.85));
  post.setSize(w, h, pixelRatio);
}
window.addEventListener('resize', resize);
resize();

let slow = 0;
function adapt(raw) {
  slow = raw > 1 / 34 ? slow + raw : Math.max(0, slow - raw * 0.5);
  if (slow > 2.5 && pixelRatio > 0.75) {
    pixelRatio = Math.max(0.75, pixelRatio - 0.25);
    renderer.setPixelRatio(pixelRatio);
    resize();
    slow = 0;
  }
}

// auto-framing target: half-way between the board centre and the marching Shadows (the leading one
// counts double), so a close camera keeps the fight in shot without the player steering
const _follow = new THREE.Vector3();
function frameAction() {
  if (state.dragging) return; // never slide the shot under a finger that is placing a card
  _follow.set(0, 0, 0);
  let n = 0, lead = null;
  for (const e of game.enemies) {
    _follow.x += e.x - 5;
    _follow.z += e.y - 5;
    n++;
    if (!lead || e.walked > lead.walked) lead = e;
  }
  if (lead) {
    _follow.x += 2 * (lead.x - 5);
    _follow.z += 2 * (lead.y - 5);
    _follow.multiplyScalar(0.5 / (n + 2));
  }
  rig.setFollow(_follow);
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let t = 0;
const grab = document.createElement('canvas');
function loop() {
  const raw = Math.min(0.1, clock.getDelta());
  if (!document.hidden) adapt(raw);
  const dt = Math.min(0.05, raw);
  t += dt;
  const frozen = state.cine || state.paused;
  // a Baton Pass prompt runs in bullet-time on wall-clock time, so 2x speed doesn't shorten it
  const steps = game.baton ? 1 : state.speed;
  if (!frozen) {
    for (let i = 0; i < steps; i++) game.update(dt);
    onEvents(game.drain());
  }
  // hit-stop: the world (and FX) freeze for the 80 ms after a posture break; bullet-time slows the
  // view by the same eased factor as the sim so animations, FX and numbers all go slow-mo together
  const stopped = game.hitStop > 0;
  const vdt = frozen || stopped ? 0 : dt * steps * game.timeScale;
  view.combat.update(frozen ? 0 : dt);
  frameAction();
  if (!state.cine) view.update(vdt, game, camera, state.selected);
  fx.update(state.cine && !state.freezeReq ? dt * 0.6 : vdt);
  arena.update(t, !!state.card);
  palace.update(t);
  rig.update(dt);
  const u = post.halftone.uniforms;
  u.uAberration.value = Math.max(0, u.uAberration.value - dt * 4);
  u.uFlash.value = Math.max(0, u.uFlash.value - dt * 2.5);
  if (u.uFlash.value <= 0) u.uFlashColor.value.set(0xffffff);
  post.render(dt, t);
  hud.update(game);
  if (state.freezeReq) {
    state.freezeReq = false;
    grab.width = canvas.width;
    grab.height = canvas.height;
    grab.getContext('2d').drawImage(canvas, 0, 0);
    runAllOut(grab);
  }
  requestAnimationFrame(loop);
}

titleScreen();
resize();
requestAnimationFrame(loop);

// debug / smoke-test handle
window.__game = { get game() { return game; }, state, hud, audio, get view() { return view; }, rig, post, fx, scene, palace, assets, assetsReady, newGame, requestAllOut, select, ctext };
