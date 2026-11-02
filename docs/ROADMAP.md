# Roadmap

## Done (v0.1: vertical slice)
- [x] Core TD loop, 8 operators, 6 Echo types, 3 stages, boss with revive
- [x] Unique animated skills, cut-ins, All-Out Rush, Baton Pass
- [x] Chapter 1 story, 4 cinematics, mid-battle story beats
- [x] Procedural art/audio, save data, settings (incl. reduce-flash), tests, CI

## Next: polish toward "AAA"
- [ ] Real art pass: swap procedural portraits for commissioned/owned art via `manifest.json`
- [ ] Skeletal animation (Spine/DragonBones) for tokens and attack/idle/skill poses
- [ ] Voice acting hooks + subtitles in the cutscene player
- [ ] Full music score (stems per scene, stinger on All-Out)
- [ ] Per-operator unique attack animations and hit-stop
- [ ] Mobile layout and touch drag-to-deploy polish
- [ ] Localization (strings already isolated in `data/story.js`)

## Content
- [ ] Chapter 2: *Requests* (Akechi echo, Sae, Sojiro) with 5+ stages
- [ ] More operators (Akechi as a late-game guest, Sumire, new original Thieves)
- [ ] Persona fusion-style upgrades: skill levels, potential, operator trust ("confidant") levels
- [ ] Enemy variety: flyers, stealth, support Echoes; environmental hazards
- [ ] Challenge modes, daily operations, endless "Mementos Depth" mode

## Tech
- [ ] Replay/recording from deterministic sim seeds
- [ ] Data-driven stage editor
- [ ] Bundled/minified release build, PWA
