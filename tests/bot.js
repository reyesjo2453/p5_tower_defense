// A simple autoplayer for balance tests: deploys the cast in story order on the plates that see the
// most runway, buys rehearsals with spare ¥, passes batons, summons Personas onto the Shadow that is
// furthest along and fires the All-Out Attack when the gauge is full.
import { UNITS } from '../src/sim/data.js';

const ORDER = ['jester', 'queen', 'oracle', 'prompter', 'limelight'];

export function bestSlot(g, type) {
  const r = UNITS[type].range;
  // how well each lane is already covered: a lane nobody watches is worth much more

  const laneTiles = {};
  for (const lane of g.lanes) laneTiles[lane] = laneRunway(g, lane);
  const watched = {};
  for (const lane of g.lanes) watched[lane] = g.units.reduce((n, u) => n + reach(laneTiles[lane], u.x, u.y, g.range(u)), 0);

  let best = null;
  let score = -1;
  for (const s of g.board.slots) {
    if (g.unitAt(s.x, s.y)) continue;
    let sc = 0;
    for (const lane of g.lanes) sc += reach(laneTiles[lane], s.x, s.y, r) / (1 + watched[lane] * 0.5);
    // a little bias toward the Treasure end: Shadows there are the urgent ones
    sc -= Math.hypot(s.x - 5, s.y - 5) * 0.05;
    if (sc > score) {
      score = sc;
      best = s;
    }
  }
  return best;
}

function laneRunway(g, lane) {
  const out = [];
  const wp = g.wp[lane];
  for (let i = 1; i < wp.length; i++) {
    const a = wp[i - 1];
    const b = wp[i];
    const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) out.push([a.x + Math.sign(b.x - a.x) * k, a.y + Math.sign(b.y - a.y) * k]);
  }
  return out;
}

function reach(tiles, x, y, r) {
  let n = 0;
  for (const [a, b] of tiles) if (Math.hypot(a - x, b - y) <= r) n++;
  return n;
}

/**
 * Play `g` to the end. opts: place / ranks / batons / summons / allOut toggles. Returns the state.
 */
export function autoplay(g, { place = true, ranks = true, batons = true, summons = true, allOut = true, maxT = 1500 } = {}) {
  const dt = 1 / 30;
  const deploy = () => {
    if (!place) return;
    for (const type of ORDER) {
      if (!g.unlocked.has(type) || g.onStage(type)) continue;
      if (g.cash < UNITS[type].cost) return; // keep saving for the next in line
      const s = bestSlot(g, type);
      if (s) g.place(type, s.x, s.y);
    }
    if (!ranks) return;
    const cand = g.units.map((u) => [u, g.rankCost(u)]).filter(([, c]) => c != null).sort((a, b) => a[1] - b[1]);
    if (cand.length && g.cash >= cand[0][1] && ORDER.every((t) => !g.unlocked.has(t) || g.onStage(t))) g.rankUp(cand[0][0]);
  };
  deploy();
  g.start();
  for (let t = 0; t < maxT && g.state === 'running'; t += dt) {
    deploy();
    if (batons && g.baton) g.batonPass();
    if (allOut && g.allOutReady && g.enemies.length >= 3) g.allOut();
    else if (summons && g.mech.has('summon') && g.enemies.length) {
      const lead = g.enemies.reduce((a, e) => (e.walked > a.walked ? e : a));
      const len = g.pathLen[lead.path].at(-1);
      // hold SP for the All-Out once it exists, unless a Shadow is about to reach the Treasure
      const reserve = g.mech.has('allout') && lead.walked < len * 0.8 ? g.rules.spMax : 0;
      if (lead.walked > len * 0.5) {
        for (const u of g.units) {
          const p = u.def.persona;
          if (g.sp >= p.cost && (reserve === 0 || g.sp >= reserve) && g.summon(u.type, lead.x, lead.y)) break;
        }
      }
    }
    g.update(dt);
    g.drain();
  }
  return g.state;
}
