/**
 * game-rules.ts — level curve + scoring for Goose Basket Shuffle.
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
 * bridge (kinds 3→5, total items 18→60), then each scene ramps the
 * bottom-reserve depth while the live physics window stays mobile-safe.
 *
 * Design constraints (GDD §4/§6, re-validated by scripts/tune.mjs in S5):
 *  - Every level is logically completable: each kind count is a multiple of 3,
 *    and the curve is validated so a thinking player (greedy policy) wins 100%.
 *  - Time scales WITH item count: budget = picks × 1.5s + 12s buffer (rounded
 *    up to 5s), so a focused player wins with margin while occlusion + variety
 *    supply the challenge — never an unfair clock.
 *  - Variety reaches 10 kinds by L3 and 12 within each later scene so normal
 *    play already reads as a rich mixed pile. Logical runs grow from 18 to
 *    432 items, while item-stream.ts keeps only 40–54 live Cannon bodies.
 */
export const LEVEL_CURVE: LevelSpec[] = [
  // Scene 1 · Garden (tutorial → bridge)
  { level: 1, kinds: 3, perKind: 2, timeMs: 40000, boxSize: 9 },
  { level: 2, kinds: 5, perKind: 4, timeMs: 140000, boxSize: 10 }, // softened from 7 kinds (R2)
  // Scene 2 · Orchard
  { level: 3, kinds: 10, perKind: 7, timeMs: 330000, boxSize: 10 },
  { level: 4, kinds: 11, perKind: 8, timeMs: 410000, boxSize: 10 },
  { level: 5, kinds: 12, perKind: 9, timeMs: 500000, boxSize: 11 },
  // Scene 3 · Pond
  { level: 6, kinds: 10, perKind: 7, timeMs: 330000, boxSize: 11 },
  { level: 7, kinds: 11, perKind: 8, timeMs: 410000, boxSize: 11 },
  { level: 8, kinds: 12, perKind: 10, timeMs: 555000, boxSize: 12 },
  // Scene 4 · Farm
  { level: 9, kinds: 10, perKind: 8, timeMs: 375000, boxSize: 11 },
  { level: 10, kinds: 11, perKind: 9, timeMs: 460000, boxSize: 12 },
  { level: 11, kinds: 12, perKind: 10, timeMs: 555000, boxSize: 12 },
  // Scene 5 · Snowfield
  { level: 12, kinds: 11, perKind: 9, timeMs: 460000, boxSize: 12 },
  { level: 13, kinds: 12, perKind: 11, timeMs: 610000, boxSize: 12 },
  // Scene 6 · Night market
  { level: 14, kinds: 12, perKind: 11, timeMs: 610000, boxSize: 12 },
  { level: 15, kinds: 12, perKind: 12, timeMs: 660000, boxSize: 12 },
];

/** Level spec composed with its scene's themed kind pool (first `kinds`). */
export function specOf(level: number): LevelSpec {
  const idx = Math.max(0, Math.min(TOTAL_LEVELS - 1, level - 1));
  const base = LEVEL_CURVE[idx]!;
  return { ...base, kindPool: sceneOfLevel(base.level).kindPool.slice(0, base.kinds) };
}

/**
 * Runtime deal spec with a seeded, freshly shuffled theme pool. The level
 * still controls how many match kinds exist, while every new run may draw a
 * different subset and order from all 12 theme models. Supplying the run RNG
 * keeps the result reproducible for tests/debugging without turning normal
 * retries into a fixed pattern.
 */
export function randomizedSpecOf(level: number, rng: () => number): LevelSpec {
  const base = specOf(level);
  const pool = [...sceneOfLevel(base.level).kindPool];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const value = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = value;
  }
  return { ...base, kindPool: pool.slice(0, base.kinds) };
}

// ── Tuning overrides (dev playtest) ─────────────────────────────────────────
// Every "feel" knob can be A/B tested in a Vite development session via URL
// params, so a human can calibrate handfeel without touching code, e.g.:
//   ?combo=2200&bonus=8&gravity=-16&score=10&timebonus=2
// Defaults below are the v3 production baseline: the clock curve is release-
// gated by tune.mjs. Production bundles, including the device-QA build, always
// use these defaults and ignore query-string tuning to preserve score integrity.
function readTuneNum(name: string, fallback: number, min: number, max: number): number {
  if (!import.meta.env.DEV || typeof window === "undefined" || !window.location?.search) {
    return fallback;
  }
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
export const COMBO_WINDOW_MS = readTuneNum("combo", 2200, 100, 60000);
export const COMBO_BONUS_PER_STEP = readTuneNum("bonus", 8, 1, 1000);
export const TIME_BONUS_PER_SEC = readTuneNum("timebonus", 2, 1, 100);

/**
 * Gravity for the physics world (ZhuaDaScene). During local development it can
 * be overridden via ?gravity=-16. Gravity is DOWNWARD, so valid overrides are
 * negative (-60..-4); a positive value (or one outside the sane range) falls
 * back rather than flipping the pile upward. Production always uses fallback.
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
  /** In untimed mode the add-time milestone instead refunds this space rescue
   * (the clock is absent there, so add-time would be a dead resource). R1 fix. */
  untimedRefund: "remove" | "undo";
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
/**
 * @param thresholdScale Multiplies both refund thresholds. R3's night-market
 * goose passes 0.9 so mid-level refunds arrive ~10% earlier. Defaults to 1
 * (no change), keeping every existing caller backward compatible.
 */
export function milestonesFor(spec: LevelSpec, thresholdScale = 1): MilestonePlan {
  const ceiling = spec.kinds * spec.perKind * SCORE_PER_MATCH;
  const step5 = (v: number): number => Math.max(5, Math.round(v / 5) * 5);
  const scale = Number.isFinite(thresholdScale) && thresholdScale > 0 ? thresholdScale : 1;
  return {
    hintStep: Math.max(20, step5(ceiling * 0.3 * scale)),
    addTimeStep: Math.max(40, step5(ceiling * 0.6 * scale)),
    comboHintAt: 4,
    // Untimed runs get a usable space rescue (remove) at the add-time milestone
    // instead of a clock resource they can never spend (R1).
    untimedRefund: "remove",
  };
}

/** Stable per-run seed (guest determinism). */
export function seedFor(level: number, salt: number): number {
  let h = (level * 2654435761) >>> 0;
  h = (h ^ (salt * 40503)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822519) >>> 0;
  return h >>> 0;
}
