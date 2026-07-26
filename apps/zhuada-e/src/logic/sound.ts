/**
 * sound.ts — WebAudio SFX engine for Goose Basket Shuffle.
 *
 * The primary cue bank is a deterministic, original set of mastered PCM assets
 * under public/audio. A compact WebAudio synthesizer remains as an immediate
 * first-play/offline fallback while samples decode. The engine is a singleton:
 * the React shell (UI clicks), the guest engine
 * (match/combo), and the Three scene (land/pick/win/fail) all call the same
 * instance so the mute state is shared everywhere.
 *
 * Audio policy:
 *  - The AudioContext starts suspended (browser autoplay rules) and is unlocked
 *    on the first user gesture (Start button / first canvas tap).
 *  - Mute is persisted to localStorage and applied to the master gain.
 */

import { gameStorage } from "./game-storage";
import { publicAssetUrl } from "./public-asset-url";

export type Sfx =
  | "land" // item settles in the pen (velocity-scaled thud)
  | "pick" // player pulls an item out
  | "match" // three-of-a-kind clears
  | "combo" // match inside the combo window
  | "comboBreak" // combo window expired (soft descending tone)
  | "traySlot" // item lands in a tray slot (soft click)
  | "win" // pen emptied, goose caught
  | "fail" // tray jammed / time up
  | "powerup" // hint / add-time used
  | "shuffle" // pen reshuffled
  | "click" // generic UI tick
  | "tick" // countdown urgency tick (last 5 seconds)
  | "unlock" // limited-edition goose unlocked (collection fanfare)
  | "shake"; // pen jolt (G3 晃一晃) — rattling noise bursts

export type Ambience = "garden" | "kitchen" | "night";
export interface SoundQaSnapshot {
  muted: boolean;
  contextState: AudioContextState | "unavailable" | "not-created";
  decodedSamples: number;
  loadingSamples: number;
  ambienceName: Ambience;
  ambiencePlaying: boolean;
  pageVisible: boolean;
}

/** Every cue name — kept in sync with `Sfx` (compile-checked below) so tests
 * can assert cue-table completeness without duplicating the union. */
export const SFX_NAMES = [
  "land", "pick", "match", "combo", "comboBreak", "traySlot", "win", "fail", "powerup", "shuffle", "click", "tick", "unlock", "shake",
] as const satisfies readonly Sfx[];

export const SFX_ASSET_URLS = Object.fromEntries(
  SFX_NAMES.map((name) => [name, publicAssetUrl(`./audio/${name}.wav`)]),
) as Record<Sfx, string>;

export const AMBIENCE_ASSET_URLS: Record<Ambience, string> = {
  garden: publicAssetUrl("./audio/ambient-garden.wav"),
  kitchen: publicAssetUrl("./audio/ambient-kitchen.wav"),
  night: publicAssetUrl("./audio/ambient-night.wav"),
};

/** Compile-time exhaustiveness: a new `Sfx` member missing from SFX_NAMES
 * violates the `extends never` constraint and fails the build. */
type AssertAllSfxListed<T extends never = Exclude<Sfx, (typeof SFX_NAMES)[number]>> = T;
export type SfxTableComplete = AssertAllSfxListed;

