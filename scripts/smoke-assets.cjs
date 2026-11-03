#!/usr/bin/env node
/* End-to-end check of the drop-in art pipeline: install the CC0 placeholders into the custom/ folders,
 * build, run the browser smoke test with glTF/PNG assertions on, then remove them and rebuild clean. */
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const run = (file, args, env = {}) => execFileSync(process.execPath, [file, ...args], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
let failed = false;
try {
  run('scripts/placeholder-assets.cjs', ['install']);
  run(vite, ['build', '--logLevel', 'warn']);
  run('scripts/smoke.cjs', [], { SMOKE_ASSETS: '1' });
} catch {
  failed = true;
} finally {
  run('scripts/placeholder-assets.cjs', ['clean']);
  run(vite, ['build', '--logLevel', 'warn']);
}
process.exitCode = failed ? 1 : 0;
