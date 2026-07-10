/**
 * game-rules.ts — level curve + scoring for Catch the Goose (B-class physics).
 *
 * Every number is a tuning hypothesis (GDD §4/§6). Levels scale item count,
 * variety, and tighten time. Tray is fixed at 7 slots. Curve is
 * deterministic from `level`.
 */

import { TRAY_SLOTS, type LevelSpec } from "./engine-zhuada";
import { sceneOfLevel } from "./scenes";

export const TOTAL_LEVELS = 15;

/**
 * Level curve — 6 themed scenes (see logic/scenes.ts), difficulty shaped per
 * the parity spec G5: L1 is a tutorial with a mathematical win floor (3 kinds ×
 * ≤2 tray copies = 6 < 7 slots, so the tray can never jam), L2 is a deliberate
 * spike (kinds 3→5, items 18→45), then each scene ramps variety/depth.
 *
 * Design constraints (GDD §4/§6, re-validated by scripts/tune.mjs in S5):
 *  - Every level is logically completable: each kind count is a multiple of 3,
 *    and the curve is validated so a thinking player (greedy policy) wins 100%.
 *  - Time scales WITH item count: budget = picks × 1.5s + 12s buffer (rounded
 *    up to 5s), so a focused player wins with margin while occlusion + variety
 *    supply the challenge — never an unfair clock.
 *  - Difficulty rises via variety (kinds 3→12) and copies (perKind 2→4).
 */
export const LEVEL_CURVE: LevelSpec[] = [
  // Scene 1 · Garden (tutorial → spike)
  { level: 1, kinds: 3, perKind: 2, timeMs: 40000, boxSize: 9 },
  { level: 2, kinds: 5, perKind: 3, timeMs: 80000, boxSize: 10 },
  // Scene 2 · Orchard
  { level: 3, kinds: 5, perKind: 3, timeMs: 80000, boxSize: 10 },
  { level: 4, kinds: 6, perKind: 3, timeMs: 95000, boxSize: 10 },
  { level: 5, kinds: 7, perKind: 3, timeMs: 110000, boxSize: 11 },
  // Scene 3 · Pond
  { level: 6, kinds: 7, perKind: 3, timeMs: 110000, boxSize: 11 },
  { level: 7, kinds: 8, perKind: 3, timeMs: 120000, boxSize: 11 },
  { level: 8, kinds: 8, perKind: 4, timeMs: 160000, boxSize: 12 },
  // Scene 4 · Farm
  { level: 9, kinds: 9, perKind: 3, timeMs: 135000, boxSize: 11 },
  { level: 10, kinds: 9, perKind: 4, timeMs: 175000, boxSize: 12 },
  { level: 11, kinds: 10, perKind: 4, timeMs: 195000, boxSize: 12 },
  // Scene 5 · Snowfield
  { level: 12, kinds: 10, perKind: 4, timeMs: 195000, boxSize: 12 },
  { level: 13, kinds: 11, perKind: 4, timeMs: 210000, boxSize: 12 },
  // Scene 6 · Night market
  { level: 14, kinds: 12, perKind: 4, timeMs: 230000, boxSize: 12 },
  { level: 15, kinds: 12, perKind: 4, timeMs: 230000, boxSize: 12 },
];

/** Level spec composed with its scene's themed kind pool (first `kinds`). */
export function specOf(level: number): LevelSpec {
  const idx = Math.max(0, Math.min(TOTAL_LEVELS - 1, level - 1));
  const base = LEVEL_CURVE[idx]!;
  return { ...base, kindPool: sceneOfLevel(base.level).kindPool.slice(0, base.kinds) };
}

// ── Tuning overrides (dev playtest) ─────────────────────────────────────────
// Every "feel" knob can be A/B tested LIVE via URL params, so a human can
// calibrate handfeel without touching code, e.g.:
//   ?combo=2200&bonus=8&gravity=-16&score=10&timebonus=2
// Defaults below are the v2.3 feel hypotheses (see GDD §10.5). These are still
// [PLACEHOLDER]-level until a real human playtest confirms them.
function readTuneNum(name: string, fallback: number, min: number, max: number): number {
  if (typeof window === "undefined" || !window.location?.search) return fallback;
  const raw = new URLSearchParams(window.location.search).get(name);
  if (raw === null || raw.trim() === "") return fallback;
  const v = Number(raw);
  return Number.isFinite(v) && v >= min && v <= max ? v : fallback;
}

// ── Scoring ────────────────────────────────────────────────────────────────
export const SCORE_PER_MATCH = readTuneNum("score", 10, 1, 10000);
// Combo window widened 1500 → 2200ms: physical pick + travel has natural gaps,
// so a tighter window made chains frustratingly rare. Wider window rewards
// quick consecutive clears (the core "satisfying" lever) without being free.
export const COMBO_WINDOW_MS = readTuneNum("combo", 2200, 100, 60000); // [PLACEHOLDER] window for chain bonus
export const COMBO_BONUS_PER_STEP = readTuneNum("bonus", 8, 1, 1000); // [PLACEHOLDER] (was 5)
export const TIME_BONUS_PER_SEC = readTuneNum("timebonus", 2, 1, 100);

/**
 * Gravity for the physics world (ZhuaDaScene). Override via ?gravity=-16.
 * Gravity is DOWNWARD, so valid overrides are negative (-60..-4); a positive
 * value (or one outside the sane range) falls back rather than flipping the
 * pile upward.
 */
export function tuneGravity(fallback = -18): number {
  return readTuneNum("gravity", fallback, -60, -4);
}

export { TRAY_SLOTS };

// ── Power-up milestone economy ───────────────────────────────────────────────

/** Per-level skill-milestone plan for mid-level power-up refunds. */
export interface MilestonePlan {
  /** +1 hint each time the score crosses another multiple of this step. */
  hintStep: number;
  /** +1 add-time each time the score crosses another multiple of this step. */
  addTimeStep: number;
  /** A combo chain of this length refunds +1 hint. */
  comboHintAt: number;
}

/**
 * Milestone thresholds derived from the LEVEL's base-score ceiling
 * (kinds × perKind matches × SCORE_PER_MATCH) instead of the old fixed
 * 100/200 — the S5 audit showed fixed thresholds made the first hint refund
 * mathematically unreachable on L1 (base ceiling 60 < 100) and pushed the
 * add-time refund to the very end of early levels where it is dead weight.
 *
 *  - hint refund lands around 30% of the ceiling: early enough to still steer
 *    the level, reachable on EVERY level without a single combo.
 *  - add-time refund lands around 60%: mid/late level, when the clock — not
 *    the tray — is the binding constraint.
 *  - a 4-chain combo refunds +1 HINT (not add-time, which the audit flagged
 *    as anti-correlated with need: fast chains mean you least need time; an
 *    information resource keeps the chain going instead).
 *
 * Reachability across all 15 levels is asserted by game-rules.test.ts and the
 * economy table is printed by scripts/tune.mjs (milestone economy check).
 */
export function milestonesFor(spec: LevelSpec): MilestonePlan {
  const ceiling = spec.kinds * spec.perKind * SCORE_PER_MATCH;
  const step5 = (v: number): number => Math.max(5, Math.round(v / 5) * 5);
  return {
    hintStep: Math.max(20, step5(ceiling * 0.3)),
    addTimeStep: Math.max(40, step5(ceiling * 0.6)),
    comboHintAt: 4,
  };
}

/** Stable per-run seed (guest determinism). */
export function seedFor(level: number, salt: number): number {
  let h = (level * 2654435761) >>> 0;
  h = (h ^ (salt * 40503)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822519) >>> 0;
  return h >>> 0;
}
