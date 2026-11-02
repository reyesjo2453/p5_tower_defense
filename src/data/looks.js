// Procedural character looks (placeholder art). Replace with real portraits via assets/manifest.json.
export const LOOKS = {
  joker: { name: 'Joker', hair: '#16161d', style: 'curly', skin: '#f0d3bb', outfit: '#17171d', trim: '#e8002d', mask: 'domino', glasses: true, accent: '#e8002d' },
  skull: { name: 'Skull', hair: '#f3d347', style: 'spiky', skin: '#efc7a2', outfit: '#25252b', trim: '#f2c200', mask: 'skull', accent: '#f2c200' },
  panther: { name: 'Panther', hair: '#f7d56a', style: 'twin', skin: '#f3d0b5', outfit: '#d3173f', trim: '#ffffff', mask: 'cat', accent: '#ff2e63' },
  fox: { name: 'Fox', hair: '#1d2a4d', style: 'straight', skin: '#f1d6c0', outfit: '#1f3a73', trim: '#f4f4f4', mask: 'fox', accent: '#29b6f6' },
  queen: { name: 'Queen', hair: '#5b3a2b', style: 'bob', skin: '#f1d2bb', outfit: '#3b2563', trim: '#e6d6ff', mask: 'domino', accent: '#b266ff' },
  mona: { name: 'Mona', hair: '#14141a', style: 'cat', skin: '#14141a', outfit: '#14141a', trim: '#f2c200', mask: 'none', accent: '#3aa0ff' },
  oracle: { name: 'Oracle', hair: '#f08a24', style: 'long', skin: '#f3d2bb', outfit: '#3a2a52', trim: '#ff9f1c', mask: 'visor', glasses: false, accent: '#ff9f1c' },
  noir: { name: 'Noir', hair: '#7b4b3a', style: 'wavy', skin: '#f4d6c2', outfit: '#6e1e3f', trim: '#ffd9e8', mask: 'lace', accent: '#c8326e' },
  // Original characters
  mio: { name: 'Mio', hair: '#1fc8c0', style: 'idol', skin: '#f2cfb8', outfit: '#2a2f4a', trim: '#1fc8c0', mask: 'none', accent: '#1fc8c0' },
  maestro: { name: 'The Maestro', hair: '#d9d9e6', style: 'slick', skin: '#e9d9cf', outfit: '#0d0d12', trim: '#ffd24a', mask: 'opera', accent: '#ffd24a' },
  sora: { name: 'Sora', hair: '#3b3b55', style: 'straight', skin: '#efd2bc', outfit: '#43455f', trim: '#8f93c9', mask: 'none', accent: '#8f93c9' },
};

export const NAME_COLORS = Object.fromEntries(Object.entries(LOOKS).map(([k, v]) => [k, v.accent]));
