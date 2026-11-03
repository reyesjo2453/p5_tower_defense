// Entry point: renderer + scene setup, input (touch/drag/tap), game loop, cut-in orchestration.
import * as THREE from 'three';
import { campaignGame, rehearsalGame, classicGame } from './sim/campaign.js';
import { UNITS, CAMPAIGN } from './sim/data.js';
import { buildArena, buildLights, world } from './render/arena.js';
import { PersonaFx } from './render/personaFx.js';
import { createPost } from './render/post.js';
import { Fx } from './render/fx.js';
import { View, CameraRig } from './render/view.js';
import { Hud } from './ui/hud.js';
import { buildPalace } from './render/palace.js';
import { silhouetteURL } from './ui/silhouettes.js';
import { modelURLs, portraitURLs, spriteURLs, poseURLs } from './assets/resolve.js';
import { loadUnitModels, hasUnitModel } from './render/gltfUnits.js';
import { loadUnitSprites } from './render/spriteUnits.js';
import { createAudio } from './audio/index.js';
import { CombatText } from './render/combatText.js';
import { StoryPlayer } from './ui/story.js';
import { Tutor } from './ui/tutorial.js';
import { SCENES, LOOP_LINES } from './story/script.js';
import { loadSave, writeSave } from './story/save.js';

const params = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const quality = params.get('q') || (coarse ? 'mobile' : 'high');
// ?story=0 skips scenes and lessons; ?unlock=all is a sandbox (the classic two-lane show with the
// whole cast, no story); ?stage=N jumps to campaign stage N; ?rehearsal=T[&seed=S] opens a Rehearsal
const sandbox = params.get('unlock') === 'all';
const storyOn = params.get('story') !== '0' && !sandbox;
const save = loadSave();
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const startMode = sandbox
  ? { kind: 'classic' }
  : params.has('rehearsal')
    ? { kind: 'rehearsal', tier: Math.max(1, Math.min(5, Number(params.get('rehearsal')) || 1)), seed: Number(params.get('seed')) || 1 }
    : { kind: 'campaign', stage: Math.max(0, Math.min(CAMPAIGN.length - 1, Number(params.get('stage')) || 0)) };
let mode = startMode;

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

let game = makeGame(mode);
const palace = buildPalace(scene, { quality: quality === 'low' ? 'low' : 'high' });
buildLights(scene, { quality: quality === 'low' ? 'low' : 'high' });
let arena = buildArena(scene, game.board, { quality: quality === 'low' ? 'low' : 'high', paths: game.paths });
const post = createPost(renderer, scene, camera, { quality: quality === 'low' ? 'low' : 'high' });
const fx = new Fx(scene);
// BGM and SFX live on separate buses; the soundtrack starts on the first gesture and never restarts
const audio = createAudio();
// floating damage numbers + WEAK!/CRITICAL! badges, projected over the canvas
const ctext = new CombatText(document.getElementById('app'), camera);
let view = new View(scene, fx, rig, audio.sfx, ctext);
// Persona apparitions, aiming reticle, fire rings, ward, stun halos
const personaFx = new PersonaFx(scene, fx, rig);

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
    // pose art in the base folder never overrides a sprite / cut-in dropped into custom/
    const poses = poseURLs();
    for (const id of Object.keys(poses)) if (/\/custom\//.test(urls[id] ?? '') && !/\/custom\//.test(poses[id].idle ?? '')) delete poses[id];
    return loadUnitSprites(urls, poses);
  })
  .then((s) => { assets.sprites = s; });
