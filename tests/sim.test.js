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
  const g = new Game({ unlockAll: true });
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
  const g = new Game({ unlockAll: true });
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
  const g = new Game({ unlockAll: true });
  g.state = 'running';
  g.waveIdx = 99;
  const e = g.spawn('brute', 'a');
  g.breakPosture(null, e);
  const hp = e.hp;
  g.damage(null, e, 100, 0);
  assert.equal(hp - e.hp, 100 * g.rules.downDmgMul);
  run(g, g.rules.downTime + 0.2);
  assert.equal(e.down, 0);
  assert.equal(e.posture, e.maxPosture);
});

test('All-Out Attack needs 3 downed (or a downed boss) and devastates them', () => {
  const g = new Game({ unlockAll: true });
  g.state = 'running';
  g.waveIdx = 0; // chapter-1 toughness
  const es = [g.spawn('mannequin', 'a'), g.spawn('mannequin', 'b'), g.spawn('brute', 'a'), g.spawn('brute', 'b')];
  g.breakPosture(null, es[0]);
  g.breakPosture(null, es[1]);
  assert.equal(g.allOutReady, false);
  g.breakPosture(null, es[2]);
  assert.equal(g.allOutReady, true);
  assert.ok(g.allOut());
  assert.equal(g.enemies.length, 1, 'only the standing brute survives');
  assert.ok(g.enemies[0].hp < g.enemies[0].maxHp);
  const g2 = new Game({ unlockAll: true });
  g2.state = 'running';
  g2.waveIdx = 99;
  g2.breakPosture(null, g2.spawn('boss', 'a'));
  assert.equal(g2.allOutReady, true);
});

