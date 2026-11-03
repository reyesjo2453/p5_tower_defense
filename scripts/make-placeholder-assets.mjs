#!/usr/bin/env node
// Generates the CC0 placeholder art in fixtures/placeholder-assets/ (authored here, public domain):
//   models/{jester,queen,oracle}.glb : a rigged, faceless mannequin (13 bones, skinned) with "Idle" and
//                                       "Attack" clips. Deliberately authored in centimetres with the
//                                       origin at the hips, so the Box3 normalizer has real work to do.
//   portraits/*.png                   : flat faceless cut-in / card / finisher silhouettes (via Playwright).
// Run: node scripts/make-placeholder-assets.mjs   (Playwright + Chromium needed for the PNGs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'fixtures', 'placeholder-assets');
fs.mkdirSync(path.join(OUT, 'models'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'portraits'), { recursive: true });

// GLTFExporter's binary path reads Blobs with FileReader, which Node lacks.
globalThis.FileReader ??= class {
  readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }); }
  readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = `data:${b.type};base64,${Buffer.from(r).toString('base64')}`; this.onloadend?.(); }); }
};

const CM = 100; // authoring unit: centimetres

const LOOKS = {
  jester: { body: 0x2c2c38, accent: 0xe8002d, build: 1.0, weapon: 'blade' },
  queen: { body: 0x33242c, accent: 0xff2a3d, build: 1.12, weapon: 'fists' },
  oracle: { body: 0x1e2c28, accent: 0x39ff88, build: 0.92, weapon: 'halo' },
};