const state = { speed: 1, paused: false, cine: false, selected: null, card: null, dragging: false, freezeReq: null, firstBreak: true, moving: null, unitDrag: null, aiming: null };
const hud = new Hud(document.getElementById('ui'), portraits, {
  cardDown(id) {
    if (busy()) return;
    cancelAim();
    audio.sfx.tap();
    const on = game.onStage(id);
    if (on) {
      // a Phantom already on stage: its card selects it (and frames it) instead of deploying a copy
      state.card = null;
      hud.setSelectedCard(null);
      select(on);
      rig.panToward(world(on.x, on.y), 0.6);
      return;
    }
    if (!game.unlocked.has(id)) return;
    state.card = state.card === id && !state.dragging ? null : id;
    state.dragging = !!state.card;
    hud.setSelectedCard(state.card);
    select(null);
    if (state.card) hud.hint(`Drag ${UNITS[id].name} onto a glowing plate (or tap a plate) · ¥${UNITS[id].cost}`);
  },
  action(act, el) {
    if (act === 'persona') {
      startAim(el?.dataset.p);
      return;
    }
    if (act === 'batonpass') {
      if (game.batonPass()) select(null);
      return;
    }
    if (act === 'call') {
      game.callWave();
      return;
    }
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
    } else if (act === 'rank' && state.selected) {
      if (game.rankUp(state.selected)) audio.sfx.place(0.05);
      else hud.hint('Not enough ¥ for that rehearsal yet.');
    } else if (act === 'move' && state.selected) {
      if (state.selected.moveCd > 0) hud.hint(`${state.selected.def.name} needs ${Math.ceil(state.selected.moveCd)}s before moving again.`);
      else {
        state.moving = state.selected;
        hud.hint(`BLOCKING: tap a free plate for ${state.selected.def.name}.`, 0);
      }
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
  hud.showUnit(u, !!(u && game.baton && game.baton.from !== u), game);
}

/** Input is blocked while a cinematic or a story scene is on screen. */
function busy() {
  return state.cine || story.playing;
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

/** Board point (fractional tile units) under the pointer, for aiming a Persona. */
function pointAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(ground, hit)) return null;
  const x = hit.x + 5;
  const y = hit.z + 5;
  return x > -1 && y > -1 && x < 11 && y < 11 ? { x, y } : null;
}

/** Persona button: aim mode (bullet-time) until the player taps the board, or taps the button again. */
function startAim(type) {
  if (busy() || !type) return;
  if (state.aiming === type) {
    cancelAim();
    return;
  }
  const u = game.onStage(type);
  if (!u) return;
  const p = game.persona(u);
  if (!game.canSummon(type)) {
    hud.hint(game.state !== 'running' ? 'Personas answer once the curtain is up.' : `${p.name} needs ${p.cost} SP. Break posture to fill the gauge.`);
    return;
  }
  state.card = null;
  hud.setSelectedCard(null);
  select(null);
  state.aiming = type;
  game.setAiming(true);
  audio.sfx.tap();
  hud.root.querySelector('.aim-hint')?.remove();
  const tip = document.createElement('div');
  tip.className = 'aim-hint';
  tip.textContent = `TAP THE RUNWAY · ${p.skill}`;
  hud.root.appendChild(tip);
  personaFx.aim({ x: 5, y: 5 }, p.radius, p.id);
}

function cancelAim() {
  if (!state.aiming) return;
  state.aiming = null;
  game.setAiming(false);
  personaFx.aim(null);
  hud.root.querySelector('.aim-hint')?.remove();
}

function trySummon(pt) {
  const type = state.aiming;
  if (!type || !pt) return false;
  const ok = game.summon(type, pt.x, pt.y);
  cancelAim();
  return ok;
}

function showGhost(tile) {
  const mover = state.card ? null : state.moving;
  if ((!state.card && !mover) || !tile) {
    ghost.visible = false;
    return;
  }
  const ok = mover ? game.canMove(mover, tile.x, tile.y) : game.canPlace(state.card, tile.x, tile.y);
  ghost.visible = game.board.slotSet.has(`${tile.x},${tile.y}`);
  ghost.position.copy(world(tile.x, tile.y));
  const r = mover ? game.range(mover) : UNITS[state.card].range;
  ghostRing.scale.setScalar(r);
  ghostPlate.material.color.set(ok ? 0x39ff88 : 0xff1a3d).multiplyScalar(1.6);
}

function tryPlace(tile) {
  if (!state.card || !tile) return false;
  if (game.place(state.card, tile.x, tile.y)) {
    audio.sfx.place(); // swoosh during the drop-in, thud as the sprite lands
    hud.deployCutIn(state.card);
    if (game.state === 'ready' && !tutor.active) hud.hint('On stage. Hit RAISE THE CURTAIN when you\'re set.');
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
  if (state.unitDrag && !state.moving && Math.hypot(e.clientX - state.unitDrag.x, e.clientY - state.unitDrag.y) > 18) {
    // dragging a Phantom on the board = Blocking (move it to another plate)
    state.moving = state.unitDrag.u;
    select(null);
  }
  if (state.card || state.moving) showGhost(tileAt(e.clientX, e.clientY));
  if (state.aiming) {
    const u = game.onStage(state.aiming);
    if (u) personaFx.aim(pointAt(e.clientX, e.clientY), u.def.persona.radius, u.def.persona.id);
  }
  if ((state.dragging && state.card) || state.unitDrag) {
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
  else if (!busy() && !state.aiming && game.mech.has('blocking')) {
    const t = tileAt(e.clientX, e.clientY);
    const u = t && game.unitAt(t.x, t.y);
    state.unitDrag = u ? { u, x: e.clientX, y: e.clientY } : null;
  }
});

function tryMove(tile) {
  const u = state.moving;
  state.moving = null;
  state.unitDrag = null;
  ghost.visible = false;
  hud.hint('');
  if (!u || !tile) return false;
  if (game.move(u, tile.x, tile.y)) {
    audio.sfx.place();
    return true;
  }
  if (u.moveCd > 0) hud.hint(`${u.def.name} needs ${Math.ceil(u.moveCd)}s before moving again.`);
  return false;
}
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
  if (busy()) return;
  const overCanvas = e.target === canvas;
  const tile = overCanvas ? tileAt(e.clientX, e.clientY) : null;
  if (state.moving && (state.unitDrag || overCanvas)) {
    // finish a Blocking move (drag release, or the tap after MOVE)
    const dragged = !!state.unitDrag;
    if (tryMove(tile) || dragged) return;
  }
  state.unitDrag = null;
  if (state.dragging && state.card) {
    // released a dragged card over the arena -> place it
    state.dragging = false;
    if (tile && tryPlace(tile)) return;
    return;
  }
  if (!overCanvas || !downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 18) return;
  downAt = null;
  if (state.aiming) {
    trySummon(pointAt(e.clientX, e.clientY));
    return;
  }
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
  else if (e.key >= '1' && e.key <= '5') startAim(game.units[Number(e.key) - 1]?.type);
  else if (e.key === 'b' || e.key === 'B') game.batonPass();
  else if (e.key === 'Escape') {
    cancelAim();
    state.card = null;
    state.moving = null;
    hud.setSelectedCard(null);
    ghost.visible = false;
    select(null);
  }
});
document.addEventListener('visibilitychange', () => document.hidden && game.state === 'running' && togglePause(true));

