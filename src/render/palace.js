// The Palace around the arena: a reflective marble checkerboard that runs to the horizon with a neon
// circuit matrix, a distant neon skyline with gothic spires, giant wireframe roulette wheels, golden
// chains hanging out of the dark, gothic balustrades, neon archways, and floating dice + calling cards.
// Everything is instanced or merged so the whole backdrop costs ~25 draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { toon, glowMat } from './toon.js';
import { cardTexture } from './models.js';

const EDGE = 8.7; // balustrade line (the board's tiles end at +-7.5)

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function buildPalace(scene, { quality = 'high' } = {}) {
  const group = new THREE.Group();
  group.name = 'palace';
  scene.add(group);
  const r = rng(1337);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const animated = [];

  // ------------------------------------------------------------ sky: velvet gradient dome
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(110, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uTop: { value: new THREE.Color(0x07040c) }, uHorizon: { value: new THREE.Color(0x3a0b2c) }, uGlow: { value: new THREE.Color(0x8a0a2a) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uTop, uHorizon, uGlow; varying vec3 vP;
        void main(){
          float h = clamp(vP.y, 0.0, 1.0);
          vec3 c = mix(uHorizon, uTop, smoothstep(0.0, 0.42, h));
          c += uGlow * pow(1.0 - h, 10.0) * 0.55;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  sky.renderOrder = -10;
  group.add(sky);

  // ------------------------------------------------------------ floor: mirror + marble checkerboard
  if (quality === 'high') {
    const mirror = new Reflector(new THREE.PlaneGeometry(240, 240), {
      textureWidth: Math.min(1024, window.innerWidth * window.devicePixelRatio * 0.5),
      textureHeight: Math.min(1024, window.innerHeight * window.devicePixelRatio * 0.5),
      color: 0x2a2232,
    });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = -0.006;
    group.add(mirror);
  }
  const marbleTex = marbleTexture();
  marbleTex.repeat.set(60, 60);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    toon(0xffffff, { map: marbleTex, spec: 1.2, shininess: 200, rim: 0, transparent: quality === 'high', opacity: quality === 'high' ? 0.8 : 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.004;
  floor.receiveShadow = true;
  group.add(floor);

  // circuit matrix: concentric neon octagons + radial traces with right-angle jogs
  {
    const pos = [];
    const col = [];
    const red = new THREE.Color(0xff1a4a).multiplyScalar(0.9);
    const gold = new THREE.Color(0xffb020).multiplyScalar(0.75);
    const seg = (a, b, c) => {
      pos.push(a.x, 0.01, a.y, b.x, 0.01, b.y);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    };
    const oct = (R, c) => {
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const a1 = ((i + 1) / 8) * Math.PI * 2 + Math.PI / 8;
        seg(new THREE.Vector2(Math.cos(a0) * R, Math.sin(a0) * R), new THREE.Vector2(Math.cos(a1) * R, Math.sin(a1) * R), c);
      }
    };
    oct(11.5, red);
    oct(16, gold);
    oct(24, red);
    oct(36, gold);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r0 = 11.5;
      const r1 = 16 + r() * 22;
      const jog = r() * 2.4 - 1.2;
      const p0 = new THREE.Vector2(Math.cos(a) * r0, Math.sin(a) * r0);
      const pm = new THREE.Vector2(Math.cos(a) * (r0 + r1) * 0.5, Math.sin(a) * (r0 + r1) * 0.5);
      const pj = pm.clone().add(new THREE.Vector2(-Math.sin(a) * jog, Math.cos(a) * jog));
      const p1 = new THREE.Vector2(Math.cos(a) * r1, Math.sin(a) * r1).add(new THREE.Vector2(-Math.sin(a) * jog, Math.cos(a) * jog));
      const c = i % 3 ? gold : red;
      seg(p0, pm, c);
      seg(pm, pj, c);
      seg(pj, p1, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, opacity: 0.85 }));
    group.add(lines);
    animated.push((t) => { lines.material.opacity = 0.65 + Math.sin(t * 1.7) * 0.2; });
  }

  // ------------------------------------------------------------ skyline: neon towers + gothic spires
  {
    const towers = [];
    for (let i = 0; i < 90; i++) {
      // full ring, denser behind the board (-z) where the camera looks
      let a = r() * Math.PI * 2;
      if (r() < 0.55) a = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.1;
      const R = 34 + r() * 30;
      const w = 2 + r() * 3.5;
      const d = 2 + r() * 3.5;
      const h = 8 + Math.pow(r(), 1.6) * 34;
      towers.push({ x: Math.cos(a) * R, z: Math.sin(a) * R, w, d, h, rot: r() * Math.PI });
    }
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const body = new THREE.InstancedMesh(box, toon(0x140c20, { unique: true, spec: 0.4, rim: 1.2, rimColor: 0xff3a7a }), towers.length);
    const winTex = windowTexture();
    const wins = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ map: winTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(1.1, 1.1, 1.1) }), towers.length);
    const bandGeo = new THREE.BoxGeometry(1.04, 0.18, 1.04);
    const bands = new THREE.InstancedMesh(bandGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), towers.length * 2);
    const spireGeo = new THREE.ConeGeometry(0.5, 1, 4);
    spireGeo.translate(0, 0.5, 0);
    spireGeo.rotateY(Math.PI / 4);
    const spires = new THREE.InstancedMesh(spireGeo, toon(0x1a1028, { unique: true, spec: 0.6, rim: 1.4, rimColor: 0xffc400 }), towers.length);
    const antGeo = new THREE.BoxGeometry(0.12, 1, 0.12);
    antGeo.translate(0, 0.5, 0);
    const ants = new THREE.InstancedMesh(antGeo, glowMat(0xff1a3d, 2.4), towers.length);
    const neon = [0xff1a4a, 0xff3ad0, 0x38e8ff, 0xffc400];
    let nb = 0;
    let ns = 0;
    let na = 0;
    towers.forEach((tw, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tw.rot);
      m4.compose(v.set(tw.x, 0, tw.z), q, s3.set(tw.w, tw.h, tw.d));
      body.setMatrixAt(i, m4);
      m4.compose(v.set(tw.x, 0, tw.z), q, s3.set(tw.w * 1.01, tw.h * 0.96, tw.d * 1.01));
      wins.setMatrixAt(i, m4);
      const c = new THREE.Color(neon[i % neon.length]).multiplyScalar(1.3 + r() * 1.2);
      for (const k of [0.62 + r() * 0.2, 1.0]) {
        if (k < 1 && r() < 0.5) continue;
        m4.compose(v.set(tw.x, tw.h * k - 0.09, tw.z), q, s3.set(tw.w, 1, tw.d));
        bands.setMatrixAt(nb, m4);
        bands.setColorAt(nb++, c);
      }
      if (tw.h > 22 || r() < 0.3) {
        const sh = Math.min(tw.w, tw.d) * (1.4 + r() * 1.6);
        m4.compose(v.set(tw.x, tw.h, tw.z), q, s3.set(Math.min(tw.w, tw.d) * 1.3, sh, Math.min(tw.w, tw.d) * 1.3));
        spires.setMatrixAt(ns++, m4);
        m4.compose(v.set(tw.x, tw.h + sh * 0.9, tw.z), q, s3.set(1, 3 + r() * 4, 1));
        ants.setMatrixAt(na++, m4);
      }
    });
    bands.count = nb;
    spires.count = ns;
    ants.count = na;
    // the far backdrop ignores the velvet fog (density 0.025 would swallow it whole): it reads as hard
    // neon silhouettes against the glowing horizon instead
    for (const m of [body, wins, bands, spires, ants]) noFog(m.material);
    group.add(body, wins, bands, spires, ants);
    animated.push((t) => {
      ants.material.color.setRGB(2.4, 0.1, 0.24).multiplyScalar(0.7 + 0.3 * Math.sin(t * 4));
    });
  }

  // ------------------------------------------------------------ giant wireframe roulette wheels
  const wheels = [
    { p: [-27, 15, -38], r: 9, tilt: [0.5, 0.6, 0.25], spin: 0.12 },
    { p: [29, 12, -32], r: 7, tilt: [0.9, -0.5, -0.2], spin: -0.18 },
    { p: [3, 26, -60], r: 13, tilt: [0.15, 0, 0.1], spin: 0.07 },
  ].map((o) => {
    const w = roulette(o.r);
    w.position.set(...o.p);
    w.rotation.set(...o.tilt);
    group.add(w);
    return { w, spin: o.spin };
  });
  animated.push((t, dt) => { for (const { w, spin } of wheels) w.children[0].rotation.y += spin * dt; });

  // ------------------------------------------------------------ golden chains
  {
    const link = new THREE.TorusGeometry(0.34, 0.085, 6, 12);
    link.scale(1, 1.5, 1);
    const chains = [];
    const catenary = (a, b, sag, n) => {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const p = new THREE.Vector3().lerpVectors(a, b, k);
        p.y -= Math.sin(k * Math.PI) * sag;
        pts.push(p);
      }
      return new THREE.CatmullRomCurve3(pts);
    };
    chains.push(catenary(new THREE.Vector3(-40, 24, -28), new THREE.Vector3(-10, 26, -44), 9, 8));
    chains.push(catenary(new THREE.Vector3(8, 27, -48), new THREE.Vector3(42, 22, -24), 10, 8));
    chains.push(catenary(new THREE.Vector3(-20, 25, -22), new THREE.Vector3(18, 27, -26), 11, 8));
    // straight drops out of the dark on both flanks
    for (const [x, z, y0] of [[-15, -12, 7], [15, -10, 6], [-19, 2, 8], [19, 4, 9], [-8, -20, 10], [9, -22, 9]]) {
      chains.push(new THREE.LineCurve3(new THREE.Vector3(x, 30, z), new THREE.Vector3(x, y0, z)));
    }
    const step = 0.52;
    const placements = [];
    for (const c of chains) {
      const len = c.getLength();
      const n = Math.floor(len / step);
      for (let i = 0; i < n; i++) {
        const u = i / n;
        placements.push({ p: c.getPointAt(u), t: c.getTangentAt(u), odd: i % 2 });
      }
    }
    const im = new THREE.InstancedMesh(link, toon(0xffb300, { unique: true, spec: 1.6, shininess: 90, rim: 0.8, rimColor: 0xfff0b0 }), placements.length);
    const up = new THREE.Vector3(0, 1, 0);
    placements.forEach(({ p, t, odd }, i) => {
      q.setFromUnitVectors(up, t);
      if (odd) q.multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2));
      m4.compose(p, q, s3.set(1, 1, 1));
      im.setMatrixAt(i, m4);
    });
    noFog(im.material);
    group.add(im);
    // pendant weights (suspended crowns-of-thorns) at the bottom of the drops
    const pend = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), glowMat(0xffc400, 2.2));
    const pends = new THREE.InstancedMesh(pend.geometry, pend.material, 6);
    [[-15, -12, 7], [15, -10, 6], [-19, 2, 8], [19, 4, 9], [-8, -20, 10], [9, -22, 9]].forEach(([x, z, y0], i) => {
      m4.makeTranslation(x, y0 - 0.7, z);
      pends.setMatrixAt(i, m4);
    });
    noFog(pends.material);
    group.add(pends);
  }

  // ------------------------------------------------------------ gothic balustrades (back + flanks)
  {
    const prof = [[0.16, 0], [0.16, 0.06], [0.08, 0.1], [0.07, 0.18], [0.14, 0.34], [0.15, 0.42], [0.08, 0.56], [0.06, 0.62], [0.11, 0.68], [0.11, 0.72]].map(([x, y]) => new THREE.Vector2(x, y));
    const baluster = new THREE.LatheGeometry(prof, 8);
    const marble = toon(0x231b30, { spec: 0.9, shininess: 120, rim: 1.0, rimColor: 0xffc400 });
    const runs = [
      { a: [-EDGE, -EDGE], b: [EDGE, -EDGE] },
      { a: [-EDGE, -EDGE], b: [-EDGE, 6.5] },
      { a: [EDGE, -EDGE], b: [EDGE, 6.5] },
    ];
    const pts = [];
    for (const { a, b } of runs) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.floor(len / 0.42);
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        if (Math.abs((i % 8) - 0) < 0.5) continue; // gaps for the newel posts
        pts.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
      }
    }
    const bal = new THREE.InstancedMesh(baluster, marble, pts.length);
    pts.forEach(([x, z], i) => {
      m4.makeTranslation(x, 0.08, z);
      bal.setMatrixAt(i, m4);
    });
    bal.castShadow = true;
    group.add(bal);
    const rails = [];
    const neonRails = [];
    const posts = [];
    for (const { a, b } of runs) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const mx = (a[0] + b[0]) / 2;
      const mz = (a[1] + b[1]) / 2;
      const alongX = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]);
      for (const [y, h, wdt] of [[0.04, 0.08, 0.42], [0.84, 0.1, 0.36]]) {
        const g = new THREE.BoxGeometry(alongX ? len + 0.4 : wdt, h, alongX ? wdt : len + 0.4);
        g.translate(mx, y + h / 2, mz);
        rails.push(g);
      }
      const ng = new THREE.BoxGeometry(alongX ? len + 0.4 : 0.05, 0.03, alongX ? 0.05 : len + 0.4);
      ng.translate(mx + (alongX ? 0 : Math.sign(mx) * -0.19), 0.955, mz + (alongX ? 0.19 : 0));
      neonRails.push(ng);
      const n = Math.floor(len / 0.42);
      for (let i = 0; i <= n; i += 8) {
        const k = i / n;
        const x = a[0] + (b[0] - a[0]) * k;
        const z = a[1] + (b[1] - a[1]) * k;
        const pg = new THREE.BoxGeometry(0.34, 1.22, 0.34);
        pg.translate(x, 0.61, z);
        posts.push(pg);
        const cap = new THREE.ConeGeometry(0.2, 0.4, 4);
        cap.rotateY(Math.PI / 4);
        cap.translate(x, 1.42, z);
        posts.push(cap);
      }
    }
    const railMesh = new THREE.Mesh(mergeGeometries([...rails, ...posts]), marble);
    railMesh.castShadow = true;
    railMesh.receiveShadow = true;
    group.add(railMesh);
    group.add(new THREE.Mesh(mergeGeometries(neonRails), glowMat(0xff1a4a, 2.2)));
    // flame-like neon finials on top of every post
    const fin = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.09), glowMat(0xffc400, 3), posts.length / 2);
    let fi = 0;
    for (let i = 0; i < posts.length; i += 2) {
      posts[i].computeBoundingBox();
      const bb = posts[i].boundingBox;
      m4.makeTranslation((bb.min.x + bb.max.x) / 2, 1.72, (bb.min.z + bb.max.z) / 2);
      fin.setMatrixAt(fi++, m4);
    }
    group.add(fin);
  }

  // ------------------------------------------------------------ neon gothic archways
  {
    const archPts = [
      [0, -11.6, 0], [-7.2, -11.2, 0.12], [7.2, -11.2, -0.12],
      [-11.4, -4.5, Math.PI / 2 - 0.1], [11.4, -4.5, -Math.PI / 2 + 0.1],
      [-11.6, 3.2, Math.PI / 2], [11.6, 3.2, -Math.PI / 2],
    ];
    const W = 1.7;
    const S = 4.2;
    const pointed = (w, s, apex) => {
      const p = new THREE.CurvePath();
      p.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-w, s, 0), new THREE.Vector3(-w, s + apex * 0.82, 0), new THREE.Vector3(0, s + apex, 0)));
      p.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, s + apex, 0), new THREE.Vector3(w, s + apex * 0.82, 0), new THREE.Vector3(w, s, 0)));
      return p;
    };
    const stone = [];
    for (const x of [-W, W]) {
      const g = new THREE.BoxGeometry(0.5, S, 0.5);
      g.translate(x, S / 2, 0);
      stone.push(g.toNonIndexed());
      const base = new THREE.BoxGeometry(0.72, 0.36, 0.72);
      base.translate(x, 0.18, 0);
      stone.push(base.toNonIndexed());
      const cap = new THREE.ConeGeometry(0.34, 1.1, 4);
      cap.rotateY(Math.PI / 4);
      cap.translate(x, S + 0.55, 0);
      stone.push(cap.toNonIndexed());
    }
    const archStone = new THREE.TubeGeometry(pointed(W, S, 2.5), 24, 0.2, 6);
    stone.push(archStone.toNonIndexed());
    const stoneGeo = mergeGeometries(stone);
    const outer = mergeGeometries([new THREE.TubeGeometry(pointed(W - 0.32, S - 0.1, 2.1), 30, 0.055, 5).toNonIndexed(),
      ...[-W + 0.32, W - 0.32].map((x) => { const g = new THREE.BoxGeometry(0.06, S - 0.3, 0.06); g.translate(x, (S - 0.3) / 2 + 0.2, 0.26); return g.toNonIndexed(); })]);
    const inner = new THREE.TubeGeometry(pointed(W - 0.62, S - 0.3, 1.5), 30, 0.035, 5);
    const sI = new THREE.InstancedMesh(stoneGeo, toon(0x1b1426, { spec: 0.8, rim: 1.2, rimColor: 0xff3a7a }), archPts.length);
    const oI = new THREE.InstancedMesh(outer, glowMat(0xff1a4a, 3.2), archPts.length);
    const iI = new THREE.InstancedMesh(inner, glowMat(0xffc400, 2.6), archPts.length);
    const curtain = new THREE.InstancedMesh(new THREE.PlaneGeometry(2 * W - 0.5, S + 1.6), glowMat(0xff1a4a, 0.6, { transparent: true, opacity: 0.12, additive: true, depthWrite: false, side: THREE.DoubleSide }), archPts.length);
    archPts.forEach(([x, z, ry], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      m4.compose(v.set(x, 0, z), q, s3.set(1, 1, 1));
      sI.setMatrixAt(i, m4);
      oI.setMatrixAt(i, m4);
      iI.setMatrixAt(i, m4);
      m4.compose(v.set(x, (S + 1.6) / 2, z), q, s3.set(1, 1, 1));
      curtain.setMatrixAt(i, m4);
    });
    sI.castShadow = true;
    group.add(sI, oI, iI, curtain);
    animated.push((t) => { oI.material.color.setRGB(3.2, 0.33, 0.93).multiplyScalar(0.8 + 0.2 * Math.sin(t * 3.1)); });
  }

  // ------------------------------------------------------------ floating dice + calling cards
  const floaters = [];
  {
    const faceMats = [1, 6, 2, 5, 3, 4].map((n) => toon(0xffffff, { map: diceFace(n), spec: 1.2, shininess: 140, rim: 0.6 }));
    const nD = 12;
    const dice = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), faceMats, nD);
    const cardMat = toon(0xffffff, { map: cardTexture(), spec: 0.8, rim: 0.6, side: THREE.DoubleSide });
    const nC = 18;
    const cards = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.56, 0.84), cardMat, nC);
    const ring = (i, n, R0, R1) => {
      // keep them out of the play area: a band around the board, mostly behind/sides
      const a = -Math.PI / 2 + ((i / n) - 0.5) * Math.PI * 1.75 + (r() - 0.5) * 0.2;
      const R = R0 + r() * (R1 - R0);
      return [Math.cos(a) * R, Math.sin(a) * R];
    };
    for (let i = 0; i < nD; i++) {
      const [x, z] = ring(i, nD, 10, 14.5);
      floaters.push({ im: dice, i, x, z, y: 1.8 + r() * 3.2, ph: r() * 6.28, sp: 0.4 + r() * 0.8, ax: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), s: 0.8 + r() * 0.9 });
      dice.setColorAt(i, new THREE.Color(i % 3 === 0 ? 0xff3050 : 0xffffff));
    }
    for (let i = 0; i < nC; i++) {
      const [x, z] = ring(i, nC, 9.6, 15);
      floaters.push({ im: cards, i, x, z, y: 1.2 + r() * 4, ph: r() * 6.28, sp: 0.6 + r() * 1.2, ax: new THREE.Vector3(r() - 0.5, 1, r() - 0.5).normalize(), s: 1 + r() * 0.5 });
    }
    dice.frustumCulled = false;
    cards.frustumCulled = false;
    group.add(dice, cards);
    const qq = new THREE.Quaternion();
    animated.push((t) => {
      for (const f of floaters) {
        qq.setFromAxisAngle(f.ax, t * f.sp + f.ph);
        m4.compose(v.set(f.x, f.y + Math.sin(t * 0.9 + f.ph) * 0.35, f.z), qq, s3.setScalar(f.s));
        f.im.setMatrixAt(f.i, m4);
      }
      dice.instanceMatrix.needsUpdate = true;
      cards.instanceMatrix.needsUpdate = true;
    });
  }

  let last = 0;
  return {
    group,
    update(t) {
      const dt = Math.min(0.1, Math.max(0, t - last));
      last = t;
      for (const fn of animated) fn(t, dt);
    },
  };
}

