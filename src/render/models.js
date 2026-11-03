// Stylized 3D figures built from primitives (original designs; faceless, silhouette-driven).
// Each builder returns { root, parts } where parts are the nodes the animator moves.
import * as THREE from 'three';
import { toon, glowMat, outline, shadows } from './toon.js';

const V2 = (x, y) => new THREE.Vector2(x, y);

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** A masquerade mask shape (front-facing, centred), extruded thin. */
function maskGeometry(w = 0.34, h = 0.13, depth = 0.03) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, h * 0.15);
  s.quadraticCurveTo(-w * 0.62, h * 0.9, -w * 0.3, h * 0.55); // left swept wing tip
  s.quadraticCurveTo(-w * 0.12, h * 0.75, 0, h * 0.35);
  s.quadraticCurveTo(w * 0.12, h * 0.75, w * 0.3, h * 0.55);
  s.quadraticCurveTo(w * 0.62, h * 0.9, w / 2, h * 0.15);
  s.quadraticCurveTo(w * 0.42, -h * 0.55, w * 0.12, -h * 0.35);
  s.lineTo(0, -h * 0.1);
  s.lineTo(-w * 0.12, -h * 0.35);
  s.quadraticCurveTo(-w * 0.42, -h * 0.55, -w / 2, h * 0.15);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Path();
    eye.moveTo(sx * w * 0.07, h * 0.08);
    eye.quadraticCurveTo(sx * w * 0.2, h * 0.32, sx * w * 0.34, h * 0.14);
    eye.quadraticCurveTo(sx * w * 0.2, -h * 0.02, sx * w * 0.07, h * 0.08);
    s.holes.push(eye);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function bladeGeometry(len = 0.62) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.035, 0);
  s.quadraticCurveTo(0.06, len * 0.55, 0.012, len);
  s.quadraticCurveTo(-0.01, len * 0.5, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false });
  g.translate(-0.017, 0, -0.006);
  return g;
}

// ---------------------------------------------------------------- JESTER (leader)
export function buildJester() {
  const root = new THREE.Group();
  const coat = toon(0x0c0c11, { spec: 0.5, shininess: 40, rim: 0.9, rimColor: 0x9aa0ff });
  const inner = toon(0x1a1a22, { spec: 0.3 });
  const silver = toon(0xdfe6f2, { spec: 1.6, shininess: 120, rim: 0.8 });
  const skin = toon(0x15151c, { spec: 0.2, rim: 0.6, rimColor: 0xffffff });
  const body = new THREE.Group();
  root.add(body);
  // legs
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.07, 0.5, 0);
    leg.add(mesh(new THREE.CapsuleGeometry(0.045, 0.42, 4, 8), inner, 0, -0.24, 0));
    leg.add(mesh(new THREE.BoxGeometry(0.08, 0.05, 0.16), coat, 0, -0.48, 0.03));
    body.add(leg);
    legs.push(leg);
  }
  // flared trench coat (lathe) with open front
  const prof = [V2(0.16, 1.12), V2(0.15, 0.95), V2(0.13, 0.78), V2(0.17, 0.55), V2(0.27, 0.22), V2(0.34, 0.08)];
  const coatGeo = new THREE.LatheGeometry(prof, 20, Math.PI * 0.62, Math.PI * 1.76);
  const coatMesh = mesh(coatGeo, toon(0x0c0c11, { spec: 0.5, shininess: 40, rim: 0.9, rimColor: 0x9aa0ff, side: THREE.DoubleSide }));
  body.add(coatMesh);
  // torso
  body.add(mesh(new THREE.CapsuleGeometry(0.12, 0.3, 4, 10), inner, 0, 0.98, 0));
  // popped collar: two tall angled plates
  for (const sx of [-1, 1]) {
    const c = mesh(new THREE.BoxGeometry(0.03, 0.2, 0.17), coat, sx * 0.11, 1.26, -0.02);
    c.rotation.z = -sx * 0.32;
    c.rotation.y = sx * 0.35;
    body.add(c);
  }
  // head + white glowing masquerade mask
  const head = new THREE.Group();
  head.position.set(0, 1.36, 0);
  head.add(mesh(new THREE.SphereGeometry(0.115, 16, 12), skin));
  const hair = mesh(new THREE.SphereGeometry(0.125, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), toon(0x08080b, { rim: 1.1, rimColor: 0xb0b8ff }), 0, 0.025, -0.01);
  head.add(hair);
  const mask = mesh(maskGeometry(), glowMat(0xffffff, 2.2), 0, 0.01, 0.105);
  mask.userData.noOutline = true;
  head.add(mask);
  body.add(head);
  // arms with dual blades
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.17, 1.15, 0);
    arm.add(mesh(new THREE.CapsuleGeometry(0.04, 0.34, 4, 8), coat, 0, -0.2, 0));
    const hand = new THREE.Group();
    hand.position.set(0, -0.4, 0.02);
    const blade = mesh(bladeGeometry(), silver, 0, 0, 0);
    blade.rotation.x = Math.PI / 2 - 0.35;
    hand.add(blade);
    hand.add(mesh(new THREE.BoxGeometry(0.07, 0.025, 0.025), silver, 0, 0, 0));
    arm.add(hand);
    arm.rotation.z = sx * 0.18;
    body.add(arm);
    arms.push(arm);
  }
  outline(root, 0.012);
  shadows(root);
  return { root, parts: { body, legs, arms, head, coat: coatMesh }, height: 1.5 };
}

