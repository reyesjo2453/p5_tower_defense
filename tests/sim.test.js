import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle, computeStats, RUSH_MAX, DOWN_TIME } from '../src/sim/battle.js';
import { STAGE_BY_ID } from '../src/data/stages.js';
import { OPERATORS } from '../src/data/operators.js';
import { rotateOffset } from '../src/core/util.js';
import { runPlan } from './helpers.js';

const mk = (squad = ['joker', 'skull', 'panther', 'mona', 'fox', 'noir', 'oracle', 'queen'], stage = '1-1') => {
  const b = new Battle(STAGE_BY_ID[stage], squad);
  b.dp = 99;
  return b;
};
const idx = (b, id) => b.cards.findIndex((c) => c.id === id);
const tick = (b, secs, dt = 1 / 30) => {
  const n = Math.round(secs / dt);
  for (let i = 0; i < n; i++) b.update(dt);
};
const foe = (b, id = 'shade', x = 3.5, y = 2.5, seg = 1) => b.spawn(id, 'a', { x, y, seg, travel: x });

test('rotateOffset rotates range tiles with facing', () => {
  assert.deepEqual(rotateOffset(2, 1, 0), [2, 1]);
  assert.deepEqual(rotateOffset(2, 0, 1), [0, 2]);
  assert.deepEqual(rotateOffset(2, 0, 2), [-2, 0]);
  assert.deepEqual(rotateOffset(2, 0, 3), [0, -2]);
});

test('deploy rules: melee on path, ranged on high ground, costs DP, then cooldown', () => {
  const b = mk();
  assert.ok(b.canDeploy(idx(b, 'joker'), 3, 2), 'joker on path');
  assert.ok(!b.canDeploy(idx(b, 'joker'), 2, 1), 'joker not on high ground');
  assert.ok(b.canDeploy(idx(b, 'panther'), 2, 1), 'panther on high ground');
  assert.ok(!b.canDeploy(idx(b, 'panther'), 3, 2), 'panther not on path');
  assert.ok(!b.canDeploy(idx(b, 'panther'), 6, 0), 'no deploying on walls');
  const dp0 = b.dp;
  const u = b.deploy(idx(b, 'joker'), 3, 2, 0);
  assert.ok(u);
  assert.equal(b.dp, dp0 - OPERATORS.joker.cost);
  assert.ok(!b.canDeploy(idx(b, 'skull'), 3, 2), 'tile occupied');
  b.retreat(u);
  assert.equal(b.dp, dp0 - OPERATORS.joker.cost + Math.floor(OPERATORS.joker.cost / 2), 'half refund');
  assert.ok(b.cards[idx(b, 'joker')].cd > 0);
  assert.ok(!b.canDeploy(idx(b, 'joker'), 3, 2), 'redeploy cooldown');
  b.dp = 0;
  assert.ok(!b.canDeploy(idx(b, 'skull'), 4, 2), 'not enough DP');
});

test('DP regenerates over time and caps at 99', () => {
  const b = mk();
  b.dp = 10;
  tick(b, 3);
  assert.ok(b.dp >= 12 && b.dp <= 13.1, `dp ${b.dp}`);
  b.dp = 98;
  tick(b, 5);
  assert.equal(b.dp, 99);
});

test('physical damage uses DEF, magic uses RES, minimum 5%', () => {
  const b = mk();
  const j = b.deploy(idx(b, 'joker'), 3, 2, 0);
  const bull = foe(b, 'bulwark', 1.5, 2.5);
  const phys = b.dealDamage(j, bull, 1000, { element: 'phys' });
  // bulwark def 480, resists phys (x0.6)
  assert.equal(phys, Math.round((1000 - 480) * 0.6));
  const min = b.dealDamage(j, bull, 100, { element: 'gun' });
  assert.equal(min, 5, 'chip damage floor');
  const seer = foe(b, 'seer', 1.5, 2.5);
  const mag = b.dealDamage(j, seer, 1000, { element: 'curse' });
  assert.equal(mag, 400, 'seer res 60 -> 40%');
});

