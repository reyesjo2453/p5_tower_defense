// 2D billboard units: a standing PNG becomes a camera-facing paper cut-out on its plate, with an
// ink + paper border, a breathing idle, a drop-in deploy, a spring-eased attack state machine
// (IDLE -> ANTICIPATE -> LUNGE -> HIT_STOP -> OVERSHOOT_RECOIL -> IDLE), a soft
// ground shadow that breathes with it and a flat ink silhouette shadow on the floor.
// Card-style art with a black backdrop is keyed first (keyout.js) so only the figure stands up.
// Used for units that have a sprite (or cut-in) PNG but no .glb; units with neither keep the
// procedural figure from models.js.
import * as THREE from 'three';
import { SPRITE_HEIGHT, SPRITE_TWEAKS, SPRITE_KEY } from '../assets/manifest.js';
import { keyOut, needsKey } from './keyout.js';

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

/** Load every resolved sprite URL ({ id: url|null }); failures warn and keep the procedural figure. */
export async function loadUnitSprites(urls) {
  const loader = new THREE.TextureLoader();
  await Promise.all(Object.entries(urls).map(async ([id, url]) => {
    if (!url) return;
    try {
      const tw = SPRITE_TWEAKS[id] ?? {};
      const { texture, key } = keyCard(await loader.loadAsync(url), { ...SPRITE_KEY, ...tw.key });
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      const aspect = trim(texture);
      templates.set(id, { texture, aspect, height: tw.height ?? SPRITE_HEIGHT, tw, url, key });
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
      id, url: t.url, height: t.height, aspect: +t.aspect.toFixed(3),
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
  const { texture, aspect, height, tw } = t;
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

  // soft ink drop-shadow: the silhouette laid flat on the floor, stretching away from the camera
  const ink = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({
    color: 0x000000, map: texture, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide,
  }));
  ink.rotation.x = -Math.PI / 2;
  ink.position.y = 0.014;
  ink.renderOrder = -1;
  face.add(ink);

  const shadow = new THREE.Mesh(DISC, new THREE.MeshBasicMaterial({
    map: shadowTexture(), transparent: true, opacity: 0.5, depthWrite: false, color: 0x000000,
  }));
  shadow.position.y = 0.012;
  shadow.renderOrder = -1;
  const shW = Math.max(0.55, Math.min(width * 0.85, 1.3));
  shadow.scale.set(shW, 1, shW * 0.55);
  root.add(shadow);

  let mirror = 1;
  let drop = 0;      // 0..DROP while falling in, then DROP
  let atk = -1;      // seconds since the current attack started, -1 when idle
  let reach = tw.lunge ?? 0.4;
  let breathT = 0;
  return {
    root,
    parts: { body, art, shadow, ink },
    height,
    sprite: true,
    get landed() { return drop >= DROP; },
    get state() { return attackState(atk); },
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
      let lunge = 0, sx = 1, sy = 1, lean = 0, flash = 0;
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
        } else if (atk < T_RECOIL) {
          // hit-stop: hold the contact pose (impact squash), no breathing, no motion
          lunge = reach;
          sx = 1.15;
          sy = 0.85;
          lean = 0.16;
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
      const stopped = attackState(atk) === 'HIT_STOP';
      if (lunge) root.position.addScaledVector(atkDir, lunge);

      // breathing idle: vertical bob + a small scale pulse, shadow shrinks/fades as the body rises
      if (!stopped) breathT += dt; // hit-stop freezes the idle too
      const s = Math.sin(breathT * 3.0 + offset);
      body.position.y = fall + s * breath;
      body.scale.set(mirror * sx, (1 + s * 0.02) * sy, 1);
      body.rotation.z = -mirror * lean;
      ink.scale.set(mirror * width * sx, height * 0.42, 1);
      const lift = Math.min(1, (s + 1) * 0.5 + fall); // 0 = low, 1 = high
      const sh = 1.04 - lift * 0.08 - Math.min(fall, 1) * 0.4;
      shadow.scale.set(shW * sh, 1, shW * 0.55 * sh);
      shadow.material.opacity = 0.52 - lift * 0.12;
      ink.material.opacity = fall > 0 ? 0.3 * Math.max(0, 1 - fall) : 0.3;
      art.material.color.setScalar(1 + flash * 0.75); // brief hit flash
      return event;
    },
    /** Start an ANTICIPATE -> LUNGE -> HIT_STOP -> OVERSHOOT_RECOIL cycle; `dist` = dash length. */
    playAttack(dist) {
      if (dist != null) reach = dist;
      atk = 0;
      return true;
    },
    dispose() {
      body.traverse((o) => o.material?.dispose());
      shadow.material.dispose();
      ink.material.dispose();
    },
  };
}
