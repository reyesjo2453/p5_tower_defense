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

export const LESSONS = {
  prologue: [
    { text: 'Drag JESTER onto one of the glowing plates beside the runway.', focus: { sel: '[data-unit="jester"]' }, until: placed('jester') },
    { text: 'When you\'re ready, raise the curtain: hit START.', focus: { sel: '.startbtn' }, until: (c) => c.game.state === 'running' },
    { text: 'See the yellow bar under each Shadow? That\'s its posture. Empty it.', ms: 5200 },
    { when: (c) => c.seen.has('oneMore'), text: 'It broke! That\'s a 1 MORE: Jester gets to act again right away. Breaks set your rhythm.', ms: 4800 },
    { when: (c) => c.seen.has('kill'), text: 'Every Shadow you drop pays out ¥. The house tips well.', ms: 3800 },
  ],
  unscripted: [
    { text: 'Drag QUEEN onto a plate. Her punches crack posture fast.', focus: { sel: '[data-unit="queen"]' }, until: placed('queen') },
    { text: 'Raise the curtain when you\'re set.', focus: { sel: '.startbtn' }, until: (c) => c.game.state === 'running' },
    {
      when: (c) => !!c.game.baton,
      text: 'Time slows after a 1 MORE. Tap the OTHER Phantom to pass the baton: they\'ll hit harder and faster.',
      focus: { unit: 'baton-target' },
      hold: true,
      until: (c) => c.seen.has('baton') || !c.game.baton,
    },
    { when: (c) => c.seen.has('baton'), text: 'Baton Pass! Keep the breaks coming and the chain keeps growing.', ms: 4200 },
  ],
  houselights: [
    { text: 'Deploy ORACLE. She has long range, so give her a plate where she can see both runways.', focus: { sel: '[data-unit="oracle"]' }, until: placed('oracle') },
    { text: 'Raise the curtain.', focus: { sel: '.startbtn' }, until: (c) => c.game.state === 'running' },
    { when: (c) => c.seen.has('weak'), text: 'Green means marked: slower, and their posture breaks easier. That\'s a WEAK! hit.', ms: 4800 },
  ],
  promptbox: [
    { text: 'Your turn to deploy ME. I patch the Treasure, and the Phantoms near me act faster.', focus: { sel: '[data-unit="prompter"]' }, until: placed('prompter') },
    {
      text: 'Rehearsal time. Tap JESTER on the board, then hit RANK UP. The house will front you the ¥.',
      focus: { unit: 'jester' },
      setup: (c) => {
        const j = c.game.onStage('jester') || c.game.units[0];
        const cost = c.game.rankCost(j);
        if (cost != null && c.game.cash < cost) c.game.cash = cost;
      },
      until: (c) => c.game.units.some((u) => u.rank > 1),
    },
    { text: 'Now change your blocking: drag any Phantom to another plate (or tap it and hit MOVE). They need a moment to settle, and then 8 s before they can move again.', until: (c) => c.seen.has('move') },
    { text: 'Raise the curtain.', focus: { sel: '.startbtn' }, until: (c) => c.game.state === 'running' },
  ],
  understudy: [
    { text: 'Deploy LIMELIGHT. Her fire splashes, and burning Shadows keep taking damage.', focus: { sel: '[data-unit="limelight"]' }, until: placed('limelight') },
    { text: 'Raise the curtain.', focus: { sel: '.startbtn' }, until: (c) => c.game.state === 'running' },
    {
      when: (c) => c.game.allOutReady,
      text: 'Three of them are down at once. Everyone on stage: ALL-OUT ATTACK!',
      focus: { sel: '.allout-btn' },
      hold: true,
      until: (c) => c.seen.has('allout') || !c.game.allOutReady,
    },
  ],
};