test('oracle marks slow enemies and expose posture', () => {
  const g = new Game({ unlockAll: true });
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
// The campaign bot plays the story order: each action waits until it is unlocked and affordable.
export function bot(g, plan, { batons = true, allOut = true } = {}) {
  g.start();
  let i = 0;
  for (let t = 0; t < 1500 && g.state === 'running'; t += 1 / 30) {
    while (i < plan.length) {
      const [act, type, x, y] = plan[i];
      if (act === 'place') {
        if (!g.unlocked.has(type) || g.cash < UNITS[type].cost) break;
        assert.ok(g.place(type, x, y), `bot placement ${type}@${x},${y}`);
      } else if (act === 'rank') {
        const u = g.onStage(type);
        const c = g.rankCost(u);
        if (c == null || g.cash < c) break;
        assert.ok(g.rankUp(u));
      }
      i++;
    }
    if (batons && g.baton) g.batonPass(g.units.find((u) => u !== g.baton.from));
    if (allOut && g.allOutReady) g.allOut();
    g.update(1 / 30);
    g.drain();
  }
  return g.state;
}

export const PLAN = [
  ['place', 'jester', 6, 3], ['place', 'queen', 4, 7], ['place', 'oracle', 8, 4],
  ['place', 'prompter', 5, 7], ['rank', 'jester'], ['place', 'limelight', 2, 6], ['rank', 'queen'],
  ['rank', 'limelight'], ['rank', 'oracle'], ['rank', 'jester'], ['rank', 'queen'], ['rank', 'prompter'],
  ['rank', 'limelight'], ['rank', 'oracle'], ['rank', 'prompter'],
];

test('a sensible plan wins the full campaign', () => {
  for (const [act, type, x, y] of PLAN) if (act === 'place') assert.ok(new Game().board.slotSet.has(`${x},${y}`), `${type}@${x},${y} is a slot`);
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

test('five unique Phantoms: one of each on stage, unlocked chapter by chapter', () => {
  const g = new Game();
  assert.deepEqual([...g.unlocked], ['jester'], 'the prologue is Jester alone');
  assert.ok(g.place('jester', 6, 3));
  g.cash = 999;
  assert.equal(g.place('jester', 4, 7), null, 'no second Jester');
  assert.equal(g.place('queen', 4, 7), null, 'Queen has not joined yet');
  assert.ok(!g.mech.has('baton') && !g.mech.has('allout'));
  g.applyUnlocks(4);
  assert.deepEqual([...g.unlocked].sort(), Object.keys(UNITS).sort());
  assert.ok(g.mech.has('allout') && g.mech.has('blocking') && g.mech.has('rank'));
});

test('rank-ups scale a unit; blocking moves it with a cooldown; sell refunds half of everything', () => {
  const g = new Game({ unlockAll: true });
  g.cash = 999;
  const u = g.place('queen', 6, 3);
  const base = g.stat(u).dmg;
  assert.ok(g.rankUp(u) && g.rankUp(u));
  assert.equal(u.rank, 3);
  assert.equal(g.rankCost(u), null, 'max rank');
  assert.ok(g.stat(u).dmg > base * 2);
  assert.ok(g.range(u) > UNITS.queen.range);
  assert.ok(g.move(u, 4, 7));
  assert.deepEqual([u.x, u.y], [4, 7]);
  assert.equal(g.move(u, 6, 3), false, 'cooldown');
  g.state = 'running';
  g.spawnQueue = [{ at: 1e9, type: 'mannequin', path: 'a' }]; // keep the wave open
  run(g, g.rules.moveCd + 0.1);
  assert.ok(g.move(u, 6, 3));
  const c = g.cash;
  g.sell(u);
  assert.equal(g.cash, c + Math.floor(u.spent / 2));
});

test('Prompter patches the Treasure and quickens allies; Limelight sets Shadows burning', () => {
  const g = new Game({ unlockAll: true });
  g.cash = 999;
  g.state = 'running';
  g.spawnQueue = [{ at: 1e9, type: 'mannequin', path: 'a' }]; // keep the wave open
  const j = g.place('jester', 6, 3);
  const i0 = g.stat(j).interval;
  g.place('prompter', 5, 3);
  assert.ok(g.stat(j).interval < i0, 'cue speeds up a neighbour');
  g.treasure = 10;
  run(g, UNITS.prompter.heal.every[0] + 0.1);
  assert.equal(g.treasure, 11);
  assert.ok(g.drain().some((x) => x.t === 'heal'));
  const l = g.place('limelight', 2, 6);
  const e = g.spawn('brute', 'a');
  e.x = 2; e.y = 5;
  l.cd = 0;
  g.updateUnit(l, 0.01);
  assert.ok(e.burn && e.burn.dps > 0);
  const hp = e.hp;
  g.updateEnemy(e, 0.6);
  assert.ok(e.hp < hp, 'burn ticks');
  assert.ok(g.drain().some((x) => x.t === 'hit' && x.dot));
});

test('campaign mode stops for the story between chapters and checkpoints restart a chapter', () => {
  const g = new Game({ campaign: true });
  g.place('jester', 6, 3);
  g.start();
  for (let t = 0; t < 400 && g.state === 'running'; t += 1 / 30) g.update(1 / 30);
  assert.equal(g.state, 'intermission');
  assert.ok(g.drain().some((x) => x.t === 'waveClear'));
  g.next();
  assert.equal(g.waveIdx, 1);
  assert.ok(g.unlocked.has('queen'));
  const cp = g.checkpoint();
  assert.equal(cp.waveIdx, 1);
  const g2 = new Game({ campaign: true, checkpoint: cp });
  assert.equal(g2.units.length, 1);
  assert.ok(g2.drain().some((x) => x.t === 'place' && x.restored));
  g2.start();
  assert.equal(g2.waveIdx, 1);
  assert.equal(g2.cash, cp.cash);
});

test('waves are well-formed', () => {
  for (const w of WAVES) for (const grp of w) {
    assert.ok(ENEMIES[grp.type], grp.type);
    assert.ok(PATHS[grp.path], grp.path);
    assert.ok(grp.count > 0 && grp.gap > 0);
  }
});

test('baton prompt: bullet-time slow-mo, 3.5 s real-time window, per-lane cooldown', () => {
  const g = new Game({ unlockAll: true });
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
  const g = new Game({ unlockAll: true });
  g.state = 'running';
  const e = g.spawn('brute', 'a');
  e.mark = 2;
  g.damage(null, e, 1, 5);
  assert.ok(g.drain().find((x) => x.t === 'hit').weak);
  e.down = 1;
  g.damage(null, e, 1, 0);
  assert.ok(g.drain().find((x) => x.t === 'hit').crit);
});
