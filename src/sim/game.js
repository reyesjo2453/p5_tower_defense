// Deterministic tower-defense simulation. No DOM, no Three.js: the renderer reads state and
// drains `events` each frame. Time only advances through update(dt).
//
// One Game is one stage: a board (opts.stage.paths, default the classic two-lane PATHS) and its
// waves, with a short break between waves. The campaign (src/sim/campaign.js) builds a new Game for
// every story stage; `chapter` picks which cast members and mechanics are unlocked.
//
// Shared SP: posture breaks and kills fill it, Persona summons spend it (game.summon), and a full
// gauge is the All-Out Attack.
import { UNITS, ENEMIES, WAVES, RULES, RANKS, CAMPAIGN, ALL_MECHANICS, CENTER, PATHS } from './data.js';
import { buildBoard, waypoints } from './board.js';

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/** Units and mechanics unlocked once chapter `i` has begun (cumulative). */
export function unlocksAt(i, campaign = CAMPAIGN) {
  const units = new Set();
  const mech = new Set();
  for (let k = 0; k <= Math.min(i, campaign.length - 1); k++) {
    for (const u of campaign[k].unlock) units.add(u);
    for (const m of campaign[k].mech) mech.add(m);
  }
  return { units, mech };
}

export class Game {
  /**
   * opts: { rules, stage ({ paths }), waves, chapter (campaign index: unlocks), unlockAll (bool:
   * every unit and mechanic; tests / sandbox), hp (Shadow HP multiplier), hpRamp (per-wave HP
   * multipliers), personaWhole (Jester's Persona has its name back) }
   */
  constructor(opts = {}) {
    this.rules = { ...RULES, ...(opts.rules || {}) };
    this.stage = opts.stage || { paths: PATHS };
    this.paths = this.stage.paths;
    this.lanes = Object.keys(this.paths);
    this.waves = opts.waves || WAVES;
    this.hp = opts.hp ?? 1;
    this.hpRamp = opts.hpRamp ?? null;
    this.unlockAll = !!opts.unlockAll;
    this.personaWhole = !!opts.personaWhole;
    this.chapterIdx = opts.chapter ?? 0;
    this.board = buildBoard(this.paths);
    this.wp = Object.fromEntries(this.lanes.map((l) => [l, waypoints(l, this.paths)]));
    this.pathLen = Object.fromEntries(this.lanes.map((l) => [l, cumulative(this.wp[l])]));
    this.cash = this.rules.startCash;
    this.treasure = this.rules.treasureHp;
    this.units = [];
    this.enemies = [];
    this.zones = []; // Persona fire rings: { x, y, r, t, max, dps, slow, src }
    this.events = [];
    this.time = 0;
    this.waveIdx = -1; // -1 = not started
    this.spawnQueue = [];
    this.waveTimer = 0;
    this.breakT = null; // seconds until the next wave while between waves
    this.state = 'ready'; // ready | running | won | lost
    this.hitStop = 0;
    this.baton = null; // { from, t, max, lane } window to pass after a 1-MORE
    this.laneCd = {}; // lane (path id) -> seconds until it may open another Baton Pass prompt
    this.timeScale = 1; // eases to bullet-time while a prompt is open or a Persona is being aimed
    this.aiming = false;
    this.sp = 0;
    this.ward = 0; // Ghostlight: leaks the Treasure shrugs off
    this.chain = 0;
    this.kills = 0;
    this.uid = 1;
    this.unlocked = new Set();
    this.mech = new Set();
    this.applyUnlocks(this.chapterIdx);
  }

  applyUnlocks(i) {
    if (this.unlockAll) {
      this.unlocked = new Set(Object.keys(UNITS));
      this.mech = new Set(ALL_MECHANICS);
      return;
    }
    const { units, mech } = unlocksAt(i);
    this.unlocked = units;
    this.mech = mech;
  }

  /** The campaign stage this game plays (its label / title), or the first one outside the campaign. */
  get chapter() {
    return CAMPAIGN[Math.max(0, Math.min(this.chapterIdx, CAMPAIGN.length - 1))];
  }