// ---------------------------------------------------------------- cut-ins
async function playOneMore(unit, chain, baton) {
  if (busy()) return;
  hud.oneMore(unit.type, chain, baton);
  if (baton && state.firstBreak && !storyOn) {
    state.firstBreak = false;
    hud.hint('POSTURE BREAK! Time slows: tap BATON PASS before the gauge empties.', 4200);
  }
}

function requestAllOut() {
  if (busy() || !game.allOutReady) return;
  state.cine = true;
  state.freezeReq = true; // grab the next rendered frame, then start the sequence
}

async function runAllOut(frame) {
  await hud.allOut(frame, fx2d, () => {
    game.allOut();
    fx.cardsRain(110, 6.5);
    rig.shake = 2;
    post.halftone.uniforms.uFlash.value = 0.8;
  }, Object.keys(UNITS).filter((id) => game.onStage(id)));
  state.cine = false;
}

// ---------------------------------------------------------------- story + tutorial
const uiRoot = document.getElementById('ui');
const story = new StoryPlayer(uiRoot, portraits);
const tutor = new Tutor(uiRoot, camera, {
  ctx: () => ({ game, state }),
  revealed: () => save.revealed,
  avatar: (revealed) => (revealed ? portraits.cutin.prompter : story.art.promptbox),
  world: (u) => view.unitView(u)?.base.clone().setY(1.3) ?? null,
  onDone: (id) => {
    if (!save.lessons.includes(id)) save.lessons.push(id);
    writeSave(save);
  },
});

/** Play a stage's scene (once per run unless `force`). */
async function playScene(id, force = false) {
  if (!storyOn || !SCENES[id] || (!force && save.seen.includes(id))) return;
  ghost.visible = false;
  state.card = null;
  hud.setSelectedCard(null);
  select(null);
  cancelAim();
  await story.play(SCENES[id], { perf: save.perf }, id);
  if (!save.seen.includes(id)) save.seen.push(id);
  if (id === 'promptbox') save.revealed = true; // the Prompter has told them about the loop
  if (id === 'strike') save.whole = true; // Jester remembers: his Persona has a name again
  writeSave(save);
  hud.setPerformance(save.perf, save.revealed);
}

