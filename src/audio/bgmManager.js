// Background music: one continuous soundtrack on its own gain bus, independent of the SFX bus.
//   1. If public/audio[/custom]/bgm.mp3 (or .ogg / .m4a) exists it is streamed and looped.
//   2. Otherwise a procedural acid-jazz / Shibuya-funk groove is synthesised with Web Audio:
//      124 BPM shuffled 16ths, Dm9 -> G13 -> Cmaj7 -> A7#9, syncopated walking funk bass with
//      slides, FM Rhodes with tremolo, crisp kit, brass stabs and vibraphone chimes.
// It starts (and fades in) on the player's first gesture and never restarts afterwards: deploys,
// waves, pauses and new games all leave it running.
import { audioContext, noiseBuffer, mtof } from './context.js';

export const BPM = 124;
const STEP = 60 / BPM / 4;          // one 16th note in seconds
const SWING = 0.17;                 // offbeat 16ths are pushed late by this fraction of a step
const LOOKAHEAD = 0.14;             // schedule this far ahead (s)
const TICK_MS = 25;

// 8-bar form, one chord per bar. Keys = rootless voicings (MIDI), bass = root in the low octave.
const CHORDS = [
  { name: 'Dm9', root: 38, keys: [53, 57, 60, 64], scale: [38, 41, 43, 45, 48, 50] },
  { name: 'G13', root: 43, keys: [53, 57, 59, 64], scale: [43, 45, 47, 50, 52, 53] },
  { name: 'Cmaj7', root: 36, keys: [52, 55, 59, 62], scale: [36, 40, 43, 45, 47, 48] },
  { name: 'A7#9', root: 33, keys: [55, 60, 61, 64], scale: [33, 37, 40, 43, 45, 48] },
];
// bass rhythm per bar (16th steps) with the scale degree played (index into chord.scale, 'o' = octave)
const BASS = [
  [[0, 0], [3, 0], [6, 'o'], [8, 3], [10, 2], [11, 3], [14, 4]],
  [[0, 0], [2, 'o'], [5, 0], [7, 2], [10, 3], [12, 4], [14, 5]],
];
// Rhodes comping hits per bar: [step, length in steps]
const COMP = [
  [[0, 5], [6, 2], [10, 4]],
  [[2, 3], [7, 2], [11, 4], [14, 2]],
];
const KICK = [[0, 7, 10], [0, 3, 8, 11, 14]];
const VIBE = [74, 77, 79, 81, 84, 86]; // D dorian / minor pentatonic up top

export class BgmManager {
  constructor() {
    this.ctx = null;
    this.bus = null;
    this.state = 'idle';           // idle | file | procedural
    this.started = false;
    this.volume = 0.55;
    this.muted = false;
    this.fileURL = null;
    this.audioEl = null;
    this.timer = null;
    this.step = 0;                 // absolute 16th counter
    this.nextTime = 0;
    this.intensity = 0.4;          // 0 = calm (scenes, menus) .. 1 = a crowd at the Treasure
    this.target = 0.4;
    this.transpose = 0;            // per act: the same groove in a new key
  }

  /** Act I / II / III of the story: the groove moves key (and loses its brightness in Act III). */
  setAct(n) {
    this.transpose = [0, 0, -2, -5][Math.max(0, Math.min(3, n))];
  }

  /** How hot the stage is right now (eases there over a bar or so). */
  setIntensity(v) {
    this.target = Math.max(0, Math.min(1, v));
  }

  /** Optional streamed track (resolved from the build-time asset index; null = procedural). */
  setFile(url) {
    this.fileURL = url || null;
  }

  setVolume(v) {
    this.volume = v;
    this.apply();
  }

  setMuted(m) {
    this.muted = m;
    this.apply();
  }

  apply(fade = 0.25) {
    if (!this.bus) return;
    const t = this.ctx.currentTime;
    const g = this.bus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(this.muted ? 0 : this.volume, t + fade);
  }

