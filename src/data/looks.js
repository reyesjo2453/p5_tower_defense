// Character design sheets for the procedural art pipeline (src/render/characters.js).
//
// These are ORIGINAL "Encore Protocol" designs: the operators wear new masks, outfits and hairstyles
// made for this project, deliberately not recreations of any existing character art. If you own
// art you would rather use, drop it in through assets/manifest.json (see docs/ASSETS.md).
//
// hair:    colour, hl (highlight), style  (swept | crop | bob | pony | shag | crown | braid | cap | idol | slick | long)
// skin:    base, shade
// eyes:    iris colour
// mask:    shard | plate | petal | goggles | crescent | circuit | veil | band | opera | none
// outfit:  coat, coat2 (shadow), inner, trim, kind (longcoat | bomber | capelet | flight | robe | hoodie | gown | greatcoat | idol | tails | parka)
// weapon:  battle token prop
export const LOOKS = {
  joker: {
    name: 'Joker', accent: '#e8002d', eyes: '#c8102e',
    hair: { c: '#e9e7ef', hl: '#ffffff', sh: '#9c98ad', style: 'swept', streak: '#e8002d' },
    skin: { c: '#f1d4c2', sh: '#d39f8f' },
    mask: { kind: 'shard', c: '#1a1a22', edge: '#e8002d' },
    outfit: { kind: 'longcoat', coat: '#23232c', coat2: '#121218', inner: '#e8002d', trim: '#d8d8e0' },
    weapon: 'knives',
  },
  skull: {
    name: 'Skull', accent: '#f2c200', eyes: '#c77d16',
    hair: { c: '#7a3a1e', hl: '#b0603a', sh: '#4a2010', style: 'crop' },
    skin: { c: '#e8bf9e', sh: '#c08c70' },
    mask: { kind: 'plate', c: '#4a4d57', edge: '#f2c200' },
    outfit: { kind: 'bomber', coat: '#3a3f2c', coat2: '#20231a', inner: '#191919', trim: '#f2c200' },
    weapon: 'hammer',
  },
  panther: {
    name: 'Panther', accent: '#ff2e63', eyes: '#ff8a3d',
    hair: { c: '#4b1f47', hl: '#8a3f7d', sh: '#2a0f28', style: 'bob' },
    skin: { c: '#f3d6c4', sh: '#d6a596' },
    mask: { kind: 'petal', c: '#ff5a2a', edge: '#ffd0a0' },
    outfit: { kind: 'capelet', coat: '#1d1018', coat2: '#0f080c', inner: '#c4123e', trim: '#ffb46b' },
    weapon: 'flame',
  },
  mona: {
    name: 'Mona', accent: '#3aa0ff', eyes: '#2fd3a7',
    hair: { c: '#d9b77a', hl: '#f7e1a8', sh: '#a3834a', style: 'cap' },
    skin: { c: '#f2d3bd', sh: '#d4a48f' },
    mask: { kind: 'goggles', c: '#2a3a52', edge: '#7fd6ff' },
    outfit: { kind: 'flight', coat: '#2b5ea8', coat2: '#173663', inner: '#f2f2f2', trim: '#ffffff' },
    weapon: 'drone',
  },
  fox: {
    name: 'Fox', accent: '#29b6f6', eyes: '#7fe3ff',
    hair: { c: '#1a4b4f', hl: '#3c8a8a', sh: '#0b2629', style: 'long' },
    skin: { c: '#f3dccd', sh: '#d6ada0' },
    mask: { kind: 'crescent', c: '#f4fbff', edge: '#29b6f6' },
    outfit: { kind: 'robe', coat: '#e9eef5', coat2: '#a9b6c8', inner: '#1d3d66', trim: '#29b6f6' },
    weapon: 'rifle',
  },
  oracle: {
    name: 'Oracle', accent: '#ff9f1c', eyes: '#c9a0ff',
    hair: { c: '#b6a6e8', hl: '#e2d8ff', sh: '#7a69b3', style: 'shag', tips: '#ff9f1c' },
    skin: { c: '#f6dccb', sh: '#d9b0a0' },
    mask: { kind: 'circuit', c: '#ff9f1c', edge: '#fff0c8' },
    outfit: { kind: 'hoodie', coat: '#2b2836', coat2: '#17151e', inner: '#ff9f1c', trim: '#ffcf7a' },
    weapon: 'tablet',
  },
  noir: {
    name: 'Noir', accent: '#c8326e', eyes: '#7b5cff',
    hair: { c: '#efe0b8', hl: '#fff6dc', sh: '#b5a37a', style: 'crown' },
    skin: { c: '#f6dbcd', sh: '#d8ada0' },
    mask: { kind: 'veil', c: '#2a0f1f', edge: '#e8c46a' },
    outfit: { kind: 'gown', coat: '#5c1430', coat2: '#30091a', inner: '#c9ccd6', trim: '#e8c46a' },
    weapon: 'shield',
  },
  queen: {
    name: 'Queen', accent: '#b266ff', eyes: '#d7b3ff',
    hair: { c: '#14121c', hl: '#4b4466', sh: '#05040a', style: 'braid', streak: '#b266ff' },
    skin: { c: '#efd2bf', sh: '#cf9f8e' },
    mask: { kind: 'band', c: '#1d1730', edge: '#b266ff' },
    outfit: { kind: 'greatcoat', coat: '#2c2f3d', coat2: '#171923', inner: '#4a2b7a', trim: '#d6c3ff' },
    weapon: 'launcher',
  },
  // Original story characters
  mio: {
    name: 'Mio', accent: '#1fc8c0', eyes: '#1fc8c0',
    hair: { c: '#1b9e98', hl: '#7ff0e6', sh: '#0b5753', style: 'idol' },
    skin: { c: '#f2d3c0', sh: '#d4a693' },
    mask: { kind: 'none' },
    outfit: { kind: 'idol', coat: '#262c48', coat2: '#151a2e', inner: '#1fc8c0', trim: '#e8fffd' },
    weapon: 'none',
  },
  maestro: {
    name: 'The Maestro', accent: '#ffd24a', eyes: '#ffd24a',
    hair: { c: '#dcdce8', hl: '#ffffff', sh: '#9a9ab0', style: 'slick' },
    skin: { c: '#e9dbd2', sh: '#bfa69a' },
    mask: { kind: 'opera', c: '#f4f0e6', edge: '#ffd24a' },
    outfit: { kind: 'tails', coat: '#0d0d12', coat2: '#050508', inner: '#f4f0e6', trim: '#ffd24a' },
    weapon: 'none',
  },
  sora: {
    name: 'Sora', accent: '#8f93c9', eyes: '#8f93c9',
    hair: { c: '#3b3b55', hl: '#6a6a90', sh: '#1f1f30', style: 'crop' },
    skin: { c: '#efd2bc', sh: '#cfa592' },
    mask: { kind: 'none' },
    outfit: { kind: 'parka', coat: '#43455f', coat2: '#282a3c', inner: '#cfd2ea', trim: '#8f93c9' },
    weapon: 'none',
  },
};

export const NAME_COLORS = Object.fromEntries(Object.entries(LOOKS).map(([k, v]) => [k, v.accent]));
