// Headless battle simulation. No DOM / canvas access: renderers consume `battle.events`.
import { OPERATORS, MAGIC_ELEMENTS, isMelee } from '../data/operators.js';
import { ENEMIES } from '../data/enemies.js';
import { SKILLS } from './skills.js';
import { rotateOffset, mulberry32, clamp, dist } from '../core/util.js';

export const DOWN_TIME = 3.0;
export const DOWN_BONUS = 1.35;
export const WEAK_BONUS = 1.3;
export const RESIST_FACTOR = 0.6;
export const RUSH_MAX = 100;
export const DP_MAX = 99;

const STAGGER_PER_WEAK_HIT = 34;

export function computeStats(u) {
  const s = { atkMul: 1, defMul: 1, intMul: 1, speedMul: 1, dmgTaken: 1 };
  for (const b of u.buffs) {
    if (b.atkMul) s.atkMul *= b.atkMul;
    if (b.defMul) s.defMul *= b.defMul;
    if (b.intMul) s.intMul *= b.intMul;
    if (b.speedMul) s.speedMul *= b.speedMul;
    if (b.dmgTaken) s.dmgTaken *= b.dmgTaken;
  }
  s.atk = u.def.atk * s.atkMul;
  s.def = u.def.def * s.defMul;
  s.res = u.def.res;
  return s;
}

export class Battle {
  constructor(stage, squadIds) {
    this.stage = stage;
    this.map = stage.map;
    this.cols = stage.cols;
    this.rows = stage.rows;
    this.rng = mulberry32(stage.seed || 7);
    this.time = 0;
    this.dp = stage.startDp;
    this.dpAcc = 0;
    this.lives = stage.lives;
    this.rush = 0;
    this.kills = 0;
    this.leaked = 0;
    this.state = 'running'; // running | won | lost
    this.events = [];
    this.operators = [];
    this.enemies = [];
    this.uid = 1;
    this.cards = squadIds.map((id) => ({ id, def: OPERATORS[id], cd: 0, unit: null, lost: false }));
    this.spawnList = [];
    for (const wv of stage.waves) {
      for (let i = 0; i < wv.count; i++) this.spawnList.push({ t: wv.at + i * wv.gap, enemy: wv.enemy, route: wv.route });
    }
    this.spawnList.sort((a, b) => a.t - b.t);
    this.spawnIdx = 0;
    this.fired = new Set();
    this.tipIdx = 0;
    this.totalEnemies = this.spawnList.length;
  }

  // ---------------------------------------------------------------- helpers
  emit(ev) {
    this.events.push(ev);
  }