  /** Call from a user gesture. Idempotent: the soundtrack is created once and keeps looping. */
  start() {
    if (this.started) {
      if (this.ctx?.state === 'suspended') this.ctx.resume();
      return;
    }
    const c = audioContext();
    if (!c) return;
    this.started = true;
    this.ctx = c;
    if (c.state === 'suspended') c.resume();
    this.bus = c.createGain();
    this.bus.gain.value = 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.2;
    this.bus.connect(comp).connect(c.destination);
    this.apply(2.5); // smooth fade-in
    if (this.fileURL) this.startFile();
    else this.startProcedural();
    // phones: stop the clock while hidden, resume where it was
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) c.suspend?.();
      else c.resume?.();
    });
  }

  startFile() {
    const el = new Audio();
    el.src = this.fileURL;
    el.loop = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    let fell = false;
    const fallback = () => {
      if (fell || this.state === 'procedural') return;
      fell = true;
      console.warn(`[audio] could not play ${this.fileURL}; using the procedural soundtrack.`);
      el.pause();
      this.startProcedural();
    };
    el.addEventListener('error', fallback, { once: true });
    try {
      this.ctx.createMediaElementSource(el).connect(this.bus);
    } catch {
      fallback();
      return;
    }
    this.audioEl = el;
    this.state = 'file';
    el.play()?.catch?.(fallback);
  }

  // ---------------------------------------------------------------- procedural groove
  startProcedural() {
    const c = this.ctx;
    this.state = 'procedural';
    this.noise = noiseBuffer(c);
    // instrument sub-buses
    const mk = (v) => { const g = c.createGain(); g.gain.value = v; g.connect(this.bus); return g; };
    this.drums = mk(0.8);
    this.bass = mk(0.75);
    this.keys = mk(0.42);
    this.brass = mk(0.22);
    this.vibes = mk(0.2);
    // Rhodes tremolo: an LFO wobbling the keys bus gain
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = 4.6;
    depth.gain.value = 0.12;
    lfo.connect(depth).connect(this.keys.gain);
    lfo.start();
    // small room: a generated impulse response, sent from keys / vibes / brass
    this.verb = c.createConvolver();
    this.verb.buffer = this.impulse(1.6);
    const wet = c.createGain();
    wet.gain.value = 0.25;
    this.verb.connect(wet).connect(this.bus);
    for (const b of [this.keys, this.vibes, this.brass]) b.connect(this.verb);

    this.step = 0;
    this.nextTime = c.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  impulse(sec) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return buf;
  }

  schedule() {
    const c = this.ctx;
    // a throttled background tab must not dump a backlog of notes: skip ahead instead
    if (this.nextTime < c.currentTime - 0.2) {
      const behind = Math.ceil((c.currentTime - this.nextTime) / STEP);
      this.step += behind;
      this.nextTime += behind * STEP;
    }
    while (this.nextTime < c.currentTime + LOOKAHEAD) {
      const s = this.step % 16;
      const t = this.nextTime + (s % 2 ? SWING * STEP : 0);
      this.playStep(this.step, t);
      this.step++;
      this.nextTime += STEP;
    }
  }

  playStep(n, t) {
    this.intensity += (this.target - this.intensity) * 0.02;
    const I = this.intensity;
    const tr = this.transpose;
    const s = n % 16;
    const bar = Math.floor(n / 16);
    const chord = CHORDS[bar % 4];
    const next = CHORDS[(bar + 1) % 4];
    const half = Math.floor(bar / 4) % 2; // second pass of the form gets the busier variations
    const phrase = Math.floor(bar / 8);

    // --- drums
    // calm: kick on the one and the snare backbeat only; hot: four on the floor, busier hats
    const drums = 0.45 + I * 0.55;
    if (KICK[bar % 2].includes(s) && (I > 0.25 || s === 0)) this.kick(t, (s === 0 ? 1 : 0.8) * drums);
    else if (I > 0.8 && s % 4 === 0) this.kick(t, 0.55);
    if (s === 4 || s === 12) this.snare(t, I > 0.15 ? drums : 0.4);
    else if ((s === 7 || s === 15) && (bar % 2 || I > 0.7)) this.snare(t, 0.18); // ghost notes
    if (bar % 8 === 7 && s >= 13 && I > 0.3) this.snare(t, 0.35 + (s - 13) * 0.2); // fill into the top
    const open = s === 14 && bar % 2 === 1;
    if (I > 0.2 || s % 4 === 2) this.hat(t, (open ? 0.5 : s % 4 === 2 ? 0.55 : s % 2 ? 0.22 : 0.38) * (0.6 + I * 0.4), open);

    // --- bass: syncopated walking funk line, sliding into the next chord on the last note
    const line = BASS[(bar + half) % 2];
    const hit = line.find(([st]) => st === s);
    if (hit) {
      const deg = hit[1];
      const note = (deg === 'o' ? chord.root + 12 : chord.scale[deg]) + tr;
      const last = hit === line[line.length - 1];
      const slideTo = last ? next.root + tr + (next.root < chord.root - 5 ? 12 : 0) : null;
      const len = last ? 2 : (line[line.indexOf(hit) + 1]?.[0] ?? 16) - s;
      this.bassNote(t, note, Math.min(len, 3) * STEP * 0.92, slideTo);
    }

    // --- Rhodes comping
    const comp = COMP[(bar + phrase) % 2].find(([st]) => st === s);
    if (comp) {
      const vel = s === 0 ? 0.9 : 0.65;
      chord.keys.forEach((m, i) => this.rhodes(t + i * 0.006, m + tr, comp[1] * STEP, vel));
    }

    // --- brass stabs: punch the downbeat of every 4th bar, anticipate the turnaround
    if (I > 0.45 && ((bar % 4 === 0 && s === 0 && (half || I > 0.75)) || (bar % 4 === 3 && s === 14))) {
      const tgt = s === 14 ? next : chord;
      this.stab(t, tgt.keys.slice(-3).map((m) => m + 12 + tr), s === 14 ? 0.18 : 0.26);
    }

    // --- vibraphone chimes accenting downbeats
    if (s === 0 && bar % 2 === 1) this.vibe(t, VIBE[(bar * 3 + phrase) % VIBE.length] + tr, 0.8);
    if (s === 3 && bar % 4 === 1) this.vibe(t, VIBE[(bar * 5 + 2) % VIBE.length] + tr, 0.5);
    if (s === 8 && bar % 8 === 6) [0, 2, 4].forEach((k, i) => this.vibe(t + i * STEP, VIBE[(k + phrase) % VIBE.length] + tr, 0.5));
  }

  env(g, t, peak, a, d, sustain = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + d);
  }

  kick(t, v) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    this.env(g, t, 0.95 * v, 0.002, 0.32);
    o.connect(g).connect(this.drums);
    o.start(t);
    o.stop(t + 0.36);
  }

  snare(t, v) {
    const c = this.ctx;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.Q.value = 0.8;
    const g = c.createGain();
    this.env(g, t, 0.55 * v, 0.001, 0.16);
    n.connect(bp).connect(g).connect(this.drums);
    n.start(t, Math.random() * 0.5);
    n.stop(t + 0.18);
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    const og = c.createGain();
    this.env(og, t, 0.4 * v, 0.001, 0.09);
    o.connect(og).connect(this.drums);
    o.start(t);
    o.stop(t + 0.1);
  }

  hat(t, v, open) {
    const c = this.ctx;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7200;
    const g = c.createGain();
    const len = open ? 0.22 : 0.035;
    this.env(g, t, 0.22 * v, 0.001, len);
    n.connect(hp).connect(g).connect(this.drums);
    n.start(t, Math.random() * 0.5);
    n.stop(t + len + 0.02);
  }

  bassNote(t, m, len, slideTo) {
    const c = this.ctx;
    const f = mtof(m);
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    o1.frequency.setValueAtTime(f, t);
    o2.frequency.setValueAtTime(f / 2, t);
    if (slideTo != null) {
      // pitch-bend slide into the next chord's root over the tail of the note
      const ft = mtof(slideTo);
      for (const [o, k] of [[o1, 1], [o2, 0.5]]) {
        o.frequency.setValueAtTime(f * k, t + len * 0.55);
        o.frequency.exponentialRampToValueAtTime(ft * k, t + len);
      }
    }
    const sub = c.createGain();
    sub.gain.value = 0.5;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 5;
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + Math.max(0.08, len));
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.006);
    g.gain.setValueAtTime(0.42, t + len * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05);
    o1.connect(lp);
    o2.connect(sub).connect(lp);
    lp.connect(g).connect(this.bass);
    o1.start(t);
    o2.start(t);
    o1.stop(t + len + 0.08);
    o2.stop(t + len + 0.08);
  }

  /** Rhodes: two FM pairs (tine + body), the tine's modulation index decaying fast. */
  rhodes(t, m, len, v) {
    const c = this.ctx;
    const f = mtof(m);
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(0.18 * v, t + 0.004);
    out.gain.exponentialRampToValueAtTime(0.09 * v, t + 0.25);
    out.gain.setValueAtTime(0.09 * v, t + len);
    out.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.35);
    const end = t + len + 0.4;
    for (const [ratio, idx, decay, detune] of [[1, 2.2, 0.35, 0], [14, 0.6, 0.06, 4]]) {
      const car = c.createOscillator();
      const mod = c.createOscillator();
      const mg = c.createGain();
      car.frequency.value = f;
      car.detune.value = detune;
      mod.frequency.value = f * ratio;
      mg.gain.setValueAtTime(f * idx, t);
      mg.gain.exponentialRampToValueAtTime(f * idx * 0.05, t + decay);
      mod.connect(mg).connect(car.frequency);
      car.connect(out);
      car.start(t);
      mod.start(t);
      car.stop(end);
      mod.stop(end);
    }
    out.connect(this.keys);
  }

  stab(t, notes, len) {
    const c = this.ctx;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(3200, t + 0.04);
    lp.frequency.exponentialRampToValueAtTime(900, t + len);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.02);
    g.gain.setValueAtTime(0.42, t + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.06);
    lp.connect(g).connect(this.brass);
    for (const m of notes) {
      for (const d of [-7, 6]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = d;
        o.connect(lp);
        o.start(t);
        o.stop(t + len + 0.08);
      }
    }
  }

  vibe(t, m, v) {
    const c = this.ctx;
    const f = mtof(m);
    const g = c.createGain();
    this.env(g, t, 0.3 * v, 0.003, 1.3);
    for (const [k, a] of [[1, 1], [4, 0.18], [10, 0.05]]) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.frequency.value = f * k;
      og.gain.value = a;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 1.35);
    }
    g.connect(this.vibes);
  }

  status() {
    return { state: this.state, started: this.started, muted: this.muted, volume: this.volume, step: this.step, ctx: this.ctx?.state ?? null };
  }
}