test('weakness hits add Stagger; a full bar knocks the enemy DOWN for bonus damage', () => {
  const b = mk();
  const p = b.deploy(idx(b, 'panther'), 2, 1, 1);
  const e = foe(b, 'shade', 2.5, 2.5);
  const hp0 = e.hp;
  b.dealDamage(p, e, 10, { element: 'fire' });
  assert.ok(e.stagger > 0 && e.down === 0);
  b.dealDamage(p, e, 10, { element: 'fire' });
  b.dealDamage(p, e, 10, { element: 'fire' });
  assert.ok(e.down > 0, 'knocked down');
  assert.equal(e.stagger, 0);
  assert.ok(b.rush > 0, 'rush gauge filled');
  assert.ok(e.downImmune > e.down, 'brief immunity afterwards');
  const before = e.hp;
  const dealt = b.dealDamage(p, e, 300, { element: 'phys' });
  assert.equal(dealt, Math.round((300 - 40) * 1.35), 'down bonus');
  assert.ok(e.hp < before && before < hp0);
  b.retreat(p); // stop the caster finishing it off while we time the knock-down
  tick(b, DOWN_TIME + 0.2);
  assert.equal(e.down, 0);
});

test('downed enemies neither move nor attack', () => {
  const b = mk();
  const p = b.deploy(idx(b, 'panther'), 2, 1, 1);
  const e = foe(b, 'shade', 1.5, 2.5);
  for (let i = 0; i < 3; i++) b.dealDamage(p, e, 1, { element: 'fire' });
  const x0 = e.x;
  tick(b, 1);
  assert.equal(e.x, x0);
});

test('operators block enemies up to their block count', () => {
  const b = mk();
  const j = b.deploy(idx(b, 'joker'), 3, 2, 0);
  const e1 = foe(b, 'bulwark', 2.7, 2.5);
  const e2 = foe(b, 'bulwark', 2.5, 2.5);
  const e3 = foe(b, 'bulwark', 2.3, 2.5);
  tick(b, 3);
  assert.equal(j.blocking.size, 2, 'joker blocks 2');
  const blocked = [e1, e2, e3].filter((e) => e.blockedBy === j.uid);
  assert.equal(blocked.length, 2);
  const free = [e1, e2, e3].find((e) => e.blockedBy !== j.uid);
  assert.ok(free.x > 3.7, 'third enemy slips past');
});

test('retreating or losing an operator frees blocked enemies', () => {
  const b = mk();
  const j = b.deploy(idx(b, 'joker'), 3, 2, 0);
  const e = foe(b, 'shade', 3.2, 2.5);
  tick(b, 0.2);
  assert.equal(e.blockedBy, j.uid);
  b.retreat(j);
  assert.equal(e.blockedBy, null);
});

test('ranged enemies stop and shoot operators in range', () => {
  const b = mk();
  const j = b.deploy(idx(b, 'joker'), 4, 2, 0);
  const s = foe(b, 'seer', 1.9, 2.5);
  tick(b, 8);
  assert.ok(j.hp < j.def.hp, 'joker was shot');
  assert.ok(s.x < 3, 'seer holds position');
});

test('Joker gains DP for each kill (passive)', () => {
  const b = mk();
  const j = b.deploy(idx(b, 'joker'), 3, 2, 0);
  const e = foe(b, 'shade', 3.5, 2.5);
  e.hp = 1;
  b.dp = 10;
  b.dealDamage(j, e, 500, { element: 'phys' });
  assert.equal(b.dp, 11);
});

test('Baton Pass: skill activation buffs and charges nearby allies and fills Rush', () => {
  const b = mk();
  const j = b.deploy(idx(b, 'joker'), 3, 2, 0);
  const m = b.deploy(idx(b, 'mona'), 3, 1, 1);
  m.sp = 0;
  foe(b, 'shade', 3.5, 2.5);
  j.sp = 99;
  assert.ok(b.activateSkill(j));
  assert.ok(m.buffs.some((x) => x.key === 'baton'));
  assert.ok(computeStats(m).atk > m.def.atk);
  assert.equal(m.sp, 6);
  assert.ok(b.rush > 0);
  assert.ok(b.takeEvents().some((e) => e.t === 'baton'));
});

test('skills need SP and (for offensive ones) a target', () => {
  const b = mk();
  const j = b.deploy(idx(b, 'joker'), 3, 2, 0);
  j.sp = 99;
  assert.ok(!b.canSkill(j), 'no enemy in range');
  foe(b, 'shade', 3.5, 2.5);
  assert.ok(b.canSkill(j));
  j.sp = 1;
  assert.ok(!b.canSkill(j), 'not enough SP');
});

