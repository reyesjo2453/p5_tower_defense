// Guided lessons, one short list per campaign chapter, narrated by the Prompter. Played by
// src/ui/tutorial.js. Every new mechanic is taught when it first appears, so the game introduces
// mechanics one chapter at a time.
//
// Step fields:
//   text       what the Prompter says (offstage until the Prompter is revealed in chapter III)
//   focus      what to spotlight: { sel: CSS selector } | { unit: unit id on the board } | null
//   when(c)    optional: the step waits (invisible) until this is true
//   until(c)   the step completes when this is true (c.seen has every event type since it began)
//   ms         or: auto-complete after this many ms
//   hold       freeze the simulation while the step is up (the player must act)
//   setup(c)   runs once when the step appears
// c = { game, state, seen: Set<event type>, flags }

const placed = (id) => (c) => !!c.game.onStage(id);

const curtainUp = { text: 'Raise the curtain when you\'re set.', focus: { sel: '.startbtn' }, until: (c) => c.game.state === 'running' };
const running = (c) => c.game.state === 'running';

export const LESSONS = {
  prologue: [
    { text: 'Drag JESTER onto one of the glowing plates beside the runway.', focus: { sel: '[data-unit="jester"]' }, until: placed('jester') },
    { text: 'The Shadows come in through that gate and walk the red runway to the Treasure. When you\'re ready, raise the curtain.', focus: { sel: '.startbtn' }, until: running },
    { text: 'See the yellow bar under each Shadow? That\'s its posture. Empty it.', ms: 5200 },
    { when: (c) => c.seen.has('oneMore'), text: 'It broke! That\'s a 1 MORE: Jester gets to act again right away. Breaks set your rhythm.', ms: 4800 },
    { when: (c) => c.seen.has('kill'), text: 'Every Shadow you drop pays out ¥. The house tips well.', ms: 3800 },
    { when: (c) => c.game.breakT != null, text: 'A short break between waves. If you\'re ready sooner, CALL brings the next wave now.', focus: { sel: '.wavechip .call' }, ms: 4800 },
  ],
  opening: [
    { text: 'Drag JESTER onto a plate. New stage, new runway.', focus: { sel: '[data-unit="jester"]' }, until: placed('jester') },
    {
      text: 'Rehearsal time. Tap JESTER on the board, then hit RANK UP. The house will front you the ¥.',
      focus: { unit: 'jester' },
      setup: (c) => {
        const j = c.game.onStage('jester');
        const cost = c.game.rankCost(j);
        if (cost != null && c.game.cash < cost) c.game.cash = cost;
      },
      until: (c) => c.game.units.some((u) => u.rank > 1),
    },
    { text: 'Rank 2: harder, faster, a little more reach. Spend your tips on rehearsals all show long.', ms: 4200 },
    curtainUp,
  ],
  noone: [
    { text: 'Deploy JESTER, then raise the curtain.', focus: { sel: '[data-unit="jester"]' }, until: placed('jester') },
    curtainUp,
    { text: 'Watch the SP gauge above your cards. Every posture break fills it.', focus: { sel: '.spbar .sp' }, ms: 4600 },
    {
      when: (c) => running(c) && c.game.enemies.length >= 2 && c.game.enemies.some((e) => e.walked > 4),
      text: 'Here they come. Tap NO ONE, then tap the runway in front of the crowd. Curtain Wind blows them all back.',
      focus: { sel: '.persona-btn[data-p="jester"]' },
      hold: true,
      setup: (c) => {
        const cost = c.game.onStage('jester')?.def.persona.cost ?? 30;
        c.game.sp = Math.max(c.game.sp, cost);
      },
      until: (c) => c.seen.has('summon') || c.game.sp < (c.game.onStage('jester')?.def.persona.cost ?? 30),
    },
    { text: 'That\'s a summon. Save SP for the moment a crowd gets too close to the Treasure.', ms: 4600 },
  ],
  unscripted: [
    { text: 'Drag QUEEN onto a plate. Her punches crack posture fast.', focus: { sel: '[data-unit="queen"]' }, until: placed('queen') },
    curtainUp,
    {
      when: (c) => !!c.game.baton,
      text: 'Time slows after a 1 MORE. Tap BATON PASS: the best-placed ally hits harder and faster for a while.',
      focus: { sel: '.baton-prompt' },
      hold: true,
      until: (c) => c.seen.has('baton') || !c.game.baton,
    },
    { when: (c) => c.seen.has('baton'), text: 'Baton Pass! It\'s optional: if the moment passes, nothing bad happens.', ms: 4200 },
    { when: (c) => c.game.sp >= 40, text: 'Queen brought a Persona too. VERDICT stuns everything in its circle.', focus: { sel: '.persona-btn[data-p="queen"]' }, ms: 4600 },
  ],
  twodoors: [
    { text: 'Two gates now. The yellow arrow marks where the next wave will come from. Put a Phantom near each runway.', ms: 6000 },
    curtainUp,
    { when: (c) => c.game.breakT != null, text: 'Between waves, check the gates again: the arrows move.', ms: 4200 },
  ],
  houselights: [
    { text: 'Deploy ORACLE. She has long range, so find a plate where she can see both runways.', focus: { sel: '[data-unit="oracle"]' }, until: placed('oracle') },
    curtainUp,
    { when: (c) => c.seen.has('weak'), text: 'Green means marked: slower, and their posture breaks easier. That\'s a WEAK! hit.', ms: 4800 },
  ],
  crosstalk: [
    { when: (c) => running(c) && c.game.sp >= 30, text: 'SIGHTLINE marks a whole crowd at once. Mark them, then break them.', focus: { sel: '.persona-btn[data-p="oracle"]' }, ms: 4800 },
  ],
  promptbox: [
    { text: 'Your turn to deploy ME. I patch the Treasure, and the Phantoms near me act faster.', focus: { sel: '[data-unit="prompter"]' }, until: placed('prompter') },
    curtainUp,
    { when: (c) => running(c) && c.game.treasure < c.game.rules.treasureHp - 2, text: 'Getting scratched up? GHOSTLIGHT patches the Treasure and wards off the next three hits.', focus: { sel: '.persona-btn[data-p="prompter"]' }, ms: 5200 },
  ],
  understudy: [
    { text: 'Deploy LIMELIGHT. Her fire splashes, and burning Shadows keep taking damage.', focus: { sel: '[data-unit="limelight"]' }, until: placed('limelight') },
    curtainUp,
    {
      when: (c) => running(c) && c.game.enemies.length >= 4 && c.game.waveIdx >= 1,
      text: 'A full SP gauge is an encore of its own: everyone on stage at once. ALL-OUT ATTACK!',
      focus: { sel: '.allout-btn' },
      hold: true,
      setup: (c) => { c.game.sp = c.game.rules.spMax; },
      until: (c) => c.seen.has('allout') || c.game.sp < c.game.rules.spMax,
    },
    { text: 'Spend SP on Personas, or save it all for an All-Out. Your call.', ms: 4400 },
  ],
  dress: [
    {
      when: (c) => c.game.units.length >= 2,
      text: 'Change your blocking: drag any Phantom to another plate (or tap it and hit MOVE). They need a moment to settle, then 8 s before they can move again.',
      until: (c) => c.seen.has('move'),
    },
    curtainUp,
  ],
};
