# Game Design

Encore Protocol is a lane-based tower defense in the mould of *Arknights*, re-skinned with the
Phantom Thieves' combat language: weaknesses, knock-downs, baton passes and all-out attacks.

## Core loop

1. Enemies ("Echoes") spawn at an **Echo Gate** and walk a fixed route to the **Safe Room**.
2. You spend **DP (Deploy Points)** to place operators. DP regenerates at 1/s (Oracle adds +0.12/s).
3. Operators attack, block, heal or support. Each has a **skill** that charges SP and is fired manually.
4. Reach the end of the wave list with at least 1 life. Stars = lives left (3 / 2 / 1).

Losing a life: every Echo that reaches the Safe Room costs its `lifeCost` (1 for most, 2 for the
Conductor, 3 for the Maestro).

## Tiles

| Tile | Meaning |
| --- | --- |
| `p` path | Enemies walk here. **Melee** classes deploy here and **block**. |
| `h` high ground | **Ranged** classes (caster, sniper, artillery, medic, support) deploy here. |
| `#` | Blocked. |
| `S` / `E` | Spawn / goal (path tiles). |

Maps are generated from route waypoints (`src/data/stages.js`): high ground is any non-path tile touching the path.

## Deploying

Pick a card → pick a valid tile → drag/move to choose facing → click. The game slows to 12% speed while
you place. Facing rotates the operator's range footprint (`range` offsets are authored facing right).
Retreat refunds half the cost and starts the normal redeploy cooldown. A **defeated** operator takes 1.5×
the cooldown.

## Classes

| Class | Role | Blocks |
| --- | --- | --- |
| Vanguard | Cheap, generates DP (Joker: +1 DP per kill) | 2 |
| Guard | Heavy melee damage | 2 |
| Defender | Huge DEF, wall | 3 |
| Caster | Magic damage (ignores DEF, hits RES) | – |
| Sniper | Fast physical (gun) fire, long range | – |
| Artillery | Slow area blasts | – |
| Medic | Heals the most wounded ally in range | – |
| Support | Debuffs enemies, grants economy | – |

## Damage model

- **Physical**: `max(ATK − DEF, 5% ATK)`. **Magic**: `ATK × (1 − RES%)`, floor 5%. **True**: ignores both.
- Elements: Phys, Gun (physical) and Fire, Ice, Elec, Wind, Psy, Nuke, Bless, Curse (magic).
- **Weakness** ×1.3 damage and adds Stagger. **Resist** ×0.6.
- **Stagger**: each weakness hit adds 34 (scaled per enemy). A full bar → **DOWN**: the Echo is stunned
  for 3s, takes ×1.35 damage, fills the Rush gauge, then is immune to Stagger for 7s. Bosses stagger slower.
- **Analyzed** (Oracle): +20% damage taken, −25% speed. **Burn**, **Slow**, **Stun** are simple timed statuses.

## Persona systems

- **Baton Pass**: when any operator fires a skill, every ally within 1.6 tiles gets ATK +20% for 6s,
  +6 SP, and the Rush gauge gains 6 (+2 per ally).
- **Rush gauge**: filled by DOWNs (+12, bosses +8) and Baton Passes. At 100 the **All-Out Rush** button
  lights up. It hits every Echo for the combined ATK of all deployed operators (×1.4, 70% pierce),
  knocks regular Echoes DOWN and staggers bosses.

## Operators and skills

| Operator | Class | Persona | Skill (animated) |
| --- | --- | --- | --- |
| Joker | Vanguard | Arsène | **Eiha Rebellion**: Arsène erupts, X-slashes everything nearby, +8 DP |
| Skull | Guard | Captain Kidd | **Thunder Reign**: sky lightning on 3 Echoes, ATK up, chain lightning |
| Panther | Caster | Carmen | **Agneyastra**: telegraphed pillar of fire on the densest cluster, Burn |
| Mona | Medic | Zorro | **Mediarama Gale**: screen-wide gale heals/shields allies and cuts Echoes |
| Fox | Sniper | Goemon | **Diamond Dust**: katana spin, attack speed up, Ice, slows |
| Oracle | Support | Al Azif | **Full Scan**: radar sweep + hex grid, all Echoes Analyzed |
| Noir | Defender | Milady | **Gran Aegis**: axe slam stuns blockers, DEF ×2, regen, counter |
| Queen | Artillery | Johanna | **Atomic Overdrive**: reticle + charge, then a nuke on the toughest Echo |

