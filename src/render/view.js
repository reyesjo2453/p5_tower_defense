// Scene graph <-> simulation sync: models for units/enemies, animation, bars, FX dispatch,
// and the isometric camera rig (45deg view, -6deg Dutch roll, Baton Pass zoom).
import * as THREE from 'three';
import { BUILDERS, buildShadow } from './models.js';
import { world, RUNWAY_H, SLOT_H } from './arena.js';
import { GRID } from '../sim/data.js';

const DUTCH = THREE.MathUtils.degToRad(-6);
const AZIMUTH = THREE.MathUtils.degToRad(45);
const ELEVATION = THREE.MathUtils.degToRad(45);

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3();
    this.focus = new THREE.Vector3();
    this.zoom = 1; // 1 = whole board, <1 = closer
    this.zoomGoal = 1;
    this.focusGoal = new THREE.Vector3();
    this.hold = 0;
    this.shake = 0;
    this.baseDist = 20;
  }

  /**
   * Fit the board into the free screen area between the top HUD and the bottom deck.
   * w/h = canvas CSS size, top/bottom = reserved CSS px.
   */
  fit(w, h, top = 60, bottom = 130) {
    const cam = this.camera;
    const freeH = Math.max(120, h - top - bottom);
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    // projected half-extents of the iso diamond (board + a margin for figures)
    const halfW = GRID * 0.7;
    const halfH = GRID * 0.38;
    const distV = halfH / (tanV * (freeH / h));
    const distH = halfW / (tanV * (w / h));
    this.baseDist = Math.max(distV, distH);
    // shift the image so the board centres in the free area
    cam.setViewOffset(w, h, 0, (bottom - top) / 2, w, h);
    cam.updateProjectionMatrix();
  }

  punch(p, zoom = 0.55, hold = 1.3) {
    this.focusGoal.copy(p);
    this.zoomGoal = zoom;
    this.hold = hold;
  }

  update(dt) {
    if (this.hold > 0) {
      this.hold -= dt;
      if (this.hold <= 0) {
        this.zoomGoal = 1;
        this.focusGoal.set(0, 0, 0);
      }
    }
    const k = 1 - Math.exp(-dt * 6);
    this.zoom += (this.zoomGoal - this.zoom) * k;
    this.focus.lerp(this.focusGoal, k);
    const d = this.baseDist * this.zoom;
    const dir = new THREE.Vector3(Math.sin(AZIMUTH) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(AZIMUTH) * Math.cos(ELEVATION));
    this.camera.position.copy(this.focus).addScaledVector(dir, d);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3);
      const s = this.shake * 0.25;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.focus);
    this.camera.rotateZ(DUTCH);
  }
}

function makeBars(width = 0.7) {
  const g = new THREE.Group();
  const mk = (color, h, y, depthOff) => {
    const geo = new THREE.PlaneGeometry(1, h);
    geo.translate(0.5, 0, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, toneMapped: false, depthTest: false, transparent: true }));
    m.position.set(-width / 2, y, depthOff);
    m.scale.x = width;
    m.renderOrder = 10;
    g.add(m);
    return m;
  };
  const bg = mk(0x000000, 0.13, 0, 0);
  bg.position.x -= 0.02;
  bg.scale.x = width + 0.04;
  bg.material.opacity = 0.75;
  const hp = mk(0xff1a3d, 0.06, 0.025, 0.001);
  const posture = mk(0xffd400, 0.035, -0.035, 0.001);
  return { group: g, hp, posture, width };
}

export class View {
  constructor(scene, fx, rig) {
    this.scene = scene;
    this.fx = fx;
    this.rig = rig;
    this.units = new Map();
    this.enemies = new Map();
    this.time = 0;
  }

