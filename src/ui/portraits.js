// Renders each unit's 3D model as a stark black silhouette (keeping only its glowing parts, e.g. the
// mask/visor/core "eye-slashes") into a transparent PNG for the comic cut-ins and deploy cards.
import * as THREE from 'three';
import { BUILDERS } from '../render/models.js';

export function renderPortraits(ids, size = 384) {
  const out = {};
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return out;
  }
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  for (const id of ids) {
    const scene = new THREE.Scene();
    const m = BUILDERS[id]();
    m.root.traverse((o) => {
      if (!o.isMesh && !o.isLineSegments) return;
      const keep = o.material && o.material.isMeshBasicMaterial && !o.userData.isOutline && o.material.color.getHex() !== 0x000000 && o.material.blending !== THREE.AdditiveBlending;
      if (o.isLineSegments) return;
      if (!keep) o.material = black;
    });
    if (id === 'oracle') m.parts.body.position.y = 0.55;
    m.root.rotation.y = -0.45;
    scene.add(m.root);
    const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
    const h = m.height;
    cam.position.set(0, h * 0.62, 5.2);
    cam.lookAt(0, h * 0.55, 0);
    renderer.render(scene, cam);
    out[id] = renderer.domElement.toDataURL('image/png');
  }
  renderer.dispose();
  renderer.forceContextLoss?.();
  return out;
}