const MUTE_KEY = "zhuada-e:sound-muted";
const MASTER_GAIN = 0.5;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Simple 1-tap feedback delay for spatial depth (45ms, 0.22 feedback). */
  private delay: DelayNode | null = null;
  private delayGain: GainNode | null = null;
  private _muted = false;
  private lastLandAt = 0;
  private buffers = new Map<Sfx, AudioBuffer>();
  private loading = new Set<Sfx>();
  private ambienceName: Ambience = "garden";
  private ambience: HTMLAudioElement | null = null;
  private ambiencePlaying = false;
  private pageVisible = typeof document === "undefined" || !document.hidden;
  /**
   * Current combo chain depth. Match/combo cues pitch-shift upward by
   * `comboStep * 40Hz` per step, making chains feel progressively more
   * powerful. Reset to 0 when the combo window expires.
   */
  private comboStep = 0;

  constructor() {
    try {
      this._muted = gameStorage.getItem(MUTE_KEY) === "1";
    } catch {
      /* best-effort */
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibilityChange);
    }
  }

  private onVisibilityChange = (): void => {
    this.pageVisible = !document.hidden;
    this.applyAmbienceState();
  };

  private applyAmbienceState(): void {
    if (!this.ambience) return;
    this.ambience.muted = this._muted;
    if (this.ambiencePlaying && this.pageVisible && !this._muted) {
      void this.ambience.play().catch(() => {});
    } else {
      this.ambience.pause();
    }
  }

  /** Lazily create the context. Returns false if WebAudio is unavailable. */
  private ensure(): boolean {
    if (this.ctx) return true;
    // Delayed fanfare timers can outlive a detached React/game surface during
    // SSR, tests, or an iframe teardown. Treat that exactly like an
    // unsupported WebAudio environment instead of touching a missing window.
    if (typeof window === "undefined") return false;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : MASTER_GAIN;
      this.master.connect(this.ctx.destination);
      // Feedback delay for spatial depth: 45ms tap, 0.22 feedback.
      // Adds a subtle room-like echo without muddying fast SFX sequences.
      this.delay = this.ctx.createDelay(0.1);
      this.delay.delayTime.value = 0.045;
      this.delayGain = this.ctx.createGain();
      this.delayGain.gain.value = 0.22;
      this.delay.connect(this.delayGain);
      this.delayGain.connect(this.delay); // feedback loop
      this.delayGain.connect(this.master); // output tap
      return true;
    } catch {
      this.ctx = null;
      this.master = null;
      this.delay = null;
      this.delayGain = null;
      return false;
    }
  }

  /** Call from within a user-gesture handler to satisfy autoplay policy. */
  unlock(): void {
    if (!this.ensure()) return;
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
    this.preloadSamples();
  }

  /**
   * Set the current combo chain depth. Called by the guest engine on each
   * match (increment) and on combo expiry (reset to 0). Match/combo cues
   * pitch-shift upward by `step * 40Hz`, making chains feel escalating.
   */
  setComboStep(step: number): void {
    this.comboStep = Math.max(0, Math.min(12, step));
  }

  get muted(): boolean {
    return this._muted;
  }

  qaSnapshot(): SoundQaSnapshot {
    return {
      muted: this._muted,
      contextState: this.ctx?.state ?? (typeof window === "undefined" ? "unavailable" : "not-created"),
      decodedSamples: this.buffers.size,
      loadingSamples: this.loading.size,
      ambienceName: this.ambienceName,
      ambiencePlaying: this.ambiencePlaying,
      pageVisible: this.pageVisible,
    };
  }

  /** Re-read after the opaque-iframe host bridge hydrates its sync mirror. */
  reloadStoredPreference(): void {
    try {
      this.setMuted(gameStorage.getItem(MUTE_KEY) === "1");
    } catch {
      /* best-effort */
    }
  }

  setMuted(m: boolean): void {
    this._muted = m;
    try {
      gameStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {
      /* best-effort */
    }
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(m ? 0 : MASTER_GAIN, now, 0.02);
    }
    this.applyAmbienceState();
  }

  toggleMuted(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  setTheme(name: Ambience): void {
    if (this.ambienceName === name && this.ambience) return;
    this.ambienceName = name;
    this.ambience?.pause();
    this.ambience = null;
    if (typeof Audio === "undefined") return;
    try {
      const audio = new Audio(AMBIENCE_ASSET_URLS[name]);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0.14;
      audio.muted = this._muted;
      this.ambience = audio;
      this.applyAmbienceState();
    } catch {
      this.ambience = null;
    }
  }

  setPlaying(playing: boolean): void {
    this.ambiencePlaying = playing;
    if (!this.ambience) this.setTheme(this.ambienceName);
    this.applyAmbienceState();
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
    osc.connect(g);
    g.connect(this.master);
    // Send a portion through the feedback delay for spatial depth.
    if (this.delay) g.connect(this.delay);
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

  private preloadSamples(): void {
    if (!this.ctx || typeof this.ctx.decodeAudioData !== "function" || typeof fetch !== "function") return;
    for (const name of SFX_NAMES) {
      if (this.buffers.has(name) || this.loading.has(name)) continue;
      this.loading.add(name);
      void fetch(SFX_ASSET_URLS[name])
        .then((response) => {
          if (!response.ok) throw 0;
          return response.arrayBuffer();
        })
        .then((bytes) => this.ctx?.decodeAudioData(bytes))
        .then((decoded) => {
          if (decoded) this.buffers.set(name, decoded);
        })
        .catch(() => {
          /* synthesized fallback below remains available */
        })
        .finally(() => this.loading.delete(name));
    }
  }

  private playSample(name: Sfx, velocity: number): boolean {
    if (!this.ctx || !this.master) return false;
    const buffer = this.buffers.get(name);
    if (!buffer) {
      this.preloadSamples();
      return false;
    }
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = Math.max(0.08, Math.min(1, velocity));
    source.connect(gain).connect(this.master);
    source.start();
    return true;
  }

  play(name: Sfx, vel = 1): void {
    if (this._muted) return;
    if (!this.ensure()) return;
    if (!this.ctx || !this.master) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    const t = this.ctx.currentTime;

    if (name === "land") {
      const now = performance.now();
      if (now - this.lastLandAt < 45) return;
      this.lastLandAt = now;
    }
    if (this.playSample(name, vel)) return;

    switch (name) {
      case "land": {
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
        // Bright C-major arpeggio, pitch-shifted up by combo depth.
        const shift = this.comboStep * 40;
        [523.25 + shift, 659.25 + shift, 783.99 + shift].forEach((f, i) => this.tone(f, t + i * 0.06, 0.18, "sine", 0.2));
        break;
      }
      case "combo": {
        // Ascending sparkle for chained clears — pitch escalates with depth.
        const shift = this.comboStep * 40;
        [659.25 + shift, 830.61 + shift, 987.77 + shift, 1318.5 + shift].forEach((f, i) => this.tone(f, t + i * 0.05, 0.14, "triangle", 0.16));
        break;
      }
      case "comboBreak": {
        // Soft descending tone when the combo window expires — communicates
        // "chain lost" without being punishing.
        this.tone(440, t, 0.12, "sine", 0.1);
        this.tone(330, t + 0.08, 0.16, "sine", 0.08);
        break;
      }
      case "traySlot": {
        // Soft click for item landing in a tray slot — lighter than "pick".
        this.tone(880, t, 0.04, "sine", 0.1);
        this.tone(1100, t + 0.02, 0.03, "triangle", 0.06);
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
