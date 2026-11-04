# Changelog

## 4.0.0 – Depth, progression and a full animation pass

**Fights**
- **Elemental affinities.** Every Phantom has an element: Jester slash, Queen strike, Oracle tech,
  Prompter light, Limelight fire. Every Shadow is weak to one element and may resist one.
  - A weak hit does 1.5× damage and 2× posture damage. A resisted hit does half.
  - Affinities show over a Shadow's head once they're known: Oracle marking that type,
    SIGHTLINE, or landing a weak hit reveals them. The save remembers them.
- **Four new Shadows**, each introduced in the story:
  - BOUNCER carries a shield that only weak hits can strip.
  - STAGEHAND heals the Shadows around it.
  - DOPPEL splits in two when it dies.
  - CRITIC is fast and fragile.
- **Mini-bosses** end Acts I and II: THE USHER (a big shield) and THE REVIEWER, whose bad reviews
  slow nearby Phantoms.
- **The Impresario has three phases.** At 66% it sends critics down every other runway. At 33% it
  calls a scene change: it steps back up the runway, steals 40 SP and walks faster. Each phase
  has its own lines.
- **Difficulty modes**: Story / Normal / Hard (Treasure HP, Shadow HP, starting ¥).
- **Stars**: 1–3 per stage by Treasure HP left.

**Progression**
- **Playbill**: replay any stage reached, keep your best stars, and rewatch any scene, including
  the ending.
- **Green Room**: stars pay for ten new bond scenes, two per cast member, unlocked as the story
  goes so nothing is spoiled early.
  - Bond 1 unlocks a perk: ENCORE, VETERAN, LONG SCAN, SAFETY NET, PYROTECHNICS.
  - Bond 2 unlocks a second Persona skill: MIRROR STEP, OBJECTION, OVERCLOCK, CUE LIGHT,
    FINALE FLARE. Choose skill A or B per Phantom.
- **Daily Rehearsal**: one seed and tier per calendar day with two modifiers (Rush, Heavy Set,
  Glass Crown, No Rehearsals, House Lights Down, Swarm). Your best stars for the day are kept.

**Presentation and animation**
- **Phantoms**:
  - afterimage trails on every dash;
  - every third melee swing is a leaping finisher with a bigger impact;
  - a rising, glowing cast pose when their Persona is summoned;
  - a hop when they receive a Baton Pass;
  - idle weight shifts and fidgets.