Each skill has (1) a full-screen cut-in (`src/render/cutin.js`), (2) a unique in-world effect
(`src/render/skillfx.js`), and (3) a pure-logic handler (`src/sim/skills.js`).

## Echoes

| Echo | Behaviour | Weak to |
| --- | --- | --- |
| Loop Echo | Basic walker | Fire, Wind |
| Skip Hound | Fast, fragile | Ice, Wind |
| Wall of Sound | Armoured, resists Phys | Elec, Nuke |
| Mute Seer | Ranged magic, outranges melee, high RES | Gun, Phys |
| Conductor Echo (mini-boss) | Summons Loop Echoes every 12s | Curse, Psy |
| The Maestro (boss) | Crescendo AoE + adds, **Encore** revival at 0 HP (45% HP, faster) | Bless, Psy |

## Stages

| Stage | Teaches | Notes |
| --- | --- | --- |
| 1-1 Last Train Loop | Deploying, blocking, weaknesses, skills | Tutorial tips, 3 starting operators |
| 1-2 Static Between Stations | Two routes, ranged enemies, armour | Unlocks Oracle, Noir |
| 1-3 Overture of Regret | Boss prep, Rush gauge, positioning vs Seers | Conductor, then the Maestro |

## Balance guard rails

`tests/sim.test.js` runs scripted "players" through every stage: each must be winnable with a sensible
plan and must **fail** if you do nothing. Re-run `npm test` after touching any number in `src/data/`.

## Architecture

```
src/sim/      Pure, deterministic game logic. No DOM. Emits events.
src/render/   Canvas drawing: field, characters, summoned spirits, skill FX, cut-ins, cinematics,
              lighting (light map) and post (bloom / grade / aberration / grain).
src/scenes/   Title, hub, battle (input/HUD), cutscene player, roster, settings.
src/data/     Operators, enemies, stages, story, procedural "looks".
src/core/     Audio synth, assets loader, save data, math utils.
```

The sim is the single source of truth; the renderer only consumes `battle.events`
(`deploy`, `shot`, `dmg`, `down`, `skill`, `baton`, `allout`, `scene`, ...). This keeps combat testable
headlessly and makes a different renderer (or real sprite/Spine art) a drop-in change.

### Render pipeline (v0.2)

1. The scene draws into an offscreen 1280×720 buffer (`Post.begin()`).
2. In battle, the animated backdrop comes first, then the **cached static field**. That is the 2.5D
   tile set built once per stage: raised high-ground blocks with bevels and cast shadows, glossy path
   floors with emissive edges, and themed props.
3. Next come the animated layers: portals, route energy, overlays, depth-sorted units with contact
   shadows, FX and ambient motes.
4. **Light map** (`lighting.js`): a half-resolution buffer is filled with the theme's ambient colour.
   Lights are added from portals, units and `Fx.lights()`, and the result multiplies the scene. Light
   cores are then re-added additively.
5. **Post** (`post.js`) applies, in order:
   - contrast and saturation, with chromatic aberration while the screen shakes or a cut-in starts;
   - split-tone grade;
   - bloom (a quarter/eighth-resolution bright pass blurred with `ctx.filter`, composited with `lighter`);
   - vignette with baked scanlines;
   - film grain.
6. Quality: `auto` starts on `high` and steps down to `low` (no bloom or grain) and then `off` if the
   frame time stays above about 26 ms. Users can pin a level in Settings.
