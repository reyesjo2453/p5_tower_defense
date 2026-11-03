// Deterministic tower-defense simulation. No DOM, no Three.js: the renderer reads state and
// drains `events` each frame. Time only advances through update(dt).
//
// Campaign: one wave per story chapter (data.js CAMPAIGN). Each chapter unlocks its cast member and
// mechanics; with `campaign: true` the game stops in 'intermission' after a wave so the story can
// play, and resumes on next(). checkpoint() / `opts.checkpoint` restart a chapter ("from the top").
import { UNITS, ENEMIES, WAVES, RULES, RANKS, CAMPAIGN, ALL_MECHANICS, CENTER } from './data.js';
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
   * opts: { rules, waves, campaign (bool: pause between waves), unlockAll (bool: every unit and
   * mechanic from the start; tests / sandbox), checkpoint (from checkpoint(): resume a chapter) }
   */
  constructor(opts = {}) {
    this.rules = { ...RULES, ...(opts.rules || {}) };
    this.waves = opts.waves || WAVES;
    this.campaignMode = !!opts.campaign;
    this.unlockAll = !!opts.unlockAll;
    this.board = buildBoard();
    this.cash = this.rules.startCash;
    this.treasure = this.rules.treasureHp;
    this.units = [];
    this.enemies = [];
    this.events = [];
    this.time = 0;
    this.waveIdx = -1; // -1 = not started
    this.spawnQueue = [];
    this.waveTimer = 0;
    this.state = 'ready'; // ready | running | intermission | won | lost
    this.hitStop = 0;
    this.baton = null; // { from, t, max, lane } window to pass after a 1-MORE
    this.laneCd = {}; // lane (path id) -> seconds until it may open another Baton Pass prompt
    this.timeScale = 1; // eases to rules.bulletTime while a prompt is open (bullet-time)
    this.chain = 0;
    this.kills = 0;
    this.uid = 1;
    this.unlocked = new Set();
    this.mech = new Set();
    this.applyUnlocks(0);
    const cp = opts.checkpoint;
    if (cp) {
      this.waveIdx = cp.waveIdx - 1; // start() steps into the checkpoint chapter
      this.applyUnlocks(cp.waveIdx);
      this.cash = cp.cash;
      this.treasure = cp.treasure;
      this.kills = cp.kills ?? 0;
      for (const s of cp.units) {
        const u = this.makeUnit(s.type, s.x, s.y);
        u.rank = s.rank ?? 1;
        u.spent = s.spent ?? UNITS[s.type].cost;
        this.units.push(u);
        this.emit('place', { unit: u, restored: true });
      }
    }
  }

  applyUnlocks(i) {
    if (this.unlockAll) {
      this.unlocked = new Set(Object.keys(UNITS));
      this.mech = new Set(ALL_MECHANICS);
      return;
    }
    const before = new Set(this.unlocked);
    const { units, mech } = unlocksAt(i);
    this.unlocked = units;
    this.mech = mech;
    const fresh = [...units].filter((u) => !before.has(u));
    if (fresh.length && before.size) this.emit('join', { units: fresh });
  }

  /** The chapter being played, or about to be (before start / during an intermission). */
  get chapter() {
    const i = this.state === 'ready' || this.state === 'intermission' ? this.waveIdx + 1 : this.waveIdx;
    return CAMPAIGN[Math.max(0, Math.min(i, CAMPAIGN.length - 1))];
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

  /** Campaign: leave the intermission and raise the curtain on the next chapter. */
  next() {
    if (this.state !== 'intermission') return;
    this.state = 'running';
    this.nextWave();
  }

  /** Restart point for the current chapter (taken as each wave begins). */
  checkpoint() {
    return this.lastCheckpoint ?? null;
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

  /** After a 1-MORE, hand the momentum to another unit. */
  batonPass(target) {
    if (!this.baton || !target || target === this.baton.from || !this.units.includes(target)) return false;
    const b = this.rules.baton;
    target.buffs = target.buffs.filter((x) => x.key !== 'baton');
    target.buffs.push({ key: 'baton', t: b.t, dmgMul: b.dmgMul + this.chain * 0.1, postureMul: b.postureMul, intervalMul: b.intervalMul });
    target.cd = 0;
    this.emit('baton', { from: this.baton.from, to: target, chain: this.chain });
    this.baton = null;
    return true;
  }

  get downed() {
    return this.enemies.filter((e) => e.down > 0);
  }

  get allOutReady() {
    if (this.state !== 'running' || !this.mech.has('allout')) return false;
    const d = this.downed;
    return d.length >= this.rules.allOutDowned || d.some((e) => e.def.boss);
  }

  /** Resolve the All-Out Attack (the renderer plays the cinematic first, then calls this). */
  allOut() {
    if (!this.allOutReady) return false;
    const r = this.rules;
    const hits = [];
    for (const e of [...this.enemies]) {
      const dmg = e.down > 0 ? r.allOutDmg + e.maxHp * r.allOutPct : r.allOutSplash;
      hits.push(e);
      this.damage(null, e, dmg, 0, { raw: true });
    }
    this.chain = 0;
    this.emit('allout', { hits });
    return true;
  }

  // ---------------------------------------------------------------- loop
  /**
   * Advance by `dt` real seconds. The Baton Pass prompt and the lane cooldowns count real time; the
   * rest of the world runs at `timeScale`, which eases down to bullet-time while a prompt is open.
   */
  update(dt) {
    if (this.state !== 'running') return;
    const r = this.rules;
    const goal = this.baton ? r.bulletTime : 1;
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
    for (const e of [...this.enemies]) this.updateEnemy(e, dt);
    for (const u of this.units) this.updateUnit(u, dt);
  }

  nextWave() {
    this.waveIdx++;
    if (this.waveIdx >= this.waves.length) return;
    this.applyUnlocks(this.waveIdx);
    const q = [];
    for (const grp of this.waves[this.waveIdx]) {
      for (let i = 0; i < grp.count; i++) q.push({ at: (grp.at ?? 0) + i * grp.gap, type: grp.type, path: grp.path });
    }
    q.sort((a, b) => a.at - b.at);
    this.spawnQueue = q;
    this.waveTimer = 0;
    this.lastCheckpoint = {
      waveIdx: this.waveIdx, cash: this.cash, treasure: this.treasure, kills: this.kills,
      units: this.units.map((u) => ({ type: u.type, x: u.x, y: u.y, rank: u.rank, spent: u.spent })),
    };
    this.emit('wave', { n: this.waveIdx + 1, total: this.waves.length, boss: q.some((s) => ENEMIES[s.type].boss), chapter: CAMPAIGN[this.waveIdx]?.id });
  }

  updateWaves(dt) {
    this.waveTimer += dt;
    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.waveTimer) {
      const s = this.spawnQueue.shift();
      this.spawn(s.type, s.path);
    }
    if (!this.spawnQueue.length && !this.enemies.length) {
      if (this.waveIdx >= this.waves.length - 1) {
        this.state = 'won';
        this.emit('won');
        return;
      }
      if (this.campaignMode) {
        this.state = 'intermission';
        this.baton = null;
        this.timeScale = 1;
        this.applyUnlocks(this.waveIdx + 1); // the next cast member joins during the intermission
        this.emit('waveClear', { n: this.waveIdx + 1, chapter: CAMPAIGN[this.waveIdx]?.id });
        return;
      }
      this.breakT = (this.breakT ?? this.rules.waveBreak) - dt;
      if (this.breakT <= 0) {
        this.breakT = undefined;
        this.nextWave();
      }
    }
  }

  spawn(type, pathId) {
    const def = ENEMIES[type];
    const wp = waypoints(pathId);
    // later chapters toughen the house: HP scales fully, posture by the square root
    const k = this.rules.hpScale[Math.max(0, Math.min(this.waveIdx, this.rules.hpScale.length - 1))] ?? 1;
    const maxHp = Math.round(def.hp * k);
    const maxPosture = Math.round(def.posture * Math.sqrt(k));
    const e = {
      uid: this.uid++, type, def, path: pathId, wp, seg: 1, maxHp, maxPosture,
      x: wp[0].x, y: wp[0].y, hp: maxHp, posture: maxPosture, down: 0, mark: 0, flash: 0,
      dirX: 1, dirY: 0, walked: 0, burn: null,
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
    if (e.down > 0) {
      e.down = Math.max(0, e.down - dt);
      if (e.down === 0) {
        e.posture = e.maxPosture;
        this.emit('recover', { enemy: e });
      }
      return;
    }
    const slow = e.mark > 0 ? 1 - UNITS.oracle.mark.slow : 1;
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
      this.treasure = Math.max(0, this.treasure - e.def.harm);
      this.removeEnemy(e);
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
    if (!this.enemies.includes(e)) return;
    const dps = u.def.burn.dps * RANKS.dmgMul[u.rank - 1] * k;
    if (e.burn && e.burn.dps > dps) {
      e.burn.t = u.def.burn.t;
      return;
    }
    e.burn = { t: u.def.burn.t, dps, acc: e.burn?.acc ?? 0, tick: e.burn?.tick ?? 0.5, src: u };
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
      this.emit('kill', { enemy: e, unit: u });
    }
  }

  breakPosture(u, e) {
    e.posture = 0;
    e.down = this.rules.downTime;
    this.hitStop = this.rules.hitStop;
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

export { CENTER };
