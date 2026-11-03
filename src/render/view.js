// Scene graph <-> simulation sync: models for units/enemies, animation, bars, FX dispatch,
// and the camera rig (close (0, 9, 8) framing, -6deg Dutch roll, spring punch-ins with a -8deg tilt).
import * as THREE from 'three';
import { BUILDERS, buildShadow } from './models.js';
import { instantiateUnit } from './gltfUnits.js';
import { instantiateSprite } from './spriteUnits.js';
import { world, RUNWAY_H, SLOT_H } from './arena.js';

const DUTCH = THREE.MathUtils.degToRad(-6); // resting Dutch roll
const PUNCH_DUTCH = THREE.MathUtils.degToRad(-8); // roll while a strike punch-in holds
const DIR = new THREE.Vector3(0, 9, 8).normalize(); // default camera at (0, 9, 8) looking at the origin
const BASE_DIST = Math.hypot(9, 8);
const FOV_MIN = 34;
const FOV_MAX = 56;
// what must stay on screen: every build slot (x +-5.6, z +-4.6) plus figure height at the back
const FIT_PTS = [];
for (const x of [-5.6, 5.6]) for (const z of [-4.6, 4.6]) for (const y of [0, 1.4]) FIT_PTS.push(new THREE.Vector3(x, y, z));

