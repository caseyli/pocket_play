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
}

export const audio = new Audio();

/** Short vibration where supported; silently skipped elsewhere. */
export function buzz(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
}
