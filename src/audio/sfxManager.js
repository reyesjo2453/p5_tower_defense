// One-shot combat / UI sound effects on their own gain bus (separate from the BGM bus, so the two
// can be balanced independently). Everything is synthesised; no files to load.
//   tap()    card / button tap: crisp dual high sine pip
//   place()  unit placement: rushing swoosh during the drop, sub-bass thud on landing
//   punch()  melee strike: sharp percussive snap with low-frequency weight
//   magic()  tech / magic trigger: resonant digital sweep with a chime tail
import { audioContext, noiseBuffer } from './context.js';

const MIN_GAP = 0.045; // the same sound retriggering faster than this is dropped (crowded fights)
const MAX_VOICES = 14;

export class SfxManager {
  constructor() {
    this.ctx = null;
    this.bus = null;
    this.volume = 0.8;
    this.muted = false;
    this.last = {};
    this.voices = 0;
    this.played = 0;
  }

  /** Call from a user gesture (shares the context with the BGM, but not its bus). */
  start() {
    if (this.bus) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const c = audioContext();
    if (!c) return;
    this.ctx = c;
    if (c.state === 'suspended') c.resume();
    this.bus = c.createGain();
    this.bus.connect(c.destination);
    this.noise = noiseBuffer(c);
    this.apply();
  }

  setVolume(v) {
    this.volume = v;
    this.apply();
  }

  setMuted(m) {
    this.muted = m;
    this.apply();
  }

  apply() {
    if (!this.bus) return;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setTargetAtTime(this.muted ? 0 : this.volume, t, 0.03);
  }

  /** Returns the start time, or -1 when the sound should be skipped. */
  gate(name) {
    if (!this.bus || this.muted || this.ctx.state !== 'running') return -1;
    const t = this.ctx.currentTime;
    if (t - (this.last[name] ?? -1) < MIN_GAP || this.voices >= MAX_VOICES) return -1;
    this.last[name] = t;
    this.played++;
    return t + 0.005;
  }

  voice(node, end) {
    this.voices++;
    node.onended = () => { this.voices--; };
    node.stop(end);
  }

  osc(type, f, t) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    return o;
  }

  gain(t, peak, attack, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.bus);
    return g;
  }

  noiseSrc(t) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    n.start(t, Math.random() * 0.5);
    return n;
  }

  /** Card tap: two quick high sine pips. */
  tap() {
    const t = this.gate('tap');
    if (t < 0) return;
    [[1850, 0], [2770, 0.045]].forEach(([f, dt]) => {
      const o = this.osc('sine', f, t + dt);
      o.connect(this.gain(t + dt, 0.16, 0.002, 0.05));
      this.voice(o, t + dt + 0.07);
    });
  }

  /** Unit placement: swoosh while the sprite drops in (~180 ms), then a sub-bass thud. */
  place(delay = 0.17) {
    const t = this.gate('place');
    if (t < 0) return;
    const c = this.ctx;
    const n = this.noiseSrc(t);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(3800, t);
    bp.frequency.exponentialRampToValueAtTime(420, t + delay);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + delay * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.06);
    n.connect(bp).connect(g).connect(this.bus);
    this.voice(n, t + delay + 0.08);
    const land = t + delay;
    const o = this.osc('sine', 120, land);
    o.frequency.exponentialRampToValueAtTime(38, land + 0.22);
    o.connect(this.gain(land, 0.95, 0.004, 0.32));
    this.voice(o, land + 0.36);
    const click = this.noiseSrc(land);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    click.connect(lp).connect(this.gain(land, 0.35, 0.001, 0.07));
    this.voice(click, land + 0.09);
  }

  /** Melee strike: noise snap on top, a pitched-down sine punch underneath. */
  punch() {
    const t = this.gate('punch');
    if (t < 0) return;
    const c = this.ctx;
    const n = this.noiseSrc(t);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    n.connect(hp).connect(this.gain(t, 0.5, 0.001, 0.05));
    this.voice(n, t + 0.07);
    const o = this.osc('sine', 170, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.1);
    o.connect(this.gain(t, 0.75, 0.002, 0.13));
    this.voice(o, t + 0.16);
    const s = this.osc('square', 95, t);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    s.connect(lp).connect(this.gain(t, 0.14, 0.001, 0.05));
    this.voice(s, t + 0.07);
  }

  /** Tech / magic: resonant band-pass sweep over a buzzy source, then a soft chime. */
  magic() {
    const t = this.gate('magic');
    if (t < 0) return;
    const c = this.ctx;
    const o = this.osc('sawtooth', 220, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.18);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 14;
    bp.frequency.setValueAtTime(600, t);
    bp.frequency.exponentialRampToValueAtTime(4200, t + 0.16);
    o.connect(bp).connect(this.gain(t, 0.3, 0.01, 0.2));
    this.voice(o, t + 0.24);
    for (const [f, a] of [[2093, 0.1], [3136, 0.05]]) {
      const ch = this.osc('sine', f, t + 0.08);
      ch.connect(this.gain(t + 0.08, a, 0.003, 0.55));
      this.voice(ch, t + 0.7);
    }
  }

  status() {
    return { ready: !!this.bus, muted: this.muted, volume: this.volume, played: this.played, voices: this.voices };
  }
}
