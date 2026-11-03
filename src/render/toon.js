// Cel-shading material system.
// toon(): MeshToonMaterial with a hard 3-step ramp, plus an injected hard-cutoff Blinn specular
// ("anime gloss") and a sharp rim light, so even glossy obsidian stays cel-shaded.
// outline(): inverted-hull ink outline (back faces pushed out along normals).
import * as THREE from 'three';

let ramp = null;
function gradientMap() {
  if (ramp) return ramp;
  const data = new Uint8Array([40, 40, 40, 255, 130, 130, 130, 255, 255, 255, 255, 255]);
  ramp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

const cache = new Map();

/**
 * @param {string|number} color
 * @param {object} o  { map, spec 0..2, shininess, rim 0..2, rimColor, emissive, emissiveIntensity, transparent, opacity, side }
 */
export function toon(color, o = {}) {
  const key = o.unique || o.map ? null : JSON.stringify([color, o]);
  if (key && cache.has(key)) return cache.get(key);
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradientMap(),
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: !!o.transparent,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
    map: o.map ?? null,
  });
  const spec = o.spec ?? 0.6;
  const shin = o.shininess ?? 60;
  const rim = o.rim ?? 0.5;
  const rimColor = new THREE.Color(o.rimColor ?? 0xffffff);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSpec = { value: spec };
    sh.uniforms.uShin = { value: shin };
    sh.uniforms.uRim = { value: rim };
    sh.uniforms.uRimColor = { value: rimColor };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSpec;\nuniform float uShin;\nuniform float uRim;\nuniform vec3 uRimColor;')
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        {
          vec3 N = normalize(geometryNormal);
          vec3 V = normalize(geometryViewDir);
          #if NUM_DIR_LIGHTS > 0
          for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
            vec3 L = directionalLights[i].direction;
            vec3 Hh = normalize(L + V);
            float s = pow(max(dot(N, Hh), 0.0), uShin);
            reflectedLight.directDiffuse += directionalLights[i].color * smoothstep(0.45, 0.5, s) * uSpec;
            // sharp rim on the lit side
            float r = 1.0 - max(dot(N, V), 0.0);
            float lit = max(dot(N, L), 0.0);
            reflectedLight.directDiffuse += uRimColor * smoothstep(0.62, 0.66, r) * step(0.05, lit) * uRim * directionalLights[i].color;
          }
          #endif
        }`,
      );
  };
  m.customProgramCacheKey = () => `toon-${spec}-${shin}-${rim}`;
  if (key) cache.set(key, m);
  return m;
}

/** Unlit glowing material (feeds bloom). */
export function glowMat(color, intensity = 2, o = {}) {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
}

const outlineMats = new Map();
function outlineMat(width, color) {
  const key = `${width}|${color}`;
  if (outlineMats.has(key)) return outlineMats.get(key);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normal * ${width.toPrecision(4)};`);
  };
  m.customProgramCacheKey = () => `outline-${width}`;
  outlineMats.set(key, m);
  return m;
}

/**
 * Add an ink outline shell to every mesh under `root` (skips meshes flagged noOutline).
 * Skinned meshes get a skinned shell bound to the same skeleton so the ink follows the animation.
 * With `worldSpace`, `width` is in world units (divided by each mesh's world scale): use it for
 * imported models whose authoring scale is unknown.
 */
export function outline(root, width = 0.025, color = 0x050507, { worldSpace = false } = {}) {
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.userData.noOutline && !o.userData.isOutline) meshes.push(o);
  });
  if (worldSpace) root.updateMatrixWorld(true);
  const ws = new THREE.Vector3();
  for (const m of meshes) {
    let w = width;
    if (worldSpace) {
      m.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), ws);
      w = width / Math.max(1e-6, (Math.abs(ws.x) + Math.abs(ws.y) + Math.abs(ws.z)) / 3);
      w = Number(w.toPrecision(3)); // keep the material cache small
    }
    let shell;
    if (m.isSkinnedMesh) {
      shell = new THREE.SkinnedMesh(m.geometry, outlineMat(w, color));
      shell.bind(m.skeleton, m.bindMatrix);
      shell.bindMode = m.bindMode;
    } else {
      shell = new THREE.Mesh(m.geometry, outlineMat(w, color));
    }
    shell.userData.isOutline = true;
    shell.raycast = () => {};
    shell.castShadow = false;
    m.add(shell);
  }
  return root;
}

/** Set all meshes under root to cast/receive shadows. */
export function shadows(root, cast = true, receive = false) {
  root.traverse((o) => {
    if (o.isMesh && !o.userData.isOutline) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return root;
}
