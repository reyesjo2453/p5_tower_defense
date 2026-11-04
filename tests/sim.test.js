import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { buildBoard, expand } from '../src/sim/board.js';
import { PATHS, UNITS, ENEMIES, WAVES, CENTER, CAMPAIGN } from '../src/sim/data.js';
import { generateStage } from '../src/sim/stagegen.js';
import { campaignGame, rehearsalGame, classicGame, dailySpec } from '../src/sim/campaign.js';
import { autoplay, bestSlot } from './bot.js';

const run = (g, secs, dt = 1 / 30) => { for (let t = 0; t < secs; t += dt) g.update(dt); };
/** A free plate on `g` (the best-covering one). */
const slotOf = (g) => {
  const s = bestSlot(g, 'jester');
  return [s.x, s.y];
};
/** Running, with a wave held open so timers tick without the stage ending. */
const open = (g) => {
  g.state = 'running';
  g.waveIdx = 0;
  g.spawnQueue = [{ at: 1e9, type: 'mannequin', path: g.lanes[0] }];
  return g;
};

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

test('All-Out Attack devastates downed Shadows and splashes the rest', () => {
  const g = new Game({ unlockAll: true });
  g.state = 'running';
  g.waveIdx = 0;
  const es = [g.spawn('mannequin', 'a'), g.spawn('mannequin', 'b'), g.spawn('brute', 'a'), g.spawn('brute', 'b')];
  for (const e of es.slice(0, 3)) g.breakPosture(null, e);
  assert.equal(g.allOutReady, false, 'needs a full SP gauge');
  g.sp = g.rules.spMax;
  assert.ok(g.allOut());
  assert.equal(g.enemies.length, 1, 'only the standing brute survives');
  assert.ok(g.enemies[0].hp < g.enemies[0].maxHp);
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

// ---------------------------------------------------------------- campaign + balance
test('fifteen stages: a generated map each, cast and mechanics unlocked one stage at a time', () => {
  assert.equal(CAMPAIGN.length, 15);
  const g0 = campaignGame(0);
  assert.deepEqual([...g0.unlocked], ['jester'], 'the prologue is Jester alone');
  assert.equal(g0.lanes.length, 1, 'the prologue has one lane');
  assert.ok(g0.place('jester', ...slotOf(g0)));
  g0.cash = 999;
  assert.equal(g0.place('jester', ...slotOf(g0)), null, 'no second Jester');
  assert.ok(!g0.mech.has('summon') && !g0.mech.has('baton'));
  // the first two stages are wins on one lane; summons arrive in stage 3, partners after that
  assert.equal(campaignGame(1).lanes.length, 1);
  assert.ok(campaignGame(2).mech.has('summon') && !campaignGame(1).mech.has('summon'));
  assert.ok(campaignGame(3).unlocked.has('queen') && !campaignGame(2).unlocked.has('queen'));
  assert.ok(!campaignGame(9).mech.has('blocking') && campaignGame(10).mech.has('blocking'), 'Blocking waits for Act III');
  const last = campaignGame(14);
  assert.deepEqual([...last.unlocked].sort(), Object.keys(UNITS).sort());
  assert.ok(last.mech.has('allout') && last.lanes.length === 3);
  assert.ok(last.waves.at(-1).some((grp) => grp.type === 'boss'), 'the finale brings the Impresario');
  // every stage introduces at most one cast member
  for (const ch of CAMPAIGN) assert.ok(ch.unlock.length <= 1, ch.id);
});

test('the generator makes clean runways: contiguous, inside the board, lanes never touching', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const [lanes, tier] of [[1, 1], [2, 3], [3, 5]]) {
      const st = generateStage({ seed, lanes, tier });
      assert.equal(Object.keys(st.paths).length, lanes, `seed ${seed}`);
      const owner = new Map();
      for (const [id, corners] of Object.entries(st.paths)) {
        const tiles = expand(corners);
        assert.deepEqual(tiles.at(-1), [CENTER.x, CENTER.y]);
        const [sx, sy] = tiles[0];
        assert.ok(sx === 0 || sy === 0 || sx === 10 || sy === 10, 'spawns on the edge');
        for (let i = 1; i < tiles.length; i++) assert.equal(Math.abs(tiles[i][0] - tiles[i - 1][0]) + Math.abs(tiles[i][1] - tiles[i - 1][1]), 1);
        for (const [x, y] of tiles) {
          assert.ok(x >= 0 && y >= 0 && x <= 10 && y <= 10);
          if (Math.abs(x - 5) <= 1 && Math.abs(y - 5) <= 1) continue; // the dais is shared
          owner.set(`${x},${y}`, id);
        }
      }
      for (const [k, id] of owner) {
        const [x, y] = k.split(',').map(Number);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const o = owner.get(`${x + dx},${y + dy}`);
          assert.ok(!o || o === id, `lanes ${id}/${o} touch at ${k} (seed ${seed})`);
        }
      }
      const b = buildBoard(st.paths);
      assert.ok(b.slots.length >= 12 * lanes, `enough plates (seed ${seed}: ${b.slots.length})`);
    }
  }
  // deterministic: the story's pinned seeds always give the same map
  assert.deepEqual(generateStage(CAMPAIGN[4].stage), generateStage(CAMPAIGN[4].stage));
});

