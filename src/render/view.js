// Scene graph <-> simulation sync: models for units/enemies, animation, bars, FX dispatch,
// and the camera rig (close (0, 9, 8) framing, -6deg Dutch roll, spring punch-ins with a -8deg tilt,
// a player zoom/pan layer on top, and directional micro-impulses on hits).
import * as THREE from 'three';
import { BUILDERS, buildShadow } from './models.js';
import { instantiateUnit } from './gltfUnits.js';
import { instantiateSprite, ATTACK } from './spriteUnits.js';
import { CombatEffects, threatRing } from './combatEffects.js';
import { world, RUNWAY_H, SLOT_H } from './arena.js';

const DUTCH = THREE.MathUtils.degToRad(-6); // resting Dutch roll
const PUNCH_DUTCH = THREE.MathUtils.degToRad(-8); // roll while a strike punch-in holds
const DIR = new THREE.Vector3(0, 9, 8).normalize(); // default camera at (0, 9, 8) looking at the origin
const BASE_DIST = Math.hypot(9, 8);
const FOV_MIN = 32;
// player zoom: 1 = the whole board fitted; the default sits ~30% closer so figures read large
export const ZOOM_DEFAULT = 0.7;
export const ZOOM_MIN = 0.42;
export const ZOOM_MAX = 1.05;
const MIN_DIST = 4.6; // never closer than this to the focus (keeps the near plane off the floor tiles)
const PAN_X = 5.4, PAN_Z = 4.4; // how far the focus may wander when fully zoomed in
const KICK_T = 0.09; // directional hit impulse decay (s)
const FOV_MAX = 40; // past this the camera backs off instead (a long lens keeps the flat 2.5D look)
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
    this._look = new THREE.Vector3();
    // establishing shot (title / results): a low drifting angle that shows off the Palace skyline.
    // est = 1 fully establishing, 0 = gameplay framing; blended with an eased slerp.
    this.est = 1;
    this.estGoal = 1;
    this.time = 0;
    this.fitFov = 0;
    this._estCam = new THREE.PerspectiveCamera(); // a camera so lookAt() aims down -Z
    this._gp = new THREE.Vector3();
    this._gq = new THREE.Quaternion();
    // player framing layer (wheel / pinch / two-finger pan), eased so input never jerks the shot
    this.user = ZOOM_DEFAULT;
    this.userGoal = ZOOM_DEFAULT;
    this.pan = new THREE.Vector3();
    this.panGoal = new THREE.Vector3();
    this.follow = new THREE.Vector3(); // where the action is (auto-framing target)
    this.manualT = 99; // seconds since the player last zoomed / panned
    // directional micro-impulse (hit camera punch)
    this.kickDir = new THREE.Vector3();
    this.kickAmt = 0;
    this.kickT = KICK_T;
  }

  /** Multiply the player zoom goal (<1 = closer); clamped to [ZOOM_MIN, ZOOM_MAX]. */
  zoomBy(f) {
    this.manualT = 0;
    this.userGoal = THREE.MathUtils.clamp(this.userGoal * f, ZOOM_MIN, ZOOM_MAX);
    this.clampPan(this.panGoal, this.userGoal);
  }

  /** Pan the focus by a screen-space drag (CSS px); h = canvas CSS height. */
  panBy(dx, dy, h) {
    const d = this.baseDist * this.user;
    const wpp = (2 * d * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) / Math.max(1, h);
    this.manualT = 0;
    this.panGoal.x -= dx * wpp;
    this.panGoal.z -= (dy * wpp) / DIR.y; // ground is foreshortened by the camera pitch
    this.clampPan(this.panGoal, this.userGoal);
  }

  /** Nudge the focus toward a world point (used to keep a dragged card's target in view). */
  panToward(p, k) {
    this.panGoal.x += (p.x - this.panGoal.x) * k;
    this.panGoal.z += (p.z - this.panGoal.z) * k;
    this.clampPan(this.panGoal, this.userGoal);
  }

  clampPan(v, zoom) {
    const room = THREE.MathUtils.clamp((ZOOM_MAX - zoom) / (ZOOM_MAX - ZOOM_MIN), 0, 1);
    v.x = THREE.MathUtils.clamp(v.x, -PAN_X * room, PAN_X * room);
    v.z = THREE.MathUtils.clamp(v.z, -PAN_Z * room, PAN_Z * room);
    v.y = 0;
  }

  /** Auto-framing: drift toward `p` (centre of the action) while the player isn't steering. */
  setFollow(p) {
    this.follow.set(p.x, 0, p.z);
  }

  resetView() {
    this.manualT = 99;
    this.userGoal = ZOOM_DEFAULT;
    this.panGoal.set(0, 0, 0);
  }

  /** Directional micro-impulse: shove the camera `amt` units along `dir`, decaying over ~90 ms. */
  kick(dir, amt = 0.05) {
    this.kickDir.copy(dir).setY(0);
    if (this.kickDir.lengthSq() < 1e-8) return;
    this.kickDir.normalize();
    this.kickAmt = amt;
    this.kickT = 0;
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
    this.focusGoal.copy(p).sub(this.panGoal).setY(p.y); // the player's pan is added back on top
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
    // damped player zoom / pan
    const ez = 1 - Math.exp(-dt * 9);
    this.manualT += dt;
    if (this.manualT > 4) {
      // nobody is steering: glide toward the action (slow, so it never fights a tap)
      const k = 1 - Math.exp(-dt * 0.8);
      this.panGoal.x += (this.follow.x - this.panGoal.x) * k;
      this.panGoal.z += (this.follow.z - this.panGoal.z) * k;
    }
    this.user += (this.userGoal - this.user) * ez;
    this.clampPan(this.panGoal, this.userGoal);
    this.pan.lerp(this.panGoal, ez);
    const look = this._look.copy(this.focus).add(this.pan);
    const d = Math.max(MIN_DIST, this.baseDist * this.zoom * this.user);
    this.camera.position.copy(look).addScaledVector(DIR, d);
    if (this.kickT < KICK_T) {
      this.kickT += dt;
      const k = Math.min(1, this.kickT / KICK_T);
      const off = this.kickAmt * (1 - k) * (1 - k);
      this.camera.position.addScaledVector(this.kickDir, off);
      look.addScaledVector(this.kickDir, off);
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3);
      const s = this.shake * 0.25;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(look);
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

const KICK = 0.05; // directional camera micro-impulse per landed melee hit (world units)
const RANGED = new Set(['oracle', 'limelight', 'prompter']); // no lunge-to-contact, no camera kick
const RANK_COLORS = [null, 0xd6dcff, 0xffd400]; // rank 2 silver, rank 3 gold
const TREASURE_P = new THREE.Vector3(0, 1.9, 0);

export class View {
  constructor(scene, fx, rig, sfx = null, text = null) {
    this.scene = scene;
    this.sfx = sfx; // one-shot SFX bus (audio/sfxManager.js); null in tests
    this.text = text; // floating damage numbers / callouts (render/combatText.js); optional
    this.combat = new CombatEffects();
    this.stats = { landings: 0, impacts: 0, flashes: 0, hitStops: 0 };
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
    // neon dashed threat ring (fades in while the unit is selected)
    const ring = threatRing(u.def.range, u.type, u.def.accent);
    ring.position.copy(p).setY(0.25);
    this.scene.add(ring);
    const v = { u, model, ring, spawnT: 0, atkT: 0, atkDir: new THREE.Vector3(0, 0, 1), base: p.clone(), phase: Math.random() * 6 };
    this.units.set(u.uid, v);
    if (u.rank > 1) this.setRank(v, u.rank, false);
    if (model.sprite) {
      v.spawnT = 1; // the sprite's own 180 ms drop replaces the scale pop; landing FX fire in update()
      return;
    }
    this.fx.ring(p.clone().setY(0.1), u.def.accent === '#e8e8f0' ? 0xffffff : u.def.accent, 2.2, 0.4);
    this.fx.burstSparks(p.clone().setY(0.5), 14);
  }

  removeUnit(u) {
    const v = this.units.get(u.uid);
    if (!v) return;
    this.scene.remove(v.model.root);
    v.model.dispose?.();
    this.scene.remove(v.ring);
    v.ring.userData.dispose();
    this.setRank(v, 1, false);
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
    this.enemies.set(e.uid, { e, model, bars, hitT: 0, maskOff: false, phase: Math.random() * 6, lastWalk: 0, freeze: 0, callT: 0, dying: 0 });
  }

  removeEnemy(e, kind = 'kill') {
    const v = this.enemies.get(e.uid);
    if (!v) return;
    const p = v.model.root.position.clone().setY(0.8 * e.def.scale);
    if (kind === 'kill') this.fx.inkBurst(p, e.def.boss ? 80 : 26);
    this.combat.restore(v.model.root);
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
      case 'move': this.moveUnit(ev.unit, ev.from); break;
      case 'rank': {
        const v = this.units.get(ev.unit.uid);
        if (v) this.setRank(v, ev.rank, true);
        break;
      }
      case 'heal':
        this.text?.damage(TREASURE_P, ev.amount, 'heal');
        this.fx.ring(new THREE.Vector3(0, 0.4, 0), 0x39ff88, 2.6, 0.5);
        break;
      case 'sell': this.removeUnit(ev.unit); break;
      case 'spawn': this.addEnemy(ev.enemy); break;
      case 'kill': {
        // a billboard's lunge may still be in flight toward it: let the blow land first
        const v = this.enemies.get(ev.enemy.uid);
        if (v && this.pendingOn(ev.enemy)) {
          v.dying = 0.45; // safety net if the attacker is sold mid-swing
          v.bars.group.visible = false;
        } else this.removeEnemy(ev.enemy, 'kill');
        break;
      }
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
          // billboard: anticipate + lunge first; the hit lands (burst, flash, numbers, hit-stop, SFX)
          // when its state machine enters HIT_STOP
          if (v.pendingHit) this.spriteImpact(v); // a quicker re-attack: land the previous blow now
          v.model.playAttack(RANGED.has(ev.unit.type) ? 0.14 : 0.4);
          v.pendingHit = { type: ev.unit.type, hitP, angle: Math.atan2(v.atkDir.z, v.atkDir.x), hits: [] };
          break;
        }
        if (!RANGED.has(ev.unit.type)) this.rig.kick?.(v.atkDir, KICK);
        v.model.playAttack?.();
        this.strikeFx(v, ev.unit.type, hitP, Math.atan2(v.atkDir.z, v.atkDir.x), false);
        break;
      }
      case 'hit': {
        // a billboard attacker shows its hits at the impact frame; everything else shows them now
        const av = ev.unit && this.units.get(ev.unit.uid);
        if (av?.pendingHit) av.pendingHit.hits.push(ev);
        else this.showHit(ev);
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
    this.fx.ring(p, v.u.type === 'jester' ? 0xffffff : v.u.def.accent, 1.6, 0.25);
    this.fx.inkBurst(p.clone().setY(p.y + 0.1), 8);
    this.rig.shake = Math.max(this.rig.shake ?? 0, 0.35);
  }

  /** Is a billboard's blow still travelling toward this enemy? */
  pendingOn(e) {
    for (const v of this.units.values()) if (v.pendingHit?.hits.some((h) => h.enemy === e)) return true;
    return false;
  }

  /** Damage landed on a Shadow: impact flash, wobble, floating number and WEAK!/CRITICAL! callouts. */
  showHit(ev, stop = 0) {
    const v = this.enemies.get(ev.enemy.uid);
    if (!v) return;
    v.hitT = 1;
    this.combat.flash(v.model.root);
    this.stats.flashes++;
    if (stop > 0) {
      v.freeze = Math.max(v.freeze, stop); // the target holds still through the hit-stop too
      this.stats.hitStops++;
    }
    if (!this.text) return;
    const s = ev.enemy.def.scale;
    const p = v.model.root.position.clone().setY(RUNWAY_H + 1.7 * s * 0.85 + 0.25);
    const magic = ev.unit?.type === 'oracle' || ev.unit?.type === 'limelight' || ev.dot;
    if (ev.dot && ev.dmg < 1) return;
    this.text.damage(p, ev.dmg, magic ? 'magic' : 'physical', { crit: ev.crit || !ev.unit, small: ev.dot });
    if ((ev.crit || ev.weak) && v.callT <= 0) {
      v.callT = 0.6; // one badge per Shadow at a time
      this.text.callout(p.clone().setY(p.y + 0.35), ev.crit ? 'CRITICAL!' : 'WEAK!');
    }
  }

  /** The billboard's lunge reached its target: comic burst at the contact point + hit FX + SFX. */
  spriteImpact(v) {
    this.stats.impacts++;
    const h = v.pendingHit;
    v.pendingHit = null;
    if (!h) return;
    for (const ev of h.hits) this.showHit(ev, ATTACK.HIT_STOP);
    for (const ev of h.hits) {
      const ve = this.enemies.get(ev.enemy.uid);
      if (ve?.dying) this.removeEnemy(ev.enemy, 'kill');
    }
    if (!RANGED.has(h.type)) this.rig.kick?.(v.atkDir, KICK);
    this.strikeFx(v, h.type, h.hitP, h.angle, true);
  }

  /** Each Phantom's signature strike at the contact point (+ its SFX). `burst` adds the comic star. */
  strikeFx(v, type, hitP, angle, burst) {
    const from = () => (v.model.gltf || v.model.sprite
      ? v.model.root.position.clone().setY(v.model.root.position.y + v.model.height * 0.7)
      : (v.model.parts.body ?? v.model.root).getWorldPosition(new THREE.Vector3()).setY(v.base.y + 0.9));
    if (type === 'jester') {
      this.fx.slash(hitP, angle);
      if (burst) this.fx.comicBurst(hitP, 'slash', 0.95);
      this.fx.burstSparks(hitP, 5, new THREE.Color(0xffffff));
      this.sfx?.punch();
    } else if (type === 'queen') {
      this.fx.ring(hitP, 0xff1a3d, 1.6, 0.25);
      if (burst) this.fx.comicBurst(hitP, 'punch', 0.9);
      this.fx.burstSparks(hitP, 7);
      this.sfx?.punch();
    } else if (type === 'limelight') {
      this.fx.beam(from(), hitP, 0xff6a1a);
      this.fx.ring(hitP, 0xff6a1a, 2.2, 0.35);
      if (burst) this.fx.comicBurst(hitP, 'fire', 0.95);
      this.fx.burstSparks(hitP, 10, new THREE.Color(0xffa040));
      this.sfx?.magic();
    } else if (type === 'prompter') {
      this.fx.beam(from(), hitP, 0xffd400);
      if (burst) this.fx.comicBurst(hitP, 'cue', 0.6);
      this.fx.burstSparks(hitP, 3, new THREE.Color(0xffd400));
      this.sfx?.tap();
    } else {
      this.fx.beam(from(), hitP, 0x39ff88);
      if (burst) this.fx.comicBurst(hitP, 'tech', 0.75);
      this.fx.burstSparks(hitP, 4);
      this.sfx?.magic();
    }
  }

  /** Rank aura: a glowing floor ring under the unit, silver at Rank 2, gold at Rank 3. */
  setRank(v, rank, celebrate) {
    if (v.aura) {
      this.scene.remove(v.aura);
      v.aura.geometry.dispose();
      v.aura.material.dispose();
      v.aura = null;
    }
    if (rank > 1) {
      const c = new THREE.Color(RANK_COLORS[rank - 1]).multiplyScalar(1.8);
      v.aura = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.44 + rank * 0.03, 6, 1), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
      v.aura.rotation.x = -Math.PI / 2;
      v.aura.position.copy(v.base).setY(v.base.y + 0.03);
      this.scene.add(v.aura);
    }
    if (celebrate) {
      const p = v.base.clone().setY(v.base.y + 0.1);
      this.fx.ring(p, RANK_COLORS[rank - 1] ?? 0xffffff, 2.4, 0.45);
      this.fx.burstSparks(p.clone().setY(p.y + 0.8), 22, new THREE.Color(RANK_COLORS[rank - 1] ?? 0xffffff));
      this.text?.callout(p.clone().setY(p.y + 2), `RANK ${rank}!`);
      this.rig.shake = Math.max(this.rig.shake ?? 0, 0.3);
    }
  }

  /** Blocking: the unit leaves its old plate in a puff of ink and drops onto the new one. */
  moveUnit(u, from) {
    const v = this.units.get(u.uid);
    if (!v) return;
    this.fx.inkBurst(world(from.x, from.y, SLOT_H).setY(0.6), 12);
    const p = world(u.x, u.y, SLOT_H);
    v.base.copy(p);
    v.model.root.position.copy(p);
    v.ring.position.copy(p).setY(0.25);
    if (v.aura) v.aura.position.copy(p).setY(p.y + 0.03);
    if (v.model.sprite) v.model.redeploy?.();
    else {
      v.spawnT = 0;
      this.fx.ring(p.clone().setY(0.1), 0xffffff, 2.2, 0.4);
    }
  }

  /** Remove every remaining figure (new game). */
  clear() {
    for (const v of [...this.units.values()]) this.removeUnit(v.u);
    for (const v of [...this.enemies.values()]) this.removeEnemy(v.e, 'leak');
    this.text?.clear();
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
    this.text?.update(dt);
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
        model.root.position.copy(v.base).addScaledVector(v.atkDir, swing * (RANGED.has(u.type) ? 0.08 : 0.25));
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
      } else if (u.type === 'prompter') {
        model.root.position.copy(v.base);
        P.body.position.y = Math.abs(Math.sin(t * 2.4 + v.phase)) * 0.03 + swing * 0.12;
        P.head.rotation.z = Math.sin(t * 1.3 + v.phase) * 0.12;
        P.tail.rotation.z = 0.4 + Math.sin(t * 3 + v.phase) * 0.3;
        P.arms[0].rotation.x = -swing * 1.2;
      } else if (u.type === 'limelight') {
        model.root.position.copy(v.base).addScaledVector(v.atkDir, swing * 0.08);
        P.body.position.y = Math.sin(t * 2 + v.phase) * 0.015;
        P.arms[1].rotation.x = -swing * 2.2 - 0.2;
        P.tails.forEach((tl, i) => { tl.rotation.x = Math.sin(t * 5 + i) * 0.15 - 0.2; });
        P.flame.scale.setScalar(1 + Math.sin(t * 12) * 0.12 + swing * 1.2);
        P.flame.rotation.y = t * 3;
      } else {
        P.body.position.y = 1.0 + Math.sin(t * 2 + v.phase) * 0.08;
        P.shell.rotation.y = t * 0.8;
        P.wire.rotation.y = t * 0.8;
        P.core.rotation.y = -t * 2;
        P.core.scale.setScalar(1 + swing * 0.8);
        P.rings.forEach((r, i) => { r.rotation.y += dt * (0.8 + i * 0.5) * (baton ? 3 : 1); });
      }
      const sel = selected === u;
      const ro = v.ring.userData.opacity();
      v.ring.userData.setOpacity(ro + ((sel ? 1 : 0) - ro) * Math.min(1, 0.25 + dt * 8));
      v.ring.userData.spin(dt);
      if (baton && Math.random() < dt * 20) this.fx.burstSparks(v.base.clone().setY(0.3 + Math.random()), 1, new THREE.Color(0xff6a9a));
    }
    // ---------------- enemies
    const q = camera.quaternion;
    for (const v of this.enemies.values()) {
      const { e, model, bars } = v;
      const root = model.root;
      v.callT -= dt;
      if (v.dying > 0) {
        v.dying -= dt;
        if (v.dying <= 0) {
          this.removeEnemy(e, 'kill');
          continue;
        }
      }
      if (v.freeze > 0) {
        v.freeze -= dt; // hit-stop: hold pose and position on the impact frame
        continue;
      }
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
      if (e.burn && Math.random() < dt * 14) this.fx.burstSparks(root.position.clone().setY(RUNWAY_H + 0.4 + Math.random() * e.def.scale), 1, new THREE.Color(0xff7a1a));
      v.hitT = Math.max(0, v.hitT - dt * 6);
      const s = e.def.scale * 0.85 * (1 + v.hitT * 0.08);
      root.scale.set(s * (1 + v.hitT * 0.06), s, s);
      // bars billboard above the head
      bars.group.position.copy(root.position).setY(RUNWAY_H + 1.55 * e.def.scale * 0.85 + 0.15);
      bars.group.quaternion.copy(q);
      bars.hp.scale.x = Math.max(0.0001, bars.width * Math.max(0, e.hp / e.maxHp));
      bars.posture.scale.x = Math.max(0.0001, bars.width * Math.max(0, e.posture / e.maxPosture));
      bars.posture.material.color.setHex(e.down > 0 ? 0xffffff : e.mark > 0 ? 0x39ff88 : 0xffd400);
      if (e.down > 0) bars.posture.scale.x = bars.width * (e.down / game.rules.downTime);
    }
  }
}
