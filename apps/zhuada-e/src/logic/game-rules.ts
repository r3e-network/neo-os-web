/**
 * game-rules.ts — level curve + scoring for Goose Basket Shuffle.
 *
 * Every number is a tuning hypothesis (GDD §4/§6). Levels scale item count,
 * variety, and tighten time. Tray is fixed at 7 slots. Curve is
 * deterministic from `level`.
 */

import { TRAY_SLOTS, type LevelSpec } from "./engine-zhuada";
import { sceneOfLevel } from "./scenes";
import {
  DEFAULT_THEME_ID,
  themeItem,
  type GameThemeId,
  type ItemSizeBand,
} from "./themes";

export const TOTAL_LEVELS = 24;

/**
 * Level curve — 9 themed scenes (see logic/scenes.ts; chapter 2 of three new
 * scenes — Volcano / Cloud / Abyss — added 2026-07-12), difficulty shaped per
 * the parity spec G5: L1 is a forgiving visual tutorial with only three
 * recognisable kinds and an unjammable 18-item pile. L2 deliberately creates
 * the game's signature difficulty cliff (kinds 3→48, total items 18→864), then
 * each scene ramps the
 * bottom-reserve depth while the live physics window stays mobile-safe.
 *
 * Design constraints (GDD §4/§6, re-validated by scripts/tune.mjs in S5):
 *  - Every level is logically completable: each kind count is a multiple of 3,
 *    and the curve is validated so a thinking player (greedy policy) wins 100%.
 *  - Time scales WITH item count: budget = picks × 1.5s + 12s buffer (rounded
 *    up to 5s), so a focused player wins with margin while occlusion + variety
 *    supply the challenge — never an unfair clock.
 *  - Variety starts at 3 kinds, then jumps straight to 48 on L2 and stays at
 *    that rich logical mix. Logical runs grow from 18 to 1,584 items
 *    (chapter 2 peak, L24); item-stream.ts cycles 18–45 live Cannon bodies
 *    while reserve remains. Eighteen identities across twelve authored
 *    silhouettes—six paired near-match families plus six singletons—appear in
 *    the first 54 bodies; thirty new identities surface later from the
 *    reservoir.
 *    New chapter 2 levels hold variety at the max of 48 (no L1→L2-style cliff)
 *    and deepen only perKind, so a returning player steps straight into the new
 *    scenes at their existing skill level.
 */
export const LEVEL_CURVE: LevelSpec[] = [
  // Scene 1 · Garden (safe tutorial → intentional challenge cliff)
  { level: 1, kinds: 3, perKind: 2, timeMs: 40000, boxSize: 9 },
  { level: 2, kinds: 48, perKind: 6, timeMs: 1310000, boxSize: 10 },
  // Scene 2 · Orchard
  { level: 3, kinds: 48, perKind: 7, timeMs: 1525000, boxSize: 10 },
  { level: 4, kinds: 48, perKind: 7, timeMs: 1525000, boxSize: 10 },
  { level: 5, kinds: 48, perKind: 8, timeMs: 1740000, boxSize: 11 },
  // Scene 3 · Pond
  { level: 6, kinds: 48, perKind: 7, timeMs: 1525000, boxSize: 11 },
  { level: 7, kinds: 48, perKind: 8, timeMs: 1740000, boxSize: 11 },
  { level: 8, kinds: 48, perKind: 9, timeMs: 1960000, boxSize: 12 },
  // Scene 4 · Farm
  { level: 9, kinds: 48, perKind: 8, timeMs: 1740000, boxSize: 11 },
  { level: 10, kinds: 48, perKind: 9, timeMs: 1960000, boxSize: 12 },
  { level: 11, kinds: 48, perKind: 9, timeMs: 1960000, boxSize: 12 },
  // Scene 5 · Snowfield
  { level: 12, kinds: 48, perKind: 9, timeMs: 1960000, boxSize: 12 },
  { level: 13, kinds: 48, perKind: 10, timeMs: 2175000, boxSize: 12 },
  // Scene 6 · Night market
  { level: 14, kinds: 48, perKind: 10, timeMs: 2175000, boxSize: 12 },
  { level: 15, kinds: 48, perKind: 10, timeMs: 2175000, boxSize: 12 },
  // ── Chapter 2 · Volcano (soft handoff — L16 matches L15, no cliff) ──
  { level: 16, kinds: 48, perKind: 10, timeMs: 2175000, boxSize: 12 },
  { level: 17, kinds: 48, perKind: 11, timeMs: 2390000, boxSize: 12 },
  { level: 18, kinds: 48, perKind: 11, timeMs: 2390000, boxSize: 12 }, // Volcano finale (1,584 items)
  // ── Chapter 2 · Cloud (opener = previous finale, breather) ──
  { level: 19, kinds: 48, perKind: 11, timeMs: 2390000, boxSize: 12 },
  { level: 20, kinds: 48, perKind: 11, timeMs: 2390000, boxSize: 12 },
  { level: 21, kinds: 48, perKind: 11, timeMs: 2390000, boxSize: 12 }, // Cloud finale (1,584 items)
  // ── Chapter 2 · Abyss (opener = previous finale, breather) ──
  { level: 22, kinds: 48, perKind: 11, timeMs: 2390000, boxSize: 12 },
  { level: 23, kinds: 48, perKind: 11, timeMs: 2390000, boxSize: 12 },
  { level: 24, kinds: 48, perKind: 11, timeMs: 2390000, boxSize: 12 }, // Abyss finale — global peak (1,584 items)
];

