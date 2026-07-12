/**
 * R3 — Goose passive bonuses (endowment + sunk-cost collection driver).
 *
 * Pure, render-free logic so it can be unit-tested without React/Three/storage.
 * Each unlocked limited-edition goose (identified by its scene id, persisted in
 * `GooseProgress.geese`) grants one gentle, *independent* permanent bonus. The
 * bonuses are deliberately mild and never touch the solvability invariant
 * (multiple-of-3 + cross-zone matching), so collecting every goose only makes
 * the run "feel earned" — it cannot break a level.
 *
 * Design pillars this serves: **long-term reason to return** (GDD §4). Turning
 * the collection from pure cosmetics into a visible power creep gives the
 * meta-loop a sunk-cost pull: the more scenes you clear, the more your future
 * runs are subtly assisted. Each bonus is an endowment — you invest clears, you
 * keep the perk — which is exactly the collection-motivation psychology R3
 * exists to fix (geese were pure decoration before).
 */

export interface GoosePassive {
  /** Extra hint power-ups granted at the start of every level. */
  extraHint: number;
  /** Extra move-out (移出) power-ups at level start. */
  extraRemove: number;
  /** Extra undo (撤回) power-ups at level start. */
  extraUndo: number;
  /** Shake cooldown reduction in ms (negative = shorter). Clamped on sum. */
  shakeCdDeltaMs: number;
  /** Combo-window extension in ms (positive). Clamped on sum. */
  comboWindowDeltaMs: number;
  /** Milestone-threshold multiplier (1 = unchanged, <1 = refunds arrive earlier). Multiplicative across geese. */
  milestoneThresholdScale: number;
}

export interface GoosePassiveDef {
  /** The delta this goose contributes (only non-default fields are set). */
  passive: Partial<GoosePassive>;
  /** messages.ts key for the perk copy the collection book renders. */
  perkKey: string;
}

// ── Tuning table (all [PLACEHOLDER] — validate in playtest) ───────────────────
// Each scene's final-level goose maps to ONE independent lever so collected
// bonuses never conflict or compound into something snowballing:
//   garden(0)   → +1 提示      (information, always welcome)
//   orchard(1)  → +1 移出      (space rescue — same family as R1's untimed refund)
//   pond(2)     → 晃动冷却 -1s  (cooldown, not a consumable — bounded below)
//   farm(3)     → 连击窗口 +200ms (rewards chains; bounded above)
//   snowfield(4)→ +1 撤回      (forgiveness for a misclick)
//   night(5)    → 里程碑阈值 ×0.9 (mid-level refunds land ~10% earlier)
const GOOSE_PASSIVE_GARDEN_HINT = 1;
const GOOSE_PASSIVE_ORCHARD_REMOVE = 1;
const GOOSE_PASSIVE_POND_SHAKE_CD_MS = -1000;
const GOOSE_PASSIVE_FARM_COMBO_MS = 200;
const GOOSE_PASSIVE_SNOWFIELD_UNDO = 1;
const GOOSE_PASSIVE_NIGHT_THRESHOLD_SCALE = 0.9;

export const GOOSE_PASSIVES: Record<number, GoosePassiveDef> = {
  0: { passive: { extraHint: GOOSE_PASSIVE_GARDEN_HINT }, perkKey: "goosePerkGarden" },
  1: { passive: { extraRemove: GOOSE_PASSIVE_ORCHARD_REMOVE }, perkKey: "goosePerkOrchard" },
  2: { passive: { shakeCdDeltaMs: GOOSE_PASSIVE_POND_SHAKE_CD_MS }, perkKey: "goosePerkPond" },
  3: { passive: { comboWindowDeltaMs: GOOSE_PASSIVE_FARM_COMBO_MS }, perkKey: "goosePerkFarm" },
  4: { passive: { extraUndo: GOOSE_PASSIVE_SNOWFIELD_UNDO }, perkKey: "goosePerkSnowfield" },
  5: { passive: { milestoneThresholdScale: GOOSE_PASSIVE_NIGHT_THRESHOLD_SCALE }, perkKey: "goosePerkNightMarket" },
};

/** Hard caps so the sum of collected geese can never distort handfeel. */
export const GOOSE_PASSIVE_LIMITS = {
  /** Shake cooldown may drop at most 3s (base 5s → floor 2s). */
  maxShakeCdReductionMs: 3000,
  /** Combo window may extend at most 4s. */
  maxComboWindowDeltaMs: 4000,
} as const;

export const EMPTY_GOOSE_PASSIVE: GoosePassive = {
  extraHint: 0,
  extraRemove: 0,
  extraUndo: 0,
  shakeCdDeltaMs: 0,
  comboWindowDeltaMs: 0,
  milestoneThresholdScale: 1,
};

/**
 * Aggregate the passive bonus of every goose in `geese` (scene ids). Unknown
 * ids are ignored so a future scene added to `SCENES` without a perk entry
 * simply contributes nothing rather than throwing.
 */
export function computeGoosePassive(geese: number[]): GoosePassive {
  const result: GoosePassive = { ...EMPTY_GOOSE_PASSIVE };
  let scale = 1;
  for (const id of geese) {
    const def = GOOSE_PASSIVES[id];
    if (!def) continue;
    const p = def.passive;
    if (p.extraHint) result.extraHint += p.extraHint;
    if (p.extraRemove) result.extraRemove += p.extraRemove;
    if (p.extraUndo) result.extraUndo += p.extraUndo;
    if (p.shakeCdDeltaMs) result.shakeCdDeltaMs += p.shakeCdDeltaMs;
    if (p.comboWindowDeltaMs) result.comboWindowDeltaMs += p.comboWindowDeltaMs;
    if (p.milestoneThresholdScale !== undefined) scale *= p.milestoneThresholdScale;
  }
  result.shakeCdDeltaMs = Math.max(
    -GOOSE_PASSIVE_LIMITS.maxShakeCdReductionMs,
    Math.min(0, result.shakeCdDeltaMs),
  );
  result.comboWindowDeltaMs = Math.max(
    0,
    Math.min(GOOSE_PASSIVE_LIMITS.maxComboWindowDeltaMs, result.comboWindowDeltaMs),
  );
  result.milestoneThresholdScale = scale;
  return result;
}

/** UI helper: the perk copy key for a scene's goose, or null if none/unlocked. */
export function goosePerkKey(sceneId: number): string | null {
  return GOOSE_PASSIVES[sceneId]?.perkKey ?? null;
}
