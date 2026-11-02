# Design

## Rules (src/sim)

| | |
| --- | --- |
| Board | 11×11 tiles. Two runways spiral from opposite gates to the Treasure at the centre (rotational symmetry). |
| Build plates | Any tile touching a runway (8-neighbourhood), except the 3×3 Treasure dais. |
| Economy | Start ¥130, +¥3/s, plus kill rewards. Selling refunds 50%. |
| Treasure | 20 HP. A leaking Shadow deals `harm` (1 / 3 / 10 for the boss). At 0 HP the curtain falls. |
| Targeting | The unit attacks whatever is furthest along its path within range. |
| Posture | Each hit removes posture. At 0 the Shadow **breaks**. |
| Break | 80 ms hit-stop. The mask shatters and the Shadow is **DOWN** for 2.6 s (no movement, ×1.5 damage taken), then posture refills. |
| 1-MORE | The breaking unit attacks again immediately and opens a 3.5 s **Baton** window. Each break in a row increases the chain. |
| Baton Pass | The receiver gets ×1.5 damage (+0.1 per chain), ×1.5 posture and ×0.6 attack interval for 6 s, and attacks now. |
| All-Out | Available while ≥3 Shadows are DOWN, or a downed boss. Downed Shadows take 520 + 40% of max HP; standing ones take 90. |

### Units

| | Cost | Range | Interval | Dmg | Posture | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Jester (Leader) | 50 | 1.85 | 0.55 s | 22 | 15 | Fast; the 1-MORE engine |
| Queen (Vanguard) | 70 | 1.55 | 0.85 s | 34 | 32 | 50% splash within 0.9 tiles |
| Oracle (Tactician) | 60 | 3.4 | 1.1 s | 12 | 6 | Marks for 3 s: −35% speed, ×1.6 posture damage taken |

### Shadows

| | HP | Posture | Speed | Harm |
| --- | --- | --- | --- | --- |
| Mannequin | 242 | 60 | 0.95 | 1 |
| Runner | 154 | 40 | 1.65 | 1 |
| Brute | 836 | 150 | 0.6 | 3 |
| Curtain Caller (boss) | 5720 | 420 | 0.42 | 10 |

### Balance guard rails (tests/sim.test.js)

A scripted bot plays the full 8-wave campaign with a sensible plan:

- With Baton Passes and All-Out Attacks it must **win**.
- With the same plan but no mechanics it must **lose**.
- Doing nothing must **lose**.

Re-run `npm test` after touching `src/sim/data.js`.

## Rendering (src/render)

- **Camera** (`CameraRig` in `view.js`): the default position is (0, 9, 8) looking at the origin with a −6° roll.
  `fit()` keeps that distance and widens the FOV (34–56°) until every build plate fits the free band between
  the HUD and the deck. Only past 56° does the camera back off. `setViewOffset` recentres the board in that
  band. `punch()` (1-MORE on the broken Shadow, rate-limited to one per 2.2 s, and the Baton receiver) drives the
  zoom and roll with springs, kicking past the −8° punch tilt so it lands with a snap. `est` blends to a low drifting
  establishing shot (title and results), including its own FOV.
- **Palace** (`palace.js`):
  - Sky: a gradient dome.
  - Floor: a 240 m `Reflector` under a translucent marble checkerboard (canvas texture), plus a neon circuit matrix of `LineSegments`.
  - Skyline: about 90 instanced towers with additive window textures, neon bands, gothic spires and antennas.
  - Three wireframe roulette wheels drawn in vertex-coloured lines.
  - Instanced golden chain links along catenaries and drops.
  - Instanced lathe balusters with merged rails, posts and neon finials.
  - Instanced pointed neon archways.
  - Floating dice (6 face textures) and calling cards.
  - The far backdrop skips the `FogExp2(0.025)` haze, which would otherwise swallow anything past about 50 m, so it reads as neon silhouettes against the horizon glow.
- **Toon materials** (`toon.js`): `MeshToonMaterial` with a 3-step `NearestFilter` ramp. `onBeforeCompile`
  injects, per directional light, a hard-edged Blinn specular (`smoothstep(0.45, 0.5, …)`) and a sharp
  lit-side rim (`smoothstep(0.62, 0.66, 1 − N·V)`). Ink outlines are inverted hulls (back faces offset along
  normals).
- **Arena** (`arena.js`):
  - A `Reflector` mirror sits under semi-transparent obsidian tiles (InstancedMesh).
  - The runway is instanced with emissive edge strips only where it borders open tiles.
  - Chevrons march toward the crown.
  - Gates and the dais complete the set.
- **Post** (`post.js`): RenderPass → UnrealBloom (threshold 1.15, so only emissive neon blooms) → OutputPass →
  halftone ShaderPass. The halftone is a 45° dot grid whose radius grows toward the corners and in very dark
  pixels, plus a slight crimson grade, vignette, flash and chromatic aberration.
- **FX** (`fx.js`): instanced pools for gold shards (they bounce), ink droplets (black or red per instance),
  sparks and calling cards (flutter, then lie flat). Short-lived slashes, rings and beams round it out.
- **Silhouettes** (`ui/silhouettes.js`): hand-authored polygon art (jester, queen, oracle, and the full-body
  leader for the splash). The layers are a white offset copy (rim light), an ink body, a red halftone pattern and
  white hatch strokes clipped to the body, then glowing gear (eye-slit, visor, holo glasses, particles).
  The art stays faceless. Each silhouette is served as an SVG data-URL so it works in `<img>` and can be drawn
  into the All-Out shatter canvas.
- **Comic kit** (`ui/comic.js`): deterministic generators for starbursts (SVG and CSS `clip-path`), ink
  splatters, speedline fields converging on a focal point, and torn-paper `polygon()` clip paths.
- **Cut-ins** (`ui/hud.js`, `ui/style.css`):
  - 1-MORE is a torn-paper band (white backing plus an ink band) with Ben-Day dots, a speedline field, the silhouette, a burst star and badge.
  - ALL-OUT starts with 3 skewed CSS panels.
  - The tap-time frame and the panels are then baked into a half-resolution canvas and broken into about 60 triangles that fly apart on a 2D overlay canvas.
  - The ransom-note letters are individually styled spans.

## Performance

- Everything numerous is instanced.
- The pixel ratio is capped at 2 on desktop and 1.5 on touch devices, and steps down while frames are slow.
- Bloom runs at half resolution.
- `?q=low` disables bloom, shadows and the reflector.
