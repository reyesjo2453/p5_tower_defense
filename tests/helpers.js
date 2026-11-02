// Shared test helpers: a tiny scripted "player" that drives the headless simulation.
import { Battle } from '../src/sim/battle.js';
import { STAGE_BY_ID } from '../src/data/stages.js';

/**
 * Run a stage with standing deployment orders.
 * plan: [{ at: seconds, id: 'joker', c, r, dir }] - each order is (re)issued whenever the operator is
 * off the field, affordable and off cooldown (like a player redeploying fallen operators).
 * Skills fire as soon as they are ready and badly hurt operators are retreated. Returns the finished Battle.
 */
export function runPlan(stageId, squad, plan, { maxTime = 420, autoSkill = true, autoRush = true, retreatBelow = 0.25 } = {}) {
  const b = new Battle(STAGE_BY_ID[stageId], squad);
  const orders = [...plan].sort((a, c) => a.at - c.at);
  const dt = 1 / 30;
  while (b.state === 'running' && b.time < maxTime) {
    for (const o of orders) {
      if (o.at > b.time) break;
      const idx = b.cards.findIndex((c) => c.id === o.id);
      if (idx >= 0 && !b.cards[idx].unit && b.canDeploy(idx, o.c, o.r)) b.deploy(idx, o.c, o.r, o.dir);
    }
    for (const u of [...b.operators]) if (retreatBelow && u.hp < u.def.hp * retreatBelow) b.retreat(u);
    if (autoSkill) for (const u of b.operators) if (b.canSkill(u)) b.activateSkill(u);
    if (autoRush && b.canAllOut()) b.useAllOut();
    b.update(dt);
    b.takeEvents();
  }
  return b;
}
