import { describe, expect, it } from "vitest";
import {
  computeGoosePassive,
  EMPTY_GOOSE_PASSIVE,
  GOOSE_PASSIVES,
  GOOSE_PASSIVE_LIMITS,
  goosePerkKey,
} from "./goose-passive";

describe("R3 — goose passive aggregation", () => {
  it("returns the empty passive for no geese", () => {
    expect(computeGoosePassive([])).toEqual(EMPTY_GOOSE_PASSIVE);
  });

  it("maps each scene goose to its single independent lever", () => {
    expect(computeGoosePassive([0]).extraHint).toBe(1);
    expect(computeGoosePassive([1]).extraRemove).toBe(1);
    expect(computeGoosePassive([2]).shakeCdDeltaMs).toBe(-1000);
    expect(computeGoosePassive([3]).comboWindowDeltaMs).toBe(200);
    expect(computeGoosePassive([4]).extraUndo).toBe(1);
    expect(computeGoosePassive([5]).milestoneThresholdScale).toBeCloseTo(0.9, 5);
  });

  it("sums non-overlapping item bonuses across geese", () => {
    const p = computeGoosePassive([0, 1, 4]);
    expect(p.extraHint).toBe(1);
    expect(p.extraRemove).toBe(1);
    expect(p.extraUndo).toBe(1);
    // Scalar levers untouched by these three geese.
    expect(p.shakeCdDeltaMs).toBe(0);
    expect(p.comboWindowDeltaMs).toBe(0);
    expect(p.milestoneThresholdScale).toBe(1);
  });

  it("multiplies the milestone threshold scale across geese", () => {
    // Only the night-market goose scales; collecting it once → 0.9.
    const p = computeGoosePassive([5]);
    expect(p.milestoneThresholdScale).toBeCloseTo(0.9, 5);
  });

  it("aggregates every goose without distorting handfeel", () => {
    const p = computeGoosePassive([0, 1, 2, 3, 4, 5]);
    expect(p.extraHint).toBe(1);
    expect(p.extraRemove).toBe(1);
    expect(p.extraUndo).toBe(1);
    expect(p.shakeCdDeltaMs).toBe(-1000);
    expect(p.comboWindowDeltaMs).toBe(200);
    expect(p.milestoneThresholdScale).toBeCloseTo(0.9, 5);
  });

  it("clamps the shake cooldown reduction to its floor", () => {
    // Even if a hypothetical config stacked a huge reduction, it cannot exceed
    // the documented cap (base 5s → min 2s).
    const p = computeGoosePassive([2]);
    expect(p.shakeCdDeltaMs).toBeGreaterThanOrEqual(-GOOSE_PASSIVE_LIMITS.maxShakeCdReductionMs);
    expect(p.shakeCdDeltaMs).toBeLessThanOrEqual(0);
  });

  it("clamps the combo-window extension to its ceiling", () => {
    const p = computeGoosePassive([3]);
    expect(p.comboWindowDeltaMs).toBeLessThanOrEqual(GOOSE_PASSIVE_LIMITS.maxComboWindowDeltaMs);
    expect(p.comboWindowDeltaMs).toBeGreaterThanOrEqual(0);
  });

  it("ignores unknown scene ids instead of throwing", () => {
    expect(computeGoosePassive([99, -1, 2])).toEqual(
      expect.objectContaining({ shakeCdDeltaMs: -1000 }),
    );
  });

  it("exposes a perk copy key per defined goose, null otherwise", () => {
    expect(goosePerkKey(0)).toBe(GOOSE_PASSIVES[0]!.perkKey);
    expect(goosePerkKey(5)).toBe("goosePerkNightMarket");
    expect(goosePerkKey(99)).toBeNull();
  });
});

describe("R7 — chapter 2 goose passives (content expansion)", () => {
  it("maps the three new scene geese to three distinct new levers", () => {
    expect(computeGoosePassive([6]).extraShuffle).toBe(1);
    expect(computeGoosePassive([7]).scoreBonus).toBeCloseTo(0.05, 5);
    expect(computeGoosePassive([8]).frenzyTriggerDelta).toBe(1);
  });

  it("sums chapter-2 bonuses alongside the originals without distortion", () => {
    const p = computeGoosePassive([0, 6, 7, 8]);
    expect(p.extraHint).toBe(1);
    expect(p.extraShuffle).toBe(1);
    expect(p.scoreBonus).toBeCloseTo(0.05, 5);
    expect(p.frenzyTriggerDelta).toBe(1);
    // Originals' scalar levers untouched by these four geese.
    expect(p.shakeCdDeltaMs).toBe(0);
    expect(p.comboWindowDeltaMs).toBe(0);
    expect(p.milestoneThresholdScale).toBe(1);
  });

  it("clamps the score-bonus prestige to its ceiling", () => {
    const p = computeGoosePassive([7]);
    expect(p.scoreBonus).toBeLessThanOrEqual(GOOSE_PASSIVE_LIMITS.maxScoreBonus);
    expect(p.scoreBonus).toBeCloseTo(0.05, 5);
  });

  it("clamps the frenzy-trigger reduction to its floor", () => {
    const p = computeGoosePassive([8]);
    expect(p.frenzyTriggerDelta).toBeLessThanOrEqual(GOOSE_PASSIVE_LIMITS.maxFrenzyTriggerReduction);
    expect(p.frenzyTriggerDelta).toBeGreaterThanOrEqual(0);
    expect(p.frenzyTriggerDelta).toBe(1);
  });

  it("exposes perk copy keys for the chapter-2 geese", () => {
    expect(goosePerkKey(6)).toBe("goosePerkVolcano");
    expect(goosePerkKey(7)).toBe("goosePerkCloud");
    expect(goosePerkKey(8)).toBe("goosePerkAbyss");
  });
});