test('every story stage is winnable with the mechanics, lost doing nothing', () => {
  for (let i = 0; i < CAMPAIGN.length; i++) {
    const g = campaignGame(i, { personaWhole: i >= 12 });
    assert.equal(autoplay(g), 'won', `${CAMPAIGN[i].id} should be winnable`);
    assert.ok(g.treasure >= 8, `${CAMPAIGN[i].id} wins with room to spare (${g.treasure})`);
    if (i > 0) assert.equal(autoplay(campaignGame(i), { place: false }), 'lost', `${CAMPAIGN[i].id}: doing nothing loses`);
  }
});

test('the opening stages are gentle; the late ones need Personas, batons and the All-Out', () => {
  for (const i of [0, 1, 2]) {
    const g = campaignGame(i);
    assert.equal(autoplay(g, { summons: false, batons: false, allOut: false }), 'won');
    assert.ok(g.treasure >= 15, `${CAMPAIGN[i].id} is forgiving (${g.treasure})`);
  }
  for (const i of [12, 13]) assert.equal(autoplay(campaignGame(i, { personaWhole: true }), { summons: false, batons: false, allOut: false }), 'lost', `${CAMPAIGN[i].id} needs the mechanics`);
  assert.equal(autoplay(campaignGame(14, { personaWhole: true }), { ranks: false }), 'lost', 'the finale needs rehearsals');
});

test('rehearsals: a fresh procedural stage per seed, tiers set lanes and toughness', () => {
  const a = rehearsalGame({ tier: 1, seed: 5, unlockAll: true });
  const b = rehearsalGame({ tier: 1, seed: 6, unlockAll: true });
  assert.notDeepEqual(a.paths, b.paths);
  assert.equal(a.lanes.length, 1);
  assert.equal(rehearsalGame({ tier: 5, seed: 5 }).lanes.length, 3);
  assert.ok(rehearsalGame({ tier: 5, seed: 5 }).hp > a.hp);
  assert.equal(autoplay(rehearsalGame({ tier: 3, seed: 9, unlockAll: true, personaWhole: true })), 'won');
});

test('classic show: the original two-lane board and eight waves still play', () => {
  const g = classicGame({ unlockAll: true });
  assert.deepEqual(g.paths, PATHS);
  assert.equal(g.waves.length, 8);
  assert.equal(autoplay(g), 'won');
});

