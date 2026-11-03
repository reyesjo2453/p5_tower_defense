// Deterministic tower-defense simulation. No DOM, no Three.js: the renderer reads state and
// drains `events` each frame. Time only advances through update(dt).
import { UNITS, ENEMIES, WAVES, RULES, CENTER } from './data.js';
import { buildBoard, waypoints } from './board.js';

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export class Game {
  constructor(opts = {}) {
    this.rules = { ...RULES, ...(opts.rules || {}) };
    this.waves = opts.waves || WAVES;
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
    this.state = 'ready'; // ready | running | won | lost
    this.hitStop = 0;
    this.baton = null; // { from, t } window to pass after a 1-MORE
    this.chain = 0;
    this.kills = 0;
    this.uid = 1;
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

  canPlace(type, x, y) {
    const def = UNITS[type];
    return !!def && this.state !== 'won' && this.state !== 'lost' && this.cash >= def.cost
      && this.board.slotSet.has(`${x},${y}`) && !this.unitAt(x, y);
  }

  place(type, x, y) {
    if (!this.canPlace(type, x, y)) return null;
    const def = UNITS[type];
    this.cash -= def.cost;
    const u = { uid: this.uid++, type, def, x, y, cd: 0.2, buffs: [], facing: 0, attacks: 0 };
    this.units.push(u);
    this.emit('place', { unit: u });
    return u;
  }

  sell(u) {
    const i = this.units.indexOf(u);
    if (i < 0) return;
    this.units.splice(i, 1);
    this.cash += Math.floor(u.def.cost * this.rules.sellRefund);
    if (this.baton?.from === u) this.baton = null;
    this.emit('sell', { unit: u });
  }

  unitAt(x, y) {
    return this.units.find((u) => u.x === x && u.y === y) || null;
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
    if (this.state !== 'running') return false;
    const d = this.downed;
    return d.length >= this.rules.allOutDowned || d.some((e) => e.def.boss);
  }

  /** Resolve the All-Out Attack (the renderer plays the cinematic first, then calls this). */
  allOut() {
    if (!this.allOutReady) return false;
    const r = this.rules;
    const hits = [];
    for (const e of [...this.enemies]) {
      const dmg = e.down > 0 ? r.allOutDmg + e.def.hp * r.allOutPct : r.allOutSplash;
      hits.push(e);
      this.damage(null, e, dmg, 0, { raw: true });
    }
    this.chain = 0;
    this.emit('allout', { hits });
    return true;
  }

  // ---------------------------------------------------------------- loop
  update(dt) {
    if (this.state !== 'running') return;
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      return;
    }
    this.time += dt;
    this.cash += this.rules.income * dt;
    this.updateWaves(dt);
    for (const e of [...this.enemies]) this.updateEnemy(e, dt);
    for (const u of this.units) this.updateUnit(u, dt);
    if (this.baton) {
      this.baton.t -= dt;
      if (this.baton.t <= 0) {
        this.baton = null;
        this.chain = 0;
        this.emit('batonExpire');
      }
    }
  }

  nextWave() {
    this.waveIdx++;
    if (this.waveIdx >= this.waves.length) return;
    const q = [];
    for (const grp of this.waves[this.waveIdx]) {
      for (let i = 0; i < grp.count; i++) q.push({ at: i * grp.gap, type: grp.type, path: grp.path });
    }
    q.sort((a, b) => a.at - b.at);
    this.spawnQueue = q;
    this.waveTimer = 0;
    this.emit('wave', { n: this.waveIdx + 1, total: this.waves.length, boss: q.some((s) => ENEMIES[s.type].boss) });
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
    const e = {
      uid: this.uid++, type, def, path: pathId, wp, seg: 1,
      x: wp[0].x, y: wp[0].y, hp: def.hp, posture: def.posture, down: 0, mark: 0, flash: 0,
      dirX: 1, dirY: 0, walked: 0,
    };
    this.enemies.push(e);
    this.emit('spawn', { enemy: e });
    return e;
  }

  updateEnemy(e, dt) {
    e.flash = Math.max(0, e.flash - dt);
    if (e.mark > 0) e.mark = Math.max(0, e.mark - dt);
    if (e.down > 0) {
      e.down = Math.max(0, e.down - dt);
      if (e.down === 0) {
        e.posture = e.def.posture;
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

  stat(u) {
    let dmg = u.def.dmg;
    let posture = u.def.posture;
    let interval = u.def.interval;
    for (const b of u.buffs) {
      dmg *= b.dmgMul || 1;
      posture *= b.postureMul || 1;
      interval *= b.intervalMul || 1;
    }
    return { dmg, posture, interval };
  }

  /** Target: the enemy furthest along its path within range (ties: lowest posture). */
  target(u) {
    let best = null;
    for (const e of this.enemies) {
      if (dist(u.x, u.y, e.x, e.y) > u.def.range) continue;
      if (!best || e.walked > best.walked) best = e;
    }
    return best;
  }

  updateUnit(u, dt) {
    for (const b of u.buffs) b.t -= dt;
    u.buffs = u.buffs.filter((b) => b.t > 0);
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
        if (e !== tgt && dist(e.x, e.y, tgt.x, tgt.y) <= u.def.splash) this.damage(u, e, s.dmg * 0.5, s.posture * 0.5);
      }
    }
    if (u.def.mark && this.enemies.includes(tgt)) tgt.mark = u.def.mark.t;
  }

  damage(u, e, dmg, posture, { raw = false } = {}) {
    if (!this.enemies.includes(e)) return;
    if (!raw && e.down > 0) dmg *= this.rules.downDmgMul;
    e.hp -= dmg;
    e.flash = 0.1;
    if (e.down <= 0 && posture > 0) {
      const mul = e.mark > 0 ? UNITS.oracle.mark.postureMul : 1;
      e.posture -= posture * mul;
      if (e.posture <= 0) this.breakPosture(u, e);
    }
    this.emit('hit', { unit: u, enemy: e, dmg });
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
      if (this.units.length > 1) this.baton = { from: u, t: this.rules.batonWindow };
      this.emit('oneMore', { unit: u, chain: this.chain });
    }
  }
}

export { CENTER };
