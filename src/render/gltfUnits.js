// Imported unit models: GLTFLoader -> normalized, toon-shaded, ink-outlined templates that are
// cloned per tower with SkeletonUtils (rigged meshes and their animations are reused safely).
// Units with no model file keep their procedural figure from models.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toon, outline, shadows } from './toon.js';
import { MODEL_HEIGHT, MODEL_TWEAKS } from '../assets/manifest.js';

/** Loaded templates by unit id: { scene, clips, height, idle, attack }. */
const templates = new Map();
const failures = new Map();

/** Convert any glTF material to the house cel shader, keeping its colour, textures and alpha. */
function toonify(src) {
  const color = src.color ? src.color.clone() : new THREE.Color(0xffffff);
  const m = toon(color, {
    unique: true,
    map: src.map ?? null,
    transparent: src.transparent,
    opacity: src.opacity ?? 1,
    side: src.side,
    spec: 0.4,
    rim: 0.6,
  });
  if (src.map) src.map.colorSpace = THREE.SRGBColorSpace;
  if (src.alphaMap) m.alphaMap = src.alphaMap;
  if (src.alphaTest) m.alphaTest = src.alphaTest;
  if (src.normalMap) { m.normalMap = src.normalMap; m.normalScale.copy(src.normalScale); }
  if (src.emissiveMap || (src.emissive && src.emissive.getHex() !== 0)) {
    m.emissive.copy(src.emissive ?? new THREE.Color(0xffffff));
    m.emissiveMap = src.emissiveMap ?? null;
    m.emissiveIntensity = src.emissiveIntensity ?? 1;
  }
  m.vertexColors = !!src.vertexColors;
  m.name = src.name;
  return m;
}

/**
 * Fit a glTF scene to `height` world units: scale by its Box3 height, centre it on x/z and put its
 * lowest point at y = 0 so feet never sink into the plates. Returns the wrapper group.
 */
export function normalize(object, height = MODEL_HEIGHT, yaw = 0) {
  const wrap = new THREE.Group();
  const turn = new THREE.Group();
  turn.rotation.y = yaw;
  turn.add(object);
  wrap.add(turn);
  wrap.updateMatrixWorld(true);
  // precise: skinned meshes are measured in their bound pose, not the raw geometry
  const box = new THREE.Box3().setFromObject(turn, true);
  const size = box.getSize(new THREE.Vector3());
  const s = size.y > 1e-6 ? height / size.y : 1;
  turn.scale.setScalar(s);
  const c = box.getCenter(new THREE.Vector3());
  turn.position.set(-c.x * s, -box.min.y * s, -c.z * s);
  wrap.updateMatrixWorld(true);
  wrap.userData.fit = { scale: s, size: size.multiplyScalar(s) };
  return wrap;
}

function prepare(gltf, id) {
  const tw = MODEL_TWEAKS[id] ?? {};
  const scene = gltf.scene || gltf.scenes[0];
  const mats = new Map();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (m) => {
      if (!mats.has(m)) mats.set(m, toonify(m));
      return mats.get(m);
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    o.frustumCulled = !o.isSkinnedMesh; // skinned bounds lag the animation
  });
  const height = tw.height ?? MODEL_HEIGHT;
  const root = normalize(scene, height, tw.yaw ?? 0);
  outline(root, 0.018, 0x050507, { worldSpace: true });
  shadows(root, true, false);
  const clips = gltf.animations || [];
  const find = (re, fallback) => clips.find((c) => re.test(c.name)) ?? fallback;
  const idle = find(new RegExp(tw.idle ?? 'idle|stand|breath', 'i'), clips[0]);
  const attack = find(new RegExp(tw.attack ?? 'attack|slash|punch|strike|cast|shoot', 'i'), null);
  return { scene: root, clips, height, idle, attack };
}

/**
 * Load every resolved model URL ({ id: url|null }). Resolves once all have loaded or failed;
 * failures are logged as warnings and the unit keeps its procedural figure.
 */
export async function loadUnitModels(urls) {
  const loader = new GLTFLoader();
  await Promise.all(Object.entries(urls).map(async ([id, url]) => {
    if (!url) return;
    try {
      const gltf = await loader.loadAsync(url);
      templates.set(id, prepare(gltf, id));
    } catch (err) {
      failures.set(id, String(err?.message || err));
      console.warn(`[assets] ${id}: could not load ${url}; using the built-in figure.`, err);
    }
  }));
  return status();
}

export function hasUnitModel(id) {
  return templates.has(id);
}

export function status() {
  return {
    loaded: [...templates.entries()].map(([id, t]) => ({ id, clips: t.clips.map((c) => c.name), height: t.height })),
    failed: Object.fromEntries(failures),
  };
}

/**
 * A fresh instance for one tower: { root, parts: {}, gltf: true, mixer, playAttack(), height }.
 * The procedural animator in view.js skips part-wise posing for these.
 */
export function instantiateUnit(id) {
  const t = templates.get(id);
  if (!t) return null;
  const inner = SkeletonUtils.clone(t.scene);
  const root = new THREE.Group();
  root.add(inner);
  const mixer = t.clips.length ? new THREE.AnimationMixer(inner) : null;
  let idle = null;
  if (mixer && t.idle) {
    idle = mixer.clipAction(t.idle);
    idle.play();
    idle.time = Math.random() * t.idle.duration; // de-sync neighbouring towers
  }
  let atk = null;
  if (mixer && t.attack && t.attack !== t.idle) {
    atk = mixer.clipAction(t.attack);
    atk.setLoop(THREE.LoopOnce, 1);
    atk.clampWhenFinished = false;
    mixer.addEventListener('finished', (e) => {
      if (e.action === atk && idle) {
        idle.enabled = true;
        idle.crossFadeFrom(atk, 0.15, false);
      }
    });
  }
  return {
    root,
    parts: { body: inner },
    height: t.height,
    gltf: true,
    mixer,
    playAttack() {
      if (!atk) return false;
      atk.reset().play();
      if (idle) atk.crossFadeFrom(idle, 0.08, false);
      return true;
    },
  };
}