  /** Lanes the next wave comes down (for the spawn-gate warning between waves). */
  get nextLanes() {
    const w = this.waves[this.waveIdx + 1];
    return w ? [...new Set(w.map((g) => g.path))] : [];
  }

  emit(t, data = {}) {
    this.events.push({ t, ...data });
  }

  drain() {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---------------------------------------------------------------- player actions
  start() {
    if (this.state !== 'ready') return;
    this.state = 'running';
    this.nextWave();
  }

  /** Between waves: skip the rest of the break and call the next wave now. */
  callWave() {
    if (this.state === 'running' && this.breakT != null) this.breakT = 0;
  }

  onStage(type) {
    return this.units.find((u) => u.type === type) || null;
  }

  canPlace(type, x, y) {
    const def = UNITS[type];
    return !!def && this.state !== 'won' && this.state !== 'lost' && this.cash >= def.cost
      && this.unlocked.has(type) && !this.onStage(type)
      && this.board.slotSet.has(`${x},${y}`) && !this.unitAt(x, y);
  }

  makeUnit(type, x, y) {
    const def = UNITS[type];
    return { uid: this.uid++, type, def, x, y, cd: 0.2, buffs: [], facing: 0, attacks: 0, rank: 1, spent: def.cost, moveCd: 0, healT: 0 };
  }

  place(type, x, y) {
    if (!this.canPlace(type, x, y)) return null;
    const u = this.makeUnit(type, x, y);
    this.cash -= u.def.cost;
    this.units.push(u);
    this.emit('place', { unit: u });
    return u;
  }

  sell(u) {
    const i = this.units.indexOf(u);
    if (i < 0) return;
    this.units.splice(i, 1);
    this.cash += Math.floor(u.spent * this.rules.sellRefund);
    if (this.baton?.from === u) this.baton = null;
    this.emit('sell', { unit: u });
  }

  unitAt(x, y) {
    return this.units.find((u) => u.x === x && u.y === y) || null;
  }

  /** ¥ for the next rank of `u`, or null at max rank / before Rank-ups unlock. */
  rankCost(u) {
    if (!this.mech.has('rank') || !u || u.rank >= RANKS.max) return null;
    return u.def.rankCost[u.rank - 1];
  }

  rankUp(u) {
    const c = this.rankCost(u);
    if (c == null || this.cash < c || !this.units.includes(u)) return false;
    this.cash -= c;
    u.spent += c;
    u.rank++;
    this.emit('rank', { unit: u, rank: u.rank });
    return true;
  }

  /** Blocking: can `u` move to plate (x, y) right now? */
  canMove(u, x, y) {
    return this.mech.has('blocking') && this.units.includes(u) && u.moveCd <= 0
      && this.board.slotSet.has(`${x},${y}`) && !this.unitAt(x, y);
  }

  move(u, x, y) {
    if (!this.canMove(u, x, y)) return false;
    const from = { x: u.x, y: u.y };
    u.x = x;
    u.y = y;
    u.moveCd = this.rules.moveCd;
    u.cd = Math.max(u.cd, this.rules.moveSettle);
    if (this.baton?.from === u) this.baton.from = u; // keeps the window; it is still the same unit
    this.emit('move', { unit: u, from });
    return true;
  }

  /** The ally a Baton Pass goes to when the player doesn't pick one: whoever hits hardest right now. */
  batonTarget() {
    if (!this.baton) return null;
    let best = null;
    let bestScore = -1;
    for (const u of this.units) {
      if (u === this.baton.from) continue;
      const s = this.stat(u);
      const score = (this.target(u) ? 1000 : 0) + (s.dmg + s.posture) / s.interval;
      if (score > bestScore) {
        bestScore = score;
        best = u;
      }
    }
    return best;
  }

  /** After a 1-MORE, hand the momentum to another unit (the best one when `target` is omitted). */
  batonPass(target = this.batonTarget()) {
    if (!this.baton || !target || target === this.baton.from || !this.units.includes(target)) return false;
    const b = this.rules.baton;
    target.buffs = target.buffs.filter((x) => x.key !== 'baton');
    target.buffs.push({ key: 'baton', t: b.t, dmgMul: b.dmgMul + Math.min(this.chain, b.chainCap) * 0.1, postureMul: b.postureMul, intervalMul: b.intervalMul });
    target.cd = 0;
    this.emit('baton', { from: this.baton.from, to: target, chain: this.chain });
    this.baton = null;
    return true;
  }

  get downed() {
    return this.enemies.filter((e) => e.down > 0);
  }

  get allOutReady() {
    return this.state === 'running' && this.mech.has('allout') && this.sp >= this.rules.spMax && this.enemies.length > 0;
  }

  /** Resolve the All-Out Attack (the renderer plays the cinematic first, then calls this). */
  allOut() {
    if (!this.allOutReady) return false;
    const r = this.rules;
    const hits = [];
    this.sp = 0;
    for (const e of [...this.enemies]) {
      const dmg = e.down > 0 ? r.allOutDmg + e.maxHp * r.allOutPct : r.allOutSplash;
      hits.push(e);
      this.damage(null, e, dmg, 0, { raw: true });
    }
    this.chain = 0;
    this.emit('allout', { hits });
    return true;
  }

  // ---------------------------------------------------------------- Personas
  gainSp(n) {
    if (!this.mech.has('summon') && !this.mech.has('allout')) return;
    this.sp = Math.min(this.rules.spMax, this.sp + n);
  }

  persona(u) {
    const p = u.def.persona;
    return { ...p, name: p.whole && this.personaWhole ? p.whole : p.name };
  }

  canSummon(type) {
    const u = this.onStage(type);
    return !!u && this.state === 'running' && this.mech.has('summon') && this.sp >= u.def.persona.cost;
  }

  /** Bullet-time while the player aims a Persona. */
  setAiming(on) {
    this.aiming = !!on;
  }

  /** Summon `type`'s Persona onto board point (x, y) (tile units, fractional allowed). */
  summon(type, x, y) {
    if (!this.canSummon(type)) return false;
    const u = this.onStage(type);
    const p = u.def.persona;
    this.sp -= p.cost;
    this.aiming = false;
    const inside = this.enemies.filter((e) => dist(e.x, e.y, x, y) <= p.radius);
    switch (p.id) {
      case 'noone': {
        const push = this.personaWhole ? p.pushWhole : p.push;
        for (const e of inside) {
          this.pushBack(e, e.def.boss ? push * 0.4 : push);
          this.damage(u, e, 0, p.posture);
        }
        break;
      }
      case 'verdict':
        for (const e of inside) {
          e.stun = Math.max(e.stun, e.def.boss ? p.stun * 0.5 : p.stun);
          this.damage(u, e, p.dmg * RANKS.dmgMul[u.rank - 1], p.posture);
        }
        break;
      case 'sightline':
        for (const e of inside) e.mark = Math.max(e.mark, p.mark);
        break;
      case 'ghostlight': {
        const heal = Math.min(p.heal, this.rules.treasureHp - this.treasure);
        this.treasure += heal;
        this.ward += p.ward;
        if (heal > 0) this.emit('heal', { unit: u, amount: heal });
        for (const e of inside) e.slowT = Math.max(e.slowT, p.slow);
        break;
      }
      case 'flashpaper':
        this.zones.push({ x, y, r: p.radius, t: p.zone, max: p.zone, dps: p.dps * RANKS.dmgMul[u.rank - 1], slow: p.slow, src: u });
        break;
      default:
    }
    this.emit('summon', { unit: u, persona: this.persona(u), x, y, r: p.radius, hits: inside });
    return true;
  }

  /** Push a Shadow `d` tiles back up its runway (Curtain Wind). */
  pushBack(e, d) {
    const from = { x: e.x, y: e.y };
    const s = Math.max(0, e.walked - d);
    const wp = e.wp;
    const cum = this.pathLen[e.path];
    let seg = 1;
    while (seg < wp.length - 1 && cum[seg] < s) seg++;
    const a = wp[seg - 1];
    const b = wp[seg];
    const len = cum[seg] - cum[seg - 1] || 1;
    const k = Math.max(0, Math.min(1, (s - cum[seg - 1]) / len));
    e.x = a.x + (b.x - a.x) * k;
    e.y = a.y + (b.y - a.y) * k;
    e.seg = seg;
    e.walked = s;
    this.emit('push', { enemy: e, from });
  }

  // ---------------------------------------------------------------- loop
  /**
   * Advance by `dt` real seconds. The Baton Pass prompt and the lane cooldowns count real time; the
   * rest of the world runs at `timeScale`, which eases down to bullet-time while a prompt is open.
   */
  update(dt) {
    if (this.state !== 'running') return;
    const r = this.rules;
    const goal = this.baton ? r.bulletTime : this.aiming ? r.summonSlow : 1;
    this.timeScale += (goal - this.timeScale) * (1 - Math.exp(-dt * r.bulletEase));
    if (Math.abs(goal - this.timeScale) < 1e-3) this.timeScale = goal;
    for (const k in this.laneCd) this.laneCd[k] = Math.max(0, this.laneCd[k] - dt);
    if (this.baton) {
      this.baton.t -= dt;
      if (this.baton.t <= 0) {
        this.baton = null;
        this.chain = 0;
        this.emit('batonExpire');
      }
    }
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      return;
    }
    dt *= this.timeScale;
    this.time += dt;
    this.cash += this.rules.income * dt;
    this.updateWaves(dt);
    if (this.state !== 'running') return;
    for (const z of this.zones) z.t -= dt;
    this.zones = this.zones.filter((z) => z.t > 0);
    for (const e of [...this.enemies]) this.updateEnemy(e, dt);
    for (const u of this.units) this.updateUnit(u, dt);
  }

