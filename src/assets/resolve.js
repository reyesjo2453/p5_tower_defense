// Resolves the custom/ -> base -> built-in fallback chain against the build-time asset index.
import { files } from 'virtual:asset-index';
import { UNIT_ART, FINISHER_ART, SPRITE_FROM_CUTIN } from './manifest.js';

const have = new Set(files);
const BASE = import.meta.env.BASE_URL;

/** URL of the first existing candidate for `kind` ('models' | 'portraits'), or null. */
export function resolveAsset(kind, file) {
  if (!file) return null;
  for (const rel of [`${kind}/custom/${file}`, `${kind}/${file}`]) if (have.has(rel)) return BASE + rel;
  return null;
}

/** { jester: url|null, ... } for the glTF models. */
export function modelURLs() {
  return Object.fromEntries(Object.entries(UNIT_ART).map(([id, a]) => [id, resolveAsset('models', a.model)]));
}

/** { jester: url|null, ... } for standing billboards: the sprite PNG, else (optionally) the cut-in PNG. */
export function spriteURLs() {
  return Object.fromEntries(Object.entries(UNIT_ART).map(([id, a]) => [
    id,
    resolveAsset('portraits', a.sprite) ?? (SPRITE_FROM_CUTIN ? resolveAsset('portraits', a.cutin) : null),
  ]));
}

/**
 * Portrait URLs with built-in fallbacks: { card: {id: url}, cutin: {id: url}, finisher: url, png: Set }.
 * `fallback(id)` returns the SVG silhouette for a unit id or 'leader'.
 */
export function portraitURLs(fallback) {
  const png = new Set();
  const pick = (file, key, fb) => {
    const u = resolveAsset('portraits', file);
    if (u) png.add(key);
    return u || fb;
  };
  const card = {};
  const cutin = {};
  for (const [id, a] of Object.entries(UNIT_ART)) {
    cutin[id] = pick(a.cutin, `cutin:${id}`, fallback(id));
    // a card face falls back to the cut-in PNG before the SVG
    card[id] = pick(a.card, `card:${id}`, cutin[id]);
  }
  const finisher = pick(FINISHER_ART, 'finisher', fallback('leader'));
  return { card, cutin, finisher, png };
}