// ---------------------------------------------------------------- SP + Personas
test('posture breaks fill SP; summons spend it; a full gauge is the All-Out Attack', () => {
  const g = open(campaignGame(14, { personaWhole: true }));
  g.cash = 9999;
  const q = g.place('queen', ...slotOf(g));
  const e = g.spawn('brute', 'a');
  e.posture = 1;
  g.damage(q, e, 1, 5);
  assert.equal(g.sp, g.rules.spBreak);
  assert.equal(g.canSummon('queen'), false, 'not enough SP yet');
  g.sp = 40;
  assert.ok(g.canSummon('queen'));
  assert.ok(g.summon('queen', e.x, e.y));
  assert.equal(g.sp, 0);
  assert.ok(g.drain().some((x) => x.t === 'summon' && x.persona.name === 'VERDICT'));
  assert.equal(g.allOutReady, false);
  g.sp = g.rules.spMax;
  assert.equal(g.allOutReady, true);
  assert.ok(g.allOut());
  assert.equal(g.sp, 0, 'the All-Out spends the whole gauge');
  assert.equal(g.summon('oracle', 5, 5), false, 'Oracle is not on stage');
});

test('each Persona does its own thing', () => {
  const setup = () => {
    const g = open(campaignGame(14, { personaWhole: false }));
    g.cash = 9999;
    for (const t of ['jester', 'queen', 'oracle', 'prompter', 'limelight']) g.place(t, ...slotOf(g));
    g.sp = 999;
    const e = g.spawn('mannequin', 'a');
    g.pushBack(e, -6); // walk it 6 tiles in
    return { g, e };
  };
  // NO ONE: Curtain Wind pushes back down the runway
  let { g, e } = setup();
  const w0 = e.walked;
  g.summon('jester', e.x, e.y);
  assert.ok(Math.abs(e.walked - (w0 - UNITS.jester.persona.push)) < 1e-6, 'pushed back');
  assert.ok(e.posture < e.maxPosture);
  assert.equal(g.persona(g.onStage('jester')).name, 'NO ONE');
  assert.equal(new Game({ personaWhole: true, unlockAll: true }).persona({ def: UNITS.jester }).name, 'HARLEQUIN');
  // VERDICT: stun holds it in place
  ({ g, e } = setup());
  g.summon('queen', e.x, e.y);
  assert.ok(e.stun > 0);
  const x0 = e.x, y0 = e.y;
  g.updateEnemy(e, 0.5);
  assert.deepEqual([e.x, e.y], [x0, y0]);
  // SIGHTLINE: marks
  ({ g, e } = setup());
  g.summon('oracle', e.x, e.y);
  assert.ok(e.mark >= UNITS.oracle.persona.mark - 1e-9);
  // GHOSTLIGHT: heals and wards the Treasure
  ({ g, e } = setup());
  g.treasure = 10;
  g.summon('prompter', e.x, e.y);
  assert.equal(g.treasure, 13);
  assert.equal(g.ward, 3);
  e.seg = e.wp.length; // reaches the Treasure
  g.updateEnemy(e, 0.01);
  assert.equal(g.treasure, 13, 'warded');
  assert.equal(g.ward, 2);
  // FLASHPAPER: a burning ring that lingers
  ({ g, e } = setup());
  g.summon('limelight', e.x, e.y);
  assert.equal(g.zones.length, 1);
  g.updateEnemy(e, 0.1);
  assert.ok(e.burn && e.burn.dps > 0);
  run(g, UNITS.limelight.persona.zone / g.rules.bulletTime + 1); // (breaks may open bullet-time)
  assert.equal(g.zones.length, 0, 'the ring burns out');
});