/** Upper bound accepted by interrupted-run validation for the current ruleset. */
export const MAX_LOGICAL_ITEMS = Math.max(
  ...LEVEL_CURVE.map((spec) => spec.kinds * spec.perKind * 3),
);

/** Deterministic level spec used by tuning and static data checks. */
export function specOf(level: number): LevelSpec {
  const idx = Math.max(0, Math.min(TOTAL_LEVELS - 1, level - 1));
  const base = LEVEL_CURVE[idx]!;
  return { ...base, kindPool: sceneOfLevel(base.level).kindPool.slice(0, base.kinds) };
}

export interface DealCompositionSummary {
  sizes: Record<ItemSizeBand, number>;
  silhouettes: number;
  lookalikeFamilies: number;
}

/** Summarize the visible design mix of one logical kind subset. */
export function summarizeDealComposition(
  themeId: GameThemeId,
  kinds: readonly number[],
): DealCompositionSummary {
  const sizes: Record<ItemSizeBand, number> = { small: 0, medium: 0, large: 0 };
  const silhouettes = new Set<string>();
  const familyColors = new Map<string, Set<number>>();
  for (const kind of kinds) {
    const item = themeItem(themeId, kind);
    sizes[item.sizeBand] += 1;
    silhouettes.add(item.silhouette);
    const family = familyColors.get(item.lookalikeFamily) ?? new Set<number>();
    family.add(item.color);
    familyColors.set(item.lookalikeFamily, family);
  }
  return {
    sizes,
    silhouettes: silhouettes.size,
    lookalikeFamilies: [...familyColors.values()].filter((family) => family.size >= 2).length,
  };
}

/**
 * Opening deals stay easy to read: one small, medium and large object with
 * three distinct silhouettes and no deliberately confusing sibling pair.
 * Challenge deals then require both size extremes, five-plus silhouettes and
 * at least one same-family/different-colour pair. Twelve-kind deals raise those
 * floors again so a full tray never reads as twelve near-identical blobs.
 */
export function isBalancedDealComposition(
  themeId: GameThemeId,
  kinds: readonly number[],
): boolean {
  const summary = summarizeDealComposition(themeId, kinds);
  if (kinds.length <= 3) {
    return summary.sizes.small >= 1
      && summary.sizes.medium >= 1
      && summary.sizes.large >= 1
      && summary.silhouettes >= 3
      && summary.lookalikeFamilies === 0;
  }
  const lateDeal = kinds.length >= 12;
  return summary.sizes.small >= (lateDeal ? 3 : 2)
    && summary.sizes.medium >= 1
    && summary.sizes.large >= (lateDeal ? 3 : 2)
    && summary.silhouettes >= (lateDeal ? 6 : 5)
    && summary.lookalikeFamilies >= (lateDeal ? 2 : 1);
}