test('every operator skill can be fired and emits its animation event', () => {
  for (const id of Object.keys(OPERATORS)) {
    const b = mk();
    const melee = ['joker', 'skull', 'noir'].includes(id);
    const u = melee ? b.deploy(idx(b, id), 3, 2, 0) : b.deploy(idx(b, id), 2, 1, 1);
    foe(b, 'shade', 3.4, 2.5);
    foe(b, 'shade', 2.6, 2.5);
    foe(b, 'hound', 1.6, 2.5);
    u.sp = 999;
    assert.ok(b.canSkill(u), `${id} can use skill`);
    assert.ok(b.activateSkill(u), `${id} activates`);
    const ev = b.takeEvents();
    assert.ok(ev.some((e) => e.t === 'skill' && e.id === OPERATORS[id].skill.id), `${id} skill event`);
    tick(b, Math.max(OPERATORS[id].skill.duration, 0) + 0.5);
    assert.ok(!u.skill.active, `${id} skill ends`);
  }
});

test('skill effects: Mona heals, Oracle analyzes, Noir counters, Skull chains, Queen nukes', () => {
  // Mona
  let b = mk();
  let m = b.deploy(idx(b, 'mona'), 2, 1, 1);
  const j = b.deploy(idx(b, 'joker'), 3, 2, 0);
  j.hp = 100;
  m.sp = 999;
  b.activateSkill(m);
  assert.ok(j.hp > 100 + 300, 'healed');
  assert.ok(j.buffs.some((x) => x.key === 'garu'));
  // Oracle
  b = mk();
  const o = b.deploy(idx(b, 'oracle'), 2, 1, 1);
  const e = foe(b, 'shade', 8.5, 2.5);
  o.sp = 999;
  b.activateSkill(o);
  tick(b, 0.2);
  assert.ok(e.buffs.some((x) => x.key === 'analyze'));
  assert.ok(e.s.dmgTaken > 1);
  // Noir
  b = mk();
  const n = b.deploy(idx(b, 'noir'), 3, 2, 0);
  const foe1 = foe(b, 'shade', 3.2, 2.5);
  tick(b, 0.2);
  n.sp = 999;
  b.activateSkill(n);
  assert.ok(foe1.stun > 0, 'blocked enemy stunned');
  tick(b, 0.1);
  assert.equal(n.s.def, OPERATORS.noir.def * 2);
  assert.ok(n.counter > 0);
  // Skull chain
  b = mk();
  const s = b.deploy(idx(b, 'skull'), 3, 2, 0);
  const a1 = foe(b, 'shade', 3.4, 2.5);
  const a2 = foe(b, 'shade', 4.4, 2.5);
  s.sp = 999;
  b.activateSkill(s);
  b.takeEvents();
  s.atkCd = 0;
  const hp = a2.hp;
  tick(b, 0.2);
  assert.ok(a2.hp < hp || a2.dead, 'chain lightning reached second target');
  assert.ok(b.events.length >= 0 && a1);
  // Queen
  b = mk();
  const q = b.deploy(idx(b, 'queen'), 2, 1, 0);
  const t = foe(b, 'bulwark', 4.5, 1.5);
  q.sp = 999;
  b.activateSkill(q);
  assert.ok(q.charging);
  const hpT = t.hp;
  tick(b, 1.6);
  assert.ok(!q.charging);
  assert.ok(t.hp < hpT - 2000, 'big nuke damage');
  assert.ok(b.takeEvents().some((x) => x.t === 'impact'));
});

test('All-Out Rush needs a full gauge, hits everything, and resets', () => {
  const b = mk();
  const j = b.deploy(idx(b, 'joker'), 3, 2, 0);
  b.deploy(idx(b, 'skull'), 4, 2, 0);
  const es = [foe(b, 'shade', 6.5, 2.5), foe(b, 'hound', 7.5, 2.5)];
  assert.ok(!b.canAllOut());
  b.rush = RUSH_MAX;
  assert.ok(b.canAllOut());
  const hp = es.map((e) => e.hp);
  assert.ok(b.useAllOut());
  assert.equal(b.rush, 0);
  es.forEach((e, i) => assert.ok(e.dead || e.hp < hp[i]));
  assert.ok(j);
});