// ---------------------------------------------------------------- QUEEN (vanguard)
export function buildQueen() {
  const root = new THREE.Group();
  const navy = toon(0x16213d, { spec: 1.2, shininess: 90, rim: 0.9, rimColor: 0x7fa0ff });
  const dark = toon(0x0b1020, { spec: 0.6, rim: 0.5 });
  const metal = toon(0xc9d2e3, { spec: 1.8, shininess: 140, rim: 0.6 });
  const crimson = 0xff1a3d;
  const body = new THREE.Group();
  root.add(body);
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.09, 0.52, 0);
    leg.add(mesh(new THREE.CapsuleGeometry(0.06, 0.38, 4, 8), dark, 0, -0.24, 0));
    leg.add(mesh(new THREE.BoxGeometry(0.11, 0.16, 0.13), navy, 0, -0.32, 0.02)); // greave
    body.add(leg);
    legs.push(leg);
  }
  // armoured torso: tapered prism
  const torso = mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.5, 6), navy, 0, 0.82, 0);
  body.add(torso);
  body.add(mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.12, 6), dark, 0, 0.55, 0));
  // crimson seam lines
  const seam = mesh(new THREE.BoxGeometry(0.02, 0.42, 0.01), glowMat(crimson, 2.5), 0, 0.84, 0.17);
  seam.userData.noOutline = true;
  body.add(seam);
  // spiked shoulder pads
  for (const sx of [-1, 1]) {
    const pad = new THREE.Group();
    pad.position.set(sx * 0.25, 1.06, 0);
    pad.add(mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), navy));
    for (let i = 0; i < 3; i++) {
      const sp = mesh(new THREE.ConeGeometry(0.028, 0.15, 6), metal, sx * (0.03 + i * 0.03), 0.09 - i * 0.015, -0.05 + i * 0.05);
      sp.rotation.z = -sx * (0.5 + i * 0.25);
      pad.add(sp);
    }
    body.add(pad);
  }
  // helm: faceless visor
  const head = new THREE.Group();
  head.position.set(0, 1.25, 0);
  head.add(mesh(new THREE.SphereGeometry(0.12, 14, 10), dark));
  const helm = mesh(new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), navy, 0, 0.01, -0.005);
  head.add(helm);
  const visor = mesh(new THREE.BoxGeometry(0.2, 0.03, 0.04), glowMat(crimson, 3), 0, 0.0, 0.11);
  visor.userData.noOutline = true;
  head.add(visor);
  // swept crest
  const crest = mesh(new THREE.ConeGeometry(0.035, 0.28, 4), metal, 0, 0.13, -0.08);
  crest.rotation.x = -1.1;
  head.add(crest);
  body.add(head);
  // arms with glowing knuckles
  const arms = [];
  const auras = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.27, 1.0, 0);
    arm.add(mesh(new THREE.CapsuleGeometry(0.055, 0.28, 4, 8), dark, 0, -0.17, 0));
    arm.add(mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.16, 6), navy, 0, -0.3, 0));
    const fist = mesh(new THREE.BoxGeometry(0.12, 0.1, 0.11), metal, 0, -0.42, 0.02);
    arm.add(fist);
    const aura = mesh(new THREE.IcosahedronGeometry(0.11, 1), glowMat(crimson, 2.2, { transparent: true, opacity: 0.55, additive: true, depthWrite: false }), 0, -0.42, 0.02);
    aura.userData.noOutline = true;
    arm.add(aura);
    auras.push(aura);
    arm.rotation.z = sx * 0.12;
    body.add(arm);
    arms.push(arm);
  }
  outline(root, 0.013);
  shadows(root);
  return { root, parts: { body, legs, arms, head, auras }, height: 1.4 };
}

