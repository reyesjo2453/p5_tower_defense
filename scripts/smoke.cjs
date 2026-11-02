#!/usr/bin/env node
/* End-to-end smoke test in a real (headless) browser. Requires Playwright:
 *   npm i -D playwright && npx playwright install chromium   (once)
 *   npm run smoke [-- --shots=./shots]
 * Walks the real UI: title -> opening cutscene -> hub -> squad -> stage 1-1 -> deploy by mouse ->
 * skill cut-in -> result, failing on any console/page error. */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const shotsArg = process.argv.find((a) => a.startsWith('--shots='));
const shots = shotsArg ? path.resolve(shotsArg.split('=')[1]) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

function assert(cond, msg) {
  if (!cond) throw new Error(`SMOKE FAIL: ${msg}`);
  console.log(`  ok  ${msg}`);
}

(async () => {
  const { chromium } = require('playwright');
  const port = 8100 + Math.floor(Math.random() * 500);
  const server = spawn(process.execPath, [path.join(__dirname, 'serve.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.g|net::ERR/.test(m.text()) && errors.push(`console: ${m.text()}`));
  const shot = async (name) => shots && page.screenshot({ path: path.join(shots, `${name}.png`) });
  const game = (fn, arg) => page.evaluate(fn, arg);

  try {
    await page.goto(`http://localhost:${port}/index.html`);
    await page.waitForFunction(() => window.__game?.sceneName === 'title');
    await shot('01-title');
    assert(true, 'title screen loads');

    await page.click('[data-act="play"]');
    await page.waitForFunction(() => window.__game.sceneName === 'cutscene');
    await page.waitForTimeout(1500);
    await shot('02-opening-cinematic');
    await page.click('[data-act="skip"]');
    await page.waitForFunction(() => window.__game.sceneName === 'hub');
    assert(true, 'opening cutscene plays and skips to hub');
    await shot('03-hub');

    await page.click('[data-stage="0"]');
    await page.click('[data-act="go"]');
    await page.waitForFunction(() => window.__game.sceneName === 'cutscene');
    await page.waitForTimeout(500);
    await page.click('[data-act="skip"]');
    await page.waitForFunction(() => window.__game.sceneName === 'battle');
    await page.waitForTimeout(600);
    assert(true, 'stage 1-1 starts after its briefing scene');

    // Deploy Joker by mouse: card -> path tile (3,2) -> face right -> click.
    await page.evaluate(() => { window.__game.scene.battle.dp = 50; });
    await page.mouse.move(60, 640);
    await page.mouse.down();
    await page.mouse.up();
    await page.mouse.click(3 * 80 + 40, 80 + 2 * 80 + 40);
    await page.mouse.move(3 * 80 + 90, 80 + 2 * 80 + 40);
    await shot('04-placing');
    await page.mouse.click(3 * 80 + 90, 80 + 2 * 80 + 40);
    const deployed = await game(() => window.__game.scene.battle.operators.map((o) => `${o.id}@${o.c},${o.r}`));
    assert(deployed.length === 1 && deployed[0] === 'joker@3,2', `mouse deploy works (${deployed})`);

    // Skill cut-in
    await game(() => {
      const s = window.__game.scene;
      const j = s.battle.operators[0];
      j.sp = 99;
      s.battle.spawn('shade', 'a', { x: 3.3, y: 2.5, seg: 1, travel: 3 });
    });
    await page.waitForTimeout(300);
    await page.keyboard.press('s').catch(() => {});
    await game(() => { const s = window.__game.scene; s.ui.selected = s.battle.operators[0]; s.useSkill(s.ui.selected); });
    await page.waitForTimeout(600);
    await shot('05-skill-cutin');
    assert(await game(() => window.__game.scene.cutin.active), 'skill cut-in plays');
    await page.waitForTimeout(2200);
    await shot('06-skill-fx');

    // Win quickly by clearing the wave list, then check the result flow.
    await game(() => {
      const b = window.__game.scene.battle;
      b.spawnIdx = b.spawnList.length;
      b.enemies.length = 0;
    });
    await page.waitForSelector('.result [data-act="next"]', { timeout: 8000 });
    await shot('07-result');
    assert(await game(() => !!window.__game.save.cleared['1-1']), 'clearing a stage is saved');
    assert(errors.length === 0, `no console / page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
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