/** Raise a stage: its scene (first time), who joins, its lessons, then the curtain button. */
async function enterStage({ scene: withScene = true } = {}) {
  const g = game;
  if (mode.kind === 'campaign') {
    const ch = CAMPAIGN[mode.stage];
    if (withScene) await playScene(ch.id);
    if (g !== game) return; // a new game started while the scene played
    // the scene may have restored Jester's Persona: rebuild so the name shows
    if (save.whole && !game.personaWhole) game.personaWhole = true;
    hud.setPerformance(save.perf, save.revealed);
    tutor.begin(ch.id, !storyOn || save.lessons.includes(ch.id));
    for (const id of ch.unlock) if (mode.stage > 0) hud.centerMsg(`${UNITS[id].name} JOINS`, 1600);
  } else tutor.begin(null, true);
  arena.alert(game.nextLanes);
  hud.root.querySelector('.startbtn')?.remove();
  hud.startButton(mode.kind === 'campaign' ? 'RAISE THE CURTAIN' : 'START SHOW', () => {
    game.start();
    if (!storyOn && mode.kind !== 'campaign') hud.hint('Break posture → 1-MORE. Fill SP → summon a Persona. Full SP → ALL-OUT!', 5000);
  });
  if (!tutor.active) {
    const ch = game.title ?? game.chapter;
    hud.hint(mode.kind === 'campaign' && mode.stage === 0 ? 'Drag your Phantom beside the crimson runway.' : `${ch.label} · ${ch.title.toUpperCase()}`, 3200);
  }
}

// ---------------------------------------------------------------- flow
/** Build the Game for `m` ({ kind: campaign | rehearsal | classic, stage, tier, seed }). */
function makeGame(m) {
  let g;
  if (m.kind === 'campaign') g = campaignGame(m.stage, { personaWhole: save.whole });
  else if (m.kind === 'rehearsal') {
    g = rehearsalGame({ tier: m.tier, seed: m.seed, chapter: Math.max(2, save.best), unlockAll: sandbox || save.finished, personaWhole: save.whole || sandbox });
    g.title = { label: 'REHEARSAL', title: `Tier ${ROMAN[m.tier]} · #${m.seed}` };
  } else {
    g = classicGame({ unlockAll: true, personaWhole: true });
    g.title = { label: 'SANDBOX', title: 'The Classic Show' };
  }
  return g;
}

/** Start (or restart) a stage. `scene` plays the stage's scene if it hasn't been seen. */
function newGame(m = mode, { scene: withScene = true } = {}) {
  mode = m;
  view.clear();
  personaFx.clear();
  cancelAim();
  game = makeGame(m);
  arena.dispose();
  arena = buildArena(scene, game.board, { quality: quality === 'low' ? 'low' : 'high', paths: game.paths });
  view = new View(scene, fx, rig, audio.sfx, ctext);
  rig.resetView();
  state.speed = 1;
  state.moving = null;
  hud.setSpeed(1);
  togglePause(false);
  select(null);
  rig.estGoal = 0; // glide down from the establishing shot into the battle framing
  enterStage({ scene: withScene });
}

const startBtn = (label, cls = '') => `<button class="startbtn live ${cls}" style="position:static;transform:skewX(-12deg)"><span>${label}</span></button>`;

