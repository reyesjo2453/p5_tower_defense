# Assets policy

- This repo contains **no ripped, extracted or traced game assets**: no models, textures, music, fonts or
  UI art taken from any Persona game.
- Every model is built from Three.js primitives in `src/render/models.js`. The designs are original and
  stylized (faceless figures, masks, armor and a drone). They are not recreations of official character designs.
- UI fonts come from Google Fonts (Anton, Bebas Neue, Bodoni Moda, Courier Prime), all under the SIL OFL.
- Your own art (for example glTF models you made) can be dropped in through the pipeline below. Only add
  assets you have the rights to. The placeholder kit in `fixtures/placeholder-assets/` is original and
  CC0 (`scripts/make-placeholder-assets.mjs`).

## Drop-in art pipeline

The game ships with original procedural 3D figures (`src/render/models.js`) and SVG silhouettes
(`src/ui/silhouettes.js`). You can replace any of them with your own glTF models and PNG cut-ins
by dropping files into `public/`. Nothing is required: a missing or broken file falls back to the
built-in art, so the build never fails because of it.

> Only use art you have the rights to use (your own work, commissioned work, or CC0 or other
> licences that allow redistribution). Never add ripped game assets.

## Music

`public/audio/bgm.mp3` (or `.ogg` / `.m4a`, with a git-ignored `audio/custom/` override) is streamed and
looped when present. Without it, `src/audio/bgmManager.js` plays its own procedural acid-jazz
groove. Only add music you have the rights to redistribute.

## Where files go

| Folder | Committed? | Deployed from CI? | Use for |
|---|---|---|---|
| `public/models/custom/`, `public/portraits/custom/` | no (git-ignored) | no | private or local art; checked first |
| `public/models/`, `public/portraits/` | yes | yes | art you want to ship publicly |

Lookup order for every file: `custom/` first, then the base folder, then the built-in fallback.

## File names (`src/assets/manifest.js`)

| Unit (archetype) | Model | Standing sprite | Deploy card | Cut-in (deploy, 1-MORE, All-Out) |
|---|---|---|---|---|
| Jester (Leader) | `jester.glb` | `jester-sprite.png` | `jester-card.png` | `jester-cutin.png` |
| Queen (Vanguard) | `queen.glb` | `queen-sprite.png` | `queen-card.png` | `queen-cutin.png` |
| Oracle (Tactician) | `oracle.glb` | `oracle-sprite.png` | `oracle-card.png` | `oracle-cutin.png` |
| Prompter (Support) | `prompter.glb` | `prompter-sprite.png` | `prompter-card.png` | `prompter-cutin.png` |
| Limelight (Caster) | `limelight.glb` | `limelight-sprite.png` | `limelight-card.png` | `limelight-cutin.png` |
| Finisher splash ("THE SHOW'S OVER") | | | | `finisher.png` |

- **Aliases.** Each name also works with `_` instead of `-`, and with the unit's alias from
  `alias` in the manifest: Jester → `vanguard`, Queen → `guard`, Oracle → `tactician`,
  Prompter → `medic`, Limelight → `caster`. For example,
  `vanguard_cutin.png` works for Jester. Every name is tried in `custom/` before the base folder.
- On the board, each unit uses the first of: its `.glb` model → its standing sprite PNG → its
  cut-in PNG (while `SPRITE_FROM_CUTIN` is on) → the built-in procedural figure.

- A card falls back to its unit's cut-in PNG, and then to the SVG silhouette.
- `.gltf` with external textures also works. Keep the texture folder next to it and point the
  manifest at the `.gltf`.
- Use PNGs with a transparent background. The cut-ins are drawn with a white comic rim around
  the alpha edge, and tall portrait crops (about 2:3) read best.

## Pose art (attack frames for billboards)

A billboard unit can have three poses. With an idle pose it stands on that art. Its attack then
swaps to the wind-up frame while it crouches and to the strike frame through the lunge and contact,
and goes back to idle during the spring recoil.

| Pose | File (any alias works, `-` or `_`) | Shown during |
|---|---|---|
| Idle | `<id>-idle.png` | standing, breathing, recoil end |
| Wind-up | `<id>-windup.png` | ANTICIPATE (70 ms crouch) |
| Strike | `<id>-strike.png` | LUNGE, HIT_STOP and the first half of the recoil |

For example `vanguard-strike.png` works for Jester and `medic-windup.png` works for Prompter.

- Use **real PNGs with transparency**, not JPEGs renamed `.png`.
- Draw the **full body with feet**, and no card frame or painted background slashes.
- Use the **same canvas size for all three poses**, with the feet on the same pixel row. The idle
  pose's crop is reused for the other two so frames swap without jitter.
- Draw the character **facing right**; `SPRITE_TWEAKS.<id>.face` mirrors it toward the target.
- Any missing frame falls back to the idle pose, and a missing idle falls back to the sprite / cut-in.

## What happens to an imported model (`src/render/gltfUnits.js`)

1. **Load.** `GLTFLoader` loads each model once, at startup; the title screen waits for it.
2. **Normalize.** A precise `Box3` (skinned meshes are measured in their bound pose) scales the
   model to `MODEL_HEIGHT` (1.8 units), centres it on x/z and puts its lowest point at `y = 0`,
   so feet sit on the build plate whatever the authoring units or origin.
3. **Style.** Every material becomes the house `toon()` cel shader. Colour, map, normal map,
   emissive and alpha are kept. A world-space ink `outline()` is added; skinned meshes get a
   skinned shell, so the ink follows the animation.
