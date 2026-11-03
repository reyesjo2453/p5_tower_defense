Project notes for Claude Code
Encore Protocol · Phantom Showcase: a Persona-inspired 3D tower defense set in a neon Palace (Vite + Three.js, mobile-first).
- Dev: npm run dev (LAN URL for phones). Tests: npm test. Build: npm run build. Browser e2e: npm run smoke (after build).
- src/sim/ is pure logic (no DOM/Three.js) and the source of truth; the view drains game.drain() events.
- Asset loading pipeline:
  - 3D models live in public/models/ (.glb format). Load via GLTFLoader using SkeletonUtils.clone() with Box3 normalization (~1.8 units tall, base grounded at y = 0). Apply toon() and outline() shaders to imported meshes.
  - If a model file is missing or fails to load, gracefully fall back to the procedural primitives in src/render/models.js.
  - 2D cut-in and finisher art checks public/portraits/ (.png) first. If an image is missing, fall back to the vector silhouettes in src/ui/silhouettes.js.
- 2D comic FX and frames live in src/ui/comic.js (stars, ink, speedlines, torn paper).
- The Palace backdrop is src/render/palace.js; keep it instanced/merged (mobile draw-call budget).
- All meshes use toon() from src/render/toon.js (cel ramp + hard spec + rim) and outline() for ink lines; glowing parts use glowMat() (unlit, toneMapped false) so only they bloom.
- After changing numbers in src/sim/data.js, run npm test (balance guard rails: win with mechanics, lose without).
- window.__game exposes { game, state, rig, scene, … } for debugging/smoke tests.
- Deploy: .github/workflows/pages.yml (push to main or manual run; Pages source must be "GitHub Actions").
