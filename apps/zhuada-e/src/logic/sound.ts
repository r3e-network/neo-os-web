/**
 * sound.ts — tiny WebAudio SFX engine for Catch the Goose.
 *
 * Every sound is SYNTHESIZED at runtime (oscillators + filtered noise) — there
 * are no audio files, so nothing is copyrighted and the bundle stays tiny. The
 * engine is a singleton: the React shell (UI clicks), the guest engine
 * (match/combo), and the Three scene (land/pick/win/fail) all call the same
 * instance so the mute state is shared everywhere.
 *
 * Audio policy:
 *  - The AudioContext starts suspended (browser autoplay rules) and is unlocked
 *    on the first user gesture (Start button / first canvas tap).
 *  - Mute is persisted to localStorage and applied to the master gain.
 */

export type Sfx =
  | "land" // item settles in the pen (velocity-scaled thud)
  | "pick" // player pulls an item out
  | "match" // three-of-a-kind clears
  | "combo" // match inside the combo window
  | "win" // pen emptied, goose caught
  | "fail" // tray jammed / time up
  | "powerup" // hint / add-time used
  | "shuffle" // pen reshuffled
  | "click" // generic UI tick
  | "tick" // countdown urgency tick (last 5 seconds)
  | "unlock" // limited-edition goose unlocked (collection fanfare)
  | "shake"; // pen jolt (G3 晃一晃) — rattling noise bursts

/** Every cue name — kept in sync with `Sfx` (compile-checked below) so tests
 * can assert cue-table completeness without duplicating the union. */
export const SFX_NAMES = [
  "land", "pick", "match", "combo", "win", "fail", "powerup", "shuffle", "click", "tick", "unlock", "shake",
] as const satisfies readonly Sfx[];

/** Compile-time exhaustiveness: a new `Sfx` member missing from SFX_NAMES
 * violates the `extends never` constraint and fails the build. */
type AssertAllSfxListed<T extends never = Exclude<Sfx, (typeof SFX_NAMES)[number]>> = T;
export type SfxTableComplete = AssertAllSfxListed;

const MUTE_KEY = "zhuada-e:sound-muted";
const MASTER_GAIN = 0.5;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted = false;
  private lastLandAt = 0;

  constructor() {
    try {
      this._muted = globalThis.localStorage?.getItem(MUTE_KEY) === "1";
    } catch {
      /* best-effort */
    }
  }

  /** Lazily create the context. Returns false if WebAudio is unavailable. */
  private ensure(): boolean {
    if (this.ctx) return true;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : MASTER_GAIN;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      this.ctx = null;
      this.master = null;
      return false;
    }
  }

  /** Call from within a user-gesture handler to satisfy autoplay policy. */
  unlock(): void {
    if (!this.ensure()) return;
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(m: boolean): void {
    this._muted = m;
    try {
      globalThis.localStorage?.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {
      /* best-effort */
    }
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(m ? 0 : MASTER_GAIN, now, 0.02);
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  // ── Low-level voices ────────────────────────────────────────────────────────

  private tone(freq: number, start: number, dur: number, type: OscillatorType, peak: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private noise(start: number, dur: number, peak: number, cutoff: number): void {
    if (!this.ctx || !this.master) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, peak), start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(lp).connect(g).connect(this.master);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  play(name: Sfx, vel = 1): void {
    if (this._muted) return;
    if (!this.ensure()) return;
    if (!this.ctx || !this.master) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    const t = this.ctx.currentTime;

    switch (name) {
      case "land": {
        const now = performance.now();
        if (now - this.lastLandAt < 45) return; // throttle cascades
        this.lastLandAt = now;
        const v = Math.max(0.15, Math.min(1, vel));
        this.noise(t, 0.09, 0.16 * v, 420 + 500 * v);
        this.tone(90 + 40 * v, t, 0.1, "sine", 0.12 * v);
        break;
      }
      case "pick": {
        this.tone(520, t, 0.09, "triangle", 0.22);
        this.tone(780, t + 0.03, 0.08, "sine", 0.14);
        break;
      }
      case "match": {
        // Bright C-major arpeggio.
        [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, t + i * 0.06, 0.18, "sine", 0.2));
        break;
      }
      case "combo": {
        // Ascending sparkle for chained clears.
        [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => this.tone(f, t + i * 0.05, 0.14, "triangle", 0.16));
        break;
      }
      case "win": {
        [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.12, 0.34, "triangle", 0.22));
        break;
      }
      case "fail": {
        this.tone(392, t, 0.3, "sawtooth", 0.16);
        this.tone(261.63, t + 0.16, 0.42, "sawtooth", 0.16);
        break;
      }
      case "powerup": {
        this.tone(660, t, 0.1, "sine", 0.16);
        this.tone(990, t + 0.05, 0.14, "sine", 0.16);
        this.tone(1320, t + 0.12, 0.16, "sine", 0.12);
        break;
      }
      case "shuffle": {
        for (let i = 0; i < 5; i += 1) this.tone(400 + i * 120, t + i * 0.04, 0.05, "square", 0.08);
        break;
      }
      case "click": {
        this.tone(1200, t, 0.03, "square", 0.06);
        break;
      }
      case "tick": {
        // Countdown urgency — a short woodblock-style knock, deliberately
        // quieter than gameplay cues so it pressures without drowning them.
        this.tone(1050, t, 0.035, "square", 0.07);
        this.tone(520, t, 0.06, "sine", 0.09);
        break;
      }
      case "unlock": {
        // Collection fanfare — a wider, slower flourish than "win" (major
        // sixth chord roll + top sparkle) marking the limited-goose moment.
        [523.25, 659.25, 880, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.09, 0.4, "triangle", 0.2));
        this.tone(1318.5, t + 0.42, 0.5, "sine", 0.16);
        this.tone(1760, t + 0.5, 0.4, "sine", 0.1);
        break;
      }
      case "shake": {
        // Pen jolt — a quick run of low filtered-noise rattles (the pile
        // clattering) under a descending wobble tone.
        for (let i = 0; i < 4; i += 1) {
          this.noise(t + i * 0.06, 0.07, 0.14 - i * 0.02, 700 - i * 90);
        }
        this.tone(180, t, 0.12, "triangle", 0.12);
        this.tone(140, t + 0.1, 0.14, "triangle", 0.1);
        break;
      }
    }
  }
}

export const sound = new SoundEngine();
