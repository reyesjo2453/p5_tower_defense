# Contributing / Developing

```bash
npm start          # http://localhost:8080  (zero-dependency static server)
npm test           # 32+ headless tests (Node >= 18)
npm run smoke      # real-browser end-to-end (needs: npm i -D playwright && npx playwright install chromium)
```

## Ground rules

1. **No ripped assets.** See [NOTICE.md](NOTICE.md) and [docs/ASSETS.md](docs/ASSETS.md).
2. Keep `src/sim/` free of DOM/canvas imports: it must run in Node for tests.
3. New operator = data entry in `src/data/operators.js` + look in `src/data/looks.js` + skill handler in
   `src/sim/skills.js` + animation in `src/render/skillfx.js` + summoned-spirit design in
   `src/render/personas.js`. `tests/data.test.js` fails until every piece exists.
4. New story scene = add to `src/data/story.js` and reference it from a stage (`scenes` / `triggers`).
5. Changing numbers? Run `npm test`. The balance tests protect "winnable" and "not trivially winnable".
6. Accessibility: anything flashing must respect `settings.reduceFlash`; shake must respect `screenShake`.

## Layout

See the architecture section in [docs/DESIGN.md](docs/DESIGN.md).
