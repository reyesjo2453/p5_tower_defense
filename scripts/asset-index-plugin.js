// Vite plugin: `virtual:asset-index` lists the drop-in art files that actually exist under
// public/models and public/portraits (including their custom/ overrides), so the game can resolve
// its fallback chain synchronously: no 404 probing, and missing files never break the build.
import fs from 'node:fs';
import path from 'node:path';

const ID = 'virtual:asset-index';
const RID = '\0' + ID;
const ROOTS = ['models', 'portraits', 'audio'];
const EXT = /\.(glb|gltf|png|webp|jpe?g|avif|mp3|ogg|m4a)$/i;

function scan(publicDir) {
  const out = [];
  const walk = (dir, rel) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), r);
      else if (EXT.test(e.name)) out.push(r);
    }
  };
  for (const root of ROOTS) walk(path.join(publicDir, root), root);
  return out.sort();
}

export function assetIndex() {
  let publicDir = 'public';
  return {
    name: 'asset-index',
    configResolved(c) { publicDir = c.publicDir; },
    resolveId(id) { return id === ID ? RID : null; },
    load(id) {
      if (id !== RID) return null;
      return `export const files = ${JSON.stringify(scan(publicDir))};\n`;
    },
    configureServer(server) {
      // dropping a file into public/models or public/portraits reloads the page with the new index
      const refresh = (file) => {
        const rel = path.relative(publicDir, file).split(path.sep);
        if (!ROOTS.includes(rel[0])) return;
        const mod = server.moduleGraph.getModuleById(RID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.add(ROOTS.map((r) => path.join(publicDir, r)));
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}