- **Shadows**:
  - they rise out of the floor when they spawn;
  - knockback and a flinch on every hit;
  - a gait per type (runners sprint leaning forward, heavies stomp, bosses sway);
  - a dazed wobble when stunned;
  - on death they're thrown back, the mask pops loose and spins away, and they sink into ink;
  - distinct silhouettes for each new type (riot shield, headset and glowing belt, two-tone mask,
    top hat and quill, usher's cap and torch, monocle).
- **Personas**: sleeves sweep open and strike down, a rune sigil turns on the floor, and the
  camera swings low around the summon.
- **Music**: the procedural groove changes key per act and follows the action, from a calm kick
  and snare to four-on-the-floor with brass when Shadows near the Treasure or a boss is on stage.
- **New sounds**: summon choir swell + gong, weakness ping, shield clank, boss brass hit.
- **Battle barks**: short speech bubbles from the cast and the bosses that never pause the fight.
- **Scene panels**: a slow push-in on the art and a print-texture overlay.

**Quality of life**
- **Pause menu** (resume, from the top, settings, title) and **Settings**: music and sound volume,
  difficulty, text size (S–XL), default game speed, a colour-blind palette and reduce motion (no
  shake, no camera swings, no looping effects).
- **Installable**: a web app manifest, icons and an offline service worker. Add it to the home
  screen and it plays full screen without a connection.

## 3.0.0 – Fifteen stages, Personas, one thing at a time

- **Fifteen story stages instead of eight one-wave chapters.** Each stage is its own map with 3–5
  waves and a short break between waves (CALL brings the next wave early). The story's twists are
  unchanged but spaced out, with seven new scenes between them (*Opening Night*, *No One*, *Two
  Doors*, *Crosstalk*, *The Green Room*, *Room 312*, *The Music Box*).
- **Procedurally generated stages** (`src/sim/stagegen.js`). Runways are generated from a seed and a
  difficulty tier, from long winding runways (easy) to short direct ones (hard), with 1–3 lanes
  that never touch. Story stages use fixed seeds, so everyone plays the same tested map.
- **A gentler start.** The first two stages are Jester alone on one lane. Summons are taught in
  stage 3, then a new cast member joins about every two stages. The second lane opens in stage 5
  and the third in stage 13.
- **Persona summons.** Posture breaks and kills fill a shared SP gauge. Tap a Persona, then tap the
  runway (time slows while you aim):
  - **NO ONE** (Jester): Curtain Wind pushes a crowd back down the runway. It becomes
    **HARLEQUIN**, and pushes further, once Jester remembers who he is.
  - **VERDICT** (Queen): Gavel Drop stuns a crowd and cracks its posture.
  - **SIGHTLINE** (Oracle): Spotlight marks a whole crowd.
  - **GHOSTLIGHT** (Prompter): patches the Treasure, wards off its next three hits and slows the circle.
  - **FLASHPAPER** (Limelight): a ring of fire that burns and slows anything crossing it.
- **Less to manage at once.**
  - The All-Out Attack is now the full-SP ultimate instead of a second meter.
  - Baton Pass aims itself: tap the prompt and the best-placed ally gets the buff.
  - Moving units waits for Act III.
- **Telegraphs**: the spawn gate the next wave will use lights up with a yellow arrow, and a wave
  counter shows progress.
- **Rehearsal mode** (from the title once you reach stage 3): a new random stage every run, in five
  tiers that open up as the story goes on.
- Later stages start with more ¥, so most of the cast can be fielded before the curtain.
- Baton Pass chains add +10% damage per link, capped at five links (the old uncapped chain made late
  stages trivial).
- `?stage=N` jumps to a campaign stage; `?rehearsal=T&seed=S` opens a Rehearsal; `?unlock=all`
  still opens the classic two-lane sandbox.
- Tests: generator invariants, every story stage winnable by the autoplayer and lost doing
  nothing, early stages forgiving, late stages lost without the mechanics or without rank-ups, and
  each Persona's effect. Saves from 2.x restart the story; the performance count carries over.

## 2.0.0 – ENCORE PROTOCOL: the story campaign

- **Story campaign** in three acts and eight chapters (`src/story/script.js`, played by `src/ui/story.js`):
  comic-panel scenes with the cast's cut-in art, typewriter speech boxes, narration captions,
  ransom-note title cards and shake / flash / glitch / fire beats. Tap to advance; SKIP ends a scene.
  The story is original. Its plot outline is in `docs/STORY.md` (spoilers).
- **The mechanics are part of the story.**
  - Losing resets the night "from the top" with a line from the Prompter, and a performance counter
    that never resets keeps track.
  - Rank-ups are rehearsals your body remembers.
  - Breaking a Shadow's posture sends one of the sleepers home.
  - The win screen's ENCORE is you.
- **Guided lessons** (`src/story/lessons.js`, `src/ui/tutorial.js`):
  - The Prompter coaches each new mechanic as its chapter introduces it, spotlighting the card,
    button or unit to use.
  - The first Baton Pass and the first All-Out hold time until you act.
  - Finished lessons are remembered.
- **Five unique Phantoms.** Each can be on stage only once, and the cast joins chapter by chapter.
  - **PROMPTER** (Support, `medic-*` art) patches the Treasure (green numbers) and quickens nearby allies.
  - **LIMELIGHT** (Caster, `caster-*` art) throws fire bursts that splash and leave Shadows burning.
- **Rank-ups** (★ to ★★★, ¥) raise damage, posture damage, attack speed and range, with a silver /
  gold floor aura.
- **Blocking**: drag a placed unit, or tap it and press MOVE, to move it to another plate. It takes a
  moment to settle, then waits 8 s before it can move again.
- **Pacing**: early chapters are short and slow. Shadow HP scales by chapter, and the waves and
  money are rebalanced around five units plus ranks. The balance tests still pass: the plan wins
  with the mechanics, and loses without them or without ranks.
- **Checkpoints and saves**: a loss restarts the current chapter. CONTINUE on the title resumes the
  saved chapter.
- **Pose art is in.** Jester, Queen and Oracle now fight with the uploaded `vanguard-` / `guard-` /
  `oracle-idle|windup|strike.png` frames: wind-up on ANTICIPATE, strike through LUNGE and HIT_STOP,
  and back to idle during the recoil. The frames are mirrored toward the target.
  - Each frame is cleaned at load (`cleanPose`): the next row's heads below the feet and slivers
    cut from neighbouring cells are dropped.
  - All frames share one crop: as wide as the widest frame, anchored at the idle pose's feet.
  - Any unit without pose art uses its keyed sprite. See `docs/ASSETS.md`.
- **All-Out Attack** shows one panel per Phantom on stage (up to five).
- `?unlock=all` opens a sandbox (whole cast, auto waves, no story). `?story=0` plays the campaign
  without scenes or lessons.

## 1.5.0 – Close-up camera, bullet-time Baton Pass, 2.5D combat feel

- **Camera** (`view.js` `CameraRig`):
  - The default shot sits ~30% closer than the whole-board fit, and the lens stays in the 32–40° range.
    On narrow screens the camera backs off rather than widening the FOV, and the haze thins to match.
  - Players can zoom with the wheel, a pinch or `+`/`-`, and pan with a two-finger or right-mouse drag
    or the arrow keys. Dragging a card to a screen edge also pans, and `0` resets the shot.
  - Zoom and pan are damped, clamped to the board and kept above a minimum distance from the floor.
  - When nobody has steered the camera for 4 s, it drifts toward the leading Shadows.
- **Bullet-time Baton Pass** (`sim/game.js`):
  - A Baton Pass prompt eases the simulation to 0.25× and back out again afterwards.
  - The prompt lasts 3.5 s of real time. A circular gauge and a bar show the time left, and both
    flash red near the end.
  - Comic speedlines frame the screen borders while time is slowed.
  - Each runway has a 9 s cooldown before it can open another prompt. A posture break during the
    cooldown still grants the 1-MORE.
- **Billboard attack state machine** (`spriteUnits.js`): IDLE → ANTICIPATE → LUNGE → HIT_STOP →
  OVERSHOOT_RECOIL.
  - ANTICIPATE (70 ms): crouch to 1.16 × 0.84 and lean back by −0.12 rad.
  - LUNGE (80 ms): an explosive snap of ~0.4 units toward the target.
  - HIT_STOP (60 ms): the attacker and its target freeze on the contact frame.
  - OVERSHOOT_RECOIL (140 ms): a damped spring back to the plate that dips slightly past rest.
- **Impact** (`combatEffects.js`):
  - The struck Shadow flashes over-bright white (`setRGB(2, 2, 2)`) for 35 ms.
  - Each landed melee hit kicks the camera 0.05 units along the attack direction, decaying over 90 ms.
  - A Shadow killed mid-lunge stays on the board until the blow lands.
- **Floating combat text** (`combatText.js`):
  - Damage numbers pop up with an elastic bounce, arc outward and fade over 650 ms. Physical hits
    are yellow/white and Oracle's are orange/red. A green heal style exists but nothing uses it yet.
  - **CRITICAL!** marks a hit on a downed Shadow, and **WEAK!** marks posture damage into an Oracle mark.
- **Threat ring**: tapping a placed unit projects a spinning, neon, dashed range ring onto the floor tiles.

## 1.4.0 – Clean billboards, combat cycle, BGM & SFX

- **Deploy cards**: the name, ¥ cost and role badge now sit in the bottom quarter over a dark,
  angled gradient. The art is anchored at the top, so faces, hair and eyes stay clear.
- **Cleaner billboards** (`keyout.js`):
  - border shards, speedlines and floating fragments are dropped;
  - black coats and hair that touched the backdrop are restored with a morphological closing;
  - thin streaks attached to the body are severed by a small opening.
  - The trimmed figure stands with its feet at `y = 0`, over a soft shadow and a flat ink silhouette.
- **Battlefield states** for billboard units:
  - a 180 ms drop-in from `y = 2.0` with a dust-ring shockwave on landing;
  - an 80 ms lunge (~0.35) toward the target, then a 40 ms impact (squash 1.15 × 0.85, flash and
    a comic slash / POW / tech burst at the contact point), then a 120 ms recoil with a settling bounce.
- **Background music** (`src/audio/bgmManager.js`):
  - streams `public/audio/bgm.mp3` when present;
  - otherwise plays a procedural 124 BPM acid-jazz / Shibuya-funk loop: shuffled hats, snare on 2 and 4,
    syncopated kick, a walking funk bass with slides, an FM Rhodes with tremolo on
    Dm9 → G13 → Cmaj7 → A7♯9, brass stabs and vibraphone chimes.
  - It fades in on the first tap and never restarts on deploys, waves or new games.
- **Sound effects** (`src/audio/sfxManager.js`) on their own bus: a card-tap blip, a placement
  swoosh and thud, a melee punch, and a magic / tech sweep.
- **Mute toggle** in the top-right HUD. The mute state and both volumes persist in `localStorage`.

## 1.3.1 – Asset aliases & keyed billboards

- **File-name aliases**: each unit also accepts its alias names, with `-` or `_`:
  - Jester: `vanguard-cutin.png` / `vanguard_cutin.png` (and `-sprite`, `-card`).
  - Queen: `guard-*`. Oracle: `tactician-*`.
  - HUD cards, the unit panel, deploy / 1-MORE / All-Out cut-ins and billboards all use them. Anything in `custom/` still wins.
- **Keyed billboards**: card-style art (opaque edges) is keyed at load for the board only:
  - uniform frame lines are stripped, then the near-black backdrop (max RGB < 18) is flood-filled away from the edges;
  - black enclosed by the figure survives, and stray text and stars are dropped.
  - Cards and cut-in overlays keep the full art. `SPRITE_KEY` in the manifest tunes or disables it.

## 1.3.0 – Billboard sprites & deploy cut-in

- **2D billboard units**: a unit with a PNG but no `.glb` stands on its plate as a paper cut-out.
  - It uses `<id>-sprite.png`, or else its cut-in PNG.
  - The PNG is alpha-trimmed and shown as a vertical-axis billboard 1.8 units tall, feet on the plate.
  - It has a white paper edge and a black ink outline.
- **Breathing idle**: a sine bob (±0.04) and scale pulse (±2%), with a ground shadow that pulses in size and opacity, plus an attack squash and flash.
- **Deploy cut-in**: placing a unit plays:
  - a diagonal torn band with sliced borders and speedlines;
  - the unit's cut-in art, plus red, green and yellow confetti;
  - a 150 ms impact shake (skipped for reduced motion).
- **Unit panel preview**: tapping a placed unit shows its portrait.
- `npm run smoke:assets` now also tests the PNG-only billboard path.

## 1.2.0 – Drop-in art pipeline

- **glTF unit models**: `public/models/{jester,queen,oracle}.glb`, with a git-ignored `custom/` override folder.
  - They are loaded with `GLTFLoader` and cloned per tower with `SkeletonUtils`, each with its own animation mixer for idle and attack clips.
  - Each model is `Box3`-normalized to 1.8 units with its feet at `y = 0`.
  - Materials are converted to the toon cel shader, and the ink outline follows skinned meshes.
- **PNG cut-ins**: per-unit card and cut-in PNGs plus a finisher PNG replace the SVG silhouettes when present.
- **Fallback chain**: `custom/` → base folder → built-in procedural figures and SVG silhouettes. A build-time asset index (Vite plugin) means no 404 probing, and missing files never break the build.
- **CC0 placeholder kit**: a rigged faceless mannequin and flat PNGs in `fixtures/placeholder-assets/`.
  - `npm run assets:placeholder` and `npm run assets:clean` install and remove them.
  - `npm run smoke:assets` runs the end-to-end check.

## 1.1.0 – Palace & comic art overhaul

- **Palace environment**:
  - A velvet `FogExp2` haze over a mirror-glossy marble checkerboard to the horizon, with a neon circuit matrix.
  - A neon skyline with gothic spires, giant wireframe roulette wheels, and hanging golden chains.
  - Gothic balustrades, pointed neon archways, and floating dice and calling cards.
- **Camera**:
  - Closer battle camera at (0, 9, 8) with an adaptive FOV.
  - Spring punch-in zoom with a −8° Dutch snap on 1-MORE and on Baton Pass.
  - An establishing shot of the Palace on the title and results screens.
- **Silhouettes**: hand-authored angular SVG silhouettes (Jester, Queen, Oracle, and a full-body leader hero) replace the 3D-render portraits.
- **1-MORE**: a torn-paper band with Ben-Day dots, converging speedlines and a burst-star badge.
- **ALL-OUT ATTACK**:
  - The panels get torn edges and speedlines.
  - The splash adds the leader hero, accent cuts, ink splatters, comic stars and fluttering calling cards.
- **HUD**:
  - Deploy cards are skewed −6° with jagged frames and yellow ¥ burst badges.
  - Bold slanted all-caps typography.

## 1.0.0 – 3D Phantom Showcase (Three.js rebuild)

- Replaced the 2D canvas game with a Vite + Three.js isometric 3D tower defense built for phones. The
  2D version stays in git history at `64bc6fb`.
- Cel-shading: toon ramp, hard specular, sharp rim light and inverted-hull outlines. Also a reflective
  obsidian floor, crimson runway with gold neon edges, spinning crown Treasure, bloom and a halftone shader.
- Jester, Queen and Oracle (original stylized figures), plus four Shadow types including a boss.
- Posture break with 80 ms hit-stop, mask shatter into gold shards and an ink eruption.
- 1-MORE screen-slice, Baton Pass with camera punch-in, and an ALL-OUT ATTACK cinematic (3-panel comic
  wipe, glass shatter, ransom-note splash, calling-card rain).
- Touch/drag controls, responsive HUD, adaptive resolution, and GitHub Pages deploy plus CI workflows.
- 12 simulation tests (including balance guard rails) and a mobile-viewport browser smoke test.

## 0.2.0 – Art & rendering pass

- **Post-processing pipeline** (`src/render/post.js`): every scene renders offscreen, then gets bloom
  (bright-pass + two blur radii), split-tone colour grading, contrast/saturation, chromatic aberration
  on impacts and skill cut-ins, a vignette, film grain and subtle scanlines. There are per-scene grades
  (title, battle, cutscene, menu).
- **Dynamic lighting** (`src/render/lighting.js`): the battle light map is driven by portals, every
  operator and Echo, and every hit, bolt, heal, death and skill. It multiplies the scene and adds glow.
- **2.5D battlefields**: pre-rendered, cached tile sets with raised high-ground blocks (bevels, cast
  shadows, emissive trims), glossy path floors with lit edges, themed props, animated Echo gates and
  safe-room beacons, energy flowing along enemy routes, and ambient motes.
- **New character art**: original Encore Protocol designs for all 8 operators and 3 story characters.
  They are cel-shaded busts with key light, coloured rim light, ink lines, hair highlights, six
  expressions, blinking and talking. The battle tokens are animated full-body chibis with class
  weapons, idle breathing, attack lunges and hit shakes.
- **New summoned spirits**: original light-built forms (Crimson Regalia, Storm Titan, Phoenix Bloom,
  Gale Ray, Frost Crane, Lattice Oracle, Bastion Queen, Orbital Lance, Grand Conductor).
- **Echoes**: glossy shaded shells, pulsing auras, smoke wisps and contact shadows.
- **Title screen**: light shafts, spirit reveal, drifting shards and a logo glint.
- **Graphics quality setting**: Auto (adapts to frame rate), High, Low and Off.

## 0.1.0 – Vertical slice

- Arknights-style tower defense core: DP economy, deploy + facing, blocking, ranged/melee tiles,
  redeploy cooldowns, retreat refunds, SP-driven skills.
- Persona-flavoured systems: elemental weaknesses, Stagger → DOWN, Baton Pass, Rush gauge and All-Out Rush.
- 8 playable Phantom Thieves, each with a unique animated skill, Persona silhouette and cut-in.
- 6 Echo types plus a mini-boss and a multi-phase boss (The Maestro, with his Encore revival).
- Chapter 1 "Replay": 3 stages, ~95 lines of original post-game story, 4 cinematics, mid-battle story beats.
- Procedural art, music and SFX; optional asset override manifest.
- 32 automated tests (data integrity, combat rules, skills, balance guard rails) and a browser smoke test.
