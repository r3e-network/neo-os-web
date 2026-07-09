/**
 * game-rules.ts — level curve + scoring for Catch the Goose (B-class physics).
 *
 * Every number is a tuning hypothesis (GDD §4/§6). Levels scale item count,
 * variety, and tighten time. Tray is fixed at 7 slots (TrayResult). Curve is
 * deterministic from `level`.
 */

import { TRAY_SLOTS, type LevelSpec } from "./engine-zhuada";

export const TOTAL_LEVELS = 15;

/**
 * Level curve — TUNED via scripts/tune.mjs (Monte-Carlo, 4000 trials/level).
 *
 * Design constraints (GDD §4/§6):
 *  - Every level is logically completable: each kind count is a multiple of 3,
 *    and the curve is validated so a thinking player (greedy policy) wins 100%.
 *  - Time scales WITH item count, not against it. The earlier draft shrank time
 *    to 50s while items grew to 180 — mathematically unwinnable. The budget
 *    below = greedyPicks × 1.5s + 12s buffer (rounded to 5s), so a focused
 *    player wins with margin while occlusion + variety supply the challenge.
 *  - Difficulty rises via variety (kinds 3→12) and copies (perKind 2→4), never
 *    via an unfair clock.
 */
export const LEVEL_CURVE: LevelSpec[] = [
  { level: 1, kinds: 3, perKind: 2, timeMs: 40000, boxSize: 9 },
  { level: 2, kinds: 3, perKind: 2, timeMs: 40000, boxSize: 9 },
  { level: 3, kinds: 4, perKind: 2, timeMs: 50000, boxSize: 9 },
  { level: 4, kinds: 4, perKind: 3, timeMs: 65000, boxSize: 10 },
  { level: 5, kinds: 5, perKind: 3, timeMs: 80000, boxSize: 10 },
  { level: 6, kinds: 5, perKind: 3, timeMs: 80000, boxSize: 10 },
  { level: 7, kinds: 6, perKind: 3, timeMs: 95000, boxSize: 11 },
  { level: 8, kinds: 6, perKind: 3, timeMs: 95000, boxSize: 11 },
  { level: 9, kinds: 7, perKind: 4, timeMs: 140000, boxSize: 12 },
  { level: 10, kinds: 8, perKind: 4, timeMs: 155000, boxSize: 12 },
  { level: 11, kinds: 9, perKind: 4, timeMs: 175000, boxSize: 12 },
  { level: 12, kinds: 10, perKind: 4, timeMs: 190000, boxSize: 12 },
  { level: 13, kinds: 11, perKind: 4, timeMs: 210000, boxSize: 12 },
  { level: 14, kinds: 12, perKind: 4, timeMs: 230000, boxSize: 12 },
  { level: 15, kinds: 12, perKind: 4, timeMs: 230000, boxSize: 12 },
];

export function specOf(level: number): LevelSpec {
  const idx = Math.max(0, Math.min(TOTAL_LEVELS - 1, level - 1));
  return LEVEL_CURVE[idx]!;
}

// ── Tuning overrides (dev playtest) ─────────────────────────────────────────
// Every "feel" knob can be A/B tested LIVE via URL params, so a human can
// calibrate handfeel without touching code, e.g.:
//   ?combo=2200&bonus=8&gravity=-16&score=10&timebonus=2
// Defaults below are the v2.3 feel hypotheses (see GDD §10.5). These are still
// [PLACEHOLDER]-level until a real human playtest confirms them.
function readTuneNum(name: string, fallback: number): number {
  if (typeof window === "undefined" || !window.location?.search) return fallback;
  const v = Number(new URLSearchParams(window.location.search).get(name));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

// ── Scoring ────────────────────────────────────────────────────────────────
export const SCORE_PER_MATCH = readTuneNum("score", 10);
// Combo window widened 1500 → 2200ms: physical pick + travel has natural gaps,
// so a tighter window made chains frustratingly rare. Wider window rewards
// quick consecutive clears (the core "satisfying" lever) without being free.
export const COMBO_WINDOW_MS = readTuneNum("combo", 2200); // [PLACEHOLDER] window for chain bonus
export const COMBO_BONUS_PER_STEP = readTuneNum("bonus", 8); // [PLACEHOLDER] (was 5)
export const TIME_BONUS_PER_SEC = readTuneNum("timebonus", 2);

/** Gravity for the physics world (ZhuaDaScene). Override via ?gravity=-16. */
export function tuneGravity(fallback = -18): number {
  return readTuneNum("gravity", fallback);
}

export { TRAY_SLOTS };

/** Stable per-run seed (guest determinism). */
export function seedFor(level: number, salt: number): number {
  let h = (level * 2654435761) >>> 0;
  h = (h ^ (salt * 40503)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822519) >>> 0;
  return h >>> 0;
}