test('boss revives once (Encore) and fires its trigger', () => {
  const b = mk(['joker'], '1-3');
  const m = b.spawn('maestro', 'a');
  assert.ok(b.takeEvents().some((e) => e.t === 'scene' && e.id === '1-3.mid'));
  m.hp = 1;
  b.dealDamage(null, m, 999999, { type: 'true' });
  assert.ok(!m.dead, 'revived');
  assert.ok(m.hp > 5000);
  assert.ok(b.takeEvents().some((e) => e.t === 'scene' && e.id === '1-3.encore'));
  b.dealDamage(null, m, 999999, { type: 'true' });
  assert.ok(m.dead, 'dies for real the second time');
});

test('enemies reaching the goal cost lives and eventually fail the stage', () => {
  const b = mk();
  const e = foe(b, 'shade', 14.9, 1.5);
  e.seg = 5;
  tick(b, 1);
  assert.equal(b.lives, 2);
  assert.equal(b.leaked, 1);
  b.lives = 1;
  const e2 = foe(b, 'shade', 14.9, 1.5);
  e2.seg = 5;
  tick(b, 1);
  assert.equal(b.state, 'lost');
});

test('simulation is deterministic', () => {
  const plan = [{ at: 0, id: 'joker', c: 3, r: 2, dir: 0 }, { at: 0, id: 'mona', c: 3, r: 1, dir: 1 }, { at: 0, id: 'panther', c: 2, r: 1, dir: 1 }];
  const a = runPlan('1-1', ['joker', 'mona', 'panther'], plan);
  const b = runPlan('1-1', ['joker', 'mona', 'panther'], plan);
  assert.equal(a.kills, b.kills);
  assert.equal(a.time.toFixed(3), b.time.toFixed(3));
  assert.equal(a.lives, b.lives);
});

// ------------------------------------------------------------ balance guard rails
const SQUAD_6 = ['joker', 'skull', 'panther', 'mona', 'fox', 'noir'];
const PLANS = {
  '1-1': { squad: ['joker', 'skull', 'panther', 'mona'], plan: [{ at: 0, id: 'joker', c: 3, r: 2, dir: 0 }, { at: 0, id: 'mona', c: 3, r: 1, dir: 1 }, { at: 0, id: 'panther', c: 2, r: 1, dir: 1 }, { at: 10, id: 'skull', c: 5, r: 4, dir: 0 }] },
  '1-2': { squad: SQUAD_6, plan: [{ at: 0, id: 'joker', c: 7, r: 1, dir: 1 }, { at: 0, id: 'noir', c: 7, r: 4, dir: 3 }, { at: 0, id: 'mona', c: 8, r: 2, dir: 0 }, { at: 8, id: 'panther', c: 9, r: 2, dir: 0 }, { at: 12, id: 'fox', c: 10, r: 4, dir: 2 }, { at: 16, id: 'skull', c: 9, r: 3, dir: 0 }] },
  '1-3': { squad: ['joker', 'noir', 'mona', 'panther', 'fox', 'oracle'], plan: [{ at: 0, id: 'joker', c: 3, r: 3, dir: 0 }, { at: 0, id: 'fox', c: 2, r: 4, dir: 0 }, { at: 0, id: 'mona', c: 4, r: 3, dir: 2 }, { at: 4, id: 'panther', c: 4, r: 2, dir: 0 }, { at: 8, id: 'noir', c: 7, r: 2, dir: 1 }, { at: 12, id: 'oracle', c: 6, r: 2, dir: 0 }] },
};

for (const [id, { squad, plan }] of Object.entries(PLANS)) {
  test(`stage ${id} is winnable with a sensible squad and plan`, () => {
    const b = runPlan(id, squad, plan);
    assert.equal(b.state, 'won', `${id} ended ${b.state} (lives ${b.lives}, kills ${b.kills})`);
    assert.ok(b.lives >= 1);
  });
  test(`stage ${id} is NOT winnable by doing nothing`, () => {
    const b = runPlan(id, squad, []);
    assert.equal(b.state, 'lost');
  });
}
