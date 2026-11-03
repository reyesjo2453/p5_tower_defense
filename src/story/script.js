// ENCORE PROTOCOL: the story. Pure data, played by src/ui/story.js.
//
// One scene opens each campaign stage (keys = CAMPAIGN ids in sim/data.js), plus the ending.
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
// Rank-ups are rehearsals the body remembers, a Persona is the face you can stand to look at (Jester's
// is blank until he remembers), Blocking is refusing to stand where the script says, and the win
// screen's ENCORE is the player.

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

  opening: [
    { title: 'SCENE I', sub: 'OPENING NIGHT' },
    { n: 'The last Shadow folds in half and drops its mask. The mask rolls across the boards in a slow circle, like a coin that doesn\'t want to land.' },
    { s: 'audience', t: '...encore.', fx: 'red' },
    { s: 'jester', t: 'They\'re clapping. For what?' },
    { s: 'prompter', off: true, t: 'For you. Don\'t let it go to your head. It\'s a very small head under all that mask.' },
    { n: 'Something glints where the Shadow fell: a plastic hospital bracelet. The name has been scratched off. The ward number hasn\'t. Ward 3.' },
    { s: 'jester', t: 'Why would a Shadow wear a hospital bracelet?' },
    { s: 'prompter', off: true, t: '...Pick up the money instead. They tip in yen here, and the tips spend.' },
    { s: 'prompter', off: true, t: 'Tap yourself on the stage and buy a rehearsal: RANK UP. Funny thing about rehearsals. Your hands will remember steps your head never learned.' },
    { s: 'jester', t: 'How would you know what my hands remember?' },
    { s: 'prompter', off: true, t: 'Lucky guess. Places.' },
  ],

  noone: [
    { title: 'SCENE II', sub: 'NO ONE' },
    { n: 'The house lights stutter. Down the runway, the Shadows aren\'t walking anymore. They\'re running.', fx: 'shake' },
    { s: 'jester', t: 'There are too many. I can\'t cut them all down alone.' },
    { s: 'prompter', off: true, t: 'Then don\'t do it alone. Everyone in this theater wears a mask, and behind every mask there\'s a role. Yours has been waiting in the wings all night.' },
    { s: 'prompter', off: true, t: 'Every time you break a Shadow, the house roars. That roar is SP. Spend it, and call your role out onto the stage.' },
    { s: 'jester', t: 'Call it what? I don\'t even know my own name.' },
    { n: 'Something enormous unfolds behind him: a coat made of smoke, a crown made of nothing, and a mask with no face painted on it.', fx: 'flash' },
    { s: 'jester', t: '...Who are you?' },
    { n: 'It doesn\'t answer. It only tilts its blank head, the same way he does.', fx: 'dark' },
    { s: 'prompter', off: true, t: 'It doesn\'t have a name because you don\'t have one. Call it NO ONE for now. It still hits like someone.' },
  ],

  unscripted: [
    { title: 'SCENE III', sub: 'UNSCRIPTED' },
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
    { s: 'prompter', off: true, t: 'Lovely chemistry. When one of you breaks a Shadow, the moment slows down. Tap BATON PASS and the momentum goes to whoever can use it. A good show is a relay.' },
    { s: 'queen', t: '...And what is THAT?' },
    { s: 'jester', t: 'NO ONE. It\'s mine, I think.' },
    { s: 'queen', t: 'Mine is called VERDICT. At least mine has a face.' },
  ],

  twodoors: [
    { title: 'SCENE IV', sub: 'TWO DOORS' },
    { n: 'A second set of doors bangs open at the back of the house. Then the stage turns on its axis, and the whole set rebuilds itself around them.', fx: 'shake' },
    { s: 'queen', t: 'The stage moved.' },
    { s: 'jester', t: 'It does that between scenes. I think.' },
    { s: 'queen', t: 'Rooms don\'t rearrange themselves. Somebody is changing the set while we stand on it.' },
    { s: 'prompter', off: true, t: 'Stagehands. Very shy. Never seen, always working.' },
    { s: 'queen', t: 'Then the stagehands just gave them two ways in. We split up. One of us on each door.' },
    { s: 'jester', t: 'And if one door falls?' },
    { s: 'queen', t: 'Then you call that faceless thing of yours and blow them back out of it.' },
    { s: 'prompter', off: true, t: 'Watch the gates between waves. Whichever one lights up is where the next ones come from.' },
  ],

  // ------------------------------------------------------------------ ACT II · INTERMISSION
  houselights: [
    { title: 'ACT II', sub: 'INTERMISSION' },
    { title: 'SCENE V', sub: 'HOUSE LIGHTS' },
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

  crosstalk: [
    { title: 'SCENE VI', sub: 'CROSSTALK' },
    { s: 'oracle', t: 'Okay, real question. Detective. Why THIS case? Forty days is a lot of days.', fx: 'glitch' },
    { s: 'queen', t: '...My brother Ren watched it. Night twenty-six. He fell asleep at the kitchen table with his headphones still on.' },
    { s: 'queen', t: 'The doctors call it a coma. I call it a robbery. Something took him, and I\'m taking him back.' },
    { s: 'oracle', t: 'Oh. I\'m... sorry. I didn\'t mean to make it weird.' },
    { s: 'queen', t: 'Your turn. You know everything about the stream. How?' },
    { s: 'oracle', t: 'I haven\'t left my room in two years. I watch everything. I\'ve watched ENCORE every single night since it started.' },
    { s: 'jester', t: 'Every night? To the end?' },
    { s: 'oracle', t: 'No! Never to the end. I always skip the last ten seconds. It feels like a door closing behind me.' },
    { s: 'prompter', off: true, t: 'Good instinct. Keep it.' },
    { s: 'queen', t: 'Then you\'re in the audience, Oracle. Same as them.' },
    { s: 'oracle', t: '...That is a very creepy thing to say to the person helping you.', fx: 'glitch' },
    { s: 'audience', t: 'EN—CORE.', fx: 'shake' },
    { s: 'oracle', t: 'Two doors, lots of guests. VERDICT stops them cold, and my SIGHTLINE paints a whole crowd at once. Teamwork!' },
  ],

  promptbox: [
    { title: 'SCENE VII', sub: 'THE PROMPT BOX' },
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
    { s: 'prompter', t: 'Why do you think your hands knew how to rehearse? You\'ve done all this before. You just don\'t remember the other {perf} times.' },
    { s: 'prompter', t: 'Put me on stage. I\'ll patch the Treasure, and anyone standing near me will find their cues faster. And when it gets bad, GHOSTLIGHT will keep the Treasure safe for a few hits.' },
  ],

  greenroom: [
    { title: 'SCENE VIII', sub: 'THE GREEN ROOM' },
    { n: 'Between scenes, the Prompter leads Jester through a door nobody else noticed: a cramped dressing room with a cracked mirror and one bulb that won\'t stop buzzing.' },
    { s: 'jester', t: 'Every Persona out there has a face. Queen\'s has a crown. Oracle\'s has an eye. Mine has nothing.' },
    { s: 'prompter', t: 'A Persona is the face you can stand to look at. You haven\'t been able to look at yours for a long time.' },
    { s: 'jester', t: 'You keep talking like you know me.' },
    { s: 'prompter', t: 'I know the lines. That\'s a different thing.' },
    { n: 'Taped to the mirror is a photo: two kids on a rooftop, waving sparklers. One of the faces has been scratched out with a key.' },
    { s: 'jester', t: 'Who did that?' },
    { s: 'prompter', t: '...Somebody who didn\'t want to be in the picture anymore.', fx: 'dark' },
    { n: 'Through the wall, from the poster in the corridor, something hums a melody. It sounds like a music box winding down.' },
    { s: 'prompter', t: 'Back to work. The house gets cruel when it\'s kept waiting.' },
  ],

  understudy: [
    { title: 'SCENE IX', sub: 'UNDERSTUDY' },
    { n: 'The poster on the back wall, the one of the star of ENCORE, curls, browns, and catches fire.', fx: 'fire' },
    { s: 'limelight', t: 'Ugh. FINALLY. Do you know how long I\'ve been flattened into that poster?', fx: 'fire' },
    { s: 'oracle', t: 'Wait. You\'re HER. You\'re the girl from the stream!' },
    { s: 'limelight', t: 'I\'m the understudy. The real star never showed, so the show went on with me. That\'s what the Impresario said.' },
    { s: 'limelight', t: 'Those people in the seats? I sang for them until my voice cracked, and they kept screaming for more. So I\'m going to burn the house down.' },
    { s: 'prompter', t: 'Please don\'t burn the house down. Burn the audience a little.' },
    { s: 'limelight', t: '...Fine. A little.' },
    { s: 'queen', t: 'With five of us, we can hit them all at once.' },
    { s: 'prompter', t: 'Let the house roar until the SP gauge is full, and everyone goes on together. An All-Out Attack. The house always loves a finale.' },
    { s: 'limelight', t: 'And mine is FLASHPAPER. Draw a line on the floor and nothing crosses it without catching fire.' },
  ],

  // ------------------------------------------------------------------ ACT III · CURTAIN CALL
  dress: [
    { title: 'ACT III', sub: 'CURTAIN CALL' },
    { title: 'SCENE X', sub: 'DRESS REHEARSAL' },
    { s: 'oracle', t: 'Uh. Guys? I found a file in the stage manager\'s booth. It\'s the script for tonight.' },
    { s: 'oracle', t: 'Every line is in it: Queen dropping in, Limelight in the poster, what I\'m saying right now. "ORACLE: Uh. Guys?"', fx: 'glitch' },
    { s: 'queen', t: 'Then whoever wrote it is the ruler.' },
    { s: 'oracle', t: 'The cover says ENCORE. Written and directed by...' },
    { s: 'oracle', t: '...JESTER.', fx: 'red' },
    { s: 'jester', t: 'I don\'t remember writing anything.' },
    { s: 'queen', t: 'Of course you don\'t. How convenient.', fx: 'shake' },
    { s: 'limelight', t: 'Everyone stop. They\'re coming.' },
    { s: 'oracle', t: 'Wait, there\'s more. Stage directions. "JESTER stands at the second mark. QUEEN stands left." It even says where we stand.' },
    { s: 'prompter', t: 'Then stop standing where the script tells you to. Drag a Phantom to a new plate. Change your blocking. The show can\'t follow a script nobody\'s following.' },
    { s: 'prompter', t: 'Tonight we fight first and have the breakdown afterwards. Places.' },
  ],

  strike: [
    { title: 'SCENE XI', sub: 'STRIKE THE SET' },
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
    { s: 'kei', t: 'I remember now. All of it.' },
    { n: 'Behind him, the faceless Persona finally paints itself a face: a harlequin\'s grin, cracked down the middle and mended with gold.', fx: 'flash' },
    { s: 'jester', t: 'HARLEQUIN. Your name is HARLEQUIN.' },
    { s: 'prompter', t: 'There it is. Welcome back, Kei.' },
  ],

  room312: [
    { title: 'SCENE XII', sub: 'ROOM 312' },
    { s: 'oracle', t: 'I\'m in the hospital\'s camera system. Ward 3, Room 12. Putting it up on the big screen.', fx: 'glitch' },
    { n: 'The backdrop flickers into grainy security footage: a hospital bed, a girl asleep under a tangle of wires, and a boy in the chair beside her.' },
    { n: 'The boy has a phone in his hands. ENCORE is playing on it. His eyes are open, and he hasn\'t blinked once.' },
    { s: 'queen', t: '...Kei. That\'s you.' },
    { s: 'kei', t: 'I\'m here. I\'m standing right here.' },
    { s: 'prompter', t: 'You\'re in both places. The part of you on this stage keeps fighting for an ending. The part in that chair keeps pressing play.' },
    { n: 'In the next bed over, half out of frame, a boy sleeps in a school uniform with his headphones still around his neck.' },
    { s: 'queen', t: 'Ren.', fx: 'red' },
    { s: 'queen', t: 'He\'s in the same ward. They\'re ALL in that ward, aren\'t they? Three hundred and twelve beds.' },
    { s: 'oracle', t: 'The house knows we saw. Three doors are opening, all of them at once.', fx: 'shake' },
    { s: 'kei', t: 'Then we hold all three.' },
  ],

  musicbox: [
    { title: 'SCENE XIII', sub: 'THE MUSIC BOX' },
    { s: 'limelight', t: 'Kei.' },
    { s: 'kei', t: '...You knew too?' },
    { s: 'hikari', t: 'I\'m not the understudy. I\'m what\'s left of the star.' },
    { n: 'She lays her hand on the music box and opens it. It\'s empty.' },
    { s: 'hikari', t: 'This box has been empty all night. The Treasure was never in it. It\'s been standing next to you.' },
    { s: 'hikari', t: 'You think I\'m angry about the fire? I\'m angry that you stopped the show to keep me safe. A show is supposed to end. That\'s what makes it worth watching.' },
    { s: 'kei', t: 'If it ends, you go with it.' },
    { s: 'hikari', t: 'Maybe. Or maybe I wake up. You\'ll never know if you keep pressing play.' },
    { s: 'hikari', t: 'So guard me one more time, little brother. And then let me go.' },
  ],

  curtain: [
    { title: 'FINALE', sub: 'CURTAIN CALL' },
    { n: 'The music box stops. For one second, the whole house holds its breath.' },
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
