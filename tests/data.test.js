import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPERATORS, OPERATOR_ORDER, CLASSES, ELEMENTS } from '../src/data/operators.js';
import { ENEMIES } from '../src/data/enemies.js';
import { STAGES, expandRoute } from '../src/data/stages.js';
import { SCENES } from '../src/data/story.js';
import { LOOKS } from '../src/data/looks.js';
import { SKILLS } from '../src/sim/skills.js';
import { SKILL_FX } from '../src/render/skillfx.js';
import { CINEMATICS } from '../src/render/cinematics.js';
import { BACKGROUND_KEYS } from '../src/render/backgrounds.js';

test('every operator is fully defined', () => {
  assert.equal(OPERATOR_ORDER.length, Object.keys(OPERATORS).length);
  for (const id of OPERATOR_ORDER) {
    const o = OPERATORS[id];
    assert.equal(o.id, id);
    assert.ok(CLASSES[o.class], `${id} class`);
    assert.ok(ELEMENTS[o.element], `${id} element`);
    assert.ok(LOOKS[id], `${id} look`);
    assert.ok(o.range.length > 0, `${id} range`);
    assert.ok(o.hp > 0 && o.atk > 0 && o.interval > 0 && o.cost > 0);
    assert.ok(SKILLS[o.skill.id], `${id} skill handler`);
    assert.ok(SKILL_FX[o.skill.id], `${id} skill animation`);
    assert.ok(o.persona && o.personaName);
  }
});

test('each operator has a unique skill and persona', () => {
  const skills = new Set(OPERATOR_ORDER.map((i) => OPERATORS[i].skill.id));
  const personas = new Set(OPERATOR_ORDER.map((i) => OPERATORS[i].persona));
  assert.equal(skills.size, OPERATOR_ORDER.length);
  assert.equal(personas.size, OPERATOR_ORDER.length);
});

test('melee classes can block, ranged cannot', () => {
  for (const id of OPERATOR_ORDER) {
    const o = OPERATORS[id];
    if (CLASSES[o.class].melee) assert.ok(o.block > 0, `${id} should block`);
    else assert.equal(o.block, 0, `${id} should not block`);
  }
});

test('enemy weaknesses reference real elements', () => {
  for (const e of Object.values(ENEMIES)) {
    for (const w of [...e.weak, ...(e.resist || [])]) assert.ok(ELEMENTS[w], `${e.id}: ${w}`);
  }
});

test('stage routes are on path tiles and waves reference real enemies', () => {
  for (const s of STAGES) {
    assert.equal(s.map.length, s.rows);
    for (const row of s.map) assert.equal(row.length, s.cols);
    for (const [key, corners] of Object.entries(s.routes)) {
      for (const [x, y] of expandRoute(corners)) assert.ok('pSE'.includes(s.map[y][x]), `${s.id} route ${key} at ${x},${y}`);
    }
    for (const w of s.waves) {
      assert.ok(ENEMIES[w.enemy], `${s.id} ${w.enemy}`);
      assert.ok(s.routes[w.route], `${s.id} route ${w.route}`);
    }
    assert.ok(s.map.join('').includes('h'), 'has high ground');
    assert.ok(s.map.join('').includes('E'), 'has a goal');
  }
});

test('operator unlocks point at real stages', () => {
  const ids = new Set(STAGES.map((s) => s.id));
  for (const o of Object.values(OPERATORS)) if (o.unlock) assert.ok(ids.has(o.unlock), o.id);
});

test('story scenes exist and only reference known assets', () => {
  const bgs = new Set(BACKGROUND_KEYS);
  for (const s of STAGES) {
    for (const key of ['pre', 'post']) assert.ok(SCENES[s.scenes[key]], `${s.id} ${key}`);
    for (const t of s.triggers || []) assert.ok(SCENES[t.scene], `${s.id} trigger ${t.scene}`);
  }
  assert.ok(SCENES.opening);
  for (const [id, steps] of Object.entries(SCENES)) {
    assert.ok(steps.length > 0, id);
    for (const st of steps) {
      if (st.bg) assert.ok(bgs.has(st.bg), `${id}: bg ${st.bg}`);
      if (st.cine) assert.ok(CINEMATICS[st.cine], `${id}: cine ${st.cine}`);
      if (st.say) assert.ok(LOOKS[st.say], `${id}: speaker ${st.say}`);
      if (st.enter) assert.ok(LOOKS[st.enter], `${id}: enter ${st.enter}`);
      if (st.say) assert.ok(st.text && st.text.length >= 1, `${id}: empty line`);
    }
  }
});

test('story has substance (not a stub)', () => {
  const lines = Object.values(SCENES).flat().filter((s) => s.say || s.narr).length;
  assert.ok(lines >= 90, `only ${lines} lines`);
});
