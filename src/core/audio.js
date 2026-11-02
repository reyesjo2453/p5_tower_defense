// Fully procedural audio (WebAudio): an acid-jazz-ish step sequencer plus synthesized SFX.
// No external audio files are required; see docs/ASSETS.md for plugging in your own music.
const mtof = (n) => 440 * 2 ** ((n - 69) / 12);

// Each track: bpm, root note, bass steps (semitone offsets / null), chord progression (per bar),
// drum string (16 steps: k=kick s=snare h=hat .=rest), lead steps.
const TRACKS = {
  title: {
    bpm: 98, root: 45,
    bass: [0, null, 0, null, 3, null, 5, null, 7, null, 5, null, 3, 5, 3, null],
    prog: [[0, 3, 7, 10], [5, 8, 12, 15], [3, 7, 10, 14], [7, 10, 14, 17]],
    drums: 'k..hs..hk.khs..h',
    lead: [12, null, null, 15, null, 14, null, null, 12, null, 10, null, null, null, 7, null],
    wave: 'sawtooth',
  },
  battle: {
    bpm: 118, root: 40,
    bass: [0, 0, null, 0, 3, null, 0, 0, 5, null, 5, 0, 7, null, 3, null],
    prog: [[0, 3, 7, 10], [0, 3, 7, 10], [5, 8, 12, 15], [7, 10, 14, 17]],
    drums: 'k.hhs.hhk.khs.hh',
    lead: [null, 12, null, 15, 19, null, 15, null, null, 12, 15, null, 17, null, 15, 12],
    wave: 'square',
  },
  boss: {
    bpm: 132, root: 38,
    bass: [0, 0, 0, null, 1, null, 0, 0, 3, null, 3, 0, 1, null, 0, null],
    prog: [[0, 3, 6, 9], [1, 4, 7, 10], [0, 3, 6, 9], [5, 8, 11, 14]],
    drums: 'k.hkskhhk.hksk.h',
    lead: [12, 13, null, 12, 15, null, 18, null, 17, null, 15, 13, null, 12, null, null],
    wave: 'sawtooth',
  },
  calm: {
    bpm: 72, root: 43,
    bass: [0, null, null, null, null, null, 7, null, 5, null, null, null, null, null, 3, null],
    prog: [[0, 7, 12, 15], [5, 12, 15, 19], [3, 10, 15, 17], [7, 14, 17, 22]],
    drums: '................',
    lead: [null, null, 19, null, null, null, 22, null, null, null, 17, null, 15, null, null, null],
    wave: 'triangle',
  },
  tension: {
    bpm: 84, root: 36,
    bass: [0, null, null, 0, null, null, 1, null, 0, null, null, 0, null, null, 6, null],
    prog: [[0, 1, 6, 7], [0, 3, 6, 9], [1, 4, 7, 10], [0, 1, 6, 7]],
    drums: 'k...........k...',
    lead: [null, null, null, null, 13, null, null, null, null, null, null, null, 12, null, null, null],
    wave: 'sawtooth',
  },
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.6;
    this.sfxVol = 0.8;
    this.track = null;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
  }

  init() {
    if (this.ctx) return;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.applyVolumes();
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.musicGain.gain.value = this.musicVol * 0.5;
    this.sfxGain.gain.value = this.sfxVol * 0.8;
  }

  osc(type, freq, t, dur, vol, dest, slideTo) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(t, dur, vol, dest, freq = 3000, type = 'highpass') {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  playMusic(name) {
    this.init();
    if (!this.ctx) return;
    if (this.trackName === name) return;
    this.stopMusic();
    const tr = TRACKS[name];
    if (!tr) return;
    this.trackName = name;
    this.track = tr;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 40);
  }

  stopMusic() {
    clearInterval(this.timer);
    this.timer = null;
    this.track = null;
    this.trackName = null;
  }

  schedule() {
    const tr = this.track;
    if (!tr || !this.ctx) return;
    const stepDur = 60 / tr.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.2) {
      const i = this.step % 16;
      const bar = Math.floor(this.step / 16) % tr.prog.length;
      const t = this.nextTime;
      const d = tr.drums[i];
      if (d === 'k') {
        this.osc('sine', 120, t, 0.18, 0.9, this.musicGain, 40);
      } else if (d === 's') {
        this.noise(t, 0.14, 0.5, this.musicGain, 1800);
      } else if (d === 'h') {
        this.noise(t, 0.04, 0.18, this.musicGain, 7000);
      }
      const b = tr.bass[i];
      if (b != null) this.osc('triangle', mtof(tr.root + b), t, stepDur * 1.7, 0.55, this.musicGain);
      if (i % 8 === 0 || i % 8 === 3) {
        for (const c of tr.prog[bar]) {
          this.osc(tr.wave === 'square' ? 'triangle' : tr.wave, mtof(tr.root + 24 + c), t, stepDur * 2.2, 0.04, this.musicGain);
        }
      }
      const l = tr.lead[i];
      if (l != null) this.osc(tr.wave, mtof(tr.root + 24 + l + (bar === 3 ? 2 : 0)), t, stepDur * 1.5, 0.07, this.musicGain);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  sfx(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.sfxGain;
    switch (name) {
      case 'click': this.osc('square', 880, t, 0.06, 0.2, o); break;
      case 'blip': this.osc('square', 520 + Math.random() * 80, t, 0.03, 0.08, o); break;
      case 'deploy':
        this.osc('sawtooth', 220, t, 0.18, 0.3, o, 660);
        this.noise(t, 0.1, 0.25, o, 2000);
        break;
      case 'retreat': this.osc('sawtooth', 600, t, 0.2, 0.25, o, 150); break;
      case 'hit': this.noise(t, 0.07, 0.3, o, 1500); this.osc('square', 180, t, 0.07, 0.2, o, 90); break;
      case 'shot': this.osc('square', 900, t, 0.06, 0.12, o, 300); break;
      case 'heal': this.osc('sine', 660, t, 0.25, 0.2, o, 990); break;
      case 'weak': this.osc('sawtooth', 300, t, 0.2, 0.3, o, 1200); this.noise(t, 0.12, 0.3, o, 4000); break;
      case 'down': this.osc('square', 140, t, 0.4, 0.4, o, 40); this.noise(t, 0.3, 0.4, o, 600, 'lowpass'); break;
      case 'kill': this.osc('triangle', 400, t, 0.15, 0.2, o, 100); break;
      case 'leak': this.osc('sawtooth', 120, t, 0.5, 0.5, o, 50); break;
      case 'skill':
        this.osc('sawtooth', 110, t, 0.6, 0.35, o, 880);
        this.noise(t, 0.5, 0.35, o, 1200);
        this.osc('square', 440, t + 0.25, 0.3, 0.2, o, 1760);
        break;
      case 'cutin':
        this.noise(t, 0.25, 0.5, o, 800, 'bandpass');
        this.osc('square', 80, t, 0.5, 0.5, o, 440);
        break;
      case 'allout':
        for (let i = 0; i < 6; i++) this.osc('sawtooth', 200 + i * 90, t + i * 0.12, 0.2, 0.3, o, 900 + i * 100);
        this.noise(t, 1.2, 0.4, o, 500, 'bandpass');
        break;
      case 'boom': this.noise(t, 0.8, 0.8, o, 300, 'lowpass'); this.osc('sine', 90, t, 0.8, 0.8, o, 30); break;
      case 'win': [0, 4, 7, 12].forEach((n, i) => this.osc('square', mtof(64 + n), t + i * 0.12, 0.3, 0.2, o)); break;
      case 'lose': [7, 3, 0, -5].forEach((n, i) => this.osc('sawtooth', mtof(60 + n), t + i * 0.2, 0.4, 0.25, o)); break;
      case 'card': this.osc('square', 150, t, 0.5, 0.35, o, 60); this.noise(t, 0.3, 0.3, o, 2500); break;
      default: break;
    }
  }
}

export const audio = new AudioEngine();