function mannequin(id) {
  const L = LOOKS[id];
  const b = L.build;
  // bones (positions relative to parent, metres * CM); origin at the hips like most DCC exports
  const bone = (name, x, y, z, parent) => {
    const o = new THREE.Bone();
    o.name = name;
    o.position.set(x * CM, y * CM, z * CM);
    parent?.add(o);
    return o;
  };
  const hips = bone('Hips', 0, 0, 0);
  const spine = bone('Spine', 0, 0.12, 0, hips);
  const chest = bone('Chest', 0, 0.22, 0, spine);
  const head = bone('Head', 0, 0.3, 0, chest);
  const armL = bone('UpperArm.L', 0.2 * b, 0.22, 0, chest);
  const foreL = bone('ForeArm.L', 0, -0.28, 0, armL);
  const armR = bone('UpperArm.R', -0.2 * b, 0.22, 0, chest);
  const foreR = bone('ForeArm.R', 0, -0.28, 0, armR);
  const thighL = bone('Thigh.L', 0.1 * b, -0.04, 0, hips);
  const shinL = bone('Shin.L', 0, -0.42, 0, thighL);
  const thighR = bone('Thigh.R', -0.1 * b, -0.04, 0, hips);
  const shinR = bone('Shin.R', 0, -0.42, 0, thighR);
  const bones = [hips, spine, chest, head, armL, foreL, armR, foreR, thighL, shinL, thighR, shinR];
  hips.updateMatrixWorld(true);

  // rigid-skinned parts: [geometry, bone, local offset (m), material group]
  const parts = [];
  const add = (geo, bn, x, y, z, mat = 0) => parts.push({ geo, bn, at: new THREE.Vector3(x, y, z).multiplyScalar(CM), mat });
  const cap = (r, len) => new THREE.CapsuleGeometry(r * CM, len * CM, 4, 10);
  add(cap(0.12 * b, 0.12), hips, 0, 0.02, 0);
  add(cap(0.13 * b, 0.12), spine, 0, 0.11, 0);
  add(cap(0.17 * b, 0.14), chest, 0, 0.12, 0);
  add(new THREE.SphereGeometry(0.115 * CM, 16, 12).scale(0.92, 1.08, 1), head, 0, 0.13, 0); // blank oval head
  add(new THREE.CylinderGeometry(0.06 * CM, 0.075 * CM, 0.08 * CM, 10), head, 0, 0.0, 0); // neck
  for (const [arm, fore, s] of [[armL, foreL, 1], [armR, foreR, -1]]) {
    add(cap(0.055 * b, 0.18), arm, 0, -0.13, 0);
    add(cap(0.048 * b, 0.17), fore, 0, -0.13, 0);
    add(new THREE.BoxGeometry(0.07 * CM, 0.09 * CM, 0.05 * CM), fore, 0, -0.29, 0, 1); // accent gloves
    if (L.weapon === 'blade' && s < 0) add(new THREE.BoxGeometry(0.02 * CM, 0.04 * CM, 0.34 * CM).translate(0, 0, 0.17 * CM), fore, 0, -0.31, 0.02, 1);
    if (L.weapon === 'fists') add(new THREE.BoxGeometry(0.1 * CM, 0.06 * CM, 0.09 * CM), fore, 0, -0.33, 0.01, 1);
  }
  for (const [thigh, shin] of [[thighL, shinL], [thighR, shinR]]) {
    add(cap(0.075 * b, 0.26), thigh, 0, -0.21, 0);
    add(cap(0.06 * b, 0.28), shin, 0, -0.2, 0);
    add(new THREE.BoxGeometry(0.1 * CM, 0.06 * CM, 0.2 * CM), shin, 0, -0.42, 0.04); // feet point +Z
  }
  // chest stripe in the accent colour (reads as "front")
  add(new THREE.BoxGeometry(0.06 * CM, 0.24 * CM, 0.03 * CM), chest, 0, 0.12, 0.155 * b, 1);
  if (L.weapon === 'halo') add(new THREE.TorusGeometry(0.2 * CM, 0.012 * CM, 6, 32).rotateX(Math.PI / 2), head, 0, 0.3, 0, 1);

  const geos = [[], []];
  for (const p of parts) {
    const g = p.geo.toNonIndexed();
    const wp = new THREE.Vector3().setFromMatrixPosition(p.bn.matrixWorld).add(p.at);
    g.translate(wp.x, wp.y, wp.z);
    const n = g.attributes.position.count;
    const bi = bones.indexOf(p.bn);
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 === 0 ? bi : 0)), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
    geos[p.mat].push(g);
  }
  const geo = mergeVertices(mergeGeometries([mergeGeometries(geos[0]), mergeGeometries(geos[1])], true), 1e-3);
  const mats = [
    new THREE.MeshStandardMaterial({ name: 'Body', color: L.body, roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ name: 'Accent', color: L.accent, emissive: L.accent, emissiveIntensity: 0.6, roughness: 0.4 }),
  ];
  const mesh = new THREE.SkinnedMesh(geo, mats);
  mesh.name = `${id}-mannequin`;
  const skeleton = new THREE.Skeleton(bones);
  const rootNode = new THREE.Group();
  rootNode.name = `${id}`;
  rootNode.add(hips, mesh);
  mesh.bind(skeleton);

  // animation
  const q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)).toArray();
  const rot = (bn, times, eulers) => new THREE.QuaternionKeyframeTrack(`${bn.name}.quaternion`, times, eulers.flatMap((e) => q(...e)));
  const pos = (bn, times, ys) => new THREE.VectorKeyframeTrack(`${bn.name}.position`, times, ys.flatMap((y) => [bn.position.x, bn.position.y + y * CM, bn.position.z]));
  const T = [0, 1, 2];
  const idle = new THREE.AnimationClip('Idle', 2, [
    pos(hips, T, [0, -0.015, 0]),
    rot(chest, T, [[0, 0, 0], [0.04, 0, 0], [0, 0, 0]]),
    rot(head, T, [[0, 0.05, 0], [-0.03, -0.05, 0], [0, 0.05, 0]]),
    rot(armL, T, [[0, 0, 0.12], [0, 0, 0.16], [0, 0, 0.12]]),
    rot(armR, T, [[0, 0, -0.12], [0, 0, -0.16], [0, 0, -0.12]]),
    rot(foreL, T, [[-0.2, 0, 0], [-0.26, 0, 0], [-0.2, 0, 0]]),
    rot(foreR, T, [[-0.2, 0, 0], [-0.26, 0, 0], [-0.2, 0, 0]]),
    rot(thighL, T, [[0, 0, 0.04], [0.03, 0, 0.04], [0, 0, 0.04]]),
    rot(thighR, T, [[0, 0, -0.04], [0.03, 0, -0.04], [0, 0, -0.04]]),
    rot(shinL, T, [[0, 0, 0], [0.06, 0, 0], [0, 0, 0]]),
    rot(shinR, T, [[0, 0, 0], [0.06, 0, 0], [0, 0, 0]]),
  ]);
  const A = [0, 0.12, 0.24, 0.5];
  const attack = new THREE.AnimationClip('Attack', 0.5, [
    rot(spine, A, [[0, 0, 0], [0, 0.5, 0], [0.1, -0.6, 0], [0, 0, 0]]),
    rot(armR, A, [[0, 0, -0.12], [-2.4, 0, -0.3], [-1.4, 0, 0.2], [0, 0, -0.12]]),
    rot(foreR, A, [[-0.2, 0, 0], [-1.2, 0, 0], [-0.1, 0, 0], [-0.2, 0, 0]]),
    rot(armL, A, [[0, 0, 0.12], [-0.6, 0, 0.4], [0.3, 0, 0.2], [0, 0, 0.12]]),
    pos(hips, A, [0, -0.04, -0.06, 0]),
  ]);
  return { scene: rootNode, clips: [idle, attack] };
}

