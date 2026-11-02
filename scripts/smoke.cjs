#!/usr/bin/env node
/* Browser end-to-end smoke test against the production build (run `npm run build` first).
 * Needs Playwright + Chromium:  npm i -D playwright && npx playwright install chromium
 * Walks: title -> enter -> touch-place a unit -> start -> posture break (1-MORE) -> baton pass ->
 * All-Out Attack cinematic -> back to play, failing on any page/console error. */
const { spawn } = require('node:child_process');
const path = require('node:path');

const ok = (c, m) => { if (!c) throw new Error(`SMOKE FAIL: ${m}`); console.log(`  ok  ${m}`); };

(async () => {
  const { chromium } = require('playwright');
  const port = 4300 + Math.floor(Math.random() * 400);
  const vite = path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js');
  const server = spawn(process.execPath, [vite, 'preview', '--port', String(port), '--strictPort'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.g|net::ERR/.test(m.text()) && errors.push(`console: ${m.text()}`));
  const G = (fn) => page.evaluate(fn);
  try {
    await page.goto(`http://localhost:${port}/`);
    await page.waitForSelector('.overlay .startbtn', { timeout: 20000 });
    ok(true, 'title renders');
    await page.tap('.overlay .startbtn');
    await page.waitForFunction(() => window.__game.rig.est === 0, null, { timeout: 20000 });
    ok(true, 'establishing shot glides into the battle camera');
    await page.tap('[data-unit="jester"]');
    const pt = await G(() => {
      const w = window.__game;
      const v = w.scene.position.clone().set(6 - 5, 0.1, 3 - 5).project(w.rig.camera);
      return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
    });
    await page.touchscreen.tap(pt.x, pt.y);
    await page.waitForTimeout(300);
    ok((await G(() => window.__game.game.units.map((u) => `${u.type}@${u.x},${u.y}`).join())) === 'jester@6,3', 'touch placement on a build plate');
    await G(() => { const g = window.__game.game; g.cash = 999; g.place('queen', 7, 6); g.place('oracle', 8, 4); });
    await page.tap('.startbtn');
    await page.waitForTimeout(1500);
    ok(await G(() => window.__game.game.state === 'running' && window.__game.game.enemies.length > 0), 'wave 1 marches');
    await G(() => { const g = window.__game.game; const e = g.enemies[0]; e.posture = 1; g.damage(g.units[0], e, 1, 5); });
    await page.waitForSelector('.onemore', { timeout: 3000 });
    ok(true, '1-MORE screen-slice plays on posture break');
    ok(await G(() => window.__game.game.batonPass(window.__game.game.units[1])), 'baton pass');
    await G(() => { const g = window.__game.game; for (let i = 0; i < 3; i++) g.breakPosture(null, g.spawn('mannequin', 'a')); });
    await page.waitForSelector('.allout-btn', { timeout: 3000 });
    await page.tap('.allout-btn');
    await page.waitForSelector('.allout', { timeout: 3000 });
    ok(true, 'ALL-OUT ATTACK comic panels');
    await page.waitForSelector('.splash', { timeout: 15000 });
    ok(true, 'shatter + ransom-note splash');
    await page.waitForFunction(() => !window.__game.state.cine, null, { timeout: 30000 });
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