// ---------------------------------------------------------------- ORACLE (tactician drone)
export function buildOracle() {
  const root = new THREE.Group();
  const green = 0x39ff88;
  const body = new THREE.Group();
  body.position.y = 1.0;
  root.add(body);
  const shell = mesh(new THREE.IcosahedronGeometry(0.24, 0), toon(0x0e1712, { spec: 1.4, shininess: 100, rim: 1.2, rimColor: green }));
  body.add(shell);
  const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.245, 0)), new THREE.LineBasicMaterial({ color: new THREE.Color(green).multiplyScalar(2), toneMapped: false }));
  body.add(wire);
  const core = mesh(new THREE.OctahedronGeometry(0.1, 0), glowMat(green, 3));
  core.userData.noOutline = true;
  body.add(core);
  // sensor "eye" band (not a face)
  const band = mesh(new THREE.TorusGeometry(0.255, 0.012, 6, 32), glowMat(green, 2.5));
  band.rotation.x = Math.PI / 2;
  band.userData.noOutline = true;
  body.add(band);
  // holographic planetary rings with orbiting moons
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    g.rotation.set(0.9 + i * 0.5, i * 1.1, 0.3 * i);
    const ring = mesh(new THREE.TorusGeometry(0.42 + i * 0.1, 0.006, 4, 64), glowMat(green, 1.8, { transparent: true, opacity: 0.7, additive: true, depthWrite: false }));
    ring.userData.noOutline = true;
    g.add(ring);
    const moon = mesh(new THREE.SphereGeometry(0.035, 10, 8), glowMat(i === 1 ? 0xffffff : green, 2.4));
    moon.position.x = 0.42 + i * 0.1;
    moon.userData.noOutline = true;
    g.add(moon);
    body.add(g);
    rings.push(g);
  }
  // hover thrust cone
  const thrust = mesh(new THREE.ConeGeometry(0.16, 0.6, 16, 1, true), glowMat(green, 1.2, { transparent: true, opacity: 0.18, additive: true, depthWrite: false, side: THREE.DoubleSide }), 0, -0.45, 0);
  thrust.rotation.x = Math.PI;
  thrust.userData.noOutline = true;
  body.add(thrust);
  outline(shell, 0.012);
  shadows(root);
  return { root, parts: { body, shell, core, rings, wire }, height: 1.3 };
}

