// Pooled 3D effects: golden mask shards, black/red ink eruptions, blade slashes, knuckle shockwaves,
// drone beams, hit sparks and fluttering calling cards. Everything is instanced for mobile GPUs.
import * as THREE from 'three';
import { toon, glowMat } from './toon.js';
import { cardTexture } from './models.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

class Pool {
  constructor(scene, geo, mat, max) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, ZERO);
    scene.add(this.mesh);
    this.items = [];
    this.max = max;
    this.colors = null;
  }

  spawn(o) {
    if (this.items.length >= this.max) this.items.shift();
    o.age = 0;
    this.items.push(o);
    return o;
  }

  update(dt, fn) {
    this.items = this.items.filter((it) => (it.age += dt) < it.life);
    let i = 0;
    for (const it of this.items) {
      fn(it, dt);
      _e.set(it.rx || 0, it.ry || 0, it.rz || 0);
      _q.setFromEuler(_e);
      const k = it.scaleFn ? it.scaleFn(it.age / it.life) : 1;
      _s.set((it.sx ?? it.s ?? 1) * k, (it.sy ?? it.s ?? 1) * k, (it.sz ?? it.s ?? 1) * k);
      _p.set(it.x, it.y, it.z);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
      if (this.colors && it.color) this.mesh.setColorAt(i, it.color);
      i++;
    }
    for (; i < this.max; i++) this.mesh.setMatrixAt(i, ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.shards = new Pool(scene, new THREE.TetrahedronGeometry(0.06), toon(0xffc93a, { spec: 2, shininess: 120, rim: 1, emissive: 0x302000 }), 260);
    const inkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.ink = new Pool(scene, new THREE.IcosahedronGeometry(0.05, 0), inkMat, 420);
    this.ink.colors = true;
    this.ink.mesh.setColorAt(0, new THREE.Color(0));
    this.sparks = new Pool(scene, new THREE.OctahedronGeometry(0.03), glowMat(0xfff2c0, 3), 220);
    this.cards = new Pool(scene, new THREE.PlaneGeometry(0.22, 0.33), new THREE.MeshBasicMaterial({ map: cardTexture(), side: THREE.DoubleSide }), 140);
    this.transient = []; // meshes with their own lifetime (slashes, rings, beams)
    this.slashGeo = new THREE.TorusGeometry(0.42, 0.025, 4, 32, Math.PI * 1.1);
    this.ringGeo = new THREE.TorusGeometry(0.3, 0.035, 6, 40);
    this.beamGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 6, 1, true);
    this.beamGeo.rotateX(Math.PI / 2);
    this.beamGeo.translate(0, 0, 0.5);
    this.inkBlack = new THREE.Color(0x050505);
    this.inkRed = new THREE.Color(0xc4001f);
  }

  // ---------------------------------------------------------------- emitters
  burstSparks(p, n = 8, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 1.5 + Math.random() * 2.5;
      this.sparks.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * v, vy: 1 + Math.random() * 2.5, vz: Math.sin(a) * v, life: 0.35 + Math.random() * 0.2, s: 1, scaleFn: (k) => 1 - k, color });
    }
  }

  /** Posture break: the gold porcelain mask shatters, black/red ink erupts. */
  shatter(p) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 1.2 + Math.random() * 2.8;
      this.shards.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * v, vy: 2 + Math.random() * 3, vz: Math.sin(a) * v, rx: Math.random() * 6, ry: Math.random() * 6, rz: 0, wr: (Math.random() - 0.5) * 20, life: 1.1 + Math.random() * 0.5, s: 0.7 + Math.random() * 1.1, bounce: true });
    }
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 0.6 + Math.random() * 2.4;
      const red = Math.random() < 0.38;
      this.ink.spawn({ x: p.x, y: p.y - 0.2, z: p.z, vx: Math.cos(a) * v, vy: 1.5 + Math.random() * 4, vz: Math.sin(a) * v, life: 0.7 + Math.random() * 0.6, s: 0.8 + Math.random() * 2.2, color: red ? this.inkRed : this.inkBlack, scaleFn: (k) => (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) * 0.9), drag: 1.5 });
    }
    this.ring(p, 0xffc93a, 1.8, 0.35);
  }

  /** Death puff: ink only. */
  inkBurst(p, n = 22) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 0.4 + Math.random() * 1.6;
      this.ink.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * v, vy: 0.8 + Math.random() * 2.5, vz: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, s: 0.8 + Math.random() * 1.5, color: Math.random() < 0.25 ? this.inkRed : this.inkBlack, scaleFn: (k) => 1 - k, drag: 2 });
    }
  }

  cardsRain(n = 90, spread = 7) {
    for (let i = 0; i < n; i++) {
      this.cards.spawn({
        x: (Math.random() - 0.5) * spread * 2, y: 4 + Math.random() * 5, z: (Math.random() - 0.5) * spread * 2,
        vx: (Math.random() - 0.5) * 1.5, vy: -1.2 - Math.random() * 1.5, vz: (Math.random() - 0.5) * 1.5,
        rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6, wr: 3 + Math.random() * 5,
        life: 3.5 + Math.random() * 2.5, s: 1, flutter: Math.random() * 10, land: true,
      });
    }
  }

  slash(p, angle, color = 0xffffff) {
    const m = new THREE.Mesh(this.slashGeo, glowMat(color, 3, { transparent: true, opacity: 1, additive: true, depthWrite: false }));
    m.position.copy(p);
    m.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.8, 0, -angle + Math.PI * 0.45);
    this.transient.push({ mesh: m, age: 0, life: 0.2, kind: 'slash' });
    this.scene.add(m);
  }

  ring(p, color, maxScale = 2, life = 0.3) {
    const m = new THREE.Mesh(this.ringGeo, glowMat(color, 2.5, { transparent: true, opacity: 1, additive: true, depthWrite: false }));
    m.position.copy(p);
    m.rotation.x = Math.PI / 2;
    this.transient.push({ mesh: m, age: 0, life, kind: 'ring', maxScale });
    this.scene.add(m);
  }

  beam(from, to, color = 0x39ff88) {
    const m = new THREE.Mesh(this.beamGeo, glowMat(color, 3, { transparent: true, opacity: 1, additive: true, depthWrite: false }));
    m.position.copy(from);
    m.lookAt(to);
    m.scale.set(1, 1, from.distanceTo(to));
    this.transient.push({ mesh: m, age: 0, life: 0.18, kind: 'beam' });
    this.scene.add(m);
  }

  /** Flat dust shockwave on the floor (deployment landing). */
  dust(p, maxScale = 2.6, life = 0.32) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xe9e1d2, transparent: true, opacity: 0.85, depthWrite: false }));
    m.position.copy(p);
    m.rotation.x = Math.PI / 2;
    this.transient.push({ mesh: m, age: 0, life, kind: 'dust', maxScale });
    this.scene.add(m);
  }

  /**
   * 2D comic impact burst at the point of contact: a camera-facing ink starburst ('punch' = yellow
   * POW star, 'slash' = white diagonal slash cut, 'tech' = green glitch star). Pops then fades.
   */
  comicBurst(p, kind = 'punch', size = 0.9) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: burstTexture(kind), transparent: true, depthTest: false, depthWrite: false }));
    m.position.copy(p);
    m.material.rotation = (Math.random() - 0.5) * 0.9;
    m.renderOrder = 10;
    this.transient.push({ mesh: m, age: 0, life: 0.24, kind: 'burst', size });
    this.scene.add(m);
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const g = 9;
    this.shards.update(dt, (it) => {
      it.vy -= g * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.z += it.vz * dt;
      if (it.y < 0.05 && it.bounce) {
        it.y = 0.05;
        it.vy *= -0.35;
        it.vx *= 0.6;
        it.vz *= 0.6;
      }
      it.rx += it.wr * dt;
      it.ry += it.wr * 0.7 * dt;
    });
    this.ink.update(dt, (it) => {
      it.vy -= g * 0.6 * dt;
      const d = Math.exp(-it.drag * dt);
      it.vx *= d;
      it.vz *= d;
      it.x += it.vx * dt;
      it.y = Math.max(0.04, it.y + it.vy * dt);
      it.z += it.vz * dt;
    });
    this.sparks.update(dt, (it) => {
      it.vy -= g * 0.5 * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.z += it.vz * dt;
    });
    this.cards.update(dt, (it) => {
      it.flutter += dt * 4;
      if (it.y > 0.03) {
        it.x += (it.vx + Math.sin(it.flutter) * 0.8) * dt;
        it.y += it.vy * dt;
        it.z += (it.vz + Math.cos(it.flutter * 0.8) * 0.8) * dt;
        it.rx += it.wr * dt;
        it.rz += it.wr * 0.6 * dt;
      } else {
        it.y = 0.03;
        it.rx = -Math.PI / 2;
        it.ry = 0;
      }
    });
    this.transient = this.transient.filter((tr) => {
      tr.age += dt;
      const k = tr.age / tr.life;
      if (k >= 1) {
        this.scene.remove(tr.mesh);
        tr.mesh.material.dispose(); // burst textures are shared and cached, only the material goes
        return false;
      }
      if (tr.kind === 'slash') {
        tr.mesh.scale.setScalar(0.8 + k * 0.5);
        tr.mesh.material.opacity = 1 - k;
      } else if (tr.kind === 'ring') {
        tr.mesh.scale.setScalar(0.3 + k * tr.maxScale);
        tr.mesh.material.opacity = 1 - k;
      } else if (tr.kind === 'dust') {
        tr.mesh.scale.set(0.3 + k * tr.maxScale, 0.3 + k * tr.maxScale, 1 + (1 - k) * 3);
        tr.mesh.material.opacity = 0.85 * (1 - k) * (1 - k);
      } else if (tr.kind === 'burst') {
        const pop = k < 0.3 ? 0.45 + (k / 0.3) * 0.75 : 1.2 - (k - 0.3) * 0.25;
        tr.mesh.scale.setScalar(tr.size * pop);
        tr.mesh.material.opacity = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
      } else if (tr.kind === 'beam') {
        tr.mesh.material.opacity = 1 - k;
        tr.mesh.scale.x = tr.mesh.scale.y = 1 + k * 2;
      }
      return true;
    });
  }
}

// cached canvas textures for comicBurst()
const bursts = {};
function burstTexture(kind) {
  if (bursts[kind]) return bursts[kind];
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const star = (n, r0, r1, rot, fill, stroke, lw) => {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 ? r0 : r1 * (0.82 + ((i * 37) % 7) / 30);
      g.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
  };
  g.lineJoin = 'miter';
  if (kind === 'slash') {
    star(9, 40, 92, 0.2, '#e8002d', '#050505', 8);
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(-0.7);
    for (const [w, col] of [[30, '#050505'], [18, '#ffffff']]) {
      g.beginPath();
      g.moveTo(-118, 0); g.lineTo(0, -w / 2); g.lineTo(118, 0); g.lineTo(0, w / 2); g.closePath();
      g.fillStyle = col;
      g.fill();
    }
    g.restore();
  } else {
    const tech = kind === 'tech';
    star(12, 52, 118, 0, '#050505');
    star(12, 46, 104, 0, tech ? '#39ff88' : '#ffe600', '#050505', 6);
    star(8, 22, 48, 0.3, '#ffffff');
  }
  bursts[kind] = new THREE.CanvasTexture(c);
  bursts[kind].colorSpace = THREE.SRGBColorSpace;
  return bursts[kind];
}
