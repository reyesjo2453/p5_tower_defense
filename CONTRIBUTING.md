# Contributing

1. `npm install`, then `npm run dev`. Open the printed Network URL on a phone to test touch.
2. Keep `src/sim` free of DOM and Three.js. Add a test in `tests/sim.test.js` for any rule change.
3. To add a unit:
   - add a data entry in `src/sim/data.js` `UNITS`;
   - add a builder in `src/render/models.js` and register it in `BUILDERS`;
   - add attack animation and FX in `src/render/view.js` (`onEvent('attack')` and `update`);
   - add a card accent in `src/ui/style.css`.
4. New meshes use `toon()` and `outline()`, and glowing bits use `glowMat()`. Instance anything numerous.
5. Before a PR, run `npm test && npm run build`. If you have Playwright, also run `npm run smoke`.
6. No ripped or copyrighted assets, and original designs only (see docs/ASSETS.md).
