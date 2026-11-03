#!/usr/bin/env node
/* Install / remove the CC0 placeholder art as private drop-ins (public/models/custom, public/portraits/custom).
 *   node scripts/placeholder-assets.cjs install   -> copy fixtures/placeholder-assets into the custom/ folders
 *   node scripts/placeholder-assets.cjs install sprites -> portraits only (no .glb): units stand as 2D billboards
 *   node scripts/placeholder-assets.cjs clean     -> empty the custom/ folders (keeps .gitkeep)
 * The custom/ folders are git-ignored, so nothing installed here is committed or deployed from CI. */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'fixtures', 'placeholder-assets');
const KINDS = ['models', 'portraits'];
const cmd = process.argv[2];
const spritesOnly = process.argv[3] === 'sprites';

for (const kind of KINDS) {
  const dst = path.join(ROOT, 'public', kind, 'custom');
  fs.mkdirSync(dst, { recursive: true });
  if (cmd === 'install') {
    if (spritesOnly && kind === 'models') continue;
    for (const f of fs.readdirSync(path.join(SRC, kind))) {
      fs.copyFileSync(path.join(SRC, kind, f), path.join(dst, f));
      console.log(`  + public/${kind}/custom/${f}`);
    }
  } else if (cmd === 'clean') {
    for (const f of fs.readdirSync(dst)) {
      if (f === '.gitkeep') continue;
      fs.rmSync(path.join(dst, f), { recursive: true, force: true });
      console.log(`  - public/${kind}/custom/${f}`);
    }
  } else {
    console.error('usage: placeholder-assets.cjs install|clean');
    process.exit(2);
  }
}
