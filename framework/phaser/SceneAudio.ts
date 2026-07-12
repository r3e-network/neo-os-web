/**
 * SceneAudio — shared procedural sound-effect mixer for miniapp game scenes.
 *
 * Every game scene gets lightweight synthesized cues (oscillator + gain
 * envelope) without shipping audio assets. The mixer is created lazily, obeys
 * browser autoplay policy (silent until the first user-gesture unlock), and
 * closes its AudioContext with the scene.
 *
 * Usage inside a BaseScene subclass (preferred — BaseScene owns lifecycle):
 *
 * ```ts
 * this.sfx.play("tap");                 // named preset
 * this.sfx.tones([{ frequency: 220, duration: 0.06, endFrequency: 150 }]);
 * ```
 *
 * Standalone usage:
 *
 * ```ts
 * const audio = new SceneAudio().attach(scene);
 * audio.unlock();   // call from a pointer handler
 * audio.play("win");
 * ```
 */

export const SCENE_AUDIO_MUTE_STORAGE_KEY = "neo-miniapps:phaser-audio-muted";
export const SCENE_AUDIO_MUTE_EVENT = "neo-miniapps:phaser-audio-muted-change";

export type SceneAudioTone = {
  /** Oscillator start frequency in Hz. */
  frequency: number;
  /** Tone duration in seconds. */
  duration: number;
  /** Start offset in seconds relative to "now". */
  delay?: number;
  /** Oscillator wave shape. Defaults to "sine". */
  type?: OscillatorType;
  /** Peak envelope gain. Defaults to 0.02; keep ≤0.08 for a consistent mix. */
  gain?: number;
  /** Optional exponential glide target frequency in Hz. */
  endFrequency?: number;
};

export type SceneAudioPreset =
  | "tap"
  | "select"
  | "start"
  | "move"
  | "merge"
  | "spawn"
  | "tick"
  | "chip"
  | "throw"
  | "land"
  | "win"
  | "lose"
  | "error"
  | "refund"
  | "flap"
  | "score"
  | "combo"
  | "reveal";

/**
 * Named cue recipes shared across games. Tuned against the hand-rolled
 * mixers that shipped first in 2048 Rush, Dice Game, and Flappy Dash.
 */
export const SCENE_AUDIO_PRESETS: Record<SceneAudioPreset, SceneAudioTone[]> = {
  tap: [{ frequency: 520, duration: 0.045, type: "triangle", gain: 0.022, endFrequency: 680 }],
  select: [{ frequency: 440, duration: 0.05, type: "triangle", gain: 0.02, endFrequency: 560 }],
  start: [
    { frequency: 392, duration: 0.07, type: "triangle", gain: 0.03, endFrequency: 587 },
    { frequency: 784, duration: 0.09, delay: 0.06, type: "sine", gain: 0.026, endFrequency: 988 },
  ],
  move: [{ frequency: 260, duration: 0.045, type: "triangle", gain: 0.016, endFrequency: 320 }],
  merge: [
    { frequency: 440, duration: 0.06, type: "sine", gain: 0.024, endFrequency: 660 },
    { frequency: 880, duration: 0.07, delay: 0.045, type: "triangle", gain: 0.021, endFrequency: 1040 },
  ],
  spawn: [{ frequency: 720, duration: 0.045, type: "sine", gain: 0.016, endFrequency: 940 }],
  tick: [{ frequency: 310, duration: 0.025, type: "square", gain: 0.012, endFrequency: 220 }],
  chip: [
    { frequency: 390, duration: 0.045, type: "sine", gain: 0.024, endFrequency: 520 },
    { frequency: 780, duration: 0.04, delay: 0.035, type: "triangle", gain: 0.018, endFrequency: 920 },
  ],
  throw: [
    { frequency: 180, duration: 0.07, type: "sawtooth", gain: 0.025, endFrequency: 360 },
    { frequency: 540, duration: 0.08, delay: 0.045, type: "triangle", gain: 0.02, endFrequency: 760 },
  ],
  land: [{ frequency: 220, duration: 0.06, type: "triangle", gain: 0.028, endFrequency: 150 }],
  win: [
    { frequency: 523, duration: 0.12, type: "triangle", gain: 0.026 },
    { frequency: 659, duration: 0.12, delay: 0.065, type: "triangle", gain: 0.026 },
    { frequency: 784, duration: 0.12, delay: 0.13, type: "triangle", gain: 0.026 },
    { frequency: 1046, duration: 0.14, delay: 0.195, type: "triangle", gain: 0.026 },
  ],
  lose: [
    { frequency: 330, duration: 0.12, type: "triangle", gain: 0.024, endFrequency: 196 },
    { frequency: 165, duration: 0.16, delay: 0.09, type: "sine", gain: 0.02, endFrequency: 110 },
  ],
  error: [{ frequency: 220, duration: 0.08, type: "square", gain: 0.014, endFrequency: 180 }],
  refund: [
    { frequency: 392, duration: 0.08, type: "sine", gain: 0.02, endFrequency: 440 },
    { frequency: 523, duration: 0.1, delay: 0.07, type: "sine", gain: 0.018 },
  ],
  flap: [{ frequency: 600, duration: 0.05, type: "triangle", gain: 0.02, endFrequency: 900 }],
  score: [{ frequency: 660, duration: 0.06, type: "sine", gain: 0.022, endFrequency: 880 }],
  combo: [
    { frequency: 523, duration: 0.06, type: "triangle", gain: 0.022, endFrequency: 660 },
    { frequency: 784, duration: 0.07, delay: 0.05, type: "triangle", gain: 0.02, endFrequency: 988 },
  ],
  reveal: [
    { frequency: 494, duration: 0.09, type: "sine", gain: 0.02, endFrequency: 659 },
    { frequency: 740, duration: 0.11, delay: 0.08, type: "sine", gain: 0.017, endFrequency: 988 },
  ],
};