function titleScreen() {
  rig.estGoal = 1;
  const cont = !sandbox && save.cp && CAMPAIGN[save.cp.stage];
  const rehearse = !sandbox && (save.best >= 3 || save.finished);
  const ov = hud.overlay(`
    <div class="logo"><div class="a">ENCORE<br>PROTOCOL</div><div class="b">PHANTOM SHOWCASE</div></div>
    <div class="howto">
      Every night at <b>11:59</b>, one stream plays on every screen in the city.<br>
      <b>312</b> people watched it to the end. None of them have woken up.<br>
      Tonight, you're on stage.
    </div>
    <div class="titlebtns">
      ${startBtn(cont ? 'NEW SHOW' : 'ENTER', 'new')}
      ${cont ? startBtn(`CONTINUE · ${cont.label}`, 'cont') : ''}
      ${rehearse ? startBtn('REHEARSAL', 'reh') : ''}
    </div>
    <div class="tag">Unofficial, non-commercial fan showcase inspired by the Persona series' style. Not affiliated with ATLUS or SEGA.
    Built-in models, designs, story and code are original.</div>`);
  const go = async (m, fresh = false) => {
    ov.remove();
    await assetsReady; // models are tiny next to the title screen dwell time; never place before they're in
    if (fresh) {
      // a fresh run: the story starts over, but the Prompter's performance count never resets
      save.seen = [];
      save.revealed = false;
      save.whole = false;
      save.cp = null;
      writeSave(save);
    }
    newGame(m);
  };
  // ?unlock=all / ?stage / ?rehearsal start straight into that mode (debug + smoke tests)
  const direct = startMode.kind !== 'campaign' || startMode.stage > 0;
  ov.querySelector('.new').addEventListener('click', () => (direct ? go(startMode) : go({ kind: 'campaign', stage: 0 }, true)));
  ov.querySelector('.cont')?.addEventListener('click', () => go({ kind: 'campaign', stage: save.cp.stage }));
  ov.querySelector('.reh')?.addEventListener('click', () => tierPicker((tier) => go({ kind: 'rehearsal', tier, seed: newSeed() })));
}

const newSeed = () => 1 + Math.floor(Math.random() * 99999);

/** Rehearsal tiers open up as the story goes on (all of them once it is finished). */
function tierPicker(pick) {
  const top = sandbox || save.finished ? 5 : Math.max(1, Math.min(5, 1 + Math.floor(save.best / 3)));
  const lanes = ['', '1 LANE', '2 LANES', '2 LANES', '3 LANES', '3 LANES · BOSS'];
  const ov = hud.overlay(`<div class="logo"><div class="a">REHEARSAL</div><div class="b">A NEW STAGE EVERY TIME</div></div>
    <div class="tierpick">${[1, 2, 3, 4, 5].map((t) => `<button class="live" data-t="${t}" ${t > top ? 'disabled style="opacity:.35"' : ''}>TIER ${ROMAN[t]}<small>${lanes[t]}</small></button>`).join('')}</div>
    ${startBtn('BACK', 'back')}`);
  ov.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
    if (b.disabled) return;
    ov.remove();
    pick(Number(b.dataset.t));
  }));
  ov.querySelector('.back').addEventListener('click', () => titleScreen());
}

/** The Treasure fell: the loop resets to the top of this stage. */
function loopReset() {
  cancelAim();
  if (mode.kind === 'campaign') {
    save.perf++;
    writeSave(save);
  }
  const line = LOOP_LINES[save.perf % LOOP_LINES.length].replace('{perf}', save.perf);
  const ch = game.title ?? game.chapter;
  const ov = hud.overlay(`<div class="logo"><div class="a">CURTAIN<br>FALLS</div><div class="b">${ch.label} · WAVE ${game.waveIdx + 1}/${game.waves.length} · ${game.kills} SHADOWS SENT HOME</div></div>
    ${storyOn && mode.kind === 'campaign' ? `<div class="loopline"><b>PROMPTER</b>${line}</div>` : ''}
    <div class="titlebtns">${startBtn('FROM THE TOP', 'again')}${mode.kind === 'rehearsal' ? startBtn('TITLE', 'title') : ''}</div>`);
  ov.querySelector('.again').addEventListener('click', () => { ov.remove(); newGame(mode, { scene: false }); });
  ov.querySelector('.title')?.addEventListener('click', () => { ov.remove(); titleScreen(); });
  rig.estGoal = 1;
}

/** The story is over. */
async function finale() {
  fx.cardsRain(140, 7);
  save.cp = null;
  save.finished = true;
  writeSave(save);
  await playScene('ending', true);
  const ov = hud.overlay(`<div class="logo"><div class="a">THE SHOW'S<br>OVER</div><div class="b">PERFORMANCE #${save.perf} · ${game.kills} SHADOWS SENT HOME</div></div>
    <div class="titlebtns">${startBtn('ENCORE', 'enc')}${startBtn('REHEARSAL', 'reh')}</div>`);
  ov.querySelector('.enc').addEventListener('click', () => {
    ov.remove();
    save.perf++; // you asked for an encore. Of course you did.
    save.seen = [];
    save.revealed = false;
    save.whole = false;
    writeSave(save);
    newGame({ kind: 'campaign', stage: 0 });
  });
  ov.querySelector('.reh').addEventListener('click', () => tierPicker((tier) => { ov.remove(); newGame({ kind: 'rehearsal', tier, seed: newSeed() }); }));
  rig.estGoal = 1;
}

