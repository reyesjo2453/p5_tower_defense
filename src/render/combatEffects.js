// Combat "feel" helpers shared by the view: a white impact flash on the struck Shadow, a hit-stop
// freeze for the target, and the neon dashed threat ring projected under a selected unit.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const FLASH_T = 0.035; // ~2 frames at 60 fps
const flashMat = new THREE.MeshBasicMaterial({ toneMapped: false });
flashMat.color.setRGB(2.0, 2.0, 2.0); // over-bright white: reads as a flash and catches the bloom

export class CombatEffects {
  constructor() {
    this.flashing = new Map(); // model root -> { t, swaps: [[mesh, material]] }
  }

  /** Swap every (non-outline) mesh of `root` to the flash material for FLASH_T seconds. */
  flash(root) {
    const cur = this.flashing.get(root);
    if (cur) {
      cur.t = FLASH_T;
      return;
    }
    const swaps = [];
    root.traverse((o) => {
      if (!o.isMesh || o.userData.isOutline || !o.visible) return;
      swaps.push([o, o.material]);
      o.material = flashMat;
    });
    this.flashing.set(root, { t: FLASH_T, swaps });
  }

  isFlashing(root) {
    return this.flashing.has(root);
  }

  /** Restore a model's own materials immediately (before it's removed, or when the flash ends). */
  restore(root) {
    const f = this.flashing.get(root);
    if (!f) return;
    for (const [m, mat] of f.swaps) m.material = mat;
    this.flashing.delete(root);
  }

  /** Real-time step (flashes are measured in frames, so they ignore the world's hit-stop). */
  update(dt) {
    for (const [root, f] of this.flashing) {
      f.t -= dt;
      if (f.t <= 0) this.restore(root);
    }
  }
}

// neon colour per unit for its threat ring
const NEON = { jester: 0x5ef2ff, queen: 0xff1a3d, oracle: 0x39ff88 };

/**
 * A stylized threat ring for a unit's range: 40 neon dashes on the edge, a thin inner guide line and
 * a faint fill so the covered tiles read at a glance. Returns a Group; group.userData.setOpacity(a)
 * fades it (0 = hidden), group.userData.spin(dt) turns the dashes.
 */
export function threatRing(radius, unitType, accent) {
  const color = new THREE.Color(NEON[unitType] ?? accent ?? 0xffffff).multiplyScalar(1.7);
  const g = new THREE.Group();
  const n = 40;
  const seg = (Math.PI * 2) / n;
  const dashes = [];
  for (let i = 0; i < n; i++) dashes.push(new THREE.RingGeometry(radius - 0.07, radius, 3, 1, i * seg, seg * 0.58));
  const dashGeo = mergeGeometries(dashes);
  dashes.forEach((d) => d.dispose());
  const mat = (opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, side: THREE.DoubleSide, userData: { max: opacity } });
  const dash = new THREE.Mesh(dashGeo, mat(1));
  const guide = new THREE.Mesh(new THREE.RingGeometry(radius - 0.13, radius - 0.11, 64), mat(0.45));
  const fill = new THREE.Mesh(new THREE.CircleGeometry(radius - 0.07, 48), mat(0.12));
  for (const m of [fill, guide, dash]) {
    m.renderOrder = 2;
    g.add(m);
  }
  g.rotation.x = -Math.PI / 2;
  let a = 0;
  g.visible = false;
  g.userData.setOpacity = (o) => {
    a = o;
    g.visible = o > 0.01;
    for (const m of [fill, guide, dash]) m.material.opacity = m.material.userData.max * o;
  };
  g.userData.spin = (dt) => {
    if (a > 0.01) dash.rotation.z += dt * 0.35;
  };
  g.userData.opacity = () => a;
  g.userData.dispose = () => {
    for (const m of [fill, guide, dash]) {
      m.geometry.dispose();
      m.material.dispose();
    }
  };
  return g;
}
