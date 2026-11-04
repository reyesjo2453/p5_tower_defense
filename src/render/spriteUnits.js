// 2D billboard units: a standing PNG becomes a camera-facing paper cut-out on its plate, with an
// ink + paper border, a breathing idle, a drop-in deploy, a spring-eased attack state machine
// (IDLE -> ANTICIPATE -> LUNGE -> HIT_STOP -> OVERSHOOT_RECOIL -> IDLE), a soft
// ground shadow that breathes with it and a flat ink silhouette shadow on the floor.
// Card-style art with a black backdrop is keyed first (keyout.js) so only the figure stands up.
// Used for units that have a sprite (or cut-in) PNG but no .glb; units with neither keep the
// procedural figure from models.js.
import * as THREE from 'three';
import { SPRITE_HEIGHT, SPRITE_TWEAKS, SPRITE_KEY } from '../assets/manifest.js';
import { keyOut, needsKey, cleanPose } from './keyout.js';
import { UNITS } from '../sim/data.js';

/** Loaded templates by unit id: { texture, aspect, height, tw }. */
const templates = new Map();
const failures = new Map();

// shared geometry: unit plane with its origin at the bottom centre, so scale.y = height grounds it
const PLANE = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
const DISC = new THREE.CircleGeometry(0.5, 32).rotateX(-Math.PI / 2);
let shadowTex = null;
function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(0.55, 'rgba(0,0,0,.7)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

/**
 * Crop the texture to its opaque pixels (alpha > 10%) so the figure's feet sit exactly on the plate
 * and the plane hugs the art. Returns the trimmed aspect ratio (width / height).
 */
function trim(texture) {
  const img = texture.image;
  const w0 = img.width, h0 = img.height;
  const k = Math.min(1, 256 / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
  try {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    const a = g.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (a[(y * w + x) * 4 + 3] > 25) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return w0 / h0; // fully transparent: leave it alone
    x1 += 1;
    y1 += 1;
    // texture v runs bottom-up (flipY), canvas rows top-down
    texture.offset.set(x0 / w, (h - y1) / h);
    texture.repeat.set((x1 - x0) / w, (y1 - y0) / h);
    return ((x1 - x0) / w * w0) / ((y1 - y0) / h * h0);
  } catch {
    return w0 / h0;
  }
}

/**
 * Card-style art (opaque edges, black backdrop) -> a keyed CanvasTexture holding only the figure.
 * Works on a copy capped at 1024 px so the HUD keeps using the original full-res image.
 * Returns { texture, key } (key = null when the art already had transparent margins).
 */
function keyCard(texture, opts) {
  const mode = opts.mode ?? 'auto';
  if (mode === false || mode === 'off') return { texture, key: null };
  const img = texture.image;
  const k = Math.min(1, 1024 / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  try {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    const px = g.getImageData(0, 0, w, h);
    if (mode === 'auto' && !needsKey(px.data, w, h)) return { texture, key: null };
    const key = keyOut(px.data, w, h, { threshold: opts.threshold ?? 18 });
    if (!key.keyed) return { texture, key };
    g.putImageData(px, 0, 0);
    const keyed = new THREE.CanvasTexture(c);
    texture.dispose();
    return { texture: keyed, key };
  } catch (err) {
    console.warn('[assets] could not key sprite background; showing the full card.', err);
    return { texture, key: null };
  }
}

/**
 * Pose art (transparent frames cut from a sheet, one canvas size per unit): clean each frame
 * (cleanPose drops the sheet's leftovers), then crop every frame to one shared box so they swap
 * without jitter: as wide as the widest frame, from the highest top down to the idle pose's feet.
 * Returns { texture (idle), frames: { windup, strike }, aspect, height } or null.
 */
async function loadPoseSet(loader, p, baseHeight) {
  const names = ['idle', 'windup', 'strike'].filter((n) => p[n]);
  if (!p.idle) return null;
  const out = {};
  for (const name of names) {
    try {
      const img = (await loader.loadAsync(p[name])).image;
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, c.width, c.height);
      const info = cleanPose(px.data, c.width, c.height);
      if (!info) continue;
      g.putImageData(px, 0, 0);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      out[name] = { tex, info, w: c.width, h: c.height };
    } catch (err) {
      console.warn(`[assets] could not load ${name} pose ${p[name]}; holding the idle pose.`, err);
    }
  }
  const idle = out.idle;
  if (!idle) return null;
  const { w, h } = idle;
  const feet = idle.info.main.y1 + 1; // exclusive
  let x0 = w, x1 = 0, y0 = feet;
  for (const f of Object.values(out)) {
    if (f.w !== w || f.h !== h) continue; // a frame on a different canvas can't share the crop
    x0 = Math.min(x0, f.info.bbox.x0);
    x1 = Math.max(x1, f.info.bbox.x1 + 1);
    y0 = Math.min(y0, f.info.bbox.y0);
  }
  for (const f of Object.values(out)) {
    f.tex.offset.set(x0 / w, (h - feet) / h);
    f.tex.repeat.set((x1 - x0) / w, (feet - y0) / h);
  }
  // world scale: the idle figure (its own top to its feet) stands baseHeight tall
  const wpp = baseHeight / Math.max(1, feet - idle.info.main.y0);
  const frames = {};
  for (const n of ['windup', 'strike']) if (out[n] && out[n].w === w && out[n].h === h) frames[n] = out[n].tex;
  return { texture: idle.tex, frames, aspect: (x1 - x0) / (feet - y0), height: (feet - y0) * wpp };
}

/**
 * Load every resolved sprite URL ({ id: url|null }); failures warn and keep the procedural figure.
 * `poses` ({ id: { idle, windup, strike } } of URLs) are optional pose art: a unit with an idle pose
 * stands on that, and its attack swaps to the windup / strike frames (see loadPoseSet).
 */
export async function loadUnitSprites(urls, poses = {}) {
  const loader = new THREE.TextureLoader();
  await Promise.all(Object.entries(urls).map(async ([id, url]) => {
    const tw = SPRITE_TWEAKS[id] ?? {};
    const baseHeight = tw.height ?? SPRITE_HEIGHT;
    const p = poses[id];
    if (p?.idle) {
      try {
        const set = await loadPoseSet(loader, p, baseHeight);
        if (set) {
          templates.set(id, { ...set, tw, url: p.idle, key: null });
          return;
        }
      } catch (err) {
        console.warn(`[assets] ${id}: pose art failed; falling back to the sprite.`, err);
      }
    }
    if (!url) return;
    try {
      const { texture, key } = keyCard(await loader.loadAsync(url), { ...SPRITE_KEY, ...tw.key });
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      const aspect = trim(texture);
      templates.set(id, { texture, aspect, height: baseHeight, tw, url, key, frames: {} });
    } catch (err) {
      failures.set(id, String(err?.message || err));
      console.warn(`[assets] ${id}: could not load sprite ${url}; using the built-in figure.`, err);
    }
  }));
  return spriteStatus();
}

export function hasUnitSprite(id) {
  return templates.has(id);
}

export function spriteStatus() {
  return {
    loaded: [...templates.entries()].map(([id, t]) => ({
      id, url: t.url, height: t.height, aspect: +t.aspect.toFixed(3), poses: Object.keys(t.frames ?? {}),
      keyed: !!t.key?.keyed, kept: t.key?.keyed ? +t.key.kept.toFixed(3) : null,
    })),
    failed: Object.fromEntries(failures),
  };
}

const _v = new THREE.Vector3();
const _r = new THREE.Vector3();

// deploy drop
const DROP = 0.18, DROP_H = 2.0;
// attack state machine (seconds): crouch/lean back -> explosive snap -> frozen contact -> spring home
export const ATTACK = { ANTICIPATE: 0.07, LUNGE: 0.08, HIT_STOP: 0.06, OVERSHOOT_RECOIL: 0.14 };
const T_LUNGE = ATTACK.ANTICIPATE;
const T_STOP = T_LUNGE + ATTACK.LUNGE;
const T_RECOIL = T_STOP + ATTACK.HIT_STOP;
const T_END = T_RECOIL + ATTACK.OVERSHOOT_RECOIL;
const easeOut2 = (k) => 1 - (1 - k) * (1 - k);
const easeOutExpo = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
// damped harmonic spring from 1 to 0 over k = 0..1: dips ~10% past rest (backward), settles at 0
const spring01 = (k) => Math.exp(-3 * k) * Math.cos(1.5 * Math.PI * k);

/** Which attack state a billboard is in, `atk` seconds after the attack started (-1 = idle). */
export function attackState(atk) {
  if (atk < 0 || atk >= T_END) return 'IDLE';
  if (atk < T_LUNGE) return 'ANTICIPATE';
  if (atk < T_STOP) return 'LUNGE';
  if (atk < T_RECOIL) return 'HIT_STOP';
  return 'OVERSHOOT_RECOIL';
}

/**
 * A fresh billboard for one tower: { root, parts: { body, art, shadow, ink }, height, sprite: true,
 * tick(t, dt, camera, atkDir) -> 'land' | 'impact' | 'land+impact' | null, playAttack(reach), state,
 * dispose() }. view.js resets root.position to the plate every frame and then calls tick(), which adds
 * the drop, lunge and idle on top and reports the landing / impact (hit-stop entry) moments so the
 * view can fire FX and SFX.
 */
export function instantiateSprite(id) {
  const t = templates.get(id);
  if (!t) return null;
  const { texture, aspect, height, tw, frames = {} } = t;
  const width = height * aspect;
  const breath = tw.breath ?? 0.04;
  const offset = Math.random() * Math.PI * 2; // de-sync neighbouring towers

  const root = new THREE.Group();
  const face = new THREE.Group(); // yaw-only billboard (stays upright, stays grounded)
  const body = new THREE.Group(); // breathing + attack squash, pivoting at the feet
  root.add(face);
  face.add(body);

  const layer = (color, grow, z) => {
    const m = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({
      color, map: texture, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide,
    }));
    m.scale.set(width + grow, height + grow, 1);
    m.position.set(0, -grow * 0.35, z);
    body.add(m);
    return m;
  };
  // comic cut-out border: black ink outside a white paper edge, then the art on top
  layer(0x050507, 0.11, -0.02);
  layer(0xffffff, 0.055, -0.01);
  const art = layer(0xffffff, 0, 0);
  const mats = [];
  body.traverse((o) => o.material && mats.push(o.material));

  // soft ink drop-shadow: the silhouette laid flat on the floor, stretching away from the camera
  const ink = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({
    color: 0x000000, map: texture, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide,
  }));
  ink.rotation.x = -Math.PI / 2;
  ink.position.y = 0.014;
  ink.renderOrder = -1;
  face.add(ink);
  mats.push(ink.material);

  const shadow = new THREE.Mesh(DISC, new THREE.MeshBasicMaterial({
    map: shadowTexture(), transparent: true, opacity: 0.5, depthWrite: false, color: 0x000000,
  }));
  shadow.position.y = 0.012;
  shadow.renderOrder = -1;
  const shW = Math.max(0.55, Math.min(width * 0.85, 1.3));
  shadow.scale.set(shW, 1, shW * 0.55);
  root.add(shadow);

  // afterimages: three tinted copies of the art that trail the dash and fade (speed read)
  const accent = new THREE.Color(tw.accent ?? (id === 'jester' ? '#ff1a3d' : UNITS[id]?.accent ?? '#ff1a3d'));
  const ghosts = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({
      color: accent.clone().lerp(new THREE.Color(0xffffff), 0.35), map: texture, transparent: true, opacity: 0,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    m.scale.set(width, height, 1);
    m.renderOrder = 2 - i;
    m.visible = false;
    root.add(m);
    mats.push(m.material);
    return m;
  });

  let mirror = 1;
  let drop = 0;      // 0..DROP while falling in, then DROP
  let atk = -1;      // seconds since the current attack started, -1 when idle
  let reach = tw.lunge ?? 0.4;
  let breathT = 0;
  let combo = 0;     // every third swing is a leaping finisher
  let finisher = false;
  let cast = -1;     // Persona cast pose: seconds since it started, -1 when not casting
  let hop = -1;      // a quick hop (Baton Pass received / idle fidget)
  let fidgetT = 4 + Math.random() * 5;
  const _g = new THREE.Vector3();
  const _w = new THREE.Vector3();
  return {
    root,
    parts: { body, art, shadow, ink },
    height,
    sprite: true,
    get landed() { return drop >= DROP; },
    get state() { return attackState(atk); },
    poses: Object.keys(frames),
    /** Blocking: fall onto a new plate (the view moves root first). */
    redeploy() {
      drop = 0;
      atk = -1;
    },
    tick(time, dt, camera, atkDir) {
      let event = null;
      // yaw-only billboard toward the camera
      root.getWorldPosition(_v);
      face.rotation.y = Math.atan2(camera.position.x - _v.x, camera.position.z - _v.z) - root.rotation.y;
      // optional mirroring so the art faces its target (only when the manifest says which way it faces)
      if (tw.face && atkDir.lengthSq() > 1e-6) {
        _r.set(1, 0, 0).applyQuaternion(camera.quaternion);
        const side = Math.sign(_r.dot(atkDir)) || mirror;
        mirror = tw.face === 'left' ? -side : side;
      }

      // deployment drop: fall from DROP_H onto the plate (gravity ease-in), then land
      let fall = 0;
      if (drop < DROP) {
        drop = Math.min(DROP, drop + dt);
        const k = drop / DROP;
        fall = DROP_H * (1 - k * k);
        if (drop >= DROP) event = 'land';
      }

      // attack state machine: ANTICIPATE (crouch, lean back) -> LUNGE (explosive snap) -> HIT_STOP
      // (frozen on contact) -> OVERSHOOT_RECOIL (damped spring home, dipping slightly backward)
      let lunge = 0, sx = 1, sy = 1, lean = 0, flash = 0, lift = 0;
      if (atk >= 0) {
        const before = atk;
        atk += dt;
        if (before < T_STOP && atk >= T_STOP) event = event ? `${event}+impact` : 'impact'; // even on a long frame
        if (atk < T_LUNGE) {
          const k = easeOut2(atk / T_LUNGE);
          sx = 1 + 0.16 * k;
          sy = 1 - 0.16 * k;
          lean = -0.12 * k;
          lunge = -0.04 * reach * k; // a hair of wind-up backward
        } else if (atk < T_STOP) {
          const k = easeOutExpo((atk - T_LUNGE) / ATTACK.LUNGE);
          lunge = reach * (k * 1.04 - 0.04);
          sx = 1.16 - 0.26 * k; // stretch along the dash
          sy = 0.84 + 0.3 * k;
          lean = -0.12 + 0.28 * k;
          if (finisher) lift = Math.sin(k * Math.PI * 0.85) * 0.42; // leap into the finisher
        } else if (atk < T_RECOIL) {
          // hit-stop: hold the contact pose (impact squash), no breathing, no motion
          lunge = reach;
          sx = finisher ? 1.22 : 1.15;
          sy = finisher ? 0.8 : 0.85;
          lean = finisher ? 0.26 : 0.16;
          flash = 1;
        } else if (atk < T_END) {
          const f = spring01((atk - T_RECOIL) / ATTACK.OVERSHOOT_RECOIL);
          lunge = reach * f;
          sx = 1 + 0.15 * f;
          sy = 1 - 0.15 * f;
          lean = 0.16 * f;
        } else {
          atk = -1;
        }
      }
      const state = attackState(atk);
      const stopped = state === 'HIT_STOP';
      // pose art: windup while anticipating, strike through the lunge, contact and first half of the
      // recoil, idle otherwise (falls back to the idle art for any missing frame)
      const frame = state === 'ANTICIPATE' ? frames.windup
        : state === 'LUNGE' || stopped || (state === 'OVERSHOOT_RECOIL' && atk < T_RECOIL + ATTACK.OVERSHOOT_RECOIL * 0.5) ? frames.strike : null;
      const map = frame ?? texture;
      if (art.material.map !== map) for (const m of mats) m.map = map;
      if (lunge) root.position.addScaledVector(atkDir, lunge);

      // afterimages: during the dash and contact, ghosts sit back along the path and fade
      const dashing = state === 'LUNGE' || stopped;
      for (let i = 0; i < ghosts.length; i++) {
        const gm = ghosts[i];
        gm.visible = dashing && reach > 0.2;
        if (!gm.visible) continue;
        const back = lunge * (0.28 + i * 0.24);
        root.getWorldPosition(_w);
        _g.copy(_w).addScaledVector(atkDir, -back);
        root.worldToLocal(_g);
        gm.position.set(_g.x, lift * (1 - i * 0.3), _g.z);
        gm.quaternion.copy(face.quaternion);
        gm.scale.set(mirror * width * sx, height * sy, 1);
        gm.material.opacity = (stopped ? 0.22 : 0.34) / (1 + i);
      }

      // Persona cast: rise, glow and hold the strike pose while the Persona appears
      let castLift = 0, glow = 0;
      if (cast >= 0) {
        cast += dt;
        const k = cast / 1.1;
        if (k >= 1) cast = -1;
        else {
          castLift = Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * 0.3 * (1 - Math.max(0, (k - 0.7) / 0.3));
          glow = 0.6 * Math.sin(k * Math.PI);
          sx *= 1 + 0.05 * Math.sin(k * 20) * (1 - k);
        }
      }
      // hops: Baton received, or an idle fidget every few seconds
      if (atk < 0 && cast < 0 && drop >= DROP) {
        fidgetT -= dt;
        if (fidgetT <= 0) {
          hop = 0;
          fidgetT = 5 + Math.random() * 6;
        }
      }
      let hopLift = 0;
      if (hop >= 0) {
        hop += dt;
        const k = hop / 0.34;
        if (k >= 1) hop = -1;
        else {
          hopLift = Math.sin(k * Math.PI) * 0.14;
          sy *= k < 0.15 ? 1 - k * 0.8 : k > 0.85 ? 1 - (1 - k) * 0.8 : 1 + 0.04;
        }
      }
      const sway = Math.sin(breathT * 0.9 + offset * 2) * 0.025; // weight shift
      if (cast >= 0 || (state === 'LUNGE' || stopped) && finisher) {
        // a strike frame for the cast / finisher if there is one
        const f = frames.strike ?? texture;
        if (art.material.map !== f) for (const m of mats) m.map = f;
      }

      // breathing idle: vertical bob + a small scale pulse, shadow shrinks/fades as the body rises
      if (!stopped) breathT += dt; // hit-stop freezes the idle too
      const s = Math.sin(breathT * 3.0 + offset);
      body.position.y = fall + s * breath + lift + castLift + hopLift;
      body.scale.set(mirror * sx, (1 + s * 0.02) * sy, 1);
      body.rotation.z = -mirror * (lean + (atk < 0 ? sway : 0));
      ink.scale.set(mirror * width * sx, height * 0.42, 1);
      const high = Math.min(1, (s + 1) * 0.5 + fall + (lift + castLift + hopLift) * 2); // 0 = low, 1 = high
      const sh = 1.04 - high * 0.08 - Math.min(fall, 1) * 0.4;
      shadow.scale.set(shW * sh, 1, shW * 0.55 * sh);
      shadow.material.opacity = 0.52 - high * 0.12;
      ink.material.opacity = fall > 0 ? 0.3 * Math.max(0, 1 - fall) : 0.3;
      art.material.color.setScalar(1 + flash * 0.75 + glow); // brief hit flash / cast glow
      return event;
    },
    /** Start an ANTICIPATE -> LUNGE -> HIT_STOP -> OVERSHOOT_RECOIL cycle; `dist` = dash length. */
    playAttack(dist) {
      if (dist != null) reach = dist;
      atk = 0;
      combo++;
      finisher = combo % 3 === 0 && reach > 0.2;
      return true;
    },
    /** Was the swing just started a leaping finisher? (the view adds a bigger impact) */
    get finisher() { return finisher; },
    /** Persona summon: rise and glow while the Persona appears. */
    playCast() {
      cast = 0;
    },
    /** A quick hop (Baton Pass received). */
    playHop() {
      hop = 0;
    },
    dispose() {
      body.traverse((o) => o.material?.dispose());
      shadow.material.dispose();
      ink.material.dispose();
    },
  };
}
