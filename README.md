# ENCORE PROTOCOL · Phantom Showcase

### A stylized 3D isometric tower defense in Three.js · cel-shaded · built for phones

![Title](docs/screenshots/01-title.png)

Shadows march down a crimson runway toward a floating golden **Treasure**. Deploy your Phantoms beside
it, **break their posture** to shatter their gold masks, chain **1-MORE → Baton Pass**, and when three are
down, tap the flashing prompt for an **ALL-OUT ATTACK**.

| | |
| --- | --- |
| ![Battle](docs/screenshots/02-battle.png) | ![1-MORE](docs/screenshots/03-one-more.png) |
| ![All-Out panels](docs/screenshots/04-all-out-panels.png) | ![The show's over](docs/screenshots/05-the-shows-over.png) |
| ![Phone landscape](docs/screenshots/06-phone-landscape.png) | ![Phone portrait](docs/screenshots/07-phone-portrait.png) |

> ⚠️ **Fan project.** This is an unofficial, non-commercial showcase inspired by the Persona series' visual
> style. It is not affiliated with ATLUS or SEGA. It contains **no ripped or copied game assets**, and every
> model, character design, effect and UI element is original and built in code (see [NOTICE.md](NOTICE.md)).

## Play on your phone

**Option A: GitHub Pages (recommended)**

1. On GitHub, go to repo **Settings → Pages**. Under **Build and deployment**, set the source to **GitHub Actions**.
2. Merge this branch into `main`, or open **Actions → Deploy to GitHub Pages → Run workflow**.
3. Open `https://<your-user>.github.io/p5_tower_defense/` on your phone.
   Tip: use "Add to Home Screen" for a full-screen launch.

> GitHub Pages on a **private** repo needs a paid plan (Pro/Team/Enterprise). On a free account,
> either make the repo public or use option B.

**Option B: from your computer, on the same Wi-Fi**

```bash
npm install
npm run dev          # prints a "Network:" URL such as http://192.168.1.20:5173 – open it on your phone
```

## Controls

| | Touch | Mouse / keys |
| --- | --- | --- |
| Deploy | Drag a card onto a plate beside the runway, or tap a card then tap a plate | same |
| Inspect / sell | Tap a deployed unit | click · `Esc` closes |
| Baton Pass | After **1-MORE!**, tap another unit within 3 s | click |
| All-Out Attack | Tap the flashing crimson **ALL-OUT ATTACK** prompt | `A` |
| Speed / pause | `1×` and `❚❚` buttons | `Space` pauses |

## What's in it

- **Isometric 3D arena** (Three.js, WebGL):
  - The view is fixed at 45° with a −6° Dutch tilt, and smoothly zooms in on Baton Passes.
  - The floor is reflective obsidian (`#0A0A0E`).
  - A raised crimson runway (`#D90429`) has emissive gold neon edges and marching chevrons.
  - The Treasure is a floating, spinning geometric crown.
- **Cel-shading everywhere**:
  - `MeshToonMaterial` uses a hard 3-step ramp, plus an injected hard-cutoff specular and a sharp rim light.
  - Meshes get inverted-hull ink outlines.
  - Directional key and rim lights cast sharp shadows.
- **Post-processing**:
  - Bloom on the neon.
  - A Ben-Day halftone shader that bites into the screen corners and the deepest shadows.
  - Chromatic aberration on posture breaks.
- **Phantoms** (original stylized figures, faceless by design):
  - **Jester** (Leader): a long flared black trench coat, popped collar, a glowing white masquerade mask and twin silver blades.
  - **Queen** (Vanguard): navy armor, metallic spiked pauldrons and crimson knuckle auras. Heavy posture damage with splash.
  - **Oracle** (Tactician): a floating neon-green icosahedral drone pod with holographic orbital rings. Its long-range marks slow Shadows and expose their posture.
- **Shadows**: faceless glossy obsidian mannequins in gold porcelain masks, with glowing yellow eyes and a marching walk cycle. There are four kinds, including a crowned boss.
- **Posture Break**: an 80 ms hit-stop, then the mask **shatters into golden shards** and **black/red ink** erupts. The Shadow drops to its knees and takes ×1.5 damage.
- **1-MORE screen-slice**: a −12° banner rips across the screen with a jagged white border, speed lines, the unit's silhouette (rendered live from its 3D model) with a glowing eye-slash, and a yellow **1-MORE!** badge.
- **ALL-OUT ATTACK**:
  1. The game freezes and a 3-panel comic wipe plays.
  2. The frozen frame **shatters like glass** into a red/black splash with ransom-note **THE SHOW'S OVER** lettering.
  3. Calling cards rain across the arena.
- **8 waves**, including a boss wave. The difficulty is tuned so that, by test, a good build **needs** the Baton Pass / All-Out mechanics to win.
- **Mobile-first**:
  - Touch and drag input, a responsive HUD for portrait and landscape, and safe-area insets.
  - Adaptive resolution that lowers the pixel ratio if frames drop.
  - `?q=low` turns off bloom and shadows.

## Develop

```bash
npm install
npm run dev        # Vite dev server (LAN-accessible)
npm test           # 12 headless simulation tests incl. balance guard rails
npm run build      # production build -> dist/
npm run smoke      # browser e2e against the build (needs: npm i -D playwright && npx playwright install chromium)
```

```
src/
  sim/      pure deterministic game logic (no DOM / Three.js): board, units, enemies, waves, posture, baton, all-out
  render/   Three.js: toon materials + outlines, arena, models, FX pools, camera rig, post-processing
  ui/       DOM HUD, comic cut-ins (1-MORE, ALL-OUT shatter), 3D-silhouette portraits, CSS
  main.js   renderer setup, input, game loop, cut-in orchestration
```

See [docs/DESIGN.md](docs/DESIGN.md) for rules and rendering details, and [docs/ROADMAP.md](docs/ROADMAP.md) for what's next.
The previous 2D canvas version (v0.2) lives in git history at commit `64bc6fb`.

---

*Persona is a trademark of ATLUS. This is an unofficial fan work. Code is MIT-licensed.*
