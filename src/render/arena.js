// The isometric arena: reflective obsidian floor, raised crimson runway with gold neon edges,
// treasure dais, build-slot markers and the lighting rig.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { GRID, CENTER } from '../sim/data.js';
import { toon, glowMat, shadows } from './toon.js';
import { buildCrown } from './models.js';

export const RUNWAY_H = 0.18;
export const SLOT_H = 0.06;

/** Tile (x, y) on the sim grid -> world position (board centred on the origin). */
export function world(x, y, h = 0) {
  return new THREE.Vector3(x - CENTER.x, h, y - CENTER.y);
}

export function buildArena(scene, board, { quality = 'high' } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  const half = GRID / 2;

  // --- reflective floor: a Reflector under a semi-transparent obsidian tile layer
  if (quality === 'high') {
    const mirror = new Reflector(new THREE.PlaneGeometry(GRID + 6, GRID + 6), {
      textureWidth: Math.min(1024, window.innerWidth * window.devicePixelRatio * 0.5),
      textureHeight: Math.min(1024, window.innerHeight * window.devicePixelRatio * 0.5),
      color: 0x22222a,
    });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = -0.002;
    group.add(mirror);
  }
  const tileMat = toon(0x0a0a0e, { spec: 1.4, shininess: 220, rim: 0, transparent: quality === 'high', opacity: quality === 'high' ? 0.78 : 1 });
  const tileGeo = new THREE.BoxGeometry(0.96, 0.04, 0.96);
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, (GRID + 4) * (GRID + 4));
  let n = 0;
  const m4 = new THREE.Matrix4();
  for (let y = -2; y < GRID + 2; y++) {
    for (let x = -2; x < GRID + 2; x++) {
      m4.makeTranslation(x - CENTER.x, -0.02, y - CENTER.y);
      tiles.setMatrixAt(n++, m4);
    }
  }
  tiles.receiveShadow = true;
  group.add(tiles);
  // fine gold grid lines between tiles (very dim)
  const grid = new THREE.GridHelper(GRID + 4, GRID + 4, 0x6a4a10, 0x3a2a0c);
  grid.position.set(-0.5 + (GRID % 2 ? 0.5 : 0), 0.001, -0.5 + (GRID % 2 ? 0.5 : 0));
  grid.material.transparent = true;
  grid.material.opacity = 0.85;
  group.add(grid);

  // --- raised crimson runway with emissive gold borders
  const runMat = toon(0xd90429, { spec: 0.35, shininess: 120, rim: 0.15, rimColor: 0xffd0a0 });
  const runGeo = new THREE.BoxGeometry(1.0, RUNWAY_H, 1.0);
  const keys = [...board.runway];
  const runway = new THREE.InstancedMesh(runGeo, runMat, keys.length);
  keys.forEach((k, i) => {
    const [x, y] = k.split(',').map(Number);
    m4.makeTranslation(x - CENTER.x, RUNWAY_H / 2, y - CENTER.y);
    runway.setMatrixAt(i, m4);
  });
  runway.receiveShadow = true;
  group.add(runway);
  // neon border strips on runway edges that face non-runway tiles
  const neon = glowMat(0xffc400, 2.4);
  const edgeGeoX = new THREE.BoxGeometry(1.0, 0.035, 0.035);
  const edgeGeoZ = new THREE.BoxGeometry(0.035, 0.035, 1.0);
  const edgesX = [];
  const edgesZ = [];
  for (const k of keys) {
    const [x, y] = k.split(',').map(Number);
    const open = (dx, dy) => !board.runway.has(`${x + dx},${y + dy}`) && !(x + dx === CENTER.x && y + dy === CENTER.y);
    if (open(0, -1)) edgesX.push([x, y - 0.5]);
    if (open(0, 1)) edgesX.push([x, y + 0.5]);
    if (open(-1, 0)) edgesZ.push([x - 0.5, y]);
    if (open(1, 0)) edgesZ.push([x + 0.5, y]);
  }
  for (const [list, geo] of [[edgesX, edgeGeoX], [edgesZ, edgeGeoZ]]) {
    const im = new THREE.InstancedMesh(geo, neon, list.length);
    list.forEach(([x, y], i) => {
      m4.makeTranslation(x - CENTER.x, RUNWAY_H + 0.012, y - CENTER.y);
      im.setMatrixAt(i, m4);
    });
    group.add(im);
  }
  // marching chevrons (animated in update)
  const chevGeo = new THREE.PlaneGeometry(0.34, 0.34);
  const chevTex = chevronTexture();
  const chevMat = new THREE.MeshBasicMaterial({ map: chevTex, transparent: true, depthWrite: false, color: new THREE.Color(0xffd36b).multiplyScalar(1.6), toneMapped: false, blending: THREE.AdditiveBlending });

  // --- treasure dais
  const dais = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, 0.22, 8), toon(0x111116, { spec: 1.2, shininess: 160, rim: 0.4 }));
  base.position.y = 0.11;
  dais.add(base);
  const ringGlow = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.025, 6, 64), glowMat(0xffc400, 3));
  ringGlow.rotation.x = Math.PI / 2;
  ringGlow.position.y = 0.23;
  dais.add(ringGlow);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.16, 8), toon(0xd90429, { spec: 1, rim: 0.4 }));
  inner.position.y = 0.3;
  dais.add(inner);
  shadows(dais, true, true);
  group.add(dais);
  const crown = buildCrown();
  group.add(crown.root);
  // halo beam above the crown
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 4, 24, 1, true), glowMat(0xffc400, 0.5, { transparent: true, opacity: 0.08, additive: true, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 2.2;
  group.add(beam);

  // --- build slots (subtle plates, highlighted while placing)
  const slotGeo = new THREE.BoxGeometry(0.8, SLOT_H, 0.8);
  const slotMat = toon(0x16161e, { spec: 1.0, shininess: 120, rim: 0.3 });
  const slots = new THREE.InstancedMesh(slotGeo, slotMat, board.slots.length);
  board.slots.forEach((s, i) => {
    m4.makeTranslation(s.x - CENTER.x, SLOT_H / 2, s.y - CENTER.y);
    slots.setMatrixAt(i, m4);
  });
  slots.receiveShadow = true;
  group.add(slots);
  const slotGlowMat = glowMat(0x39ff88, 1.6, { transparent: true, opacity: 0.0, additive: true, depthWrite: false });
  const slotGlow = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.82, 0.82), slotGlowMat, board.slots.length);
  board.slots.forEach((s, i) => {
    m4.makeRotationX(-Math.PI / 2).setPosition(s.x - CENTER.x, SLOT_H + 0.005, s.y - CENTER.y);
    slotGlow.setMatrixAt(i, m4);
  });
  group.add(slotGlow);

  // --- spawn gates
  for (const path of [[0, 2], [10, 8]]) {
    const gate = new THREE.Group();
    const p = world(path[0], path[1]);
    gate.position.copy(p);
    for (const s of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), toon(0x0a0a0e, { spec: 1, rim: 0.6, rimColor: 0xff1a3d }));
      pillar.position.set(0, 0.8, s * 0.5);
      gate.add(pillar);
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 6, 24, Math.PI), glowMat(0xff1a3d, 3));
    arch.rotation.y = Math.PI / 2;
    arch.position.y = 1.6;
    gate.add(arch);
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.6), glowMat(0xff1a3d, 1, { transparent: true, opacity: 0.25, additive: true, depthWrite: false, side: THREE.DoubleSide }));
    portal.rotation.y = Math.PI / 2;
    portal.position.y = 0.8;
    gate.add(portal);
    group.add(gate);
  }

  // --- lighting: low ambient, strong key with sharp shadows, coloured rim lights
  const hemi = new THREE.HemisphereLight(0x6a5a8a, 0x100008, 0.8);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1e0, 1.7);
  key.position.set(-6, 12, 4);
  key.castShadow = quality !== 'low';
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -half - 2;
  key.shadow.camera.right = half + 2;
  key.shadow.camera.top = half + 2;
  key.shadow.camera.bottom = -half - 2;
  key.shadow.bias = -0.0015;
  scene.add(key);
  const rimR = new THREE.DirectionalLight(0xff2a4a, 1.6);
  rimR.position.set(8, 4, -8);
  scene.add(rimR);
  const rimB = new THREE.DirectionalLight(0x6f7bff, 1.0);
  rimB.position.set(-8, 3, -6);
  scene.add(rimB);
  const crownLight = new THREE.PointLight(0xffc400, 3, 4.5, 1.8);
  crownLight.position.set(0, 1.6, 0);
  scene.add(crownLight);

  const runwayTiles = keys.map((k) => k.split(',').map(Number));
  const chevrons = new THREE.InstancedMesh(chevGeo, chevMat, 60);
  group.add(chevrons);

  return {
    group, crown, slots, slotGlow, slotGlowMat, runway, beam, crownLight, key,
    update(t, placing) {
      crown.parts.crown.rotation.y = t * 0.8;
      crown.parts.crown.position.y = 1.4 + Math.sin(t * 1.6) * 0.08;
      crown.parts.jewel.rotation.y = -t * 2;
      beam.material.opacity = 0.07 + Math.sin(t * 2) * 0.02;
      crownLight.intensity = 2.6 + Math.sin(t * 3) * 0.6;
      slotGlowMat.opacity += ((placing ? 0.35 + Math.sin(t * 6) * 0.15 : 0) - slotGlowMat.opacity) * 0.2;
      // chevrons marching toward the crown along each path
      updateChevrons(chevrons, t);
    },
    runwayTiles,
  };
}

