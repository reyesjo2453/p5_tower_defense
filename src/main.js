import { audio } from './core/audio.js';
import { assets } from './core/assets.js';
import { loadSave, persist } from './core/storage.js';
import { TitleScene } from './scenes/title.js';
import { HubScene } from './scenes/hub.js';
import { RosterScene, SettingsScene } from './scenes/menus.js';
import { CutsceneScene } from './scenes/cutscene.js';
import { BattleScene } from './scenes/battle.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');

const game = {
  canvas,
  ctx,
  ui: document.getElementById('ui'),
  save: loadSave(),
  persist,
  audio,
  scene: null,
  scenes: {},
  go(name, params = {}) {
    if (this.scene?.exit) this.scene.exit();
    this.ui.innerHTML = '';
    this.scene = this.scenes[name];
    this.sceneName = name;
    this.scene.enter(params);
  },
  /** Play a story scene once (or always with force), then continue. */
  playScene(id, onDone, { force = false } = {}) {
    if (!id || (!force && this.save.seen[id] && !this.debugReplay)) return onDone();
    this.save.seen[id] = true;
    persist();
    this.go('cutscene', { id, onDone });
  },
};
window.__game = game; // handy for debugging / smoke tests

game.scenes = {
  title: new TitleScene(game),
  hub: new HubScene(game),
  roster: new RosterScene(game),
  settings: new SettingsScene(game),
  cutscene: new CutsceneScene(game),
  battle: new BattleScene(game),
};

function resize() {
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stage.style.transformOrigin = '0 0';
  stage.style.transform = `translate(${-640 * s}px, ${-360 * s}px) scale(${s})`;
}
window.addEventListener('resize', resize);
resize();

function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * 1280, y: ((e.clientY - r.top) / r.height) * 720 };
}
for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
  canvas.addEventListener(type, (e) => {
    audio.resume();
    const p = pointerPos(e);
    game.scene?.pointer?.(type.replace('pointer', ''), p.x, p.y, e);
  });
}
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const p = pointerPos(e);
  game.scene?.pointer?.('context', p.x, p.y, e);
});
window.addEventListener('keydown', (e) => {
  audio.resume();
  game.scene?.key?.(e);
});
window.addEventListener('pointerdown', () => audio.resume(), { once: true });

audio.setVolumes(game.save.settings.music, game.save.settings.sfx);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const sc = game.scene;
  if (sc) {
    sc.update(dt);
    ctx.save();
    ctx.clearRect(0, 0, 1280, 720);
    sc.draw(ctx);
    ctx.restore();
  }
  requestAnimationFrame(frame);
}

assets.load().finally(() => {
  game.go('title');
  requestAnimationFrame(frame);
});
