// Skill behaviours. `start` returns extra data for the renderer (target positions, etc.).
import { dist } from '../core/util.js';

const pos = (e) => ({ x: e.x, y: e.y });

export const SKILLS = {
  // Joker: instant area slash around himself, grants DP.
  arsene_eiha: {
    start(b, u) {
      const targets = b.enemiesNear(u.x, u.y, 2.1);
      const fx = targets.map(pos);
      for (const e of targets) b.dealDamage(u, e, u.s.atk * 2.6, { type: 'magic', element: 'curse' });
      b.addDp(8);
      return { targets: fx, radius: 2.1 };
    },
  },

  // Skull: lightning from the sky on 3 enemies, then ATK up + chain lightning.
  kidd_thunder: {
    start(b, u) {
      const sorted = b.enemies.filter((e) => !e.dead).sort((a, c) => c.travel - a.travel).slice(0, 3);
      const fx = sorted.map(pos);
      for (const e of sorted) b.dealDamage(u, e, u.s.atk * 1.2, { type: 'magic', element: 'elec' });
      b.addBuff(u, { key: 'skill', atkMul: 1.45, t: 999, skill: true });
      u.chain = 2;
      return { targets: fx };
    },
    end(b, u) {
      u.chain = 0;
    },
  },

  // Panther: pillar of fire on the densest cluster in range + burn.
  carmen_agneyastra: {
    start(b, u) {
      const inR = b.enemiesInRange(u);
      let best = inR[0];
      let bestN = -1;
      for (const e of inR) {
        const n = b.enemiesNear(e.x, e.y, 1.6).length;
        if (n > bestN) { bestN = n; best = e; }
      }
      if (!best) return { targets: [] };
      const center = pos(best);
      const hit = b.enemiesNear(center.x, center.y, 1.6);
      for (const e of hit) {
        b.dealDamage(u, e, u.s.atk * 3.3, { type: 'magic', element: 'fire' });
        if (!e.dead) e.burn = { t: 5, tick: 0.5, dps: u.s.atk * 0.25, src: u };
      }
      return { targets: hit.map(pos), center, radius: 1.6 };
    },
  },

  // Mona: heal everyone, DEF buff, gust damages enemies.
  zorro_mediarama: {
    anywhere: true,
    start(b, u) {
      const allies = b.operators.map(pos);
      for (const o of b.operators) {
        b.heal(o, u.s.atk * 1.4, u);
        b.addBuff(o, { key: 'garu', defMul: 1.2, t: 8 });
      }
      const foes = b.enemies.filter((e) => !e.dead);
      const fx = foes.map(pos);
      for (const e of foes) b.dealDamage(u, e, u.s.atk * 0.9, { type: 'magic', element: 'wind' });
      return { targets: fx, allies };
    },
  },

  // Fox: attack speed up, ice element, slows.
  goemon_diamond: {
    start(b, u) {
      b.addBuff(u, { key: 'skill', intMul: 0.55, t: 999, skill: true });
      u.atkElement = 'ice';
      u.slowOnHit = true;
      return {};
    },
    end(b, u) {
      u.atkElement = u.def.element;
      u.slowOnHit = false;
    },
  },

  // Queen: charge, then massive nuke on the toughest enemy in range.
  anat_atomic: {
    start(b, u) {
      u.charging = true;
      const tgt = b.enemiesInRange(u).sort((a, c) => c.def.hp - a.def.hp)[0];
      u.lockTarget = tgt ? tgt.uid : null;
      return { targets: tgt ? [pos(tgt)] : [], charge: true };
    },
    end(b, u, silent) {
      u.charging = false;
      if (silent) return;
      let tgt = b.enemies.find((e) => e.uid === u.lockTarget && !e.dead);
      if (!tgt) tgt = b.enemiesInRange(u).sort((a, c) => c.def.hp - a.def.hp)[0];
      if (!tgt) return;
      const center = pos(tgt);
      const near = b.enemiesNear(center.x, center.y, 1.8);
      for (const e of near) {
        const mult = e === tgt ? 5.5 : 3.3;
        b.dealDamage(u, e, u.s.atk * mult, { type: 'magic', element: 'nuke', pierce: 0.5 });
      }
      b.emit({ t: 'impact', id: 'anat_atomic', x: center.x, y: center.y, radius: 1.8 });
    },
  },

  // Oracle: analyze every enemy.
  alazif_scan: {
    anywhere: true,
    start() {
      return {};
    },
    tick(b) {
      for (const e of b.enemies) {
        if (e.dead) continue;
        b.addBuff(e, { key: 'analyze', dmgTaken: 1.2, speedMul: 0.75, t: 0.6 });
      }
    },
  },

  // Noir: stun blocked enemies, DEF up, regen, counter.
  milady_aegis: {
    anywhere: true,
    start(b, u) {
      const blocked = b.enemies.filter((e) => u.blocking.has(e.uid));
      const fx = blocked.map(pos);
      for (const e of blocked) {
        b.dealDamage(u, e, u.s.atk * 1.5, { type: 'magic', element: 'bless' });
        e.stun = Math.max(e.stun, 1.5);
      }
      b.addBuff(u, { key: 'skill', defMul: 2, t: 999, skill: true });
      u.regenPct = 0.04;
      u.counter = 0.8;
      return { targets: fx };
    },
    end(b, u) {
      u.regenPct = 0;
      u.counter = 0;
    },
  },
};

export const _dist = dist; // keeps dist import tree-shake friendly for tests
