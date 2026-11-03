// Audio front door: owns the BGM and SFX managers (separate buses), the persisted mute / volume
// settings, and the first-gesture unlock that starts the soundtrack.
import { BgmManager } from './bgmManager.js';
import { SfxManager } from './sfxManager.js';
import { loadSettings, saveSettings } from './context.js';
import { resolveAsset } from '../assets/resolve.js';

export function createAudio() {
  const settings = loadSettings();
  const bgm = new BgmManager();
  const sfx = new SfxManager();
  bgm.setFile(resolveAsset('audio', ['bgm.mp3', 'bgm.ogg', 'bgm.m4a']));
  bgm.volume = settings.bgm;
  sfx.volume = settings.sfx;
  bgm.muted = sfx.muted = settings.muted;
  const listeners = new Set();

  const audio = {
    bgm,
    sfx,
    get muted() { return settings.muted; },
    /** Start both buses (safe to call on every gesture; only the first one does anything). */
    unlock() {
      sfx.start();
      bgm.start();
    },
    setMuted(m) {
      settings.muted = !!m;
      bgm.setMuted(settings.muted);
      sfx.setMuted(settings.muted);
      saveSettings(settings);
      for (const fn of listeners) fn(settings.muted);
    },
    toggleMute() {
      audio.setMuted(!settings.muted);
      if (!settings.muted) audio.unlock();
      return settings.muted;
    },
    setVolume(kind, v) {
      settings[kind] = Math.min(1, Math.max(0, v));
      (kind === 'bgm' ? bgm : sfx).setVolume(settings[kind]);
      saveSettings(settings);
    },
    onMute(fn) { listeners.add(fn); },
    status() { return { muted: settings.muted, bgm: bgm.status(), sfx: sfx.status() }; },
  };

  // browsers only allow audio after a gesture: the first tap / click / key anywhere starts it
  const first = () => {
    audio.unlock();
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.removeEventListener(ev, first, true);
  };
  for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, first, true);
  return audio;
}
