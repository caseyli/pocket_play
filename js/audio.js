// Shared synthesised sounds (Web Audio API). No audio files.
// The AudioContext is created on the first user tap, as browsers require.

const MUTE_KEY = 'pp-muted';
const PENTA = [0, 2, 4, 7, 9];
const BASE_HZ = 392; // G4

/** Frequency of the i-th step up a major pentatonic scale from BASE_HZ. */
export const noteFreq = (i) => {
  i = Math.max(0, Math.min(i, 16));
  return BASE_HZ * Math.pow(2, (Math.floor(i / 5) * 12 + PENTA[i % 5]) / 12);
};

function loadMuted() {
  try { return localStorage.getItem(MUTE_KEY) === 'true'; } catch (e) { return false; }
}

class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._muted = loadMuted();
    this._lastLand = 0;
    this._voices = new Set();
  }

  get muted() { return this._muted; }
  set muted(v) {
    this._muted = !!v;
    try { localStorage.setItem(MUTE_KEY, String(this._muted)); } catch (e) {}
    if (this._muted) this.stopAll();
  }

  /** Call from a user gesture. Creates/resumes the AudioContext. */
  init() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try {
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  /** Suspend when the app is hidden so nothing keeps running in the background. */
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }

  /** Immediately silence every sound still playing. */
  stopAll() {
    for (const o of this._voices) { try { o.stop(); } catch (e) {} }
    this._voices.clear();
  }

  tone(freq, dur, type = 'triangle', vol = 0.16, when = 0, slideTo) {
    if (this._muted || !this.ctx || this.ctx.state === 'closed') return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
    this._voices.add(o);
    o.onended = () => { this._voices.delete(o); g.disconnect(); };
  }

  // ---- Named sounds ----
  /** A note per dot added, rising up the scale as the chain grows. */
  connect(i) { const f = noteFreq(i); this.tone(f, 0.2, 'triangle', 0.17); this.tone(f * 2, 0.1, 'sine', 0.05); }
  /** Backtrack: the note steps back down. */
  back(i) { this.tone(noteFreq(i), 0.12, 'triangle', 0.1); }
  /** Bubbly downward bloop, pitch rising along the chain. */
  pop(i) { const f = 520 + Math.min(i, 14) * 45; this.tone(f * 1.8, 0.13, 'sine', 0.22, 0, f * 0.5); this.tone(f * 3, 0.04, 'square', 0.03); }
  /** Very soft landing tick, throttled. */
  land() {
    const n = performance.now();
    if (n - this._lastLand < 70) return;
    this._lastLand = n;
    this.tone(220, 0.05, 'sine', 0.035);
  }
  /** Milestone / game start. */
  jingle() {
    [0, 2, 4, 5, 7].forEach((s, k) => this.tone(noteFreq(s + 5), 0.22, 'triangle', 0.16, k * 0.09));
    this.tone(noteFreq(12), 0.5, 'sine', 0.1, 0.45);
  }
  /** Big chain: short cheerful chord. */
  cheer() { [0, 4, 7].forEach((s, k) => this.tone(noteFreq(s + 3), 0.18, 'triangle', 0.13, k * 0.06)); }
  /** Shuffle / exit. */
  swoosh() { this.tone(900, 0.45, 'triangle', 0.08, 0, 160); this.tone(300, 0.5, 'sine', 0.08, 0.35, 700); }
  /** Little "blip" used to confirm unmuting. */
  blip() { this.connect(4); }

  // ---- Traffic lights, stars, karts ----
  lightGreen() { this.tone(noteFreq(5), 0.16, 'triangle', 0.14); this.tone(noteFreq(9), 0.3, 'triangle', 0.15, 0.12); }
  lightYellow() { this.tone(noteFreq(7), 0.35, 'sine', 0.12); this.tone(noteFreq(7) * 2, 0.15, 'sine', 0.03); }
  lightRed() { this.tone(noteFreq(7), 0.2, 'triangle', 0.13); this.tone(noteFreq(2), 0.35, 'triangle', 0.13, 0.16); }
  /** Gentle "stop, stop!" reminder: two soft low boops. Never harsh. */
  remind() { this.tone(330, 0.14, 'sine', 0.12); this.tone(262, 0.2, 'sine', 0.12, 0.18); }
  /** Sparkly arpeggio for earning a star. */
  star() { [7, 9, 10, 12].forEach((s, k) => this.tone(noteFreq(s), 0.16, 'triangle', 0.12, k * 0.06)); this.tone(noteFreq(14), 0.4, 'sine', 0.06, 0.24); }
  /** Little tyre squeak. */
  squeak() { this.tone(1400, 0.16, 'sine', 0.035, 0, 900); }

  /**
   * A continuous, soft engine hum. Returns { set(speed01), quiet(), stop() }.
   * quiet() silences it until the next set(); stop() ends it for good.
   * Respects mute; restarts itself if it was silenced by stopAll() or muting.
   */
  engine() {
    let nodes = null, stopped = false;
    const build = () => {
      const c = this.ctx;
      const out = c.createGain(); out.gain.value = 0.0001;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.7;
      const o1 = c.createOscillator(); o1.type = 'triangle';
      const o2 = c.createOscillator(); o2.type = 'sawtooth';
      const o2g = c.createGain(); o2g.gain.value = 0.25; // a little grit, filtered soft
      const lfo = c.createOscillator(); lfo.type = 'sine';
      const lfoG = c.createGain(); lfoG.gain.value = 4;
      lfo.connect(lfoG); lfoG.connect(o1.frequency); lfoG.connect(o2.frequency);
      o1.connect(lp); o2.connect(o2g).connect(lp); lp.connect(out).connect(this.master);
      const oscs = [o1, o2, lfo];
      const n = { out, lp, o1, o2, lfo, oscs };
      oscs.forEach((o) => {
        o.start();
        this._voices.add(o);
        o.onended = () => { this._voices.delete(o); if (nodes === n) kill(); }; // e.g. silenced by stopAll()
      });
      return n;
    };
    const kill = () => {
      if (!nodes) return;
      const n = nodes; nodes = null;
      n.oscs.forEach((o) => { try { o.stop(); } catch (e) {} });
      try { n.out.disconnect(); } catch (e) {}
    };
    return {
      set: (v) => {
        if (stopped || !this.ctx || this.ctx.state === 'closed') return;
        if (this._muted) { kill(); return; }
        if (!nodes) nodes = build();
        const t = this.ctx.currentTime;
        v = Math.max(0, Math.min(1, v));
        const f = 55 + v * 85;
        nodes.o1.frequency.setTargetAtTime(f, t, 0.08);
        nodes.o2.frequency.setTargetAtTime(f * 1.005, t, 0.08);
        nodes.lfo.frequency.setTargetAtTime(7 + v * 9, t, 0.1);
        nodes.lp.frequency.setTargetAtTime(380 + v * 700, t, 0.1);
        nodes.out.gain.setTargetAtTime(0.018 + v * 0.05, t, 0.08);
      },
      quiet: () => kill(),
      stop: () => { stopped = true; kill(); },
    };
  }
}

export const audio = new Audio();

/** Short vibration where supported; silently skipped elsewhere. */
export function buzz(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
}
