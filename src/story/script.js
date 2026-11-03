// ENCORE PROTOCOL: the story. Pure data, played by src/ui/story.js.
//
// One scene opens each campaign chapter (keys = CAMPAIGN ids in sim/data.js), plus the ending.
// Beat shapes:
//   { title, sub }                 title card (ransom-note slam)
//   { n }                          narration caption
//   { s, t, off?, fx? }            speech: speaker id, text, off = voice from offstage (no art)
// fx: 'shake' | 'flash' | 'glitch' | 'fire' | 'red' | 'dark'
// {perf} in any text is replaced with the current performance number.
//
// Spine (spoilers): the crew believes it is guarding a ruler's Treasure. Over the night they learn
// that the night loops; that the Shadows are the 312 sleepers themselves; that Jester wrote the
// show; that the Prompter is the memory Jester cut out of himself; and that the Treasure is
// Limelight, Jester's sister Hikari, whose fall at her last show he caused. The ruler is the
// Audience: everyone who wouldn't stop watching. Every mechanic is something the story says out loud:
// a posture break unmasks a sleeper, a 1-MORE is another chance, a loss is a loop ("from the top"),
// Rank-ups are rehearsals the body remembers, and the win screen's ENCORE is the player.

export const SPEAKERS = {
  jester: { name: 'JESTER', side: 'L', art: 'jester', color: '#ffffff' },
  kei: { name: 'KEI', side: 'L', art: 'jester', color: '#ffffff', unmasked: true },
  queen: { name: 'QUEEN', side: 'R', art: 'queen', color: '#ff1a3d' },
  oracle: { name: 'ORACLE', side: 'R', art: 'oracle', color: '#39ff88' },
  prompter: { name: 'PROMPTER', side: 'L', art: 'prompter', color: '#ffd400' },
  limelight: { name: 'LIMELIGHT', side: 'R', art: 'limelight', color: '#ff6a1a' },
  hikari: { name: 'HIKARI', side: 'R', art: 'limelight', color: '#ffb36a', unmasked: true },
  audience: { name: 'THE AUDIENCE', side: 'C', art: 'audience', color: '#e8002d' },
  impresario: { name: 'THE IMPRESARIO', side: 'C', art: 'impresario', color: '#e8002d' },
};

