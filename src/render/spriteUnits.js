// 2D billboard units: a standing PNG becomes a camera-facing paper cut-out on its plate, with an
// ink + paper border, a breathing idle, an attack squash and a soft ground shadow that breathes with it.
// Used for units that have a sprite (or cut-in) PNG but no .glb; units with neither keep the
// procedural figure from models.js.
import * as THREE from 'three';
import { SPRITE_HEIGHT, SPRITE_TWEAKS } from '../assets/manifest.js';

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

/** Load every resolved sprite URL ({ id: url|null }); failures warn and keep the procedural figure. */
export async function loadUnitSprites(urls) {
  const loader = new THREE.TextureLoader();
  await Promise.all(Object.entries(urls).map(async ([id, url]) => {
    if (!url) return;
    try {
      const texture = await loader.loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      const aspect = trim(texture);
      const tw = SPRITE_TWEAKS[id] ?? {};
      templates.set(id, { texture, aspect, height: tw.height ?? SPRITE_HEIGHT, tw, url });
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
    loaded: [...templates.entries()].map(([id, t]) => ({ id, url: t.url, height: t.height, aspect: +t.aspect.toFixed(3) })),
    failed: Object.fromEntries(failures),
  };
}

const _v = new THREE.Vector3();
const _r = new THREE.Vector3();

/**
 * A fresh billboard for one tower: { root, parts: { body, art, shadow }, height, sprite: true,
 * tick(t, dt, camera, atkDir), playAttack(), dispose() }. view.js calls tick() every frame.
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

  const shadow = new THREE.Mesh(DISC, new THREE.MeshBasicMaterial({
    map: shadowTexture(), transparent: true, opacity: 0.5, depthWrite: false, color: 0x000000,
  }));
  shadow.position.y = 0.012;
  shadow.renderOrder = -1;
  const shW = Math.max(0.55, Math.min(width * 0.85, 1.3));
  shadow.scale.set(shW, 1, shW * 0.55);
  root.add(shadow);

  let kick = 0;
  let mirror = 1;
  return {
    root,
    parts: { body, art, shadow },
    height,
    sprite: true,
    tick(time, dt, camera, atkDir) {
      // yaw-only billboard toward the camera
      root.getWorldPosition(_v);
      face.rotation.y = Math.atan2(camera.position.x - _v.x, camera.position.z - _v.z) - root.rotation.y;
      // optional mirroring so the art faces its target (only when the manifest says which way it faces)
      if (tw.face && atkDir.lengthSq() > 1e-6) {
        _r.set(1, 0, 0).applyQuaternion(camera.quaternion);
        const side = Math.sign(_r.dot(atkDir)) || mirror;
        mirror = tw.face === 'left' ? -side : side;
      }
      // breathing idle: vertical bob + a small scale pulse, shadow shrinks/fades as the body rises
      const s = Math.sin(time * 3.0 + offset);
      kick = Math.max(0, kick - dt * 5);
      const k = Math.sin(kick * Math.PI);
      body.position.y = s * breath;
      body.scale.set(mirror * (1 + k * 0.1), (1 + s * 0.02) * (1 - k * 0.07), 1);
      body.rotation.z = -mirror * k * 0.12;
      const lift = (s + 1) * 0.5; // 0 = low, 1 = high
      shadow.scale.set(shW * (1.04 - lift * 0.08), 1, shW * 0.55 * (1.04 - lift * 0.08));
      shadow.material.opacity = 0.52 - lift * 0.12;
      art.material.color.setScalar(1 + k * 0.6); // brief hit flash
    },
    playAttack() {
      kick = 1;
      return true;
    },
    dispose() {
      body.traverse((o) => o.material?.dispose());
      shadow.material.dispose();
    },
  };
}
