// Persona summons on the board: the aiming reticle, the apparition that rises over the target (a
// spectral cloak with the Persona's mask), its skill's signature effect, Flashpaper's lingering fire
// rings, Ghostlight's ward around the dais and stun halos over Shadows. All shapes and masks are
// generated here; no external art.
import * as THREE from 'three';
import { glowMat } from './toon.js';
import { RUNWAY_H } from './arena.js';

const COLORS = { noone: 0xf2f2ff, verdict: 0xff1a3d, sightline: 0x39ff88, ghostlight: 0xffd400, flashpaper: 0xff6a1a };

/** A Persona's mask, drawn on a canvas (each one a different silhouette). */
function maskTexture(id, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const col = `#${new THREE.Color(color).getHexString()}`;
  g.translate(128, 128);
  g.lineJoin = 'round';
  const fill = (path) => {
    g.fillStyle = '#050507';
    g.strokeStyle = col;
    g.lineWidth = 10;
    g.fill(path);
    g.stroke(path);
  };
  const p = new Path2D();
  if (id === 'noone') {
    // a blank harlequin: diamond domino with two empty eyes (it doesn't know its own face yet)
    p.moveTo(-110, -6); p.lineTo(-40, -58); p.lineTo(0, -20); p.lineTo(40, -58); p.lineTo(110, -6); p.lineTo(40, 52); p.lineTo(0, 18); p.lineTo(-40, 52); p.closePath();
    fill(p);
    g.fillStyle = col;
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 44, -2, 20, 11, s * 0.35, 0, Math.PI * 2); g.fill(); }
  } else if (id === 'verdict') {
    // a visor under a three-point crown
    p.moveTo(-100, 40); p.lineTo(-100, -20); p.lineTo(-70, -80); p.lineTo(-30, -36); p.lineTo(0, -96); p.lineTo(30, -36); p.lineTo(70, -80); p.lineTo(100, -20); p.lineTo(100, 40); p.closePath();
    fill(p);
    g.fillStyle = col;
    g.fillRect(-80, 0, 160, 16);
  } else if (id === 'sightline') {
    // one great lens
    p.ellipse(0, 0, 112, 70, 0, 0, Math.PI * 2);
    fill(p);
    g.strokeStyle = col;
    g.lineWidth = 8;
    g.beginPath(); g.arc(0, 0, 44, 0, Math.PI * 2); g.stroke();
    g.fillStyle = col;
    g.beginPath(); g.arc(0, 0, 18, 0, Math.PI * 2); g.fill();
  } else if (id === 'ghostlight') {
    // a lantern face: a cage with a single flame for a mouth
    p.roundRect(-70, -96, 140, 192, 30);
    fill(p);
    g.strokeStyle = col;
    g.lineWidth = 6;
    for (const x of [-35, 0, 35]) { g.beginPath(); g.moveTo(x, -90); g.lineTo(x, 90); g.stroke(); }
    g.fillStyle = col;
    g.beginPath(); g.moveTo(0, 60); g.quadraticCurveTo(26, 20, 0, -14); g.quadraticCurveTo(-26, 20, 0, 60); g.fill();
  } else {
    // flashpaper: a crown of flame over slit eyes
    p.moveTo(-104, 30);
    for (let i = 0; i <= 8; i++) p.lineTo(-104 + i * 26, i % 2 ? -96 + (i % 4) * 12 : -30);
    p.lineTo(104, 30); p.lineTo(0, 70); p.closePath();
    fill(p);
    g.fillStyle = col;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 18, 6); g.lineTo(s * 76, -8); g.lineTo(s * 70, 12); g.closePath(); g.fill(); }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class PersonaFx {
  constructor(scene, fx, rig) {
    this.scene = scene;
    this.fx = fx;
    this.rig = rig;
    this.live = [];
    this.masks = {};
    // aiming reticle: a double ring + a soft disc
    this.aimer = new THREE.Group();
    const ringA = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 64), glowMat(0xffffff, 1.6, { transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    const ringB = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.63, 6), glowMat(0xffffff, 1.6, { transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), glowMat(0xffffff, 0.6, { transparent: true, opacity: 0.12, additive: true, depthWrite: false }));
    for (const m of [ringA, ringB, disc]) m.rotation.x = -Math.PI / 2;
    this.aimer.add(ringA, ringB, disc);
    this.aimer.userData = { ringA, ringB, disc };
    this.aimer.visible = false;
    scene.add(this.aimer);
    // Flashpaper fire rings (pooled) and Ghostlight's ward around the dais
    this.zones = [];
    this.ward = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.05, 6, 64), glowMat(COLORS.ghostlight, 2.4, { transparent: true, opacity: 0.9 }));
    this.ward.rotation.x = Math.PI / 2;
    this.ward.position.y = 0.5;
    this.ward.visible = false;
    scene.add(this.ward);
    this.stuns = new Map(); // enemy uid -> halo mesh
    this.time = 0;
  }

  mask(id) {
    if (!this.masks[id]) this.masks[id] = maskTexture(id, COLORS[id] ?? 0xffffff);
    return this.masks[id];
  }

  /** Show the reticle at board point (x, y) (tile units) or hide it (null). */
  aim(pt, r = 1, id = 'noone') {
    this.aimer.visible = !!pt;
    if (!pt) return;
    this.aimer.position.set(pt.x - 5, RUNWAY_H + 0.04, pt.y - 5);
    this.aimer.scale.setScalar(r);
    const c = new THREE.Color(COLORS[id] ?? 0xffffff).multiplyScalar(1.8);
    for (const m of Object.values(this.aimer.userData)) m.material.color.copy(c);
  }

  /** The Persona rises over (x, y) and its skill lands. */
  summon(ev, from) {
    const id = ev.persona.id;
    const color = COLORS[id] ?? 0xffffff;
    const p = new THREE.Vector3(ev.x - 5, RUNWAY_H, ev.y - 5);
    const g = new THREE.Group();
    g.position.copy(p);
    // the cloak: two nested additive cones, open at the bottom, flaring as they rise
    const outer = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.6, 20, 1, true), glowMat(color, 1.2, { transparent: true, opacity: 0.22, additive: true, depthWrite: false, side: THREE.DoubleSide }));
    outer.position.y = 1.8;
    outer.rotation.x = Math.PI; // wide at the top like a cape caught in an updraft
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 16, 1, true), glowMat(color, 2.2, { transparent: true, opacity: 0.35, additive: true, depthWrite: false, side: THREE.DoubleSide }));
    inner.position.y = 1.7;
    const mask = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.mask(id), transparent: true, depthWrite: false, toneMapped: false }));
    mask.scale.set(1.5, 1.5, 1);
    mask.position.y = 3.7;
    // arms: two long flared sleeves that sweep open as it rises
    const arms = [-1, 1].map((sd) => {
      const arm = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.2, 10, 1, true), glowMat(color, 1.6, { transparent: true, opacity: 0.3, additive: true, depthWrite: false, side: THREE.DoubleSide }));
      arm.geometry.translate(0, -1.1, 0); // pivot at the shoulder
      arm.position.set(sd * 0.45, 3.2, 0);
      arm.rotation.z = sd * 0.2;
      arm.userData.side = sd;
      g.add(arm);
      return arm;
    });
    // a sigil on the floor: a ring of rune ticks that turns under the Persona
    const sigil = new THREE.Mesh(new THREE.RingGeometry(ev.r * 0.82, ev.r, 24, 1), glowMat(color, 2, { transparent: true, opacity: 0.7, additive: true, depthWrite: false, side: THREE.DoubleSide }));
    sigil.rotation.x = -Math.PI / 2;
    sigil.position.copy(p).setY(RUNWAY_H + 0.03);
    this.scene.add(sigil);
    g.add(outer, inner, mask);
    g.scale.setScalar(0.01);
    this.scene.add(g);
    this.live.push({ g, outer, inner, mask, arms, sigil, t: 0, life: 1.9 });
    // a streak from the summoner to the apparition, then the skill's own effect
    if (from) this.fx.beam(from.clone().setY(1.2), p.clone().setY(2.2), color);
    this.fx.ring(p.clone().setY(RUNWAY_H + 0.05), color, ev.r * 2.2, 0.55);
    this.fx.dust(p.clone().setY(RUNWAY_H + 0.04), ev.r * 2, 0.4);
    const pt = p.clone().setY(1);
    if (id === 'noone') {
      this.fx.comicBurst(pt, 'slash', 1.2);
      this.fx.burstSparks(pt, 40, new THREE.Color(0xffffff));
      this.rig.shake = Math.max(this.rig.shake ?? 0, 0.7);
    } else if (id === 'verdict') {
      this.fx.comicBurst(pt, 'punch', 1.4);
      this.fx.ring(p.clone().setY(0.3), 0xff1a3d, ev.r * 2.8, 0.4);
      this.fx.burstSparks(pt, 30);
      this.rig.shake = Math.max(this.rig.shake ?? 0, 1.4);
    } else if (id === 'sightline') {
      this.fx.comicBurst(pt, 'tech', 1.1);
      this.fx.ring(p.clone().setY(0.2), 0x39ff88, ev.r * 2.2, 0.9);
      this.fx.burstSparks(pt, 24, new THREE.Color(0x39ff88));
    } else if (id === 'ghostlight') {
      this.fx.comicBurst(pt, 'cue', 1.1);
      this.fx.beam(p.clone().setY(1.5), new THREE.Vector3(0, 1.4, 0), 0xffd400);
      this.fx.ring(new THREE.Vector3(0, 0.4, 0), 0xffd400, 3.4, 0.6);
    } else {
      this.fx.comicBurst(pt, 'fire', 1.3);
      this.fx.burstSparks(pt, 36, new THREE.Color(0xffa040));
      this.rig.shake = Math.max(this.rig.shake ?? 0, 0.6);
    }
    this.rig.punch?.(p.clone().setY(1.2), 0.8, 0.9, 1.6);
  }

  update(dt, game, camera) {
    this.time += dt;
    const t = this.time;
    // apparitions: rise and swell (0..0.35), hold and breathe, then thin out and drift up
    for (const a of [...this.live]) {
      a.t += dt;
      const k = a.t / a.life;
      const grow = Math.min(1, a.t / 0.35);
      const s = (1 - Math.pow(1 - grow, 3)) * (1 + Math.sin(a.t * 9) * 0.03);
      a.g.scale.set(s, s * (0.9 + grow * 0.1), s);
      a.g.rotation.y += dt * 1.6;
      const fade = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
      a.outer.material.opacity = 0.22 * fade;
      a.inner.material.opacity = 0.35 * fade;
      a.mask.material.opacity = fade;
      a.mask.position.y = 3.7 + (k > 0.7 ? (k - 0.7) * 3 : 0);
      // sleeves sweep open on the rise, then strike down at ~0.4 (the skill lands)
      const open = Math.min(1, a.t / 0.35);
      const strike = a.t > 0.35 && a.t < 0.6 ? Math.sin(((a.t - 0.35) / 0.25) * Math.PI) : 0;
      for (const arm of a.arms) {
        arm.rotation.z = arm.userData.side * (0.2 + open * 1.1 - strike * 0.9);
        arm.material.opacity = 0.3 * fade;
      }
      a.sigil.rotation.z += dt * 2.2;
      a.sigil.material.opacity = 0.7 * fade;
      a.sigil.scale.setScalar(0.6 + Math.min(1, a.t / 0.25) * 0.4);
      if (a.t >= a.life) {
        this.scene.remove(a.g);
        this.scene.remove(a.sigil);
        a.sigil.geometry.dispose();
        a.sigil.material.dispose();
        for (const arm of a.arms) {
          arm.geometry.dispose();
          arm.material.dispose();
        }
        a.outer.geometry.dispose();
        a.outer.material.dispose();
        a.inner.geometry.dispose();
        a.inner.material.dispose();
        a.mask.material.dispose();
        this.live.splice(this.live.indexOf(a), 1);
      }
    }
    if (this.aimer.visible) {
      const { ringB } = this.aimer.userData;
      ringB.rotation.z = t * 1.5;
      this.aimer.userData.disc.material.opacity = 0.1 + Math.sin(t * 6) * 0.04;
    }
    if (!game) return;
    // fire rings follow game.zones
    while (this.zones.length < game.zones.length) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 6, 48), glowMat(COLORS.flashpaper, 2.6, { transparent: true, opacity: 0.9 }));
      m.rotation.x = Math.PI / 2;
      this.scene.add(m);
      this.zones.push(m);
    }
    this.zones.forEach((m, i) => {
      const z = game.zones[i];
      m.visible = !!z;
      if (!z) return;
      m.position.set(z.x - 5, RUNWAY_H + 0.08, z.y - 5);
      m.scale.setScalar(z.r * (1 + Math.sin(t * 14 + i) * 0.03));
      m.material.opacity = Math.min(1, z.t / 0.5) * (0.75 + Math.sin(t * 22 + i) * 0.2);
      if (dt > 0 && Math.random() < dt * 18) {
        const a = Math.random() * Math.PI * 2;
        this.fx.burstSparks(new THREE.Vector3(z.x - 5 + Math.cos(a) * z.r, RUNWAY_H + 0.2, z.y - 5 + Math.sin(a) * z.r), 1, new THREE.Color(0xff7a1a));
      }
    });
    // ward ring: one notch of brightness per hit it will absorb
    this.ward.visible = game.ward > 0;
    if (this.ward.visible) {
      this.ward.rotation.z = t * 0.8;
      this.ward.scale.setScalar(1 + Math.sin(t * 4) * 0.03);
      this.ward.material.opacity = 0.45 + Math.min(3, game.ward) * 0.18;
    }
    // stun halos over Shadows
    for (const e of game.enemies) {
      let h = this.stuns.get(e.uid);
      if (e.stun > 0 && !h) {
        h = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 4, 5), glowMat(0xff1a3d, 2.4));
        h.rotation.x = Math.PI / 2;
        this.scene.add(h);
        this.stuns.set(e.uid, h);
      }
      if (!h) continue;
      if (e.stun <= 0) {
        this.dropStun(e.uid);
        continue;
      }
      h.position.set(e.x - 5, RUNWAY_H + 1.75 * e.def.scale * 0.85 + 0.05, e.y - 5);
      h.rotation.z = t * 6;
    }
    for (const uid of this.stuns.keys()) if (!game.enemies.some((e) => e.uid === uid)) this.dropStun(uid);
    void camera;
  }

  dropStun(uid) {
    const h = this.stuns.get(uid);
    if (!h) return;
    this.scene.remove(h);
    h.geometry.dispose();
    h.material.dispose();
    this.stuns.delete(uid);
  }

  /** New stage: drop anything still on the board. */
  clear() {
    for (const a of this.live) {
      this.scene.remove(a.g);
      this.scene.remove(a.sigil);
    }
    this.live = [];
    for (const uid of [...this.stuns.keys()]) this.dropStun(uid);
    for (const m of this.zones) m.visible = false;
    this.ward.visible = false;
    this.aim(null);
  }
}