test('aiming a Persona slows time; Baton Pass picks the best ally by itself', () => {
  const g = open(classicGame({ unlockAll: true }));
  g.setAiming(true);
  run(g, 1);
  assert.ok(g.timeScale < 0.3, `bullet-time while aiming (${g.timeScale})`);
  g.setAiming(false);
  run(g, 1);
  assert.ok(g.timeScale > 0.95);
  g.cash = 999;
  const a = g.place('queen', 1, 1);
  const far = g.place('oracle', 8, 1);
  const near = g.place('jester', 2, 1);
  const e = g.spawn('brute', 'a');
  e.x = 1; e.y = 2;
  e.posture = 1;
  g.damage(a, e, 1, 5);
  assert.equal(g.batonTarget(), near, 'the ally with a Shadow in reach');
  assert.ok(g.batonPass());
  assert.ok(near.buffs.some((b) => b.key === 'baton'));
  assert.ok(!far.buffs.length);
});

test('waves within a stage: a break, a CALL to skip it, the gate warning', () => {
  const g = campaignGame(4);
  g.place('jester', ...slotOf(g));
  g.start();
  assert.equal(g.waveIdx, 0);
  // kill everything as it appears until the wave is over
  for (let t = 0; t < 300 && g.breakT == null; t += 1 / 30) {
    g.update(1 / 30);
    for (const e of [...g.enemies]) g.damage(null, e, 1e9, 0, { raw: true });
  }
  assert.ok(g.breakT > 0, 'between waves');
  const clear = g.drain().find((x) => x.t === 'waveClear');
  assert.ok(clear && clear.next.length >= 1 && clear.next.every((l) => g.lanes.includes(l)));
  g.callWave();
  g.update(1 / 30);
  assert.equal(g.waveIdx, 1, 'CALL brings the next wave now');
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

// ---------------------------------------------------------------- v4: affinities, new Shadows, meta
test('affinities: weak hits hurt more, break posture faster and reveal the type; resists halve', () => {
  const g = open(classicGame({ unlockAll: true }));
  g.cash = 999;
  const j = g.place('jester', 1, 1); // slash
  const q = g.place('queen', 2, 1); // strike
  const m = g.spawn('mannequin', 'a'); // weak to slash
  const hp = m.hp;
  g.damage(j, m, 10, 10);
  assert.equal(hp - m.hp, 15);
  assert.equal(m.maxPosture - m.posture, 20);
  assert.ok(g.known.has('mannequin'), 'a weak hit reveals the affinities');
  assert.ok(g.drain().some((x) => x.t === 'hit' && x.weak && x.elem === 'slash'));
  const r = g.spawn('runner', 'a'); // resists strike
  const rh = r.hp;
  g.damage(q, r, 10, 10);
  assert.equal(rh - r.hp, 5);
  assert.ok(!g.known.has('runner'), 'a resisted hit does not reveal');
  const blind = open(classicGame({ unlockAll: true, blind: true }));
  blind.reveal('runner');
  assert.ok(!blind.known.has('runner'), 'House Lights Down keeps weaknesses hidden');
});

test('new Shadows: shields need weak hits, stagehands heal, doppels split, the Reviewer pans', () => {
  const g = open(classicGame({ unlockAll: true }));
  g.cash = 999;
  const j = g.place('jester', 1, 1);
  const q = g.place('queen', 2, 1);
  const b = g.spawn('bouncer', 'a'); // weak to strike, 3 shield
  g.damage(j, b, 10, 50);
  assert.ok(b.maxPosture - b.posture <= 10 + 1e-9, 'shield soaks posture from non-weak hits');
  for (let i = 0; i < 3; i++) g.damage(q, b, 1, 1);
  assert.equal(b.shield, 0, 'three weak hits strip it');
  const s = g.spawn('stagehand', 'a');
  const hurt = g.spawn('mannequin', 'a');
  hurt.hp = 10;
  g.enemyAbilities(s, ENEMIES.stagehand.heal.every + 0.01);
  assert.ok(hurt.hp > 10, 'stagehand patched its friend');
  const d = g.spawn('doppel', 'a');
  g.pushBack(d, -4);
  const n = g.enemies.length;
  g.damage(null, d, 1e6, 0, { raw: true });
  assert.equal(g.enemies.length, n - 1 + 2, 'doppel splits into two');
  assert.ok(g.enemies.slice(-2).every((x) => x.type === 'runner' && x.walked > 3), 'halves start where it fell');
  const rv = g.spawn('reviewer', 'a');
  rv.x = 1; rv.y = 2;
  g.enemyAbilities(rv, ENEMIES.reviewer.review.every + 0.01);
  assert.ok(j.buffs.some((x) => x.key === 'review') && g.stat(j).interval > UNITS.jester.interval, 'bad review slows Phantoms nearby');
});

test('mini-bosses headline their act; the Impresario changes the scene at 66% and 33%', () => {
  assert.ok(campaignGame(4).waves.at(-1).some((x) => x.type === 'usher'));
  assert.ok(campaignGame(9).waves.at(-1).some((x) => x.type === 'reviewer'));
  const g = open(campaignGame(14, { personaWhole: true }));
  const boss = g.spawn('boss', 'a');
  g.pushBack(boss, -6);
  g.sp = 80;
  const queued = g.spawnQueue.length;
  g.damage(null, boss, boss.maxHp * 0.4, 0, { raw: true });
  assert.equal(boss.phase, 1);
  assert.ok(g.spawnQueue.length > queued, 'phase 2 calls critics down the other runways');
  const w = boss.walked;
  g.damage(null, boss, boss.maxHp * 0.3, 0, { raw: true });
  assert.equal(boss.phase, 2);
  assert.ok(boss.walked < w, 'phase 3: scene change, it steps back up the runway');
  assert.equal(g.sp, 80 - g.rules.bossSpSteal, 'and steals SP');
  assert.ok(g.drain().filter((x) => x.t === 'bossPhase').length === 2);
});

test('difficulty, stars, bond perks and the second Persona skill', () => {
  const easy = campaignGame(5, { difficulty: 'story' });
  const hard = campaignGame(5, { difficulty: 'hard' });
  assert.ok(easy.rules.treasureHp > hard.rules.treasureHp && easy.hp < hard.hp && easy.rules.startCash > hard.rules.startCash);
  const g = campaignGame(0);
  assert.equal(autoplay(g), 'won');
  assert.ok(g.stars >= 1 && g.stars <= 3);
  // bonds: VETERAN deploys Queen at Rank 2; SAFETY NET adds 3 Treasure HP
  const b = open(campaignGame(14, { bonds: { queen: 1, prompter: 1, oracle: 2 }, loadout: { oracle: 'B', queen: 'B' } }));
  assert.equal(b.rules.treasureHp, 23);
  b.cash = 9999;
  assert.equal(b.place('queen', ...slotOf(b)).rank, 2);
  assert.equal(b.persona(b.onStage('queen')).kind, 'verdict', 'loadout B needs bond 2');
  b.place('oracle', ...slotOf(b));
  assert.equal(b.persona(b.onStage('oracle')).kind, 'overclock');
  b.sp = 99;
  assert.ok(b.summon('oracle', 5, 5));
  assert.ok(b.units.every((u) => u.buffs.some((x) => x.key === 'overclock')), 'OVERCLOCK quickens everyone');
});

test('daily rehearsal: one spec per day, two modifiers that change the rules', () => {
  const a = dailySpec(new Date(2026, 10, 4));
  assert.deepEqual(a, dailySpec(new Date(2026, 10, 4)));
  assert.notDeepEqual(a.seed, dailySpec(new Date(2026, 10, 5)).seed);
  assert.equal(a.modifiers.length, 2);
  assert.notEqual(a.modifiers[0], a.modifiers[1]);
  const glass = rehearsalGame({ tier: 2, seed: 3, unlockAll: true, modifiers: ['glass', 'noranks'] });
  assert.equal(glass.rules.treasureHp, 10);
  assert.ok(!glass.mech.has('rank'));
});