async function writeGLB(id) {
  const { scene, clips } = mannequin(id);
  const exporter = new GLTFExporter();
  const buf = await exporter.parseAsync(scene, { binary: true, animations: clips });
  const file = path.join(OUT, 'models', `${id}.glb`);
  fs.writeFileSync(file, Buffer.from(buf));
  console.log(`  ${path.relative(ROOT, file)}  ${(buf.byteLength / 1024).toFixed(1)} KB`);
}

for (const id of Object.keys(LOOKS)) await writeGLB(id);

// ---- PNG portraits: faceless flat silhouettes drawn on a canvas in headless Chromium
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
const draw = async (name, w, h, look, label) => {
  const data = await page.evaluate(({ w, h, look, label }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const k = Math.min(w / 400, h / 600);
    g.translate(w / 2, h);
    g.scale(k, k);
    const body = (fill) => {
      g.fillStyle = fill;
      g.beginPath(); g.ellipse(0, -520, 46, 54, 0, 0, Math.PI * 2); g.fill(); // blank head
      g.beginPath();
      g.moveTo(-24, -470); g.lineTo(24, -470); g.lineTo(110 * look.build, -420); g.lineTo(150, -250); g.lineTo(118, -240);
      g.lineTo(80, -360); g.lineTo(70, -230); g.lineTo(96, 0); g.lineTo(26, 0); g.lineTo(0, -200);
      g.lineTo(-26, 0); g.lineTo(-96, 0); g.lineTo(-70, -230); g.lineTo(-80, -360); g.lineTo(-170, -470); g.lineTo(-140, -490);
      g.lineTo(-110 * look.build, -420); g.closePath(); g.fill();
    };
    g.save(); g.translate(10, 6); body('rgba(0,0,0,0.0)'); g.restore();
    g.lineJoin = 'round';
    g.strokeStyle = '#fff'; g.lineWidth = 14;
    g.save(); body('#fff'); g.restore();
    g.save(); g.scale(0.965, 0.975); g.translate(0, -8); body(look.ink); g.restore();
    // accent sash + stripe
    g.fillStyle = look.accent;
    g.beginPath(); g.moveTo(-70, -420); g.lineTo(-40, -420); g.lineTo(60, -250); g.lineTo(30, -250); g.closePath(); g.fill();
    // "PLACEHOLDER" tag
    g.save(); g.rotate(-0.2); g.fillStyle = '#ffe600'; g.fillRect(-190, -150, 380, 56);
    g.fillStyle = '#000'; g.font = 'italic 900 36px sans-serif'; g.textAlign = 'center'; g.fillText(label, 0, -110); g.restore();
    return c.toDataURL('image/png');
  }, { w, h, look, label });
  const file = path.join(OUT, 'portraits', `${name}.png`);
  fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`  ${path.relative(ROOT, file)}`);
};
const INK = { jester: { ink: '#111', accent: '#e8002d', build: 1 }, queen: { ink: '#1a1014', accent: '#ff2a3d', build: 1.12 }, oracle: { ink: '#0d1512', accent: '#39ff88', build: 0.92 } };
for (const [id, look] of Object.entries(INK)) {
  await draw(`${id}-cutin`, 800, 1200, look, `${id.toUpperCase()} · CC0`);
  await draw(`${id}-card`, 400, 600, look, 'PLACEHOLDER');
}
await draw('finisher', 1000, 1500, { ink: '#0a0a0a', accent: '#e8002d', build: 1.05 }, 'FINISHER · CC0');
await browser.close();
fs.writeFileSync(path.join(OUT, 'LICENSE.txt'), 'Placeholder art generated by scripts/make-placeholder-assets.mjs for this project.\nDedicated to the public domain under CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/\n');
console.log('done');