  tileAt(c, r) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return '#';
    return this.map[r][c];
  }

  unitAt(c, r) {
    return this.operators.find((o) => o.c === c && o.r === r) || null;
  }

  deployedCount() {
    return this.operators.length;
  }

  addDp(n) {
    this.dp = Math.min(DP_MAX, this.dp + n);
  }

  addRush(n) {
    this.rush = clamp(this.rush + n, 0, RUSH_MAX);
  }

  addBuff(u, buff) {
    const existing = u.buffs.find((b) => b.key === buff.key);
    if (existing) {
      existing.t = Math.max(existing.t, buff.t);
      Object.assign(existing, buff, { t: existing.t });
    } else {
      u.buffs.push({ ...buff });
    }
  }

  enemiesNear(x, y, r) {
    return this.enemies.filter((e) => !e.dead && dist(e.x, e.y, x, y) <= r);
  }

  heal(u, amount, from) {
    if (u.dead) return 0;
    const before = u.hp;
    u.hp = Math.min(u.def.hp, u.hp + amount);
    const got = Math.round(u.hp - before);
    if (got > 0) this.emit({ t: 'heal', x: u.x, y: u.y, v: got, from });
    return got;
  }

  rangeKeys(u) {
    const keys = new Set();
    for (const [dx, dy] of u.def.range) {
      const [rx, ry] = rotateOffset(dx, dy, u.dir);
      keys.add(`${u.c + rx},${u.r + ry}`);
    }
    return keys;
  }

  inRange(u, e) {
    return u.rangeSet.has(`${Math.floor(e.x)},${Math.floor(e.y)}`);
  }

  enemiesInRange(u) {
    return this.enemies.filter((e) => !e.dead && this.inRange(u, e));
  }

  // ---------------------------------------------------------------- deploy
  isMeleeCard(card) {
    return isMelee(card.def);
  }

  canDeploy(cardIdx, c, r) {
    const card = this.cards[cardIdx];
    if (!card || this.state !== 'running') return false;
    if (card.unit || card.cd > 0 || card.lost) return false;
    if (this.dp < card.def.cost) return false;
    return this.validTile(card, c, r);
  }

  validTile(card, c, r) {
    const t = this.tileAt(c, r);
    if (this.unitAt(c, r)) return false;
    return isMelee(card.def) ? t === 'p' || t === 'S' : t === 'h';
  }

  deploy(cardIdx, c, r, dir) {
    if (!this.canDeploy(cardIdx, c, r)) return null;
    const card = this.cards[cardIdx];
    const def = card.def;
    this.dp -= def.cost;
    const u = {
      kind: 'op', uid: this.uid++, id: def.id, def, c, r, x: c + 0.5, y: r + 0.5, dir,
      hp: def.hp, atkCd: 0.4, sp: def.skill.initSp, buffs: [], blocking: new Set(),
      skill: { active: false, t: 0 }, dead: false, cardIdx, flash: 0, charging: false, chain: 0, counter: 0,
      regenPct: 0, atkElement: def.element, slowOnHit: false, age: 0,
    };
    u.rangeSet = this.rangeKeys(u);
    u.s = computeStats(u);
    card.unit = u;
    this.operators.push(u);
    this.emit({ t: 'deploy', x: u.x, y: u.y, id: def.id, uid: u.uid });
    // anything already standing here becomes blocked
    this.refreshBlocking(u);
    return u;
  }

  retreat(u) {
    if (!u || u.dead) return;
    this.addDp(Math.floor(u.def.cost / 2));
    this.removeOperator(u, false);
    this.emit({ t: 'retreat', x: u.x, y: u.y, id: u.id });
  }

  removeOperator(u, defeated) {
    u.dead = true;
    if (u.skill.active) this.endSkill(u, true);
    for (const e of this.enemies) if (e.blockedBy === u.uid) e.blockedBy = null;
    this.operators = this.operators.filter((o) => o !== u);
    const card = this.cards[u.cardIdx];
    card.unit = null;
    card.cd = u.def.redeploy * (defeated ? 1.5 : 1);
    if (defeated) this.emit({ t: 'oplost', x: u.x, y: u.y, id: u.id });
  }

  refreshBlocking(u) {
    if (u.def.block <= 0) return;
    for (const e of this.enemies) {
      if (e.dead || e.blockedBy || u.blocking.size >= u.def.block) continue;
      if (Math.floor(e.x) === u.c && Math.floor(e.y) === u.r) {
        e.blockedBy = u.uid;
        u.blocking.add(e.uid);
      }
    }
  }

  // ---------------------------------------------------------------- skills
  canSkill(u) {
    const sk = u.def.skill;
    if (this.state !== 'running' || u.dead || u.skill.active || u.charging) return false;
    if (u.sp < sk.spCost) return false;
    if (sk.needsTarget && this.enemiesInRange(u).length === 0 && !SKILLS[sk.id].anywhere) return false;
    return true;
  }

  activateSkill(u) {
    if (!this.canSkill(u)) return false;
    const sk = u.def.skill;
    u.sp = 0;
    u.skill.active = true;
    u.skill.t = sk.duration;
    const data = SKILLS[sk.id].start(this, u) || {};
    this.emit({ t: 'skill', id: sk.id, opId: u.id, uid: u.uid, x: u.x, y: u.y, dir: u.dir, duration: sk.duration, ...data });
    this.batonPass(u);
    if (sk.duration <= 0) this.endSkill(u);
    return true;
  }

  endSkill(u, silent = false) {
    if (!u.skill.active) return;
    u.skill.active = false;
    u.buffs = u.buffs.filter((b) => !b.skill);
    SKILLS[u.def.skill.id].end?.(this, u, silent);
    if (!silent) this.emit({ t: 'skillEnd', id: u.def.skill.id, uid: u.uid });
  }

  batonPass(from) {
    const mates = this.operators.filter((o) => o !== from && dist(o.x, o.y, from.x, from.y) <= 1.6);
    if (!mates.length) return;
    for (const m of mates) {
      this.addBuff(m, { key: 'baton', atkMul: 1.2, t: 6 });
      if (!m.skill.active) m.sp = Math.min(m.def.skill.spCost, m.sp + 6);
    }
    this.addRush(6 + mates.length * 2);
    this.emit({ t: 'baton', from: { x: from.x, y: from.y }, to: mates.map((m) => ({ x: m.x, y: m.y })) });
  }

  // ---------------------------------------------------------------- all-out rush
  canAllOut() {
    return this.state === 'running' && this.rush >= RUSH_MAX && this.enemies.some((e) => !e.dead) && this.operators.length > 0;
  }

  useAllOut() {
    if (!this.canAllOut()) return false;
    const squad = [...this.operators];
    const targets = this.enemies.filter((e) => !e.dead);
    this.rush = 0;
    this.emit({ t: 'allout', ops: squad.map((o) => ({ id: o.id, x: o.x, y: o.y })), targets: targets.map((e) => ({ x: e.x, y: e.y })) });
    for (const e of targets) {
      let total = 0;
      for (const o of squad) total += o.s.atk * 1.4;
      this.dealDamage(squad[0], e, total, { type: 'phys', element: 'phys', pierce: 0.7, noStagger: true, silent: false });
      if (e.dead) continue;
      if (e.def.boss) {
        e.stagger = Math.min(e.def.staggerMax - 1, e.stagger + e.def.staggerMax * 0.5);
        e.stun = Math.max(e.stun, 1.5);
      } else {
        this.knockDown(e, true);
      }
    }
    return true;
  }

  // ---------------------------------------------------------------- damage
  dealDamage(src, tgt, amount, o = {}) {
    if (tgt.dead) return 0;
    const el = o.element || 'phys';
    const type = o.type || (MAGIC_ELEMENTS.has(el) ? 'magic' : 'phys');
    const s = tgt.s;
    let dmg;
    if (type === 'true') dmg = amount;
    else if (type === 'phys') dmg = Math.max(amount - s.def * (1 - (o.pierce || 0)), amount * 0.05);
    else dmg = Math.max(amount * (1 - clamp(s.res * (1 - (o.pierce || 0)), 0, 95) / 100), amount * 0.05);
    let weak = false;
    let resist = false;
    if (tgt.kind === 'enemy') {
      if (tgt.def.weak.includes(el)) { dmg *= WEAK_BONUS; weak = true; }
      if (tgt.def.resist?.includes(el)) { dmg *= RESIST_FACTOR; resist = true; }
      if (tgt.down > 0) dmg *= DOWN_BONUS;
    }
    dmg *= s.dmgTaken;
    dmg = Math.max(1, Math.round(dmg));
    tgt.hp -= dmg;
    tgt.flash = 0.12;
    this.emit({ t: 'dmg', x: tgt.x, y: tgt.y, v: dmg, weak, resist, down: tgt.kind === 'enemy' && tgt.down > 0, op: tgt.kind === 'op', element: el });
    if (tgt.kind === 'enemy') {
      if (weak && !o.noStagger && tgt.down <= 0 && tgt.downImmune <= 0) {
        tgt.stagger += STAGGER_PER_WEAK_HIT * (tgt.def.staggerGain ?? 1);
        if (tgt.stagger >= tgt.def.staggerMax) this.knockDown(tgt, false);
      }
      if (tgt.hp <= 0) this.killEnemy(tgt, src);
    } else if (tgt.hp <= 0) {
      this.removeOperator(tgt, true);
    }
    return dmg;
  }

  knockDown(e, forced) {
    if (e.dead) return;
    e.down = DOWN_TIME;
    e.stagger = 0;
    e.downImmune = DOWN_TIME + 7;
    this.addRush(e.def.boss ? 8 : 12);
    this.emit({ t: 'down', x: e.x, y: e.y, forced, boss: !!e.def.boss });
  }

  killEnemy(e, src) {
    if (e.dead) return;
    if (e.def.revive && !e.revived) {
      e.revived = true;
      e.hp = Math.round(e.def.hp * e.def.revive.hpPct);
      e.down = 0;
      e.stagger = 0;
      e.stun = 2.5;
      e.buffs = e.buffs.filter((b) => b.key !== 'analyze');
      e.speedBase *= 1.25;
      this.emit({ t: 'phase', text: 'ENCORE!', x: e.x, y: e.y, color: '#ffd24a' });
      this.fireTriggers('encore');
      return;
    }
    e.dead = true;
    this.kills++;
    for (const o of this.operators) o.blocking.delete(e.uid);
    if (src?.kind === 'op' && src.id === 'joker' && !src.dead) this.addDp(1);
    this.emit({ t: 'kill', x: e.x, y: e.y, id: e.def.id, boss: !!e.def.boss });
    this.enemies = this.enemies.filter((x) => x !== e);
  }

  // ---------------------------------------------------------------- spawning
  makeEnemy(id, routeKey, at) {
    const def = ENEMIES[id];
    const corners = this.stage.routes[routeKey];
    const route = corners.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
    const start = at || route[0];
    return {
      kind: 'enemy', uid: this.uid++, id, def, route, routeKey, seg: at ? at.seg : 1, x: start.x, y: start.y,
      hp: def.hp, speedBase: def.speed, buffs: [], stagger: 0, down: 0, downImmune: 0, stun: 0, blockedBy: null,
      atkCd: 0.6, travel: at ? at.travel : 0, dead: false, flash: 0, burn: null, timers: { ability: def.summonEvery || def.crescendoEvery || 0 },
      s: { atkMul: 1, defMul: 1, intMul: 1, speedMul: 1, dmgTaken: 1, atk: def.atk, def: def.def, res: def.res },
    };
  }

  spawn(id, routeKey, at) {
    const e = this.makeEnemy(id, routeKey, at);
    this.enemies.push(e);
    this.emit({ t: 'spawn', x: e.x, y: e.y, id, boss: !!e.def.boss });
    if (!at) this.fireTriggers('spawn', { enemy: id });
    return e;
  }

  fireTriggers(kind, data = {}) {
    (this.stage.triggers || []).forEach((tr, i) => {
      const key = `${i}`;
      if (this.fired.has(key) || tr.on !== kind) return;
      if (kind === 'spawn' && tr.enemy !== data.enemy) return;
      if (kind === 'time' && this.time < tr.t) return;
      if (kind === 'kills' && this.kills < tr.n) return;
      this.fired.add(key);
      this.emit({ t: 'scene', id: tr.scene });
    });
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    if (this.state !== 'running') return;
    this.time += dt;

    // DP regen
    let rate = 1;
    for (const o of this.operators) if (o.id === 'oracle') rate += 0.12;
    this.dpAcc += dt * rate;
    while (this.dpAcc >= 1) {
      this.dpAcc -= 1;
      this.addDp(1);
    }

    for (const c of this.cards) if (!c.unit && c.cd > 0) c.cd = Math.max(0, c.cd - dt);

    while (this.spawnIdx < this.spawnList.length && this.spawnList[this.spawnIdx].t <= this.time) {
      const sp = this.spawnList[this.spawnIdx++];
      this.spawn(sp.enemy, sp.route);
    }
    const tips = this.stage.tips || [];
    while (this.tipIdx < tips.length && tips[this.tipIdx].at <= this.time) this.emit({ t: 'tip', text: tips[this.tipIdx++].text });

    this.fireTriggers('time');
    this.fireTriggers('kills');

    for (const e of [...this.enemies]) this.updateEnemy(e, dt);
    for (const o of [...this.operators]) this.updateOperator(o, dt);

    if (this.lives <= 0) {
      this.state = 'lost';
      this.emit({ t: 'lost' });
    } else if (this.spawnIdx >= this.spawnList.length && this.enemies.length === 0) {
      this.state = 'won';
      this.emit({ t: 'won', stars: this.stars() });
    }
  }

  stars() {
    if (this.lives >= this.stage.lives) return 3;
    if (this.lives >= this.stage.lives - 1) return 2;
    return 1;
  }

  tickBuffs(u, dt) {
    for (const b of u.buffs) b.t -= dt;
    if (u.buffs.some((b) => b.t <= 0 && !b.skill)) u.buffs = u.buffs.filter((b) => b.t > 0 || b.skill);
    u.s = computeStats(u);
    if (u.flash > 0) u.flash -= dt;
  }

  updateOperator(u, dt) {
    u.age += dt;
    this.tickBuffs(u, dt);
    const d = u.def;
    const sk = d.skill;
    if (!u.skill.active && sk.spType === 'auto') u.sp = Math.min(sk.spCost, u.sp + dt);
    if (u.skill.active) {
      u.skill.t -= dt;
      SKILLS[sk.id].tick?.(this, u, dt);
      if (u.skill.t <= 0) this.endSkill(u);
    }
    if (u.regenPct > 0) this.heal(u, d.hp * u.regenPct * dt, u);
    if (u.dead || u.charging) return;
    u.atkCd -= dt;
    if (u.atkCd <= 0) this.operatorAttack(u);
  }

  operatorAttack(u) {
    const d = u.def;
    const interval = d.interval * u.s.intMul;
    if (d.class === 'medic') {
      const hurt = this.operators
        .filter((o) => o.hp < o.def.hp && o !== u && u.rangeSet.has(`${o.c},${o.r}`))
        .sort((a, b) => a.hp / a.def.hp - b.hp / b.def.hp)[0];
      if (!hurt) return;
      this.heal(hurt, u.s.atk, u);
      this.emit({ t: 'shot', kind: 'heal', element: d.element, from: { x: u.x, y: u.y }, to: { x: hurt.x, y: hurt.y }, id: u.id });
      u.atkCd = interval;
      this.gainAttackSp(u);
      return;
    }
    const cands = this.enemiesInRange(u);
    if (!cands.length) return;
    let pool = cands;
    if (isMelee(d)) {
      const blocked = cands.filter((e) => u.blocking.has(e.uid));
      if (blocked.length) pool = blocked;
    }
    const target = pool.reduce((a, b) => (b.travel > a.travel ? b : a));
    const el = u.atkElement;
    const hitOpts = { element: el };
    const dmg = this.dealDamage(u, target, u.s.atk, hitOpts);
    this.emit({ t: 'shot', kind: isMelee(d) ? 'melee' : 'ranged', element: el, from: { x: u.x, y: u.y }, to: { x: target.x, y: target.y }, id: u.id, big: !!d.splash, dir: u.dir });
    if (u.slowOnHit && !target.dead) this.addBuff(target, { key: 'slow', speedMul: 0.6, t: 2 });
    if (d.splash) {
      for (const e of this.enemiesNear(target.x, target.y, d.splash)) {
        if (e !== target) this.dealDamage(u, e, u.s.atk * 0.6, hitOpts);
      }
    }
    if (u.chain > 0 && dmg > 0) {
      const others = this.enemies
        .filter((e) => e !== target && !e.dead && dist(e.x, e.y, target.x, target.y) <= 1.9)
        .sort((a, b) => dist(a.x, a.y, target.x, target.y) - dist(b.x, b.y, target.x, target.y))
        .slice(0, u.chain);
      if (others.length) {
        this.emit({ t: 'chain', points: [target, ...others].map((e) => ({ x: e.x, y: e.y })) });
        for (const e of others) this.dealDamage(u, e, u.s.atk * 0.6, { element: 'elec' });
      }
    }
    u.atkCd = interval;
    this.gainAttackSp(u);
  }

  gainAttackSp(u) {
    const sk = u.def.skill;
    if (sk.spType === 'attack' && !u.skill.active) u.sp = Math.min(sk.spCost, u.sp + 1);
  }

  updateEnemy(e, dt) {
    if (e.dead) return;
    this.tickBuffs(e, dt);
    if (e.burn) {
      e.burn.t -= dt;
      e.burn.tick -= dt;
      if (e.burn.tick <= 0) {
        e.burn.tick += 0.5;
        this.dealDamage(e.burn.src, e, e.burn.dps * 0.5, { element: 'fire', noStagger: true });
        if (e.dead) return;
      }
      if (e.burn.t <= 0) e.burn = null;
    }
    if (e.downImmune > 0) e.downImmune -= dt;
    if (e.stun > 0) { e.stun -= dt; return; }
    if (e.down > 0) {
      e.down = Math.max(0, e.down - dt);
      return;
    }
    this.enemyAbility(e, dt);
    if (e.dead) return;

    // blocked: fight the operator
    if (e.blockedBy) {
      const op = this.operators.find((o) => o.uid === e.blockedBy);
      if (op && !op.dead) {
        this.enemyStrike(e, op, dt);
        return;
      }
      e.blockedBy = null;
    }
    // ranged enemies stop to shoot
    if (e.def.ranged) {
      const targets = this.operators.filter((o) => dist(o.x, o.y, e.x, e.y) <= e.def.range);
      if (targets.length) {
        targets.sort((a, b) => dist(a.x, a.y, e.x, e.y) - dist(b.x, b.y, e.x, e.y));
        this.enemyStrike(e, targets[0], dt);
        return;
      }
    }
    this.moveEnemy(e, dt);
  }

  enemyStrike(e, op, dt) {
    e.atkCd -= dt;
    if (e.atkCd > 0) return;
    e.atkCd = e.def.interval;
    const type = e.def.magic ? 'magic' : 'phys';
    this.emit({ t: 'estrike', from: { x: e.x, y: e.y }, to: { x: op.x, y: op.y }, ranged: !!e.def.ranged, color: e.def.color });
    const hp0 = op.hp;
    this.dealDamage(e, op, e.s.atk ?? e.def.atk, { type, element: e.def.magic ? 'curse' : 'phys' });
    if (op.counter > 0 && !e.dead) this.dealDamage(op, e, op.s.atk * op.counter, { element: 'bless' });
    if (hp0 > 0 && op.def.skill.spType === 'hit' && !op.dead) op.sp = Math.min(op.def.skill.spCost, op.sp + 1);
  }

  enemyAbility(e, dt) {
    const def = e.def;
    if (!def.ability) return;
    e.timers.ability -= dt;
    if (e.timers.ability > 0) return;
    if (def.ability === 'summon') {
      e.timers.ability = def.summonEvery;
      for (let i = 0; i < 2; i++) this.spawn(def.summon, e.routeKey, { x: e.x, y: e.y, seg: e.seg, travel: Math.max(0, e.travel - i * 0.3) });
      this.emit({ t: 'phase', text: 'SUMMON', x: e.x, y: e.y, color: def.color });
    } else if (def.ability === 'crescendo') {
      e.timers.ability = def.crescendoEvery * (e.revived ? 0.75 : 1);
      const hit = this.operators.filter((o) => dist(o.x, o.y, e.x, e.y) <= 2.8);
      this.emit({ t: 'phase', text: 'CRESCENDO', x: e.x, y: e.y, color: def.color, ring: 2.8 });
      for (const o of hit) this.dealDamage(e, o, 340, { type: 'magic', element: 'curse' });
      for (let i = 0; i < 2; i++) this.spawn('hound', e.routeKey, { x: e.x, y: e.y, seg: e.seg, travel: Math.max(0, e.travel - i * 0.3) });
    }
  }

  moveEnemy(e, dt) {
    let budget = e.speedBase * e.s.speedMul * dt;
    while (budget > 0 && e.seg < e.route.length) {
      const wp = e.route[e.seg];
      const d = dist(e.x, e.y, wp.x, wp.y);
      if (d <= budget) {
        e.x = wp.x;
        e.y = wp.y;
        e.travel += d;
        budget -= d;
        e.seg++;
      } else {
        e.x += ((wp.x - e.x) / d) * budget;
        e.y += ((wp.y - e.y) / d) * budget;
        e.travel += budget;
        budget = 0;
      }
      // blocking check on tile entry
      const c = Math.floor(e.x);
      const r = Math.floor(e.y);
      const op = this.operators.find((o) => o.c === c && o.r === r && o.def.block > 0);
      if (op && op.blocking.size < op.def.block) {
        e.blockedBy = op.uid;
        op.blocking.add(e.uid);
        return;
      }
    }
    if (e.seg >= e.route.length) {
      e.dead = true;
      this.leaked++;
      this.lives -= e.def.lifeCost;
      this.emit({ t: 'leak', x: e.x, y: e.y, cost: e.def.lifeCost });
      for (const o of this.operators) o.blocking.delete(e.uid);
      this.enemies = this.enemies.filter((x) => x !== e);
    }
  }

  takeEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }
}
