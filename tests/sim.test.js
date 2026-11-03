import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { buildBoard, expand } from '../src/sim/board.js';
import { PATHS, UNITS, ENEMIES, WAVES, CENTER } from '../src/sim/data.js';

const run = (g, secs, dt = 1 / 30) => { for (let t = 0; t < secs; t += dt) g.update(dt); };

test('runways are contiguous and end at the treasure', () => {
  for (const corners of Object.values(PATHS)) {
    const tiles = expand(corners);
    for (let i = 1; i < tiles.length; i++) {
      const [ax, ay] = tiles[i - 1];
      const [bx, by] = tiles[i];
      assert.equal(Math.abs(ax - bx) + Math.abs(ay - by), 1);
    }
    assert.deepEqual(tiles.at(-1), [CENTER.x, CENTER.y]);
  }
});

test('build slots exist, are off the runway and off the treasure dais', () => {
  const b = buildBoard();
  assert.ok(b.slots.length > 20);
  for (const s of b.slots) {
    assert.ok(!b.runway.has(`${s.x},${s.y}`));
    assert.ok(!(Math.abs(s.x - CENTER.x) <= 1 && Math.abs(s.y - CENTER.y) <= 1));
  }
});

test('placing costs cash, rejects bad tiles, sell refunds half', () => {
  const g = new Game();
  const slot = g.board.slots[0];
  const c0 = g.cash;
  const u = g.place('jester', slot.x, slot.y);
  assert.ok(u);
  assert.equal(g.cash, c0 - UNITS.jester.cost);
  assert.equal(g.place('queen', slot.x, slot.y), null, 'occupied');
  assert.equal(g.place('queen', CENTER.x, CENTER.y), null, 'treasure');
  assert.equal(g.place('queen', 1, 2), null, 'runway');
  g.sell(u);
  assert.equal(g.cash, c0 - UNITS.jester.cost + UNITS.jester.cost / 2);
});

test('enemies march along the runway and damage the treasure', () => {
  const g = new Game();
  g.state = 'running';
  g.spawnQueue = [];
  g.waveIdx = 0;
  g.spawn('mannequin', 'a');
  run(g, 30);
  assert.equal(g.treasure, g.rules.treasureHp - ENEMIES.mannequin.harm);
});

test('posture break: DOWN, hit-stop, 1 MORE and a baton window', () => {
  const g = new Game();
  g.state = 'running';
  g.waveIdx = 99;
  const a = g.place('queen', 1, 1);
  const b = g.place('jester', 2, 1);
  const e = g.spawn('brute', 'a');
  e.posture = 1;
  g.damage(a, e, 1, 5);
  assert.ok(e.down > 0);
  assert.equal(g.hitStop, g.rules.hitStop);
  const ev = g.drain().map((x) => x.t);
  assert.ok(ev.includes('break') && ev.includes('oneMore'));
  assert.equal(g.baton.from, a);
  assert.equal(a.cd, 0, 'breaker acts again');
  // hit-stop freezes the world
  const x0 = e.x;
  g.update(0.05);
  assert.equal(e.x, x0);
  // baton pass buffs the receiver
  assert.ok(g.batonPass(b));
  assert.ok(b.buffs.some((x) => x.key === 'baton'));
  assert.ok(g.stat(b).dmg > UNITS.jester.dmg);
  assert.equal(g.baton, null);
});

test('downed enemies take bonus damage and recover posture', () => {
  const g = new Game();
  g.state = 'running';
  g.waveIdx = 99;
  const e = g.spawn('brute', 'a');
  g.breakPosture(null, e);
  const hp = e.hp;
  g.damage(null, e, 100, 0);
  assert.equal(hp - e.hp, 100 * g.rules.downDmgMul);
  run(g, g.rules.downTime + 0.2);
  assert.equal(e.down, 0);
  assert.equal(e.posture, ENEMIES.brute.posture);
});

test('All-Out Attack needs 3 downed (or a downed boss) and devastates them', () => {
  const g = new Game();
  g.state = 'running';
  g.waveIdx = 99;
  const es = [g.spawn('mannequin', 'a'), g.spawn('mannequin', 'b'), g.spawn('brute', 'a'), g.spawn('brute', 'b')];
  g.breakPosture(null, es[0]);
  g.breakPosture(null, es[1]);
  assert.equal(g.allOutReady, false);
  g.breakPosture(null, es[2]);
  assert.equal(g.allOutReady, true);
  assert.ok(g.allOut());
  assert.equal(g.enemies.length, 1, 'only the standing brute survives');
  assert.ok(g.enemies[0].hp < ENEMIES.brute.hp);
  const g2 = new Game();
  g2.state = 'running';
  g2.waveIdx = 99;
  g2.breakPosture(null, g2.spawn('boss', 'a'));
  assert.equal(g2.allOutReady, true);
});

