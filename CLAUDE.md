Project notes for Claude Code
Encore Protocol · Phantom Showcase: a Persona-inspired 3D tower defense set in a neon Palace (Vite + Three.js, mobile-first).
- Dev: npm run dev (LAN URL for phones). Tests: npm test. Build: npm run build. Browser e2e: npm run smoke (after build).
- src/sim/ is pure logic (no DOM/Three.js) and the source of truth; the view drains game.drain() events.
- Asset loading pipeline:
  - 3D models live in public/models/ (.glb format). Load via GLTFLoader using SkeletonUtils.clone() with Box3 normalization (~1.8 units tall, base grounded at y = 0). Apply toon() and outline() shaders to imported meshes.
  - If a model file is missing or fails to load, gracefully fall back to the procedural primitives in src/render/models.js.
  - 2D cut-in and finisher art checks public/portraits/ (.png) first. If an image is missing, fall back to the vector silhouettes in src/ui/silhouettes.js.
- Audio: src/audio/ (bgmManager.js = looping soundtrack, public/audio/bgm.mp3 or procedural; sfxManager.js = one-shots). Separate gain buses; started on the first gesture; window.__game.audio.
- 2D comic FX and frames live in src/ui/comic.js (stars, ink, speedlines, torn paper).
- The Palace backdrop is src/render/palace.js; keep it instanced/merged (mobile draw-call budget).
- All meshes use toon() from src/render/toon.js (cel ramp + hard spec + rim) and outline() for ink lines; glowing parts use glowMat() (unlit, toneMapped false) so only they bloom.
- After changing numbers in src/sim/data.js, run npm test (balance guard rails: win with mechanics, lose without).
- Camera: CameraRig in src/render/view.js (fit() = whole board; player zoom/pan layer on top, default ZOOM_DEFAULT ~30% closer; kick() = hit impulse). Input lives in main.js.
- Combat feel: sim Baton Pass prompts run in bullet-time (game.timeScale, rules.bulletTime/batonCooldown per lane); the view scales its dt by game.timeScale. Billboard attacks are a state machine in spriteUnits.js (ATTACK timings); impact flash + threat ring in src/render/combatEffects.js; damage numbers / callouts in src/render/combatText.js.
- Stages: one Game per stage. src/sim/stagegen.js generates runways (seed + tier, 1-3 lanes) and composes waves; src/sim/campaign.js builds campaign / Rehearsal / classic games. CAMPAIGN in sim/data.js = 15 stages with pinned seeds. The arena (render/arena.js) is rebuilt per stage; lights are built once.
- Personas: shared SP (breaks/kills) -> game.summon(type, x, y); full SP = All-Out. Effects in game.js, visuals in render/personaFx.js, aiming in main.js (startAim / trySummon). Balance autoplayer: tests/bot.js.
- Story campaign: src/story/script.js (scenes, one per CAMPAIGN stage + ending), lessons.js (Prompter tutorial steps), save.js (localStorage: cp.stage, best, perf, seen, lessons, revealed, whole). UI: src/ui/story.js, src/ui/tutorial.js. Five unique units (one each on stage), rank-ups, Blocking (move, Act III). ?unlock=all = classic sandbox, ?story=0 = no scenes/lessons, ?stage=N, ?rehearsal=T&seed=S. Plot outline (spoilers): docs/STORY.md.
- window.__game exposes { game, state, rig, scene, … } for debugging/smoke tests.
- Deploy: .github/workflows/pages.yml (push to main or manual run; Pages source must be "GitHub Actions").
