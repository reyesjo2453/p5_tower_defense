# Assets & Legal

## What this repo ships

Everything on screen and in your ears is generated at runtime from original code:

- Portraits, tokens, Echoes, summoned spirits: `src/render/characters.js`, `personas.js`, `echoes.js`.
  The operator designs (`src/data/looks.js`) and spirits are **original designs** made for this project.
  The procedural pipeline will not imitate official character art; that stays your call via the override below.
- Lighting and post-processing: `src/render/lighting.js`, `src/render/post.js`.
- Backgrounds and cinematics: `backgrounds.js`, `cinematics.js`.
- Music and SFX: `src/core/audio.js` (WebAudio synth).

## What it does *not* ship (and why)

Official *Persona 5* art, models, UI, logos, music and voice lines are copyrighted by ATLUS / SEGA.
**Do not extract or copy them into this project, even for private use**; this repo is designed so you never need to.
The game is intended to be playable, and shareable, without them.

## Plugging in your own art

Create `assets/manifest.json`:

```json
{
  "images": {
    "portrait.joker": "assets/portraits/joker.png",
    "portrait.maestro": "assets/portraits/maestro.png",
    "bg.crossing_dusk": "assets/backgrounds/crossing_dusk.jpg"
  }
}
```

| Key | Used for | Recommended size |
| --- | --- | --- |
| `portrait.<id>` | Dialogue busts, cut-ins, tokens, cards. Transparent PNG, bottom-centre anchored. | ~1000×1400 |
| `bg.<key>` | Cutscene & battle backgrounds (`crossing_dusk`, `station_platform`, `attic_night`, `train_interior`, `loop_void`, `static_tunnel`, `palace_gate`, `stage_hall`, `white_void`, `battle_loop`, `battle_static`, `battle_palace`) | 1280×720 |

`<id>` is any key in `src/data/looks.js` (`joker`, `skull`, `panther`, `fox`, `queen`, `mona`, `oracle`,
`noir`, `mio`, `maestro`, `sora`). Anything not listed falls back to the procedural art.

Files in `assets/` are git-ignored (except the manifest and READMEs). Only commit art you own
or have commissioned.

## Good sources

- Commission an artist (the roster in `OPERATORS` is a ready-made brief).
- Generate original art with a tool whose output you may use commercially.
- CC0 / properly licensed packs (check the license, keep attribution in `CREDITS.md`).

## Audio

To replace the synth, add files under `assets/audio/` and extend `AudioEngine` in `src/core/audio.js`
(`playMusic` / `sfx` are the only entry points the rest of the game uses).