export const SCENES = {
  // ------------------------------------------------------------------ ACT I · OPENING NIGHT
  prologue: [
    { title: '11:59 PM', sub: 'EVERY SCREEN IN THE CITY' },
    { n: 'Every night at 11:59, every screen in the city plays the same stream at once: phones, billboards, the TV in a closed noodle shop. It runs four minutes, and nobody remembers pressing play.' },
    { n: 'There is a stage and a spotlight, and one word across the curtain: ENCORE.' },
    { n: '312 people have watched it to the end. None of them have woken up since.', fx: 'red' },
    { title: 'ACT I', sub: 'OPENING NIGHT' },
    { n: 'You open your eyes at center stage. There is a mask on your face, and you don\'t remember putting it on.' },
    { s: 'prompter', off: true, t: 'Psst. Down here, in the prompt box.' },
    { s: 'prompter', off: true, t: 'You\'ve forgotten your line again. Don\'t worry. Everyone does, here.' },
    { s: 'jester', t: '...Again?' },
    { s: 'prompter', off: true, t: 'Your line is: "Nothing leaves this stage."' },
    { s: 'audience', t: 'EN—CORE. EN—CORE. EN—CORE.', fx: 'shake' },
    { s: 'prompter', off: true, t: 'The house is restless. See the music box behind you? That\'s the Treasure, and they want it. If they take it, tonight never ends.' },
    { s: 'jester', t: 'Nothing leaves this stage.' },
    { s: 'prompter', off: true, t: 'Perfect delivery. Now, places, please.' },
  ],

  unscripted: [
    { title: 'SCENE I', sub: 'UNSCRIPTED' },
    { n: 'Something drops from the catwalk. Steel-toed boots hit the boards and crack them.', fx: 'shake' },
    { s: 'queen', t: 'Step away from the Treasure, thief.' },
    { s: 'jester', t: 'I\'m guarding it.' },
    { s: 'queen', t: 'Guards don\'t wear masks. I\'ve been tracking this stream for forty days. The man who runs this place calls himself the Impresario, and that box holds his heart.' },
    { s: 'queen', t: 'I steal it, his heart changes, and three hundred and twelve people wake up.' },
    { s: 'prompter', off: true, t: 'Bold. Wrong, but bold.' },
    { s: 'queen', t: 'Who said that?' },
    { s: 'audience', t: 'ENCORE!', fx: 'shake' },
    { s: 'queen', t: '...Those aren\'t his guards. They\'re coming for the box too.' },
    { s: 'jester', t: 'Then we hold it together. You can rob me afterwards.' },
    { s: 'queen', t: 'Deal. Afterwards.' },
    { s: 'prompter', off: true, t: 'Lovely chemistry. When one of you breaks a Shadow, the moment slows down. Use it to pass the momentum on. A good show is a relay.' },
  ],

  houselights: [
    { title: 'SCENE II', sub: 'HOUSE LIGHTS' },
    { s: 'oracle', t: '—testing, testing, is this thing on? Oh, it IS. Hi! You two are trending.', fx: 'glitch' },
    { s: 'queen', t: 'Who are you?' },
    { s: 'oracle', t: 'Remote support. I traced the stream so I could patch in. Bad news first: there\'s no server. The signal is coming out of a hospital bed.' },
    { s: 'oracle', t: 'Ward 3. Room 12.' },
    { s: 'jester', t: 'Three-twelve.', fx: 'red' },
    { s: 'queen', t: 'The same number as the sleepers.' },
    { s: 'oracle', t: 'Weird news next: there\'s no ruler. Every Palace has a ruler signature, and this one doesn\'t. It\'s like somebody is writing the place live.' },
    { s: 'oracle', t: 'Good news last: I can see their weak points. Anything I paint green breaks easier. You\'re welcome in advance.' },
    { s: 'prompter', off: true, t: 'Finally, a stage manager.' },
  ],

  // ------------------------------------------------------------------ ACT II · INTERMISSION
  promptbox: [
    { title: 'ACT II', sub: 'INTERMISSION' },
    { n: 'The little hatch at the lip of the stage creaks open.' },
    { s: 'prompter', t: 'Fine. FINE. Since you\'re all staring at the box anyway.' },
    { s: 'queen', t: '...It\'s a cat.' },
    { s: 'prompter', t: 'It\'s a PROMPTER. Someone has to remember the lines.' },
    { s: 'jester', t: 'You keep saying "again."' },
    { s: 'prompter', t: 'Because it is again. Every time the Treasure falls, the clock goes back to 11:59, and all of you forget. Everyone except me.' },
    { s: 'prompter', t: 'This is performance number {perf}.', fx: 'flash' },
    { s: 'oracle', t: 'That\'s not possible. My logs only go back one night.' },
    { s: 'prompter', t: 'Exactly one night. Every night.' },
    { s: 'queen', t: 'Then why tell us now?' },
    { s: 'prompter', t: 'Because you\'ve never made it this far before.' },
    { s: 'prompter', t: 'Your hands remember what your heads forget. Spend the house money and the rehearsals come back: rank up. And stop standing where you stood last time. Change your blocking.' },
    { s: 'prompter', t: 'I\'ll patch the Treasure from here. Don\'t make me patch it too often.' },
  ],

  understudy: [
    { title: 'SCENE IV', sub: 'UNDERSTUDY' },
    { n: 'The poster on the back wall, the one of the star of ENCORE, curls, browns, and catches fire.', fx: 'fire' },
    { s: 'limelight', t: 'Ugh. FINALLY. Do you know how long I\'ve been flattened into that poster?', fx: 'fire' },
    { s: 'oracle', t: 'Wait. You\'re HER. You\'re the girl from the stream!' },
    { s: 'limelight', t: 'I\'m the understudy. The real star never showed, so the show went on with me. That\'s what the Impresario said.' },
    { s: 'limelight', t: 'Those people in the seats? I sang for them until my voice cracked, and they kept screaming for more. So I\'m going to burn the house down.' },
    { s: 'prompter', t: 'Please don\'t burn the house down. Burn the audience a little.' },
    { s: 'limelight', t: '...Fine. A little.' },
    { s: 'queen', t: 'With five of us, we can hit them all at once.' },
    { s: 'prompter', t: 'When three of them are down at the same moment, everyone goes on together. An All-Out Attack. The house always loves a finale.' },
  ],

  // ------------------------------------------------------------------ ACT III · CURTAIN CALL
  dress: [
    { title: 'ACT III', sub: 'DRESS REHEARSAL' },
    { s: 'oracle', t: 'Uh. Guys? I found a file in the stage manager\'s booth. It\'s the script for tonight.' },
    { s: 'oracle', t: 'Every line is in it: Queen dropping in, Limelight in the poster, what I\'m saying right now. "ORACLE: Uh. Guys?"', fx: 'glitch' },
    { s: 'queen', t: 'Then whoever wrote it is the ruler.' },
    { s: 'oracle', t: 'The cover says ENCORE. Written and directed by...' },
    { s: 'oracle', t: '...JESTER.', fx: 'red' },
    { s: 'jester', t: 'I don\'t remember writing anything.' },
    { s: 'queen', t: 'Of course you don\'t. How convenient.', fx: 'shake' },
    { s: 'limelight', t: 'Everyone stop. They\'re coming.' },
    { s: 'prompter', t: 'Tonight we fight first and have the breakdown afterwards. Places.' },
  ],

  strike: [
    { title: 'SCENE VI', sub: 'STRIKE THE SET' },
    { s: 'jester', t: 'Prompter. You knew.' },
    { s: 'prompter', t: 'I\'m the last thing you wrote.' },
    { s: 'prompter', t: 'On loop twelve, you gave up. Failing you could survive. Remembering it, you couldn\'t.' },
    { s: 'prompter', t: 'So you cut the memories out, put them in a cat, and hid the cat in a box. That way someone would remember the lines, and you could keep trying.' },
    { n: 'The mask comes loose. Behind it is a seventeen-year-old who hasn\'t slept in forty-one days.', fx: 'dark' },
    { s: 'kei', t: 'My name is Kei Amane. Hikari is my sister. I ran the pyrotechnics at her shows.' },
    { s: 'kei', t: 'At her last one, I fired the cue a second too early.', fx: 'fire' },
    { s: 'kei', t: 'The clip got forty million views. Every comment said the same thing: ENCORE. ENCORE. ENCORE.' },
    { s: 'oracle', t: 'Room 312. That\'s Hikari Amane\'s bed.' },
    { s: 'kei', t: 'If the show ends, I\'m afraid she ends with it. So I wrote a show that never ends.' },
    { s: 'queen', t: 'And the sleepers?' },
    { s: 'prompter', t: 'Look at the seats, detective. Look at the masks you\'ve been breaking.' },
    { n: 'Under every shattered mask is a face: a salaryman, a night-shift nurse, a kid still in his school uniform.' },
    { s: 'queen', t: '...They\'re the sleepers. We\'ve been fighting the victims.' },
    { s: 'prompter', t: 'You\'ve been sending them home. Every Shadow you break remembers it has somewhere else to be. It just takes a few hundred tries.' },
  ],

  curtain: [
    { title: 'FINALE', sub: 'CURTAIN CALL' },
    { s: 'limelight', t: 'Kei.' },
    { s: 'kei', t: '...You knew too?' },
    { s: 'hikari', t: 'I\'m not the understudy. I\'m what\'s left of the star.' },
    { n: 'She lays her hand on the music box and opens it. It\'s empty.' },
    { s: 'hikari', t: 'This box has been empty all night. The Treasure was never in it. It\'s been standing next to you.' },
    { s: 'hikari', t: 'You think I\'m angry about the fire? I\'m angry that you stopped the show to keep me safe. A show is supposed to end. That\'s what makes it worth watching.' },
    { s: 'audience', t: 'NO. NO ENDINGS.', fx: 'shake' },
    { n: 'The seats empty. 312 masks lift into the air and stitch themselves into one shape: a top hat made of torn tickets and a smile made of applause.', fx: 'dark' },
    { s: 'impresario', t: 'WE ARE THE IMPRESARIO. WE PAID FOR AN ENCORE, AND WE WILL HAVE IT. FOREVER.', fx: 'shake' },
    { s: 'oracle', t: 'THERE\'S the ruler signature! It isn\'t one person. It\'s everyone who wouldn\'t stop watching.' },
    { s: 'kei', t: 'Prompter. What\'s my next line?' },
    { s: 'prompter', t: '...There isn\'t one. You never wrote an ending.' },
    { s: 'jester', t: 'Then I\'ll improvise.', fx: 'flash' },
  ],

  ending: [
    { n: 'The last mask breaks, and the applause stops. For the first time in forty-one nights, the house is quiet.' },
    { s: 'impresario', t: '...but we wanted... more...' },
    { s: 'hikari', t: 'I know. Thank you for watching. Go home.' },
    { n: 'One by one, the seats go dark.' },
    { title: '11:59 PM', sub: 'WARD 3 · ROOM 12' },
    { n: 'A heart monitor quickens. A hand twitches on the blanket.' },
    { n: 'In the chair beside the bed, a boy who hasn\'t slept in forty-one days is sleeping.' },
    { s: 'hikari', t: 'Kei. Wake up. You missed my cue.' },
    { n: 'Across the city, 312 people wake at once, and none of them can remember the dream.' },
    { title: 'THE SHOW\'S OVER', sub: '' },
    { n: 'Three nights later, at 11:59, every screen in the city lights up again. The stream has a new title: ENCORE, starring THE PHANTOM SHOWCASE.', fx: 'red' },
    { n: 'Viewers: 1' },
    { s: 'prompter', off: true, t: 'Psst. You. Yes, you, holding the screen. You\'ve been watching the whole time.' },
    { s: 'prompter', off: true, t: 'So. Do you want an encore?' },
  ],
};

/** Prompter's line when the Treasure falls (the loop resets). Picked by performance number. */
export const LOOP_LINES = [
  'And... curtain. From the top.',
  'Performance {perf}. You were better last time. Places.',
  'I\'ll remember that one for you. Again.',
  'Every show stumbles in rehearsal. From the top.',
  'They wanted an encore. Let\'s give them a better one.',
];

/** Performance number the story starts counting from (the Prompter has seen 45 before you). */
export const FIRST_PERFORMANCE = 46;