test('oracle marks slow enemies and expose posture', () => {
  const g = new Game();
  g.state = 'running';
  g.waveIdx = 99;
  const o = g.place('oracle', 1, 1);
  const e = g.spawn('brute', 'a');
  e.x = 1; e.y = 2;
  o.cd = 0;
  g.updateUnit(o, 0.01);
  assert.ok(e.mark > 0);
  const p = e.posture;
  g.damage(null, e, 1, 10);
  assert.equal(p - e.posture, 10 * UNITS.oracle.mark.postureMul);
});

// ---------------------------------------------------------------- balance
function bot(g, plan, { batons = true, allOut = true } = {}) {
  g.start();
  let i = 0;
  for (let t = 0; t < 900 && g.state === 'running'; t += 1 / 30) {
    while (i < plan.length && g.cash >= UNITS[plan[i][0]].cost) {
      const [type, x, y] = plan[i++];
      assert.ok(g.place(type, x, y), `bot placement ${type}@${x},${y}`);
    }
    if (batons && g.baton) g.batonPass(g.units.find((u) => u !== g.baton.from));
    if (allOut && g.allOutReady) g.allOut();
    g.update(1 / 30);
    g.drain();
  }
  return g.state;
}

const PLAN = [
  ['jester', 6, 3], ['jester', 4, 7], ['oracle', 8, 4], ['oracle', 2, 6], ['queen', 7, 6], ['queen', 3, 4],
  ['jester', 8, 3], ['jester', 2, 7], ['queen', 6, 1], ['queen', 4, 9], ['oracle', 8, 1], ['oracle', 2, 9],
  ['jester', 3, 1], ['jester', 7, 9], ['queen', 5, 3], ['queen', 5, 7], ['jester', 2, 4], ['jester', 8, 6],
];

test('a sensible plan wins the full campaign', () => {
  for (const [type, x, y] of PLAN) assert.ok(new Game().board.slotSet.has(`${x},${y}`), `${type}@${x},${y} is a slot`);
  const g = new Game();
  assert.equal(bot(g, PLAN), 'won');
  assert.ok(g.treasure > 0);
});

test('the 1-MORE / Baton / All-Out mechanics matter: same plan without them loses', () => {
  assert.equal(bot(new Game(), PLAN, { batons: false, allOut: false }), 'lost');
});

test('doing nothing loses', () => {
  assert.equal(bot(new Game(), []), 'lost');
});

test('waves are well-formed', () => {
  for (const w of WAVES) for (const grp of w) {
    assert.ok(ENEMIES[grp.type], grp.type);
    assert.ok(PATHS[grp.path], grp.path);
    assert.ok(grp.count > 0 && grp.gap > 0);
  }
});

test('baton prompt: bullet-time slow-mo, 3.5 s real-time window, per-lane cooldown', () => {
  const g = new Game();
  g.state = 'running';
  g.waveIdx = 99;
  const a = g.place('queen', 1, 1);
  g.place('jester', 2, 1);
  const e = g.spawn('brute', 'a');
  e.posture = 1;
  g.damage(a, e, 1, 5);
  assert.ok(g.baton && g.baton.lane === 'a' && g.baton.t === 3.5);
  assert.ok(g.drain().find((x) => x.t === 'oneMore').baton);
  run(g, 1);
  assert.ok(g.timeScale < 0.26, `eases into bullet-time (${g.timeScale})`);
  assert.ok(Math.abs(g.baton.t - 2.5) < 0.05, 'window counts real (unscaled) seconds');
  run(g, 2.6);
  assert.equal(g.baton, null, 'prompt expires after 3.5 s');
  run(g, 1);
  assert.ok(g.timeScale > 0.95, `eases back to full speed (${g.timeScale})`);
  // same lane inside the cooldown: still a 1-MORE, but no new prompt
  const e2 = g.spawn('brute', 'a');
  e2.posture = 1;
  g.damage(a, e2, 1, 5);
  assert.equal(g.baton, null);
  assert.equal(g.drain().find((x) => x.t === 'oneMore').baton, false);
  // the other lane has its own cooldown
  const e3 = g.spawn('brute', 'b');
  e3.posture = 1;
  g.damage(a, e3, 1, 5);
  assert.ok(g.baton && g.baton.lane === 'b');
});

test('hit events flag crits (DOWN bonus) and weakness (marked posture)', () => {
  const g = new Game();
  g.state = 'running';
  const e = g.spawn('brute', 'a');
  e.mark = 2;
  g.damage(null, e, 1, 5);
  assert.ok(g.drain().find((x) => x.t === 'hit').weak);
  e.down = 1;
  g.damage(null, e, 1, 0);
  assert.ok(g.drain().find((x) => x.t === 'hit').crit);
});
