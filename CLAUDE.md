# Project notes for Claude Code

Encore Protocol · Phantom Showcase: a Persona-inspired 3D isometric tower defense (Vite + Three.js, mobile-first).

- Dev: `npm run dev` (LAN URL for phones). Tests: `npm test`. Build: `npm run build`. Browser e2e: `npm run smoke` (after build).
- `src/sim/` is pure logic (no DOM/Three.js) and the source of truth; the view drains `game.drain()` events.
- Never add ripped/copyrighted game assets. Models are built from primitives in `src/render/models.js`;
  designs are original and faceless; keep them that way. Don't draw faces with SVG/canvas paths.
- All meshes use `toon()` from `src/render/toon.js` (cel ramp + hard spec + rim) and `outline()` for ink lines;
  glowing parts use `glowMat()` (unlit, toneMapped false) so only they bloom.
- After changing numbers in `src/sim/data.js`, run `npm test` (balance guard rails: win with mechanics, lose without).
- `window.__game` exposes { game, state, rig, scene, … } for debugging/smoke tests.
- Deploy: `.github/workflows/pages.yml` (push to main or manual run; Pages source must be "GitHub Actions").