function compositionScore(themeId: GameThemeId, kinds: readonly number[]): number {
  const summary = summarizeDealComposition(themeId, kinds);
  // Cap the contribution from any one bucket: diversity wins over filling the
  // candidate with only tiny pieces or only large anchors.
  return summary.silhouettes * 12
    + Math.min(summary.lookalikeFamilies, 3) * 7
    + (
      Math.min(summary.sizes.small, 3)
      + Math.min(summary.sizes.medium, 3)
      + Math.min(summary.sizes.large, 3)
    ) * 5;
}

function combinations(values: readonly number[], take: number): number[][] {
  const output: number[][] = [];
  const current: number[] = [];
  const visit = (start: number): void => {
    if (current.length === take) {
      output.push([...current]);
      return;
    }
    const needed = take - current.length;
    for (let index = start; index <= values.length - needed; index += 1) {
      current.push(values[index]!);
      visit(index + 1);
      current.pop();
    }
  };
  visit(0);
  return output;
}

function shuffleKinds(kinds: number[], rng: () => number): number[] {
  for (let index = kinds.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    const value = kinds[index]!;
    kinds[index] = kinds[swap]!;
    kinds[swap] = value;
  }
  return kinds;
}

/**
 * Balanced candidates depend only on the authored theme metadata and level
 * pool, never on the run RNG. Cache that deterministic search so opening a
 * fresh game/retry only performs the cheap random finalist pick and shuffle.
 * This also keeps rapid replay and daily-challenge setup off the combinatorial
 * hot path (15 choose 7 is 6,435 candidate summaries).
 */
const balancedDealFinalistsCache = new Map<string, readonly (readonly number[])[]>();

function balancedDealFinalists(
  level: number,
  kinds: number,
  pool: readonly number[],
  themeId: GameThemeId,
): readonly (readonly number[])[] {
  // Level pools are immutable authored catalog data, so theme + level fully
  // identifies the candidate set without serializing the pool on every run.
  const cacheKey = themeId + level;
  const cached = balancedDealFinalistsCache.get(cacheKey);
  if (cached) return cached;

  const candidates = combinations(pool, kinds);
  let bestScore = Number.NEGATIVE_INFINITY;
  let finalists: number[][] = [];
  for (const candidate of candidates) {
    if (!isBalancedDealComposition(themeId, candidate)) continue;
    const score = compositionScore(themeId, candidate);
    if (score > bestScore) {
      bestScore = score;
      finalists = [candidate];
    } else if (score === bestScore) {
      finalists.push(candidate);
    }
  }
  // Catalog tests make this fallback unreachable, but keeping it deterministic
  // prevents a future metadata mistake from blocking the player at startup.
  finalists = finalists.length ? finalists : candidates;
  balancedDealFinalistsCache.set(cacheKey, finalists);
  return finalists;
}

/**
 * Runtime deal spec with a seeded, freshly selected theme pool. Each scene
 * offers 48 of the theme's 54 item identities; the level selects 3–48 from it.
 * Selection is random among the highest-quality balanced compositions, then
 * shuffled again so neither the subset nor generation order becomes a fixed
 * retry pattern. Supplying the run RNG keeps daily/debug runs reproducible.
 */
export function randomizedSpecOf(
  level: number,
  rng: () => number,
  themeId: GameThemeId = DEFAULT_THEME_ID,
): LevelSpec {
  const base = specOf(level);
  const pool = sceneOfLevel(base.level).kindPool;
  const finalists = balancedDealFinalists(base.level, base.kinds, pool, themeId);
  const selectedIndex = Math.floor(rng() * finalists.length);
  const selected = [...finalists[selectedIndex]!];
  return { ...base, kindPool: shuffleKinds(selected, rng) };
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
 * Reachability across all 24 levels is asserted by game-rules.test.ts and the
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
