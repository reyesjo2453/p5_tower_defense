#!/usr/bin/env node
/* Browser end-to-end smoke test against the production build (run `npm run build` first).
 * Needs Playwright + Chromium:  npm i -D playwright && npx playwright install chromium
 * Walks: title -> enter -> touch-place a unit -> start -> posture break (1-MORE) -> baton pass ->
 * All-Out Attack cinematic -> back to play, failing on any page/console error. */
const { spawn } = require('node:child_process');
const path = require('node:path');

// GPU-less CI runners render the Palace at ~1 fps; wait on game state, with generous ceilings there.
const SLOW = process.env.CI ? 6 : 1;
const T = (ms) => ms * SLOW;
const ok = (c, m) => { if (!c) throw new Error(`SMOKE FAIL: ${m}`); console.log(`  ok  ${m}`); };

(async () => {
  const { chromium } = require('playwright');
  const port = 4300 + Math.floor(Math.random() * 400);
  const vite = path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js');
  const server = spawn(process.execPath, [vite, 'preview', '--port', String(port), '--strictPort'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  page.setDefaultTimeout(T(30000));
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.g|net::ERR/.test(m.text()) && errors.push(`console: ${m.text()}`));
  const G = (fn) => page.evaluate(fn);
  try {
    await page.goto(`http://localhost:${port}/`);
    await page.waitForSelector('.overlay .startbtn', { timeout: T(20000) });
    ok(true, 'title renders');
    await page.tap('.overlay .startbtn');
    await page.waitForFunction(() => window.__game.rig.est === 0, null, { timeout: T(20000) });
    ok(true, 'establishing shot glides into the battle camera');
    await page.tap('[data-unit="jester"]');
    const pt = await G(() => {
      const w = window.__game;
      const v = w.scene.position.clone().set(6 - 5, 0.1, 3 - 5).project(w.rig.camera);
      return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
    });
    await page.touchscreen.tap(pt.x, pt.y);
    await page.waitForFunction(() => window.__game.game.units.length > 0, null, { timeout: T(5000) }).catch(() => {});
    ok((await G(() => window.__game.game.units.map((u) => `${u.type}@${u.x},${u.y}`).join())) === 'jester@6,3', 'touch placement on a build plate');
    ok((await G(() => window.__game.hud.lastDeploy)) === 'jester', 'deploy cut-in fires on placement');
    if (process.env.SMOKE_SPRITES) {
      // billboard pipeline: cut-in PNG as a camera-facing cut-out, 1.8 tall, feet on the plate, breathing
      await page.waitForFunction(() => window.__game.view.units.size > 0 && [...window.__game.view.units.values()][0].model.landed, null, { timeout: T(20000) });
      const read = () => G(() => {
        const w = window.__game;
        const v = [...w.view.units.values()][0];
        const art = v.model.parts.art;
        art.updateMatrixWorld(true);
        const box = new art.geometry.boundingBox.constructor().setFromObject(art);
        return { sprite: !!v.model.sprite, h: box.max.y - box.min.y, minY: box.min.y, base: v.base.y, bodyY: v.model.parts.body.position.y,
          sh: v.model.parts.shadow.material.opacity, loaded: w.assets.sprites.loaded.map((l) => l.id).sort().join(), models: w.assets.models.loaded.length,
          tex: w.assets.sprites.loaded.find((l) => l.id === 'jester').url };
      });
      await G(() => window.__game.view.units.values().next().value.model.parts.art.geometry.computeBoundingBox());
      const a = await read();
      ok(a.models === 0 && a.loaded === 'jester,oracle,queen', `sprites loaded for units without a .glb (${a.loaded})`);
      ok(a.sprite && /custom\/jester-cutin\.png$/.test(a.tex), 'placed unit is a billboard of its cut-in PNG');
      ok(Math.abs(a.h - 1.8) < 0.12, `billboard height ~1.8 (got ${a.h.toFixed(3)})`);
      ok(Math.abs(a.minY - a.base) < 0.07, `feet on the plate (minY ${a.minY.toFixed(3)} vs plate ${a.base.toFixed(3)})`);
      const t0 = await G(() => window.__game.view.time);
      await page.waitForFunction((t) => window.__game.view.time > t + 0.15, t0, { timeout: T(20000) });
      const b = await read();
      ok(Math.abs(a.bodyY) <= 0.041 && a.bodyY !== b.bodyY && a.sh !== b.sh, `breathing bob + shadow pulse animate (y ${a.bodyY.toFixed(4)}->${b.bodyY.toFixed(4)}, shadow ${a.sh.toFixed(3)}->${b.sh.toFixed(3)})`);
      require('node:fs').mkdirSync(path.join(__dirname, '..', 'shots'), { recursive: true });
      await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'sprites-board.png') });
    }
    // audio: the first gesture started the BGM (procedural unless public/audio/bgm.* exists) and the
    // card tap + placement played on the separate SFX bus
    const au = await G(() => window.__game.audio.status());
    ok(au.bgm.started && ['procedural', 'file'].includes(au.bgm.state), `BGM started on the first gesture (${au.bgm.state}, ctx ${au.bgm.ctx})`);
    ok(au.sfx.ready && au.sfx.played >= 1, `SFX bus separate and playing (${au.sfx.played} one-shots)`);
    if (au.bgm.state === 'procedural' && au.bgm.ctx === 'running') {
      const s0 = au.bgm.step;
      await page.waitForFunction((s) => window.__game.audio.bgm.step > s + 4, s0, { timeout: T(5000) });
      ok(true, 'procedural groove keeps scheduling 16ths');
    }
    await page.tap('[data-act="mute"]');
    ok(await G(() => window.__game.audio.muted && document.querySelector('[data-act="mute"]').classList.contains('off') && JSON.parse(localStorage.getItem('encore.audio')).muted === true), 'mute toggle persists to localStorage');
    await page.tap('[data-act="mute"]');
    ok(await G(() => !window.__game.audio.muted), 'unmute');
    // card labels sit in the bottom band so the face stays clear
    ok(await G(() => [...document.querySelectorAll('.card')].every((c) => {
      const r = c.getBoundingClientRect(), m = c.querySelector('.meta').getBoundingClientRect();
      return m.top >= r.top + r.height * 0.6 && m.bottom <= r.bottom + 1;
    })), 'card name / cost / role anchored in the lower band');
    if (!process.env.SMOKE_SPRITES && !process.env.SMOKE_ASSETS) {
      // whatever art is committed in public/portraits: card-style PNGs must be keyed down to a figure
      await page.waitForFunction(() => window.__game.assets.sprites, null, { timeout: T(20000) });
      const keyed = await G(() => window.__game.assets.sprites.loaded.filter((l) => l.keyed));
      for (const k of keyed) ok(k.kept > 0.04 && k.kept < 0.9, `${k.id} billboard keyed out of its card (${k.url.split('/').pop()}, kept ${(k.kept * 100).toFixed(0)}%)`);
      if (keyed.length) {
        require('node:fs').mkdirSync(path.join(__dirname, '..', 'shots'), { recursive: true });
        await page.waitForFunction(() => [...window.__game.view.units.values()][0]?.model.landed, null, { timeout: T(20000) });
        ok(await G(() => window.__game.view.stats.landings >= 1), 'billboard dropped in and landed');
        await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'keyed-board.png') });
      }
    }
    if (process.env.SMOKE_ASSETS) {
      // drop-in pipeline: glTF figure, Box3-normalized to ~1.8 with feet on the plate, animated by its clips
      await page.waitForFunction(() => window.__game.view.units.size > 0 && [...window.__game.view.units.values()][0].spawnT >= 1, null, { timeout: T(20000) });
      const m = await G(() => {
        const w = window.__game;
        const v = [...w.view.units.values()][0];
        v.model.root.updateMatrixWorld(true);
        let minY = Infinity, maxY = -Infinity;
        v.model.root.traverse((o) => {
          if (!o.isSkinnedMesh || o.userData.isOutline) return;
          o.computeBoundingBox();
          const b = o.boundingBox.clone().applyMatrix4(o.matrixWorld);
          minY = Math.min(minY, b.min.y); maxY = Math.max(maxY, b.max.y);
        });
        return { gltf: !!v.model.gltf, mixer: !!v.model.mixer, minY, h: (maxY - minY) / v.model.root.scale.y, base: v.base.y, loaded: w.assets.models.loaded.map((l) => l.id).sort().join(), png: w.assets.portraits.length };
      });
      ok(m.loaded === 'jester,oracle,queen', `glTF models loaded (${m.loaded})`);
      ok(m.gltf && m.mixer, 'placed unit is a SkeletonUtils clone with an animation mixer');
      ok(Math.abs(m.h - 1.8) < 0.12, `Box3-normalized height ~1.8 (got ${m.h.toFixed(3)})`);
      ok(Math.abs(m.minY - m.base) < 0.08, `feet grounded on the plate (minY ${m.minY.toFixed(3)} vs plate ${m.base.toFixed(3)})`);
      ok(m.png === 7, `all 7 portrait PNGs resolved from custom/ (${m.png})`);
      ok(await G(() => [...document.querySelectorAll('.card .face img')].every((i) => /custom\/\w+-card\.png$/.test(i.src))), 'deploy cards show the card PNGs');
    }
    await G(() => { const g = window.__game.game; g.cash = 999; g.place('queen', 7, 6); g.place('oracle', 8, 4); });
    await page.tap('.startbtn');
    await page.waitForFunction(() => window.__game.game.state === 'running' && window.__game.game.enemies.length > 0, null, { timeout: T(10000) }).catch(() => {});
    ok(await G(() => window.__game.game.state === 'running' && window.__game.game.enemies.length > 0), 'wave 1 marches');
    if (await G(() => [...window.__game.view.units.values()].some((v) => v.model.sprite))) {
      // swiftshader runs the game far below real time, so feed one attack event instead of waiting
      await G(() => { const w = window.__game, g = w.game; const u = g.units.find((x) => w.view.unitView(x)?.model.sprite); w.view.onEvent({ t: 'attack', unit: u, enemy: g.enemies[0] }); });
      await page.waitForFunction(() => window.__game.view.stats.impacts > 0, null, { timeout: T(15000) });
      ok(true, 'billboard attack cycle reaches its impact frame (lunge -> burst)');
    }
    await G(() => { const g = window.__game.game; const e = g.enemies[0]; e.posture = 1; g.damage(g.units[0], e, 1, 5); });
    await page.waitForSelector('.onemore', { timeout: T(3000) });
    ok(true, '1-MORE screen-slice plays on posture break');
    if (process.env.SMOKE_ASSETS) {
      ok(await G(() => /custom\/jester-cutin\.png$/.test(document.querySelector('.onemore .sil').src)), '1-MORE cut-in uses the PNG');
      ok(await G(() => { const v = [...window.__game.view.units.values()][0]; return v.model.mixer.time > 0; }), 'animation clips advancing');
    }
    ok(await G(() => window.__game.game.batonPass(window.__game.game.units[1])), 'baton pass');
    await G(() => { const g = window.__game.game; for (let i = 0; i < 3; i++) g.breakPosture(null, g.spawn('mannequin', 'a')); });
    await page.waitForSelector('.allout-btn', { timeout: T(3000) });
    await page.tap('.allout-btn');
    await page.waitForSelector('.allout', { timeout: T(3000) });
    ok(true, 'ALL-OUT ATTACK comic panels');
    await page.waitForSelector('.splash', { timeout: T(15000) });
    ok(true, 'shatter + ransom-note splash');
    if (process.env.SMOKE_ASSETS) {
      ok(await G(() => [...document.querySelectorAll('.allout .panel img')].length === 0 || [...document.querySelectorAll('.allout .panel img')].every((i) => /cutin\.png$/.test(i.src))), 'All-Out panels use the cut-in PNGs');
      ok(await G(() => /custom\/finisher\.png$/.test(document.querySelector('.splash .hero').src)), 'finisher splash uses the PNG');
      require('node:fs').mkdirSync(path.join(__dirname, '..', 'shots'), { recursive: true });
      await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'assets-splash.png') });
    }
    await page.waitForFunction(() => !window.__game.state.cine, null, { timeout: T(30000) });
    ok(await G(() => window.__game.game.downed.length === 0), 'downed Shadows were finished');
    ok(errors.length === 0, `no page/console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
    console.log('SMOKE PASSED');
  } catch (e) {
    console.error(e.message);
    if (errors.length) console.error(errors.join('\n'));
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
})();