import { PATHS } from '../sim/data.js';
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _e = new THREE.Euler();
function updateChevrons(im, t) {
  let n = 0;
  for (const corners of Object.values(PATHS)) {
    const segs = [];
    let total = 0;
    for (let i = 0; i < corners.length - 1; i++) {
      const [ax, ay] = corners[i];
      const [bx, by] = corners[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      segs.push([ax, ay, bx, by, total, len]);
      total += len;
    }
    for (let d = (t * 0.9) % 1; d < total && n < im.count; d += 1) {
      for (const [ax, ay, bx, by, s0, len] of segs) {
        if (d > s0 + len) continue;
        const k = (d - s0) / len;
        _p.set(ax + (bx - ax) * k - CENTER.x, RUNWAY_H + 0.006, ay + (by - ay) * k - CENTER.y);
        _e.set(-Math.PI / 2, 0, -Math.atan2(by - ay, bx - ax));
        _q.setFromEuler(_e);
        _m.compose(_p, _q, _s);
        im.setMatrixAt(n++, _m);
        break;
      }
    }
  }
  for (; n < im.count; n++) {
    _m.makeScale(0, 0, 0);
    im.setMatrixAt(n, _m);
  }
  im.instanceMatrix.needsUpdate = true;
}

function chevronTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff';
  g.lineWidth = 9;
  g.lineJoin = 'miter';
  g.beginPath();
  g.moveTo(18, 12);
  g.lineTo(42, 32);
  g.lineTo(18, 52);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
