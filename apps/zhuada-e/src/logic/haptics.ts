/**
 * haptics.ts — tiny vibration-feedback engine for Catch the Goose.
 *
 * Mirrors the SoundEngine's shape: a shared singleton with a persisted
 * enable/disable toggle (localStorage), feature-detected `navigator.vibrate`
 * (Android Chrome et al.; silently inert where unsupported, e.g. iOS Safari),
 * and a fixed cue table so the game code never hard-codes patterns inline.
 *
 * Cue table (ms):
 *   pick  → 10          (light tap acknowledging a successful pull)
 *   match → 30          (three-of-a-kind cleared)
 *   win   → 30,50,80    (rising celebratory triplet)
 *   fail  → 100         (single firm buzz)
 */

export type HapticCue = "pick" | "match" | "win" | "fail";

const HAPTICS_KEY = "zhuada-e:haptics-off";

const PATTERNS: Record<HapticCue, number | number[]> = {
  pick: 10,
  match: 30,
  win: [30, 50, 80],
  fail: 100,
};

class HapticsEngine {
  private _enabled = true;

  constructor() {
    try {
      this._enabled = globalThis.localStorage?.getItem(HAPTICS_KEY) !== "1";
    } catch {
      /* best-effort */
    }
  }

  /** True when the platform exposes `navigator.vibrate` (feature detection). */
  get supported(): boolean {
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  }

  get enabled(): boolean {
    return this._enabled;
  }

  setEnabled(on: boolean): void {
    this._enabled = on;
    try {
      globalThis.localStorage?.setItem(HAPTICS_KEY, on ? "0" : "1");
    } catch {
      /* best-effort */
    }
    if (!on && this.supported) {
      try {
        navigator.vibrate(0); // cancel any in-flight pattern
      } catch {
        /* best-effort */
      }
    }
  }

  toggleEnabled(): boolean {
    this.setEnabled(!this._enabled);
    return this._enabled;
  }

  play(cue: HapticCue): void {
    if (!this._enabled || !this.supported) return;
    try {
      navigator.vibrate(PATTERNS[cue]);
    } catch {
      /* some browsers throw outside user gestures — feedback is best-effort */
    }
  }
}

export const haptics = new HapticsEngine();
