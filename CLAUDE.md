# Project notes for Claude Code

Encore Protocol: a Persona 5 fan tower defense (vanilla JS ES modules + Canvas, no build step).

- Run: `npm start` (http://localhost:8080). Tests: `npm test`. Browser e2e: `npm run smoke`.
- `src/sim/` is pure logic (no DOM) and is the source of truth; `src/render/` only reads `battle.events`.
- Never add ripped/copyrighted game assets. All art/audio is procedural (see NOTICE.md, docs/ASSETS.md).
  Character/spirit designs in `src/data/looks.js` and `src/render/personas.js` are original; keep them that way.
- Render pipeline: scenes draw offscreen -> `src/render/post.js` (bloom/grade/grain). Battle adds a light map
  (`src/render/lighting.js`); FX feed it via `Fx.lights()`. Static field tiles are cached per stage.
- Adding an operator touches 5 places; `tests/data.test.js` lists what is missing (see CONTRIBUTING.md).
- After changing numbers in `src/data/`, run `npm test` (balance guard rails).
- `window.__game` exposes the running game for debugging/smoke tests.