  addUnit(u) {
    const model = BUILDERS[u.type]();
    const p = world(u.x, u.y, SLOT_H);
    model.root.position.copy(p);
    model.root.scale.setScalar(0.01);
    this.scene.add(model.root);
    // range ring (shown when selected)
    const ring = new THREE.Mesh(new THREE.RingGeometry(u.def.range - 0.04, u.def.range, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(u.def.accent).multiplyScalar(1.5), transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(p).setY(0.25);
    this.scene.add(ring);
    const v = { u, model, ring, spawnT: 0, atkT: 0, atkDir: new THREE.Vector3(0, 0, 1), base: p.clone(), phase: Math.random() * 6 };
    this.units.set(u.uid, v);
    this.fx.ring(p.clone().setY(0.1), u.type === 'oracle' ? 0x39ff88 : 0xffffff, 2.2, 0.4);
    this.fx.burstSparks(p.clone().setY(0.5), 14);
  }

  removeUnit(u) {
    const v = this.units.get(u.uid);
    if (!v) return;
    this.scene.remove(v.model.root);
    this.scene.remove(v.ring);
    this.fx.inkBurst(v.base.clone().setY(0.6), 14);
    this.units.delete(u.uid);
  }

  addEnemy(e) {
    const model = buildShadow(e.def.boss ? 'boss' : e.type === 'brute' ? 'brute' : 'mannequin');
    model.root.scale.setScalar(e.def.scale * 0.85);
    model.root.position.copy(world(e.x, e.y, RUNWAY_H));
    this.scene.add(model.root);
    const bars = makeBars(e.def.boss ? 1.4 : 0.7);
    this.scene.add(bars.group);
    this.enemies.set(e.uid, { e, model, bars, hitT: 0, maskOff: false, phase: Math.random() * 6, lastWalk: 0 });
  }

  removeEnemy(e, kind = 'kill') {
    const v = this.enemies.get(e.uid);
    if (!v) return;
    const p = v.model.root.position.clone().setY(0.8 * e.def.scale);
    if (kind === 'kill') this.fx.inkBurst(p, e.def.boss ? 80 : 26);
    this.scene.remove(v.model.root);
    this.scene.remove(v.bars.group);
    this.enemies.delete(e.uid);
  }

  unitView(u) {
    return this.units.get(u.uid);
  }

  /** Handle a sim event (returns true if consumed). */
  onEvent(ev) {
    switch (ev.t) {
      case 'place': this.addUnit(ev.unit); break;
      case 'sell': this.removeUnit(ev.unit); break;
      case 'spawn': this.addEnemy(ev.enemy); break;
      case 'kill': this.removeEnemy(ev.enemy, 'kill'); break;
      case 'leak': this.removeEnemy(ev.enemy, 'leak'); this.rig.shake = Math.max(this.rig.shake, 1); break;
      case 'attack': {
        const v = this.units.get(ev.unit.uid);
        const ev2 = this.enemies.get(ev.enemy.uid);
        if (!v || !ev2) break;
        v.atkT = 1;
        const tp = ev2.model.root.position.clone();
        v.atkDir.copy(tp).sub(v.base).setY(0).normalize();
        const hitP = tp.clone().setY(0.9 * ev.enemy.def.scale);
        if (ev.unit.type === 'jester') {
          this.fx.slash(hitP, Math.atan2(v.atkDir.z, v.atkDir.x));
          this.fx.burstSparks(hitP, 5, new THREE.Color(0xffffff));
        } else if (ev.unit.type === 'queen') {
          this.fx.ring(hitP, 0xff1a3d, 1.6, 0.25);
          this.fx.burstSparks(hitP, 7);
        } else {
          const from = v.model.parts.body.getWorldPosition(new THREE.Vector3());
          this.fx.beam(from, hitP, 0x39ff88);
          this.fx.burstSparks(hitP, 4);
        }
        break;
      }
      case 'hit': {
        const v = this.enemies.get(ev.enemy.uid);
        if (v) v.hitT = 1;
        break;
      }
      case 'break': {
        const v = this.enemies.get(ev.enemy.uid);
        if (!v) break;
        const head = v.model.parts.head.getWorldPosition(new THREE.Vector3());
        this.fx.shatter(head);
        v.model.parts.mask.visible = false;
        v.maskOff = true;
        this.rig.shake = Math.max(this.rig.shake, ev.enemy.def.boss ? 1.4 : 0.6);
        break;
      }
      case 'recover': {
        const v = this.enemies.get(ev.enemy.uid);
        if (v) {
          v.model.parts.mask.visible = true;
          v.maskOff = false;
          this.fx.ring(v.model.root.position.clone().setY(1.2), 0xffc93a, 1, 0.3);
        }
        break;
      }
      case 'baton': {
        const v = this.units.get(ev.to.uid);
        if (v) {
          this.rig.punch(v.base.clone().setY(0.4), 0.5, 1.4);
          this.fx.ring(v.base.clone().setY(0.15), 0xff2a6a, 2.5, 0.5);
          this.fx.burstSparks(v.base.clone().setY(1), 20, new THREE.Color(0xff6a9a));
        }
        break;
      }
      default:
        return false;
    }
    return true;
  }

  update(dt, game, camera, selected) {
    this.time += dt;
    const t = this.time;
    // ---------------- units
    for (const v of this.units.values()) {
      const { u, model } = v;
      v.spawnT = Math.min(1, v.spawnT + dt * 3);
      const pop = v.spawnT < 1 ? 1 + Math.sin(v.spawnT * Math.PI) * 0.25 : 1;
      model.root.scale.setScalar(Math.max(0.01, v.spawnT) * pop * 1.3);
      v.atkT = Math.max(0, v.atkT - dt * 4);
      const swing = Math.sin(v.atkT * Math.PI);
      const baton = u.buffs.some((b) => b.key === 'baton');
      // face the current target direction smoothly
      const want = Math.atan2(v.atkDir.x, v.atkDir.z);
      let dy = want - model.root.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      model.root.rotation.y += dy * Math.min(1, dt * 10);
      const P = model.parts;
      if (u.type === 'jester') {
        model.root.position.copy(v.base).addScaledVector(v.atkDir, swing * 0.35);
        P.body.rotation.y = swing * 1.4;
        P.arms[0].rotation.x = -swing * 1.6 + Math.sin(t * 2 + v.phase) * 0.05;
        P.arms[1].rotation.x = -swing * 1.2 - Math.sin(t * 2 + v.phase) * 0.05;
        P.coat.scale.set(1 + swing * 0.15, 1, 1 + swing * 0.15);
        P.body.position.y = Math.sin(t * 2.2 + v.phase) * 0.012;
      } else if (u.type === 'queen') {
        model.root.position.copy(v.base).addScaledVector(v.atkDir, swing * 0.2);
        const side = u.attacks % 2;
        P.arms[side].rotation.x = -swing * 1.7;
        P.arms[1 - side].rotation.x = swing * 0.3;
        P.body.rotation.y = (side ? -1 : 1) * swing * 0.4;
        for (const a of P.auras) {
          const s = 1 + Math.sin(t * 8 + v.phase) * 0.15 + swing * 0.6 + (baton ? 0.4 : 0);
          a.scale.setScalar(s);
          a.rotation.y = t * 3;
        }
        P.body.position.y = Math.sin(t * 2 + v.phase) * 0.01;
      } else {
        P.body.position.y = 1.0 + Math.sin(t * 2 + v.phase) * 0.08;
        P.shell.rotation.y = t * 0.8;
        P.wire.rotation.y = t * 0.8;
        P.core.rotation.y = -t * 2;
        P.core.scale.setScalar(1 + swing * 0.8);
        P.rings.forEach((r, i) => { r.rotation.y += dt * (0.8 + i * 0.5) * (baton ? 3 : 1); });
      }
      const sel = selected === u;
      v.ring.material.opacity += ((sel ? 0.8 : 0) - v.ring.material.opacity) * 0.25;
      if (baton && Math.random() < dt * 20) this.fx.burstSparks(v.base.clone().setY(0.3 + Math.random()), 1, new THREE.Color(0xff6a9a));
    }
    // ---------------- enemies
    const q = camera.quaternion;
    for (const v of this.enemies.values()) {
      const { e, model, bars } = v;
      const root = model.root;
      root.position.set(e.x - 5, RUNWAY_H, e.y - 5);
      const want = Math.atan2(e.dirX, e.dirY);
      let dy = want - root.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      root.rotation.y += dy * Math.min(1, dt * 8);
      const P = model.parts;
      const stride = e.walked * 5.2 + v.phase;
      if (e.down > 0) {
        // broken: buckle to a kneel, sway
        P.body.rotation.x += (0.55 - P.body.rotation.x) * Math.min(1, dt * 12);
        P.body.position.y += (-0.25 - P.body.position.y) * Math.min(1, dt * 12);
        P.legs[0].rotation.x = -1.2;
        P.legs[1].rotation.x = 0.6;
        P.arms.forEach((a, i) => { a.rotation.x = 0.4 + Math.sin(t * 6 + i) * 0.1; });
        P.head.rotation.z = Math.sin(t * 7) * 0.12;
      } else {
        P.body.rotation.x += (0.08 - P.body.rotation.x) * Math.min(1, dt * 8);
        P.body.position.y = Math.abs(Math.sin(stride)) * 0.05;
        P.legs[0].rotation.x = Math.sin(stride) * 0.7;
        P.legs[1].rotation.x = -Math.sin(stride) * 0.7;
        P.arms[0].rotation.x = -Math.sin(stride) * 0.5;
        P.arms[1].rotation.x = Math.sin(stride) * 0.5;
        P.head.rotation.z = 0;
      }
      // glowing eyes flicker; marked enemies get green-tinted eyes
      for (const eye of P.eyes) eye.scale.y = 0.6 + Math.abs(Math.sin(t * 9 + v.phase)) * 0.6;
      v.hitT = Math.max(0, v.hitT - dt * 6);
      const s = e.def.scale * 0.85 * (1 + v.hitT * 0.08);
      root.scale.set(s * (1 + v.hitT * 0.06), s, s);
      // bars billboard above the head
      bars.group.position.copy(root.position).setY(RUNWAY_H + 1.55 * e.def.scale * 0.85 + 0.15);
      bars.group.quaternion.copy(q);
      bars.hp.scale.x = Math.max(0.0001, bars.width * Math.max(0, e.hp / e.def.hp));
      bars.posture.scale.x = Math.max(0.0001, bars.width * Math.max(0, e.posture / e.def.posture));
      bars.posture.material.color.setHex(e.down > 0 ? 0xffffff : e.mark > 0 ? 0x39ff88 : 0xffd400);
      if (e.down > 0) bars.posture.scale.x = bars.width * (e.down / game.rules.downTime);
    }
  }
}
