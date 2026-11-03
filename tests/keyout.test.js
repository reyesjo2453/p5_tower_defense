import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyOut, needsKey } from '../src/render/keyout.js';

// synthetic 60x80 card: white frame (3px) + red inner frame (2px), near-black backdrop with
// JPEG-ish noise, a grey figure with a black "coat" hole, a stray star and a detached hand
function card() {
  const w = 60, h = 80, d = new Uint8ClampedArray(w * h * 4);
  const set = (x, y, r, g, b) => { const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = Math.min(x, y, w - 1 - x, h - 1 - y);
    if (e < 3) set(x, y, 250, 250, 250);
    else if (e < 5) set(x, y, 220, 10, 20);
    else set(x, y, (x * 7 + y * 3) % 12, (x + y) % 9, 4);
  }
  for (let y = 20; y < 70; y++) for (let x = 20; x < 40; x++) set(x, y, 160, 150, 140); // body
  for (let y = 35; y < 45; y++) for (let x = 25; x < 35; x++) set(x, y, 5, 5, 5);       // black coat, enclosed
  for (let y = 10; y < 12; y++) for (let x = 10; x < 12; x++) set(x, y, 255, 255, 0);   // stray star
  for (let y = 40; y < 50; y++) for (let x = 44; x < 54; x++) set(x, y, 160, 150, 140); // detached hand (100px)
  return { w, h, d };
}
const alpha = (c, x, y) => c.d[(y * c.w + x) * 4 + 3];

test('card art is detected as needing a key; cut-outs are not', () => {
  const c = card();
  assert.equal(needsKey(c.d, c.w, c.h), true);
  keyOut(c.d, c.w, c.h);
  assert.equal(needsKey(c.d, c.w, c.h), false);
});

test('keyOut strips the frame and black backdrop but keeps the figure', () => {
  const c = card();
  const r = keyOut(c.d, c.w, c.h);
  assert.equal(r.keyed, true);
  assert.deepEqual(r.frame, { top: 5, bottom: 5, left: 5, right: 5 });
  assert.equal(alpha(c, 1, 1), 0, 'white frame');
  assert.equal(alpha(c, 4, 40), 0, 'red frame');
  assert.equal(alpha(c, 10, 60), 0, 'black backdrop');
  assert.equal(alpha(c, 30, 30), 255, 'figure');
  assert.equal(alpha(c, 30, 40), 255, 'enclosed black survives');
  assert.equal(alpha(c, 46, 44), 255, 'detached part kept');
  assert.equal(alpha(c, 10, 10), 0, 'stray star dropped');
  assert.ok(r.kept > 0.2 && r.kept < 0.25, `kept ${r.kept}`);
});

test('an image with no dark backdrop is left untouched', () => {
  const w = 20, h = 20, d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set([(i * 37) % 255, (i * 91) % 255, 200, 255], i * 4);
  const before = d.slice();
  const r = keyOut(d, w, h);
  assert.equal(r.kept > 0.9, true);
  assert.equal(d.filter((v, i) => i % 4 === 3 && v === 0).length, 0);
  assert.deepEqual(d.slice(0, 40), before.slice(0, 40));
});