/** Every wave of the stage is cleared. */
function stageClear() {
  cancelAim();
  arena.alert([]);
  select(null);
  if (mode.kind === 'campaign') {
    const next = mode.stage + 1;
    if (next >= CAMPAIGN.length) {
      finale();
      return;
    }
    save.cp = { stage: next };
    save.best = Math.max(save.best, next);
    writeSave(save);
    hud.centerMsg('CURTAIN!', 1300);
    fx.cardsRain(60, 6);
    const ch = CAMPAIGN[mode.stage];
    setTimeout(() => {
      const ov = hud.overlay(`<div class="logo"><div class="a">${ch.label}<br>CLEARED</div><div class="b">${ch.title.toUpperCase()} · TREASURE ${game.treasure}/${game.rules.treasureHp} · ${game.kills} SHADOWS SENT HOME</div></div>
        ${startBtn(`NEXT · ${CAMPAIGN[next].label}`, 'next')}`);
      ov.querySelector('.next').addEventListener('click', () => { ov.remove(); newGame({ kind: 'campaign', stage: next }); });
      rig.estGoal = 1;
    }, 1400);
    return;
  }
  fx.cardsRain(140, 7);
  const ov = hud.overlay(`<div class="logo"><div class="a">TREASURE<br>SECURED</div><div class="b">${game.treasure}/${game.rules.treasureHp} · ${game.kills} SHADOWS</div></div>
    <div class="titlebtns">${startBtn(mode.kind === 'rehearsal' ? 'NEW STAGE' : 'ENCORE', 'again')}${mode.kind === 'rehearsal' ? startBtn('TITLE', 'title') : ''}</div>`);
  ov.querySelector('.again').addEventListener('click', () => { ov.remove(); newGame(mode.kind === 'rehearsal' ? { ...mode, seed: newSeed() } : mode); });
  ov.querySelector('.title')?.addEventListener('click', () => { ov.remove(); titleScreen(); });
  rig.estGoal = 1;
}

function onEvents(events) {
  for (const ev of events) {
    view.onEvent(ev);
    tutor.onEvent(ev);
    switch (ev.t) {
      case 'wave': {
        const ch = game.title ?? game.chapter;
        hud.centerMsg(ev.n === 1 ? ch.label : ev.boss ? 'CURTAIN CALL' : `WAVE ${ev.n}/${ev.total}`, 1500);
        arena.alert([]);
        break;
      }
      case 'waveClear':
        hud.centerMsg('WAVE CLEAR', 1200);
        arena.alert(ev.next);
        break;
      case 'summon': {
        hud.summonCutIn(ev.unit.type, ev.persona);
        const uv = view.unitView(ev.unit);
        personaFx.summon(ev, uv?.base ?? null);
        audio.sfx.magic?.();
        post.halftone.uniforms.uAberration.value = 0.8;
        break;
      }
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
        hud.centerMsg(`BATON PASS → ${ev.to.def.name}`, 900);
        break;
      case 'won':
        stageClear();
        break;
      case 'lost':
        loopReset();
        break;
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
  const frozen = state.cine || state.paused || story.playing || tutor.hold;
  // a Baton Pass prompt runs in bullet-time on wall-clock time, so 2x speed doesn't shorten it
  const steps = game.baton || state.aiming ? 1 : state.speed;
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
  personaFx.update(frozen ? 0 : dt, game, camera);
  palace.update(t);
  rig.update(dt);
  const u = post.halftone.uniforms;
  u.uAberration.value = Math.max(0, u.uAberration.value - dt * 4);
  u.uFlash.value = Math.max(0, u.uFlash.value - dt * 2.5);
  if (u.uFlash.value <= 0) u.uFlashColor.value.set(0xffffff);
  post.render(dt, t);
  hud.update(game, { aiming: state.aiming });
  tutor.update();
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
window.__game = { get game() { return game; }, get mode() { return mode; }, get arena() { return arena; }, state, hud, audio, get view() { return view; }, rig, post, fx, personaFx, scene, palace, assets, assetsReady, newGame, requestAllOut, select, ctext, story, tutor, save, startAim, trySummon };