  nextWave() {
    this.waveIdx++;
    if (this.waveIdx >= this.waves.length) return;
    const q = [];
    for (const grp of this.waves[this.waveIdx]) {
      for (let i = 0; i < grp.count; i++) q.push({ at: (grp.at ?? 0) + i * grp.gap, type: grp.type, path: grp.path });
    }
    q.sort((a, b) => a.at - b.at);
    this.spawnQueue = q;
    this.waveTimer = 0;
    this.breakT = null;
    this.emit('wave', { n: this.waveIdx + 1, total: this.waves.length, boss: q.some((s) => ENEMIES[s.type].boss), lanes: [...new Set(q.map((s) => s.path))] });
  }

  updateWaves(dt) {
    if (this.breakT != null) {
      this.breakT -= dt;
      if (this.breakT <= 0) this.nextWave();
      return;
    }
    this.waveTimer += dt;
    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.waveTimer) {
      const s = this.spawnQueue.shift();
      this.spawn(s.type, s.path);
    }
    if (!this.spawnQueue.length && !this.enemies.length) {
      if (this.waveIdx >= this.waves.length - 1) {
        this.state = 'won';
        this.baton = null;
        this.aiming = false;
        this.timeScale = 1;
        this.emit('won');
        return;
      }
      this.breakT = this.rules.waveBreak;
      this.emit('waveClear', { n: this.waveIdx + 1, total: this.waves.length, next: this.nextLanes });
    }
  }

  spawn(type, pathId) {
    const def = ENEMIES[type];
    const wp = this.wp[pathId];
    // tougher stages: HP scales fully, posture by the square root
    const ramp = this.hpRamp ? this.hpRamp[Math.max(0, Math.min(this.waveIdx, this.hpRamp.length - 1))] ?? 1 : 1;
    const k = this.hp * ramp;
    const maxHp = Math.round(def.hp * k);
    const maxPosture = Math.round(def.posture * Math.sqrt(k));
    const e = {
      uid: this.uid++, type, def, path: pathId, wp, seg: 1, maxHp, maxPosture,
      x: wp[0].x, y: wp[0].y, hp: maxHp, posture: maxPosture, down: 0, mark: 0, flash: 0,
      dirX: 1, dirY: 0, walked: 0, burn: null, stun: 0, slowT: 0,
    };
    this.enemies.push(e);
    this.emit('spawn', { enemy: e });
    return e;
  }

  updateEnemy(e, dt) {
    e.flash = Math.max(0, e.flash - dt);
    if (e.mark > 0) e.mark = Math.max(0, e.mark - dt);
    if (e.burn) {
      // Limelight's fire: damage accumulates and lands in 0.5 s ticks (one number per tick)
      const b = e.burn;
      b.t -= dt;
      b.acc += b.dps * dt;
      b.tick -= dt;
      if (b.tick <= 0 || b.t <= 0) {
        b.tick = 0.5;
        const dmg = b.acc;
        b.acc = 0;
        if (b.t <= 0) e.burn = null;
        this.damage(this.units.includes(b.src) ? b.src : null, e, dmg, 0, { dot: true });
        if (!this.enemies.includes(e)) return;
      }
    }
    if (e.slowT > 0) e.slowT = Math.max(0, e.slowT - dt);
    let slow = e.mark > 0 ? 1 - UNITS.oracle.mark.slow : 1;
    if (e.slowT > 0) slow = Math.min(slow, 0.5);
    for (const z of this.zones) {
      if (dist(e.x, e.y, z.x, z.y) > z.r) continue;
      slow = Math.min(slow, 1 - z.slow);
      this.igniteDps(this.units.includes(z.src) ? z.src : null, e, z.dps, 1.2);
    }
    if (e.down > 0) {
      e.down = Math.max(0, e.down - dt);
      if (e.down === 0) {
        e.posture = e.maxPosture;
        this.emit('recover', { enemy: e });
      }
      return;
    }
    if (e.stun > 0) {
      e.stun = Math.max(0, e.stun - dt);
      return;
    }
    let step = e.def.speed * slow * dt;
    while (step > 0 && e.seg < e.wp.length) {
      const t = e.wp[e.seg];
      const d = dist(e.x, e.y, t.x, t.y);
      if (d < 1e-6) {
        e.seg++;
        continue;
      }
      const m = Math.min(step, d);
      e.dirX = (t.x - e.x) / d;
      e.dirY = (t.y - e.y) / d;
      e.x += e.dirX * m;
      e.y += e.dirY * m;
      e.walked += m;
      step -= m;
      if (m === d) e.seg++;
    }
    if (e.seg >= e.wp.length) {
      this.removeEnemy(e);
      if (this.ward > 0) {
        this.ward--;
        this.emit('warded', { enemy: e });
        return;
      }
      this.treasure = Math.max(0, this.treasure - e.def.harm);
      this.emit('leak', { enemy: e, harm: e.def.harm });
      if (this.treasure <= 0) {
        this.state = 'lost';
        this.emit('lost');
      }
    }
  }

  removeEnemy(e) {
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
  }

  range(u) {
    return u.def.range + RANKS.range[u.rank - 1];
  }

  /** Prompter's cue: allies inside a Prompter's radius act faster. */
  cueMul(u) {
    let mul = 1;
    for (const p of this.units) {
      if (p === u || !p.def.cue) continue;
      if (dist(p.x, p.y, u.x, u.y) <= p.def.cue.radius) mul = Math.min(mul, p.def.cue.intervalMul[p.rank - 1]);
    }
    return mul;
  }

  stat(u) {
    const k = u.rank - 1;
    let dmg = u.def.dmg * RANKS.dmgMul[k];
    let posture = u.def.posture * RANKS.postureMul[k];
    let interval = u.def.interval * RANKS.intervalMul[k] * this.cueMul(u);
    for (const b of u.buffs) {
      dmg *= b.dmgMul || 1;
      posture *= b.postureMul || 1;
      interval *= b.intervalMul || 1;
    }
    return { dmg, posture, interval };
  }

  /** Target: the enemy furthest along its path within range. */
  target(u) {
    const r = this.range(u);
    let best = null;
    for (const e of this.enemies) {
      if (dist(u.x, u.y, e.x, e.y) > r) continue;
      if (!best || e.walked > best.walked) best = e;
    }
    return best;
  }

  updateUnit(u, dt) {
    for (const b of u.buffs) b.t -= dt;
    u.buffs = u.buffs.filter((b) => b.t > 0);
    u.moveCd = Math.max(0, u.moveCd - dt);
    if (u.def.heal) {
      // Prompter patches the Treasure
      u.healT += dt;
      const every = u.def.heal.every[u.rank - 1];
      if (u.healT >= every) {
        u.healT = 0;
        if (this.treasure < this.rules.treasureHp) {
          const amount = Math.min(u.def.heal.amount, this.rules.treasureHp - this.treasure);
          this.treasure += amount;
          this.emit('heal', { unit: u, amount });
        }
      }
    }
    u.cd -= dt;
    if (u.cd > 0) return;
    const tgt = this.target(u);
    if (!tgt) {
      u.cd = 0.05;
      return;
    }
    const s = this.stat(u);
    u.cd = s.interval;
    u.attacks++;
    u.facing = Math.atan2(tgt.y - u.y, tgt.x - u.x);
    this.emit('attack', { unit: u, enemy: tgt });
    this.damage(u, tgt, s.dmg, s.posture);
    if (u.def.splash) {
      for (const e of [...this.enemies]) {
        if (e !== tgt && dist(e.x, e.y, tgt.x, tgt.y) <= u.def.splash) {
          this.damage(u, e, s.dmg * 0.5, s.posture * 0.5);
          if (u.def.burn) this.ignite(u, e, 0.6);
        }
      }
    }
    if (u.def.burn && this.enemies.includes(tgt)) this.ignite(u, tgt, 1);
    if (u.def.mark && this.enemies.includes(tgt)) tgt.mark = u.def.mark.t;
  }

  ignite(u, e, k) {
    this.igniteDps(u, e, u.def.burn.dps * RANKS.dmgMul[u.rank - 1] * k, u.def.burn.t);
  }

  igniteDps(u, e, dps, t) {
    if (!this.enemies.includes(e)) return;
    if (e.burn && e.burn.dps > dps) {
      e.burn.t = Math.max(e.burn.t, t);
      return;
    }
    e.burn = { t: Math.max(t, e.burn?.t ?? 0), dps, acc: e.burn?.acc ?? 0, tick: e.burn?.tick ?? 0.5, src: u };
  }

  damage(u, e, dmg, posture, { raw = false, dot = false } = {}) {
    if (!this.enemies.includes(e)) return;
    // crit: striking a broken (DOWN) Shadow; weak: posture damage into an Oracle mark
    const crit = !raw && !dot && e.down > 0;
    const weak = e.down <= 0 && posture > 0 && e.mark > 0;
    if (!raw && e.down > 0) dmg *= this.rules.downDmgMul;
    e.hp -= dmg;
    if (!dot) e.flash = 0.1;
    if (e.down <= 0 && posture > 0) {
      const mul = weak ? UNITS.oracle.mark.postureMul : 1;
      e.posture -= posture * mul;
      if (e.posture <= 0) this.breakPosture(u, e);
    }
    this.emit('hit', { unit: u, enemy: e, dmg, crit, weak, raw, dot });
    if (e.hp <= 0) {
      this.removeEnemy(e);
      this.cash += e.def.reward;
      this.kills++;
      this.gainSp(this.rules.spKill);
      this.emit('kill', { enemy: e, unit: u });
    }
  }

  breakPosture(u, e) {
    e.posture = 0;
    e.down = this.rules.downTime;
    this.hitStop = this.rules.hitStop;
    this.gainSp(this.rules.spBreak);
    this.emit('break', { enemy: e, unit: u });
    if (u && this.units.includes(u)) {
      // 1 MORE: the breaker acts again immediately and may pass the baton.
      u.cd = 0;
      this.chain++;
      // Baton Pass prompt (bullet-time), at most one per lane every batonCooldown seconds
      const lane = e.path;
      let prompt = false;
      if (this.mech.has('baton') && this.units.length > 1 && !this.baton && !(this.laneCd[lane] > 0)) {
        this.baton = { from: u, t: this.rules.batonWindow, max: this.rules.batonWindow, lane };
        this.laneCd[lane] = this.rules.batonCooldown;
        prompt = true;
      }
      this.emit('oneMore', { unit: u, chain: this.chain, baton: prompt });
    }
  }
}

/** Running distance along a waypoint list: cum[i] = path length from the spawn to waypoint i. */
function cumulative(wp) {
  const out = [0];
  for (let i = 1; i < wp.length; i++) out.push(out[i - 1] + dist(wp[i - 1].x, wp[i - 1].y, wp[i].x, wp[i].y));
  return out;
}

export { CENTER };
