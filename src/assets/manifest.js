// Drop-in art manifest. Every unit archetype maps to a glTF model plus its 2D cut-in art.
// Paths are relative to public/models and public/portraits. Each file is looked up in
// `custom/` first, then the base folder; anything missing falls back to the built-in procedural
// figure (src/render/models.js) or the SVG silhouette (src/ui/silhouettes.js), so the build
// never depends on these files existing. See docs/ASSETS.md.
export const UNIT_ART = {
  jester: {
    archetype: 'Leader',
    model: 'jester.glb',
    card: 'jester-card.png',     // deploy-card face
    cutin: 'jester-cutin.png',   // 1-MORE band, All-Out panel, deploy cut-in
    sprite: 'jester-sprite.png', // standing billboard on the board (used when there is no .glb)
  },
  queen: {
    archetype: 'Vanguard',
    model: 'queen.glb',
    card: 'queen-card.png',
    cutin: 'queen-cutin.png',
    sprite: 'queen-sprite.png',
  },
  oracle: {
    archetype: 'Tactician',
    model: 'oracle.glb',
    card: 'oracle-card.png',
    cutin: 'oracle-cutin.png',
    sprite: 'oracle-sprite.png',
  },
};

// "THE SHOW'S OVER" finisher splash hero.
export const FINISHER_ART = 'finisher.png';

// Normalized standing height (world units) for imported models, feet at y = 0.
export const MODEL_HEIGHT = 1.8;

// Optional per-model tweaks, keyed by unit id: { yaw (radians, if the model doesn't face +Z),
// height (overrides MODEL_HEIGHT), idle / attack (animation clip name, regex source) }.
export const MODEL_TWEAKS = {};

// 2D billboard units. A unit with no .glb but a standing sprite PNG (or, failing that, its cut-in
// PNG when SPRITE_FROM_CUTIN is on) stands on its plate as a camera-facing paper cut-out.
// Transparent margins are trimmed at load, so the art's lowest opaque pixel touches the plate.
export const SPRITE_HEIGHT = 1.8; // bottom at y = 0, centre at 0.9
export const SPRITE_FROM_CUTIN = true;

// Optional per-sprite tweaks, keyed by unit id: { height (e.g. 1.1 for a small mascot-sized
// figure), flip (true if the art faces left), breath (bob amplitude, default 0.04) }.
export const SPRITE_TWEAKS = {};