export function isSceneAudioMuted(): boolean {
  const win = getBrowserWindow();
  if (!win) return false;
  try {
    return win.localStorage.getItem(SCENE_AUDIO_MUTE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setSceneAudioMuted(muted: boolean): void {
  const win = getBrowserWindow();
  if (!win) return;
  try {
    win.localStorage.setItem(SCENE_AUDIO_MUTE_STORAGE_KEY, muted ? "true" : "false");
  } catch {
    // Private browsing / disabled storage should not break game input.
  }
  const event =
    typeof win.CustomEvent === "function"
      ? new win.CustomEvent(SCENE_AUDIO_MUTE_EVENT, { detail: { muted } })
      : new Event(SCENE_AUDIO_MUTE_EVENT);
  win.dispatchEvent(event);
}

export function toggleSceneAudioMuted(): boolean {
  const muted = !isSceneAudioMuted();
  setSceneAudioMuted(muted);
  return muted;
}

/** Minimal structural slice of Phaser.Scene needed for lifecycle binding. */
type SceneAudioHost = {
  events: {
    once(event: string, handler: () => void, context?: unknown): unknown;
  };
};

type SceneAudioWindow = Window & {
  AudioContext?: typeof AudioContext;
  CustomEvent?: typeof CustomEvent;
  webkitAudioContext?: typeof AudioContext;
};

export class SceneAudio {
  private context: AudioContext | null = null;
  private isUnlocked = false;

  /** True once a user gesture has unlocked the mixer. */
  get unlocked(): boolean {
    return this.isUnlocked;
  }

  /** Global miniapp game-audio preference shared by every Phaser scene. */
  get muted(): boolean {
    return isSceneAudioMuted();
  }

  setMuted(muted: boolean): void {
    setSceneAudioMuted(muted);
  }

  toggleMuted(): boolean {
    return toggleSceneAudioMuted();
  }

  /** Bind close() to the scene's shutdown/destroy events. */
  attach(scene: SceneAudioHost): this {
    scene.events.once("shutdown", () => this.close());
    scene.events.once("destroy", () => this.close());
    return this;
  }

  /**
   * Mark the mixer user-unlocked and resume a suspended context.
   * Call from pointer/keyboard handlers; safe to call repeatedly.
   */
  unlock(): void {
    if (this.muted) {
      this.isUnlocked = true;
      return;
    }
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") {
      void context.resume();
    }
    this.isUnlocked = true;
  }

  /** Play a named preset cue. */
  play(preset: SceneAudioPreset): void {
    this.tones(SCENE_AUDIO_PRESETS[preset]);
  }

  /** Schedule an ad-hoc set of tones (game-specific cues). */
  tones(tones: readonly SceneAudioTone[]): void {
    if (this.muted) return;
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") {
      // Autoplay policy: stay silent until the first user gesture.
      if (!this.isUnlocked) return;
      void context.resume();
    }
    for (const tone of tones) {
      this.scheduleTone(context, tone);
    }
  }

  /** Close the underlying AudioContext. Idempotent. */
  close(): void {
    if (!this.context) return;
    try {
      // close() on an already-closed context (e.g. the browser tore the page
      // down first) REJECTS asynchronously — consume it so scene shutdown
      // never surfaces an unhandled promise rejection.
      void this.context.close()?.catch?.(() => {});
    } catch {
      // Context may already be closing during page teardown.
    }
    this.context = null;
    this.isUnlocked = false;
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    const win = getBrowserWindow();
    if (!win) return null;
    const AudioCtor = win.AudioContext ?? win.webkitAudioContext;
    if (!AudioCtor) return null;
    try {
      this.context = new AudioCtor();
    } catch {
      this.context = null;
    }
    return this.context;
  }

  private scheduleTone(context: AudioContext, tone: SceneAudioTone): void {
    const startAt = context.currentTime + (tone.delay ?? 0);
    const gainValue = tone.gain ?? 0.02;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = tone.type ?? "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, startAt);
    if (tone.endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, tone.endFrequency),
        startAt + tone.duration,
      );
    }

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + tone.duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + tone.duration + 0.025);
  }
}

function getBrowserWindow(): SceneAudioWindow | null {
  return typeof window === "undefined" ? null : (window as SceneAudioWindow);
}
