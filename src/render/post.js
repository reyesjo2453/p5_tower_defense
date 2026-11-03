// Post-processing: bloom on emissive neon, then a Ben-Day halftone pass that bites into the screen
// corners and the deep shadows, plus a subtle crimson/black grade and vignette.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const HalftoneShader = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uDot: { value: 7.0 }, // dot cell size in CSS px
    uCorner: { value: 0.55 }, // how far the corner halftone reaches
    uShadow: { value: 0.12 }, // luminance below which shadows get dots
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uAberration: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uDot, uCorner, uShadow, uTime, uFlash, uAberration;
    uniform vec3 uFlashColor;
    varying vec2 vUv;
    float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main() {
      vec2 off = (vUv - 0.5) * uAberration * 0.012;
      vec4 base = texture2D(tDiffuse, vUv);
      vec3 col = base.rgb;
      if (uAberration > 0.001) {
        col.r = texture2D(tDiffuse, vUv + off).r;
        col.b = texture2D(tDiffuse, vUv - off).b;
      }
      float L = lum(col);
      // rotated (45deg) dot grid in pixel space
      vec2 p = vUv * uRes;
      float c45 = 0.7071;
      vec2 r = vec2(c45 * p.x - c45 * p.y, c45 * p.x + c45 * p.y) / uDot;
      vec2 cell = fract(r) - 0.5;
      float d = length(cell);
      // corner mask (distance from centre in aspect space)
      vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float corner = smoothstep(uCorner, uCorner + 0.45, length(q));
      float shadow = smoothstep(uShadow, 0.0, L);
      float amount = clamp(max(corner, shadow * 0.45), 0.0, 1.0);
      float radius = 0.5 * amount;
      float dotMask = 1.0 - smoothstep(radius - 0.06, radius + 0.06, d);
      // dots: deep black in the light, crimson in the deepest shadow
      vec3 ink = mix(vec3(0.0), vec3(0.45, 0.0, 0.05), shadow * (1.0 - corner));
      col = mix(col, ink, dotMask * amount * 0.7);
      // grade: lift reds, crush blacks a touch, cool the shadows slightly
      col = pow(col, vec3(1.05, 1.08, 1.04));
      col.r *= 1.04;
      // vignette
      col *= 1.0 - 0.35 * smoothstep(0.55, 1.15, length(q));
      col = mix(col, uFlashColor, clamp(uFlash, 0.0, 1.0));
      gl_FragColor = vec4(col, base.a);
    }
  `,
};

export function createPost(renderer, scene, camera, { quality = 'high' } = {}) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  let bloom = null;
  if (quality !== 'low') {
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.35, 1.15);
    composer.addPass(bloom);
  }
  composer.addPass(new OutputPass());
  const halftone = new ShaderPass(HalftoneShader);
  composer.addPass(halftone);
  const api = {
    composer,
    halftone,
    bloom,
    setSize(w, h, pr) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      halftone.uniforms.uRes.value.set(w * pr, h * pr);
      halftone.uniforms.uDot.value = 6.5 * pr;
    },
    render(dt, t) {
      halftone.uniforms.uTime.value = t;
      composer.render(dt);
    },
  };
  api.setSize(size.x, size.y, renderer.getPixelRatio());
  return api;
}