// critically-damped-ish spring step (k stiffness, c damping)
function spring(x, v, goal, k, c, dt) {
  const a = (goal - x) * k - v * c;
  v += a * dt;
  return [x + v * dt, v];
}

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.focus = new THREE.Vector3();
    this.focusGoal = new THREE.Vector3();
    this.zoom = 1; // 1 = framing distance, <1 = punched in
    this.zoomV = 0;
    this.zoomGoal = 1;
    this.roll = DUTCH;
    this.rollV = 0;
    this.rollGoal = DUTCH;
    this.hold = 0;
    this.shake = 0;
    this.baseDist = BASE_DIST;
    this.since = 99;
    this._probe = new THREE.PerspectiveCamera();
    // establishing shot (title / results): a low drifting angle that shows off the Palace skyline.
    // est = 1 fully establishing, 0 = gameplay framing; blended with an eased slerp.
    this.est = 1;
    this.estGoal = 1;
    this.time = 0;
    this.fitFov = 0;
    this._estCam = new THREE.PerspectiveCamera(); // a camera so lookAt() aims down -Z
    this._gp = new THREE.Vector3();
    this._gq = new THREE.Quaternion();
  }

  /**
   * Frame the board in the free screen area between the top HUD and the bottom deck. The camera stays
   * at its close default (0, 9, 8); the FOV widens to fit narrow screens, and only past FOV_MAX does
   * the camera back off. w/h = canvas CSS size, top/bottom = reserved CSS px.
   */
  fit(w, h, top = 60, bottom = 130) {
    const cam = this.camera;
    const freeH = Math.max(120, h - top - bottom);
    const limY = (freeH / h) * 0.96;
    const limX = 0.95;
    const probe = this._probe;
    probe.aspect = w / h;
    const fits = (fov, dist) => {
      probe.fov = fov;
      probe.position.copy(DIR).multiplyScalar(dist);
      probe.lookAt(0, 0, 0);
      probe.updateMatrixWorld();
      probe.updateProjectionMatrix();
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of FIT_PTS) {
        const n = p.clone().project(probe);
        if (Math.abs(n.x) > limX) return false;
        minY = Math.min(minY, n.y);
        maxY = Math.max(maxY, n.y);
      }
      // vertical: the projected span has to fit in the free band (we recentre it with a view offset)
      return maxY - minY <= 2 * limY;
    };
    let fov = FOV_MIN;
    let dist = BASE_DIST;
    while (fov < FOV_MAX && !fits(fov, dist)) fov += 1;
    while (!fits(fov, dist) && dist < 60) dist += 0.5;
    cam.fov = fov;
    this.fitFov = fov;
    this.baseDist = dist;
    // centre the projected board in the free band: find its NDC midpoint and shift the view
    probe.fov = fov;
    probe.position.copy(DIR).multiplyScalar(dist);
    probe.lookAt(0, 0, 0);
    probe.updateMatrixWorld();
    probe.updateProjectionMatrix();
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of FIT_PTS) {
      const n = p.clone().project(probe);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    }
    const midNdc = (minY + maxY) / 2; // where the board's centre lands now
    const freeMidPx = top + freeH / 2; // where we want it (CSS px from the top)
    const nowPx = (1 - midNdc) * 0.5 * h;
    cam.setViewOffset(w, h, 0, nowPx - freeMidPx, w, h);
    cam.updateProjectionMatrix();
  }

  /** Strike punch-in: zoom toward p, roll to the -8 deg Dutch angle, then ease back after `hold` s. */
  punch(p, zoom = 0.6, hold = 1.0, gap = 0) {
    if (this.since < gap) return; // rate-limit automatic punch-ins so rapid breaks don't seasick
    this.since = 0;
    this.focusGoal.copy(p);
    this.zoomGoal = zoom;
    this.rollGoal = PUNCH_DUTCH;
    this.rollV -= 0.9; // kick past the target so the tilt lands with a snap
    this.zoomV -= 0.8;
    this.hold = Math.max(this.hold, hold);
  }

  update(dt) {
    if (dt <= 0) return;
    this.since += dt;
    if (this.hold > 0) {
      this.hold -= dt;
      if (this.hold <= 0) {
        this.zoomGoal = 1;
        this.rollGoal = DUTCH;
        this.focusGoal.set(0, 0, 0);
      }
    }
    const h = Math.min(dt, 1 / 30);
    [this.zoom, this.zoomV] = spring(this.zoom, this.zoomV, this.zoomGoal, 70, 13, h);
    [this.roll, this.rollV] = spring(this.roll, this.rollV, this.rollGoal, 90, 12, h);
    this.focus.lerp(this.focusGoal, 1 - Math.exp(-dt * 7));
    const d = this.baseDist * this.zoom;
    this.camera.position.copy(this.focus).addScaledVector(DIR, d);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3);
      const s = this.shake * 0.25;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.focus);
    this.camera.rotateZ(this.roll);
    // blend toward / away from the establishing shot
    this.time += dt;
    this.est = Math.min(1, Math.max(0, this.est + Math.sign(this.estGoal - this.est) * dt / 1.8));
    if (this.est > 0.0001) {
      const e = this.est * this.est * (3 - 2 * this.est);
      const a = Math.sin(this.time * 0.13) * 0.55;
      const ec = this._estCam;
      ec.position.set(Math.sin(a) * 15.5, 6.2 + Math.sin(this.time * 0.21) * 0.6, Math.cos(a) * 15.5);
      ec.lookAt(Math.sin(a) * -3, 3.4, -14);
      ec.rotateZ(DUTCH);
      this._gp.copy(this.camera.position);
      this._gq.copy(this.camera.quaternion);
      this.camera.position.lerpVectors(this._gp, ec.position, e);
      this.camera.quaternion.slerpQuaternions(this._gq, ec.quaternion, e);
    }
    const fov = this.fitFov + (52 - this.fitFov) * (this.est * this.est * (3 - 2 * this.est));
    if (this.fitFov && Math.abs(fov - this.camera.fov) > 1e-3) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
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
  constructor(scene, fx, rig, sfx = null) {
    this.scene = scene;
    this.sfx = sfx; // one-shot SFX bus (audio/sfxManager.js); null in tests
    this.stats = { landings: 0, impacts: 0 };
    this.fx = fx;
    this.rig = rig;
    this.units = new Map();
    this.enemies = new Map();
    this.time = 0;
  }

  addUnit(u) {
    // imported glTF figure (normalized to MODEL_HEIGHT), else a 2D billboard from a sprite/cut-in PNG,
    // else the procedural figure
    const model = instantiateUnit(u.type) ?? instantiateSprite(u.type) ?? BUILDERS[u.type]();
    model.size = model.gltf || model.sprite ? 1 : 1.3;
    const p = world(u.x, u.y, SLOT_H);
    model.root.position.copy(p);
    model.root.scale.setScalar(model.sprite ? 1 : 0.01); // billboards drop in instead of popping
    this.scene.add(model.root);
    // range ring (shown when selected)
    const ring = new THREE.Mesh(new THREE.RingGeometry(u.def.range - 0.04, u.def.range, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(u.def.accent).multiplyScalar(1.5), transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(p).setY(0.25);
    this.scene.add(ring);
    const v = { u, model, ring, spawnT: 0, atkT: 0, atkDir: new THREE.Vector3(0, 0, 1), base: p.clone(), phase: Math.random() * 6 };
    this.units.set(u.uid, v);
    if (model.sprite) {
      v.spawnT = 1; // the sprite's own 180 ms drop replaces the scale pop; landing FX fire in update()
      return;
    }
    this.fx.ring(p.clone().setY(0.1), u.type === 'oracle' ? 0x39ff88 : 0xffffff, 2.2, 0.4);
    this.fx.burstSparks(p.clone().setY(0.5), 14);
  }

  removeUnit(u) {
    const v = this.units.get(u.uid);
    if (!v) return;
    this.scene.remove(v.model.root);
    v.model.dispose?.();
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
        if (v.model.sprite) {
          // billboard: lunge first, the hit lands (burst + squash + flash + SFX) at the impact frame
          const ranged = ev.unit.type === 'oracle';
          v.model.playAttack(ranged ? 0.12 : 0.35);
          v.pendingHit = { type: ev.unit.type, hitP, angle: Math.atan2(v.atkDir.z, v.atkDir.x) };
          break;
        }
        v.model.playAttack?.();
        if (ev.unit.type === 'oracle') this.sfx?.magic();
        else this.sfx?.punch();
        if (ev.unit.type === 'jester') {
          this.fx.slash(hitP, Math.atan2(v.atkDir.z, v.atkDir.x));
          this.fx.burstSparks(hitP, 5, new THREE.Color(0xffffff));
        } else if (ev.unit.type === 'queen') {
          this.fx.ring(hitP, 0xff1a3d, 1.6, 0.25);
          this.fx.burstSparks(hitP, 7);
        } else {
          const from = v.model.gltf || v.model.sprite ? v.model.root.position.clone().setY(v.model.root.position.y + v.model.height * 0.7) : v.model.parts.body.getWorldPosition(new THREE.Vector3());
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
        this.rig.punch(v.model.root.position.clone().setY(0.6), ev.enemy.def.boss ? 0.7 : 0.66, 0.75, 2.2);
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
          this.rig.punch(v.base.clone().setY(0.4), 0.55, 1.3);
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

  /** Deployment landing: dust shockwave ring, a puff of ink and a little camera thump. */
  landSprite(v) {
    this.stats.landings++;
    const p = v.base.clone().setY(v.base.y + 0.04);
    this.fx.dust(p, 2.6, 0.32);
    this.fx.ring(p, v.u.type === 'oracle' ? 0x39ff88 : 0xffffff, 1.6, 0.25);
    this.fx.inkBurst(p.clone().setY(p.y + 0.1), 8);
    this.rig.shake = Math.max(this.rig.shake ?? 0, 0.35);
  }

  /** The billboard's lunge reached its target: comic burst at the contact point + hit FX + SFX. */
  spriteImpact(v) {
    this.stats.impacts++;
    const h = v.pendingHit;
    v.pendingHit = null;
    if (!h) return;
    if (h.type === 'oracle') {
      const from = v.model.root.position.clone().setY(v.model.root.position.y + v.model.height * 0.7);
      this.fx.beam(from, h.hitP, 0x39ff88);
      this.fx.comicBurst(h.hitP, 'tech', 0.75);
      this.fx.burstSparks(h.hitP, 4);
      this.sfx?.magic();
      return;
    }
    if (h.type === 'jester') {
      this.fx.slash(h.hitP, h.angle);
      this.fx.comicBurst(h.hitP, 'slash', 0.95);
      this.fx.burstSparks(h.hitP, 5, new THREE.Color(0xffffff));
    } else {
      this.fx.ring(h.hitP, 0xff1a3d, 1.6, 0.25);
      this.fx.comicBurst(h.hitP, 'punch', 0.9);
      this.fx.burstSparks(h.hitP, 7);
    }
    this.sfx?.punch();
  }

  /** Turn a 3D figure toward its current target direction smoothly. */
  faceTarget(model, v, dt) {
    const want = Math.atan2(v.atkDir.x, v.atkDir.z);
    let dy = want - model.root.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    model.root.rotation.y += dy * Math.min(1, dt * 10);
  }

  update(dt, game, camera, selected) {
    this.time += dt;
    const t = this.time;
    // ---------------- units
    for (const v of this.units.values()) {
      const { u, model } = v;
      v.spawnT = Math.min(1, v.spawnT + dt * 3);
      const pop = v.spawnT < 1 ? 1 + Math.sin(v.spawnT * Math.PI) * 0.25 : 1;
      model.root.scale.setScalar(Math.max(0.01, v.spawnT) * pop * model.size);
      v.atkT = Math.max(0, v.atkT - dt * 4);
      const swing = Math.sin(v.atkT * Math.PI);
      const baton = u.buffs.some((b) => b.key === 'baton');
      if (model.sprite) {
        // paper cut-out: billboards itself, drops in, breathes and runs its own lunge -> impact ->
        // recoil cycle on top of the plate position; we fire the FX/SFX on the moments it reports
        model.root.position.copy(v.base);
        const moment = model.tick(t, dt * (baton ? 1.5 : 1), camera, v.atkDir);
        if (moment?.includes('land')) this.landSprite(v);
        if (moment?.includes('impact')) this.spriteImpact(v);
      } else {
        this.faceTarget(model, v, dt);
      }
      const P = model.parts;
      if (model.sprite) {
        // posed by tick() above
      } else if (model.gltf) {
        // imported figure: its own clips drive the pose; add a short lunge toward the target
        model.mixer?.update(dt * (baton ? 1.5 : 1));
        model.root.position.copy(v.base).addScaledVector(v.atkDir, swing * (u.type === 'oracle' ? 0.08 : 0.25));
        if (!model.mixer) P.body.position.y = Math.sin(t * 2 + v.phase) * 0.02;
      } else if (u.type === 'jester') {
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
