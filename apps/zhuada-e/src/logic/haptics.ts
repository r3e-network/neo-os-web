/**
 * haptics.ts — vibration-feedback engine for Goose Basket Shuffle.
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
 *   jam   → 55,35,90    (urgent two-stage tray-full warning)
 *   fail  → 100         (single firm buzz)
 *   shake → 18,35,28    (two-stage basket jolt)
 */

import { gameStorage } from "./game-storage";

export type HapticCue = "pick" | "match" | "combo" | "win" | "jam" | "fail" | "shake";
export interface HapticsQaSnapshot {
  supported: boolean;
  enabled: boolean;
}

const HAPTICS_KEY = "zhuada-e:haptics-off";

const PATTERNS: Record<HapticCue, number | number[]> = {
  pick: 10,
  match: 30,
  combo: 30, // base — scaled by playCombo()
  win: [30, 50, 80],
  jam: [55, 35, 90],
  fail: 100,
  shake: [18, 35, 28],
};

class HapticsEngine {
  private _enabled = true;

  constructor() {
    try {
      this._enabled = gameStorage.getItem(HAPTICS_KEY) !== "1";
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

  qaSnapshot(): HapticsQaSnapshot {
    return {
      supported: this.supported,
      enabled: this._enabled,
    };
  }

  /** Re-read after the opaque-iframe host bridge hydrates its sync mirror. */
  reloadStoredPreference(): void {
    try {
      this._enabled = gameStorage.getItem(HAPTICS_KEY) !== "1";
    } catch {
      /* best-effort */
    }
  }

  setEnabled(on: boolean): void {
    this._enabled = on;
    try {
      gameStorage.setItem(HAPTICS_KEY, on ? "0" : "1");
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

  /**
   * Combo-scaled haptic: intensity grows with chain depth so a x5 combo
   * feels materially stronger than a x1 match. Pattern: [base + step*5, gap, bonus].
   */
  playCombo(comboStep: number): void {
    if (!this._enabled || !this.supported) return;
    const base = 30 + Math.min(12, comboStep) * 5;
    try {
      navigator.vibrate(comboStep > 2 ? [base, 20, base * 0.6] : base);
    } catch {
      /* best-effort */
    }
  }
}

export const haptics = new HapticsEngine();
