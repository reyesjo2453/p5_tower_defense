# Changelog

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