function noFog(mat) {
  // (toon() materials passed here are created with unique: true, so no shared cache entry is touched)
  mat.fog = false;
  return mat;
}

// ------------------------------------------------------------------------------------- textures
function marbleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const r = rng(99);
  const cells = [['#1d1628', '#0a0810'], ['#0a0810', '#1d1628']];
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    g.fillStyle = cells[y][x];
    g.fillRect(x * 256, y * 256, 256, 256);
  }
  // veins
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(${150 + r() * 80},${110 + r() * 60},${170 + r() * 60},${0.05 + r() * 0.12})`;
    g.lineWidth = 0.6 + r() * 1.8;
    g.beginPath();
    let x = r() * 512;
    let y = r() * 512;
    g.moveTo(x, y);
    for (let k = 0; k < 9; k++) {
      x += (r() - 0.35) * 70;
      y += (r() - 0.5) * 70;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // gold inlay between cells
  g.strokeStyle = 'rgba(200,150,40,.55)';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 509, 509);
  g.beginPath();
  g.moveTo(256, 0); g.lineTo(256, 512); g.moveTo(0, 256); g.lineTo(512, 256);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const r = rng(5);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 64, 256);
  const cols = ['#ff2a6a', '#ff9a2a', '#3ae8ff', '#ffe08a', '#c03aff'];
  for (let y = 6; y < 250; y += 9) {
    for (let x = 4; x < 60; x += 8) {
      if (r() < 0.32) {
        g.fillStyle = cols[Math.floor(r() * cols.length)];
        g.globalAlpha = 0.35 + r() * 0.65;
        g.fillRect(x, y, 4, 5);
      }
    }
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const pipLayout = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
};
function diceFace(n) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f1ea';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#050505';
  g.lineWidth = 4;
  g.strokeRect(2, 2, 60, 60);
  g.fillStyle = n === 1 ? '#e8002d' : '#050505';
  for (const [x, y] of pipLayout[n]) {
    g.beginPath();
    g.arc(x * 64, y * 64, n === 1 ? 10 : 6, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A floating roulette wheel drawn entirely in glowing line segments (red/gold pockets). */
function roulette(R) {
  const outer = new THREE.Group();
  const wheel = new THREE.Group();
  outer.add(wheel);
  const pos = [];
  const col = [];
  const gold = new THREE.Color(1.7, 1.15, 0.25);
  const red = new THREE.Color(1.9, 0.12, 0.3);
  const white = new THREE.Color(1.3, 1.25, 1.35);
  const seg = (a, b, c) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
  };
  const P = (rad, a, y = 0) => new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad);
  const N = 37;
  const rings = [[R, gold, 0], [R * 0.93, gold, 0.25], [R * 0.78, white, 0.25], [R * 0.62, gold, 0.5], [R * 0.2, gold, 0.9], [R * 0.12, red, 1.1]];
  for (const [rad, c, y] of rings) {
    for (let i = 0; i < 72; i++) seg(P(rad, (i / 72) * Math.PI * 2, y), P(rad, ((i + 1) / 72) * Math.PI * 2, y), c);
  }
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    seg(P(R * 0.78, a, 0.25), P(R * 0.93, a, 0.25), white);
    // pocket fill hint: a cross-hatch per pocket, alternating red / gold
    const a2 = ((i + 0.5) / N) * Math.PI * 2;
    seg(P(R * 0.8, a2, 0.25), P(R * 0.91, a2, 0.25), i % 2 ? red : gold);
    seg(P(R * 0.62, a, 0.5), P(R * 0.78, a, 0.25), i % 2 ? red : gold);
  }
  // hub spokes (a cross with diamond tips)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    seg(P(R * 0.12, a, 1.1), P(R * 0.58, a, 0.5), gold);
    seg(P(R * 0.58, a, 0.5), P(R * 0.5, a + 0.08, 0.6), gold);
    seg(P(R * 0.58, a, 0.5), P(R * 0.5, a - 0.08, 0.6), gold);
  }
  // spindle
  seg(new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(0, 2.2, 0), gold);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  wheel.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, opacity: 0.95, fog: false })));
  // a translucent velvet disc behind the lines so the wheel reads as a solid object
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshBasicMaterial({ color: 0x1a0612, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.05;
  wheel.add(disc);
  return outer;
}
