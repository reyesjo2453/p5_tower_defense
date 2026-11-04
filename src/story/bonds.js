// The Green Room: optional bond scenes between stages, two per cast member. Stars from the stages
// pay for them (BOND_COST in sim/data.js). Bond 1 unlocks the member's perk, bond 2 their second
// Persona skill. Same beat format as script.js. Each scene only opens once its member has joined
// (`after`: the CAMPAIGN index where they join) and, for the second, once the story has reached
// `after2`, so no scene spoils a twist that hasn't happened yet.
export const BOND_SCENES = {
  jester: {
    after: 0,
    after2: 11,
    title: ['THE CRACKED MIRROR', 'NAMES'],
    scenes: [
      [
        { title: 'GREEN ROOM', sub: 'THE CRACKED MIRROR' },
        { n: 'The mirror in the dressing room has a crack that runs exactly through the mask\'s left eye.' },
        { s: 'jester', t: 'Every time I look in here, I think I\'m about to remember something.' },
        { s: 'prompter', off: true, t: 'And then?' },
        { s: 'jester', t: 'Then I notice I\'m holding my breath, and I stop.' },
        { s: 'prompter', off: true, t: 'That\'s a skill, you know. Stopping right before the bad part. Performers call it timing.' },
        { s: 'jester', t: 'Then let\'s use it. If I can stop right before the bad part, I can strike right after it.' },
        { n: 'BOND 1 · ENCORE: Jester\'s own posture breaks give +4 SP.', fx: 'flash' },
      ],
      [
        { title: 'GREEN ROOM', sub: 'NAMES' },
        { s: 'kei', t: 'I used to write names on the cue sheet. Hers was always at the top. HIKARI, in red.' },
        { s: 'prompter', t: 'And yours?' },
        { s: 'kei', t: 'I never put mine on it. The person on the cue sheet is the one who can get it wrong.' },
        { s: 'prompter', t: 'Harlequin is a name, Kei. You put it on the sheet yourself.' },
        { s: 'kei', t: '...Then it can step instead of pushing. Feint the whole crowd, and let the others land it.' },
        { n: 'BOND 2 · HARLEQUIN learns MIRROR STEP: a wide feint that cracks every Shadow\'s posture.', fx: 'flash' },
      ],
    ],
  },
  queen: {
    after: 3,
    after2: 6,
    title: ['CASE FILE', 'THE KITCHEN TABLE'],
    scenes: [
      [
        { title: 'GREEN ROOM', sub: 'CASE FILE' },
        { n: 'Queen has spread forty days of notes across the dressing table: printouts, timestamps, a map stuck with red pins.' },
        { s: 'jester', t: 'You did all this alone?' },
        { s: 'queen', t: 'Nobody else believed it was a case. Thirty-nine nights of being told I was grieving wrong.' },
        { s: 'queen', t: 'So I trained. Every night after the stream, I hit the bag until my knuckles split. I am not walking into round one again.' },
        { n: 'BOND 1 · VETERAN: Queen deploys at Rank 2.', fx: 'flash' },
      ],
      [
        { title: 'GREEN ROOM', sub: 'THE KITCHEN TABLE' },
        { s: 'queen', t: 'Ren left his headphones on. I didn\'t take them off for a week. I thought if the stream ended in his ears, he\'d hear the end and come back.' },
        { s: 'oracle', t: 'That\'s... not how comas work.' },
        { s: 'queen', t: 'I know. I\'m a detective, not a doctor. Detectives ask one question at a time, and they don\'t stop.' },
        { s: 'queen', t: 'So VERDICT will stop asking the crowd. It will pick the guiltiest one and put everything into a single blow.' },
        { n: 'BOND 2 · VERDICT learns OBJECTION: one crushing hit on the toughest Shadow in the circle.', fx: 'flash' },
      ],
    ],
  },
  oracle: {
    after: 5,
    after2: 8,
    title: ['TWO MONITORS', 'THE LAST TEN SECONDS'],
    scenes: [
      [
        { title: 'GREEN ROOM', sub: 'TWO MONITORS' },
        { s: 'oracle', t: 'Okay, confession. I have two monitors. One is you guys. The other is still playing the stream.', fx: 'glitch' },
        { s: 'jester', t: 'Why?' },
        { s: 'oracle', t: 'Because if I can watch it AND watch you, I can see what it\'s about to do. Patterns. Tells. The house has tells.' },
        { s: 'oracle', t: 'I can hold a mark on them a little longer now. I\'ve learned where they flinch.' },
        { n: 'BOND 1 · LONG SCAN: Oracle\'s marks last 2 s longer.', fx: 'flash' },
      ],
      [
        { title: 'GREEN ROOM', sub: 'THE LAST TEN SECONDS' },
        { s: 'oracle', t: 'I turned the second monitor off.' },
        { s: 'queen', t: 'What changed?' },
        { s: 'oracle', t: 'I figured out what happens in the last ten seconds. Nothing. It just asks if you want to keep watching. That\'s the whole trap.' },
        { s: 'oracle', t: 'So I wrote something that says NO for me, really fast, for everyone on stage. Overclocked. Don\'t tell the doctors.' },
        { n: 'BOND 2 · SIGHTLINE learns OVERCLOCK: every Phantom on stage attacks much faster for 6 s.', fx: 'flash' },
      ],
    ],
  },
  prompter: {
    after: 7,
    after2: 11,
    title: ['THE NET', 'WHAT A PROMPTER IS FOR'],
    scenes: [
      [
        { title: 'GREEN ROOM', sub: 'THE NET' },
        { s: 'prompter', t: 'You know the net under the trapeze? Nobody claps for the net.' },
        { s: 'jester', t: 'Is that what you are?' },
        { s: 'prompter', t: 'Forty-five shows I\'ve watched from that box. I know every place the Treasure takes a hit. I\'ve started patching them in advance.' },
        { n: 'BOND 1 · SAFETY NET: the Treasure has 3 more HP.', fx: 'flash' },
      ],
      [
        { title: 'GREEN ROOM', sub: 'WHAT A PROMPTER IS FOR' },
        { s: 'kei', t: 'When this is over, what happens to you? You\'re my memories. Do you just... go back in?' },
        { s: 'prompter', t: 'A prompter isn\'t there to say the lines. A prompter is there so the actor doesn\'t have to be afraid of forgetting them.' },
        { s: 'prompter', t: 'If you remember, I\'m done. That\'s a good ending for a prompter. Now let me give the whole cast their cue at once.' },
        { n: 'BOND 2 · GHOSTLIGHT learns CUE LIGHT: Phantoms in the circle get a free Baton Pass buff.', fx: 'flash' },
      ],
    ],
  },
  limelight: {
    after: 9,
    after2: 13,
    title: ['SPARKLERS', 'THE LAST CUE'],
    scenes: [
      [
        { title: 'GREEN ROOM', sub: 'SPARKLERS' },
        { s: 'limelight', t: 'When I was little, somebody wrote my name in the air with a sparkler and set the curtains on fire.', fx: 'fire' },
        { s: 'queen', t: 'Who?' },
        { s: 'limelight', t: 'Someone I haven\'t seen in a long time. I told them it was the best effect I\'d ever seen. I think they never forgot it.' },
        { s: 'limelight', t: 'Fire doesn\'t scare me. It\'s the one thing in this theater that\'s honest about what it does.' },
        { n: 'BOND 1 · PYROTECHNICS: Limelight\'s burns deal 50% more damage.', fx: 'flash' },
      ],
      [
        { title: 'GREEN ROOM', sub: 'THE LAST CUE' },
        { s: 'hikari', t: 'Kei. The cue you fired too early. Do you want to know what I was going to do in that second?' },
        { s: 'kei', t: '...No.' },
        { s: 'hikari', t: 'I was going to bow. That\'s all. One more bow. You didn\'t take anything from me that mattered.' },
        { s: 'hikari', t: 'So I\'m going to do the bow now. With the biggest flare this house has ever seen.' },
        { n: 'BOND 2 · FLASHPAPER learns FINALE FLARE: an instant blast of fire that sets the circle burning.', fx: 'flash' },
      ],
    ],
  },
};
