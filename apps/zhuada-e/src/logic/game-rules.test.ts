/**
 * game-rules.test.ts — milestone economy + curve fairness regression tests.
 *
 * The S5 balance audit found the old fixed milestone thresholds (100/200)
 * mathematically unreachable on L1 (base ceiling 60) and the combo refund
 * anti-correlated with need. These tests pin the re-derived per-level plan:
 * every refund must be reachable on every level from base score alone, and
 * the shipped clock must never sit under the tune.mjs fairness floor
 * (items × 1.5s + 12s, rounded to 5s).
 */

import { describe, expect, it } from "vitest";
import {
  LEVEL_CURVE,
  SCORE_PER_MATCH,
  TOTAL_LEVELS,
  milestonesFor,
  specOf,
} from "./game-rules";

const baseCeiling = (level: number): number => {
  const spec = specOf(level);
  return spec.kinds * spec.perKind * SCORE_PER_MATCH;
};

describe("milestonesFor", () => {
  it("keeps every refund reachable from base score alone on all levels", () => {
    for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
      const plan = milestonesFor(specOf(level));
      const ceiling = baseCeiling(level);
      expect(plan.hintStep).toBeGreaterThan(0);
      expect(plan.addTimeStep).toBeGreaterThan(0);
      // First hint refund must land no later than the base ceiling (no combo
      // required), and the add-time refund too.
      expect(plan.hintStep).toBeLessThanOrEqual(ceiling);
      expect(plan.addTimeStep).toBeLessThanOrEqual(ceiling);
      // Hint arrives before add-time (steering aid before clock aid).
      expect(plan.hintStep).toBeLessThan(plan.addTimeStep);
    }
  });

  it("lands the L1 tutorial refunds early (hint at 20, add-time at 40)", () => {
    const plan = milestonesFor(specOf(1));
    expect(plan.hintStep).toBe(20);
    expect(plan.addTimeStep).toBe(40);
    // L1 ceiling is 60: two hint refunds + one add-time refund are reachable.
    expect(baseCeiling(1)).toBe(60);
  });

  it("scales thresholds with the level ceiling (roughly 30% / 60%)", () => {
    for (let level = 2; level <= TOTAL_LEVELS; level += 1) {
      const plan = milestonesFor(specOf(level));
      const ceiling = baseCeiling(level);
      expect(Math.abs(plan.hintStep - ceiling * 0.3)).toBeLessThanOrEqual(3);
      expect(Math.abs(plan.addTimeStep - ceiling * 0.6)).toBeLessThanOrEqual(3);
    }
  });

  it("refunds a hint (not add-time) for a 4-chain combo", () => {
    for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
      expect(milestonesFor(specOf(level)).comboHintAt).toBe(4);
    }
  });

  it("refunds a usable space rescue (not a dead clock resource) in untimed mode", () => {
    // R1: the default untimed mode has no clock, so the add-time milestone must
    // hand back a rescue the player can actually spend (remove). A test that
    // lets this silently become `undefined`/`"addTime"` would resurrect the
    // dead-resource bug for every untimed run.
    for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
      expect(milestonesFor(specOf(level)).untimedRefund).toBe("remove");
    }
  });
});

describe("LEVEL_CURVE clock fairness", () => {
  it("never budgets below the tune.mjs recommendation (items × 1.5s + 12s)", () => {
    for (const spec of LEVEL_CURVE) {
      const items = spec.kinds * spec.perKind * 3;
      const rawFloorMs = (items * 1.5 + 12) * 1000;
      const recMs = Math.ceil((items * 1.5 + 12) / 5) * 5 * 1000;
      expect(spec.timeMs).toBeGreaterThanOrEqual(rawFloorMs);
      expect(spec.timeMs).toBeGreaterThanOrEqual(recMs);
    }
  });
});