4. **Instance.** Each tower is a `SkeletonUtils.clone()` of the template, with its own
   `AnimationMixer`:
   - The idle clip loops: the first clip matching `idle|stand|breath`, else the first clip.
   - The attack clip plays once per hit: the first clip matching `attack|slash|punch|strike|cast|shoot`.
   - On top of the clips, a short procedural lunge toward the target is added.
5. **Tweak.** Per-model fixes live in `MODEL_TWEAKS` in the manifest:
   - `yaw`, if the model doesn't face +Z.
   - `height`.
   - `idle` / `attack` clip-name patterns.

## What happens to a sprite unit (`src/render/spriteUnits.js`)

A unit with a PNG but no model stands on its plate as a 2D paper cut-out:

1. **Load and key.** `THREE.TextureLoader` loads the PNG. If its edges are mostly opaque (a
   rectangular card rather than a cut-out), a copy is keyed on a canvas (`src/render/keyout.js`)
   so only the figure stands on the board:
   - Uniform frame lines are stripped from each edge.
   - The near-black backdrop (max RGB below `SPRITE_KEY.threshold`, default 18) is flood-filled
     away from the edges. Black enclosed by the figure is kept.
   - Stray text and stars are dropped, keeping the main figure and any large detached parts.
     Pieces that touch the outer edge (border shards), long thin streaks (speedlines) and
     fragments floating away from the body are dropped too.
   - Black clothing or hair that touched the backdrop is restored: dark pixels inside a
     morphological closing of the figure come back.
   - A small morphological opening then severs thin speedlines that touch the body through a
     narrow neck. Thick comic slashes drawn over the figure stay; only a transparent
     `<id>-sprite.png` gets rid of those.
   - The HUD cards, unit panel and cut-in overlays still show the full card.
   - Art drawn on anything other than a black backdrop isn't keyed. For a clean figure, add a
     transparent `<id>-sprite.png`. Set `SPRITE_KEY.mode` to `false` to turn keying off.
2. **Trim.** Transparent margins are trimmed, so the lowest opaque pixel touches the plate and the
   plane hugs the art.
3. **Billboard.** A plane with `transparent: true, alphaTest: 0.1` turns on the vertical axis
   only to face the camera. That keeps it upright and grounded, unlike a screen-aligned
   `THREE.Sprite`, whose feet slide off the tile under a tilted camera.
   - It is `SPRITE_HEIGHT` (1.8) tall: the bottom is at `y = 0` and the centre at 0.9.
   - Behind it sit two silhouette layers, a white paper edge and a black ink outline.
   - On the floor, a soft ground shadow plus the silhouette laid flat in translucent ink.
4. **Animate.** Each frame, with a random phase per tower:
   - **Drop-in:** a newly placed unit falls from `y = 2.0` onto the plate over 180 ms, then
     lands with a dust ring shockwave, an ink puff, a small camera thump and the placement SFX.
   - **Idle:** `y = base + sin(t·3 + phase)·0.04` and `scale.y = 1 + sin(t·3 + phase)·0.02`,
     pivoting at the feet. The ground shadow shrinks and fades as the body rises.
   - **Attack:** lunge ~0.35 toward the target over 80 ms (0.12 for Oracle's ranged shot), then
     impact for 40 ms: squash to `1.15 × 0.85`, a brightness flash, a comic burst at the contact
     point and the hit SFX. Then a 120 ms recoil back to the plate with a light settling bounce.
     The sim applies damage on its own clock; only the visuals wait for the impact frame.
5. **Tweak.** `SPRITE_TWEAKS` in the manifest:
   - `height`, e.g. `1.1` for a small mascot-sized figure.
   - `breath`: the bob amplitude.
   - `face: 'right' | 'left'`: the way the art faces. When set, the sprite mirrors to face its target.
   - `lunge`: the default dash distance.
   - `key: { mode, threshold, close, sever }`: per-unit keying override (e.g. a higher threshold
     for noisy JPEG blacks, a larger `close` for more black clothing, `sever: 0` to keep thin details).

Placing a unit also plays the **deploy cut-in**:
- A diagonal torn band with sliced borders and speedlines.
- The unit's cut-in art, plus red, green and yellow confetti.
- A 150 ms screen shake (skipped when the player prefers reduced motion).

It never blocks input.

The folder index comes from a small Vite plugin (`scripts/asset-index-plugin.js`, exposed as
`virtual:asset-index`). The game knows which files exist without probing for 404s, and in
`npm run dev`, adding or removing a file reloads the page.

## Testing with the CC0 placeholders

`fixtures/placeholder-assets/` holds public-domain test art generated by
`scripts/make-placeholder-assets.mjs`:
- A rigged, faceless 13-bone mannequin per archetype, with `Idle` and `Attack` clips. It is
  deliberately authored in centimetres with the origin at the hips, so the normalizer has real work to do.
- Matching flat PNG cut-ins, card faces and a finisher image.

```bash
npm run assets:placeholder   # copy them into the custom/ folders (git-ignored)
npm run dev                  # see them in game
npm run assets:clean         # back to the built-in art
node scripts/placeholder-assets.cjs install sprites   # PNGs only: units stand as 2D billboards
npm run smoke:assets         # e2e test of both paths (glTF + PNGs, then PNG-only billboards), clean up
```

`window.__game.assets` reports which PNGs resolved and which models loaded or failed.
