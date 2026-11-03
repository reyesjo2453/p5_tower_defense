// Resolves the custom/ -> base -> built-in fallback chain against the build-time asset index.
import { files } from 'virtual:asset-index';
import { UNIT_ART, FINISHER_ART, SPRITE_FROM_CUTIN } from './manifest.js';

const have = new Set(files);
const BASE = import.meta.env.BASE_URL;

/**
 * URL of the first existing candidate for `kind` ('models' | 'portraits'), or null. `file` may be
 * a name or a list of names; every name is tried in custom/ before any is tried in the base folder.
 */
export function resolveAsset(kind, file) {
  const names = [].concat(file ?? []).filter(Boolean);
  for (const dir of [`${kind}/custom/`, `${kind}/`]) {
    for (const n of names) if (have.has(dir + n)) return BASE + dir + n;
  }
  return null;
}

/**
 * Every file name a unit's `field` may use: the manifest name, its `-`/`_` twin, and the same for
 * each alias (e.g. jester-cutin.png, jester_cutin.png, vanguard-cutin.png, vanguard_cutin.png).
 */
export function candidates(id, field) {
  const a = UNIT_ART[id];
  const file = a?.[field];
  if (!file) return [];
  const out = [file];
  const m = file.match(new RegExp(`^${id}[-_](.+)$`));
  for (const name of [id, ...(a.alias ?? [])]) {
    if (!m) break;
    out.push(`${name}-${m[1]}`, `${name}_${m[1]}`);
  }
  return [...new Set(out)];
}

/** { jester: url|null, ... } for the glTF models. */
export function modelURLs() {
  return Object.fromEntries(Object.keys(UNIT_ART).map((id) => [id, resolveAsset('models', candidates(id, 'model'))]));
}

/** { jester: url|null, ... } for standing billboards: the sprite PNG, else (optionally) the cut-in PNG. */
export function spriteURLs() {
  return Object.fromEntries(Object.keys(UNIT_ART).map((id) => [
    id,
    // one list, so anything in custom/ (sprite or cut-in) beats the base folder
    resolveAsset('portraits', [...candidates(id, 'sprite'), ...(SPRITE_FROM_CUTIN ? candidates(id, 'cutin') : [])]),
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
  for (const id of Object.keys(UNIT_ART)) {
    cutin[id] = pick(candidates(id, 'cutin'), `cutin:${id}`, fallback(id));
    // a card face falls back to the cut-in PNG before the SVG
    card[id] = pick(candidates(id, 'card'), `card:${id}`, cutin[id]);
  }
  const finisher = pick(FINISHER_ART, 'finisher', fallback('leader'));
  return { card, cutin, finisher, png };
}