// ---------------------------------------------------------------- SHADOW (enemy)
export function buildShadow(kind = 'mannequin') {
  const root = new THREE.Group();
  const obsidian = toon(0x07070a, { spec: 1.6, shininess: 160, rim: 1.0, rimColor: kind === 'boss' ? 0xffd24a : 0xff2a4a });
  const gold = toon(0xe8b923, { spec: 1.8, shininess: 120, rim: 0.7, rimColor: 0xfff1b0 });
  const body = new THREE.Group();
  root.add(body);
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.08, 0.55, 0);
    leg.add(mesh(new THREE.CapsuleGeometry(0.055, 0.42, 4, 8), obsidian, 0, -0.27, 0));
    body.add(leg);
    legs.push(leg);
  }
  const torso = mesh(new THREE.CapsuleGeometry(kind === 'brute' ? 0.2 : 0.14, 0.38, 6, 12), obsidian, 0, 0.88, 0);
  torso.scale.set(1, 1, 0.75);
  body.add(torso);
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * (kind === 'brute' ? 0.26 : 0.19), 1.08, 0);
    arm.add(mesh(new THREE.CapsuleGeometry(kind === 'brute' ? 0.065 : 0.045, 0.4, 4, 8), obsidian, 0, -0.24, 0));
    arm.rotation.z = sx * 0.1;
    body.add(arm);
    arms.push(arm);
  }
  const head = new THREE.Group();
  head.position.set(0, 1.3, 0);
  head.add(mesh(new THREE.SphereGeometry(0.12, 16, 12), obsidian));
  // gold porcelain mask: a shallow shell over the front of the head with eye slits
  const mask = new THREE.Group();
  const shellGeo = new THREE.SphereGeometry(0.128, 18, 14, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.18, Math.PI * 0.62);
  const maskMesh = mesh(shellGeo, toon(0xe8b923, { spec: 1.8, shininess: 120, rim: 0.7, rimColor: 0xfff1b0, side: THREE.DoubleSide }));
  maskMesh.rotation.y = 0;
  mask.add(maskMesh);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = mesh(new THREE.BoxGeometry(0.05, 0.012, 0.02), glowMat(0xffe14a, 3.5), sx * 0.045, 0.02, 0.125);
    eye.rotation.z = -sx * 0.25;
    eye.userData.noOutline = true;
    mask.add(eye);
    eyes.push(eye);
  }
  head.add(mask);
  if (kind === 'boss') {
    // crown of porcelain spikes for the Curtain Caller
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const sp = mesh(new THREE.ConeGeometry(0.025, 0.14, 5), gold, Math.cos(a) * 0.1, 0.13, Math.sin(a) * 0.1);
      head.add(sp);
    }
  }
  body.add(head);
  outline(root, 0.012, 0x1a0006);
  shadows(root);
  return { root, parts: { body, legs, arms, head, mask, eyes }, height: 1.45 };
}

// ---------------------------------------------------------------- TREASURE (spinning crown)
export function buildCrown() {
  const root = new THREE.Group();
  const gold = toon(0xffc93a, { spec: 2.0, shininess: 140, rim: 1.0, rimColor: 0xffffff, emissive: 0x3a2400 });
  const crown = new THREE.Group();
  // faceted band
  crown.add(mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.22, 10, 1, true), toon(0xffc93a, { spec: 2.0, shininess: 140, rim: 1.0, emissive: 0x3a2400, side: THREE.DoubleSide })));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const tall = i % 2 === 0;
    const sp = mesh(new THREE.ConeGeometry(0.08, tall ? 0.42 : 0.24, 4), gold, Math.cos(a) * 0.4, 0.11 + (tall ? 0.21 : 0.12), Math.sin(a) * 0.4);
    sp.rotation.y = -a;
    crown.add(sp);
    if (tall) {
      const gem = mesh(new THREE.OctahedronGeometry(0.06), glowMat(i % 4 === 0 ? 0xff1a3d : 0xffffff, 2.5), Math.cos(a) * 0.4, 0.46, Math.sin(a) * 0.4);
      gem.userData.noOutline = true;
      crown.add(gem);
    }
  }
  const jewel = mesh(new THREE.OctahedronGeometry(0.16), glowMat(0xff1a3d, 2.2));
  jewel.position.y = 0.05;
  jewel.userData.noOutline = true;
  crown.add(jewel);
  outline(crown, 0.015);
  shadows(crown);
  crown.position.y = 1.4;
  root.add(crown);
  return { root, parts: { crown, jewel } };
}

// ---------------------------------------------------------------- calling card texture
let cardTex = null;
export function cardTexture() {
  if (cardTex) return cardTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = '#050505';
  g.fillRect(0, 0, 128, 192);
  g.strokeStyle = '#e8002d';
  g.lineWidth = 8;
  g.strokeRect(6, 6, 116, 180);
  g.fillStyle = '#e8002d';
  // stylized crown emblem (the Treasure)
  g.beginPath();
  g.moveTo(34, 112);
  g.lineTo(28, 72);
  g.lineTo(48, 92);
  g.lineTo(64, 62);
  g.lineTo(80, 92);
  g.lineTo(100, 72);
  g.lineTo(94, 112);
  g.closePath();
  g.fill();
  g.fillRect(34, 118, 60, 10);
  g.fillStyle = '#fff';
  g.font = 'bold 16px sans-serif';
  g.textAlign = 'center';
  g.fillText('ENCORE', 64, 160);
  cardTex = new THREE.CanvasTexture(c);
  cardTex.colorSpace = THREE.SRGBColorSpace;
  return cardTex;
}

export const BUILDERS = { jester: buildJester, queen: buildQueen, oracle: buildOracle };
