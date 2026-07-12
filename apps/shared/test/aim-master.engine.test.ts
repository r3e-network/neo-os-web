import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONFIG,
  EMPTY_AIM_RUN,
  RING_POINTS,
  calculateHitResult,
  comboMultiplier,
  difficultyProfile,
  evaluateHitResults,
  generateDifficultyPattern,
  generateTargetPattern,
  isAccuracyHit,
  isWin,
  parseTargetPattern,
  totalPoints,
} from "../../aim-master/src/logic/aim-engine";
import {
  canReleaseAfterGrace,
  DIFFICULTY_RULES,
  formatClock,
  gasDisplay,
  payoutFixed8ForAccuracy,
  ruleOf,
  statusOf,
} from "../../aim-master/src/logic/game-rules";

/**
 * Aim Master engine tests.
 *
 * The engine has two layers:
 *  - aim-engine.ts — target physics (pattern generation, hit detection, scoring)
 *  - game-rules.ts  — economic constants (entry, reward, payout, formatting)
 */

describe("aim-master target pattern generation", () => {
  it("generates a deterministic pattern from the same seed", () => {
    const seed = "deadbeef" + "00".repeat(28);
    const a = generateTargetPattern(seed);
    const b = generateTargetPattern(seed);
    expect(a).toEqual(b);
  });

  it("generates different patterns from different seeds", () => {
    const a = generateTargetPattern("seed-a" + "0".repeat(58));
    const b = generateTargetPattern("seed-b" + "0".repeat(58));
    expect(a).not.toEqual(b);
  });

  it("returns positions within the gauge width (0…width)", () => {
    const seed = "range-test" + "0".repeat(54);
    const pattern = generateTargetPattern(seed);
    expect(pattern.length).toBeGreaterThan(0);
    for (const pos of pattern) {
      expect(pos).toBeGreaterThanOrEqual(0);
      expect(pos).toBeLessThanOrEqual(DEFAULT_CONFIG.width);
    }
  });

  it("respects a custom config override", () => {
    const seed = "config-test" + "0".repeat(53);
    const customWidth = 400;
    const pattern = generateTargetPattern(seed, { width: customWidth });
    for (const pos of pattern) {
      expect(pos).toBeLessThanOrEqual(customWidth);
    }
  });

  it("generates ~5000 ms worth of ticks", () => {
    const seed = "length-test" + "0".repeat(53);
    const tickMs = DEFAULT_CONFIG.tickMs;
    const pattern = generateTargetPattern(seed);
    const expectedTicks = Math.ceil(5000 / tickMs);
    expect(pattern.length).toBe(expectedTicks);
  });

  it("does not consult ambient Math.random for seeded motion", () => {
    const originalRandom = Math.random;
    Math.random = () => { throw new Error("ambient randomness must not be used"); };
    try {
      expect(generateTargetPattern("fully-seeded")).toEqual(
        generateTargetPattern("fully-seeded"),
      );
    } finally {
      Math.random = originalRandom;
    }
  });

  it("defines a monotonic difficulty curve and a longer guest timeline", () => {
    const easy = difficultyProfile(0);
    const medium = difficultyProfile(1);
    const hard = difficultyProfile(2);
    expect(easy.maxSpeed).toBeLessThan(medium.maxSpeed);
    expect(medium.maxSpeed).toBeLessThan(hard.maxSpeed);
    expect(easy.reducedMotionStepMs).toBeGreaterThan(medium.reducedMotionStepMs);
    expect(medium.reducedMotionStepMs).toBeGreaterThan(hard.reducedMotionStepMs);
    expect(generateDifficultyPattern("guest-seed", 1)).toHaveLength(
      Math.ceil(12_000 / DEFAULT_CONFIG.tickMs),
    );
    expect(generateDifficultyPattern("guest-seed", 0, 1_000)).not.toEqual(
      generateDifficultyPattern("guest-seed", 2, 1_000),
    );
  });

  it("rejects corrupt or oversized pattern views without shifting their timeline", () => {
    expect(parseTargetPattern("0,150,300")).toEqual([0, 150, 300]);
    expect(parseTargetPattern("0,NaN,300")).toEqual([]);
    expect(parseTargetPattern("0,301,150")).toEqual([]);
    expect(parseTargetPattern("150")).toEqual([]);
    expect(parseTargetPattern(Array.from({ length: 5 }, () => "150").join(","), 300, 4)).toEqual([]);
  });
});

describe("aim-master hit calculation", () => {
  it("returns bullseye (ring 0) when stopped at the centre", () => {
    const result = calculateHitResult(DEFAULT_CONFIG.centre);
    expect(result.ring).toBe(0);
    expect(result.points).toBe(RING_POINTS[0]);
    expect(result.offset).toBe(0);
  });

  it("returns ring 0 within bullseye radius of centre", () => {
    const result = calculateHitResult(DEFAULT_CONFIG.centre + 3);
    expect(result.ring).toBe(0);
    expect(Math.abs(result.offset)).toBeLessThanOrEqual(DEFAULT_CONFIG.bullseyeRadius);
  });

  it("returns ring 1 just outside the bullseye", () => {
    const pos = DEFAULT_CONFIG.centre + DEFAULT_CONFIG.bullseyeRadius + 1;
    const result = calculateHitResult(pos);
    expect(result.ring).toBe(1);
    expect(result.points).toBe(RING_POINTS[1]);
  });

  it("returns ring 5 at the far edge of the gauge", () => {
    const pos = DEFAULT_CONFIG.width;
    const result = calculateHitResult(pos);
    expect(result.ring).toBe(5);
    expect(result.points).toBe(RING_POINTS[5]);
  });

  it("clamps ring to 5 for offsets beyond the gauge", () => {
    const result = calculateHitResult(-100);
    expect(result.ring).toBe(5);
    expect(result.points).toBe(RING_POINTS[5]);

    const result2 = calculateHitResult(DEFAULT_CONFIG.width + 100);
    expect(result2.ring).toBe(5);
    expect(result2.points).toBe(RING_POINTS[5]);
  });

  it("reports negative offset for positions left of centre", () => {
    const result = calculateHitResult(DEFAULT_CONFIG.centre - 50);
    expect(result.offset).toBeLessThan(0);
  });

  it("keeps exact visual ring boundaries in the inner ring", () => {
    const bullseyeEdge = DEFAULT_CONFIG.centre + DEFAULT_CONFIG.bullseyeRadius;
    const ringOneEdge = bullseyeEdge + DEFAULT_CONFIG.ringWidth;
    expect(calculateHitResult(bullseyeEdge).ring).toBe(0);
    expect(calculateHitResult(bullseyeEdge + 0.001).ring).toBe(1);
    expect(calculateHitResult(ringOneEdge).ring).toBe(1);
    expect(calculateHitResult(ringOneEdge + 0.001).ring).toBe(2);
  });

  it("normalises non-finite positions and invalid geometry safely", () => {
    expect(calculateHitResult(Number.NaN).ring).toBe(5);
    expect(calculateHitResult(DEFAULT_CONFIG.centre + 30, { ringWidth: 0 }).ring).toBe(1);
  });
});

describe("aim-master authoritative run scoring", () => {
  it("builds score, hit count, combo, and max combo from signed offsets", () => {
    const evaluated = evaluateHitResults([
      { ring: 5, points: 0, offset: 0 },
      { ring: 5, points: 0, offset: 0 },
      { ring: 0, points: 999_999, offset: 150 },
      { ring: 5, points: 0, offset: 0 },
    ]);
    expect(evaluated.summary).toEqual({
      accuracyHits: 3,
      totalShots: 4,
      combo: 1,
      maxCombo: 2,
      score: 31,
    });
    expect(evaluated.results.map((result) => result.ring)).toEqual([0, 0, 5, 0]);
    expect(evaluated.results.map((result) => result.awardedPoints)).toEqual([10, 11, 0, 10]);
  });

  it("resets combo on a miss and caps the multiplier at 2x", () => {
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(6)).toBe(1.5);
    expect(comboMultiplier(99)).toBe(2);
    const evaluated = evaluateHitResults(
      Array.from({ length: 12 }, () => ({ offset: 0 })),
    );
    expect(evaluated.summary.combo).toBe(12);
    expect(evaluated.summary.maxCombo).toBe(12);
    expect(evaluated.results.at(-1)?.multiplier).toBe(2);
  });

  it("ignores malformed shots rather than turning them into bullseyes", () => {
    const evaluated = evaluateHitResults([
      null,
      { offset: Number.NaN },
      { offset: "not-a-number" },
      { offset: 0 },
    ]);
    expect(evaluated.summary).toEqual({ ...EMPTY_AIM_RUN, accuracyHits: 1, totalShots: 1, combo: 1, maxCombo: 1, score: 10 });
    expect(evaluated.results).toHaveLength(1);
  });
});

describe("aim-master accuracy and win detection", () => {
  it("isAccuracyHit returns true for rings 0, 1, 2", () => {
    expect(isAccuracyHit(0)).toBe(true);
    expect(isAccuracyHit(1)).toBe(true);
    expect(isAccuracyHit(2)).toBe(true);
  });

  it("isAccuracyHit returns false for rings 3, 4, 5", () => {
    expect(isAccuracyHit(3)).toBe(false);
    expect(isAccuracyHit(4)).toBe(false);
    expect(isAccuracyHit(5)).toBe(false);
  });

  it("isWin returns false when accuracy hits are below target", () => {
    const ringsHit = [0, 5, 3]; // only 1 good hit
    expect(isWin(ringsHit, 3)).toBe(false);
  });

  it("isWin returns true when accuracy hits meet the target", () => {
    const ringsHit = [0, 1, 2]; // 3 good hits
    expect(isWin(ringsHit, 3)).toBe(true);
  });

  it("isWin returns true when accuracy hits exceed the target", () => {
    const ringsHit = [0, 1, 2, 0]; // 4 good hits, target 3
    expect(isWin(ringsHit, 3)).toBe(true);
  });
});

describe("aim-master totalPoints", () => {
  it("sums RING_POINTS for each ring value", () => {
    expect(totalPoints([0])).toBe(RING_POINTS[0]);
    expect(totalPoints([5])).toBe(RING_POINTS[5]);
    expect(totalPoints([0, 1, 2])).toBe(RING_POINTS[0] + RING_POINTS[1] + RING_POINTS[2]);
    expect(totalPoints([0, 0, 0])).toBe(RING_POINTS[0] * 3);
  });

  it("clamps invalid ring values to 0..5", () => {
    expect(totalPoints([-1])).toBe(RING_POINTS[0]);
    expect(totalPoints([99])).toBe(RING_POINTS[5]);
  });

  it("returns 0 for an empty array", () => {
    expect(totalPoints([])).toBe(0);
  });
});

describe("aim-master difficulty rules and payout", () => {
  it("defines three difficulty tiers with correct key and targetAccuracy", () => {
    expect(DIFFICULTY_RULES).toHaveLength(3);

    const [easy, medium, hard] = DIFFICULTY_RULES;

    expect(easy.difficulty).toBe(0);
    expect(easy.key).toBe("easy");
    expect(easy.entryFixed8).toBe(2_000_000n);
    expect(easy.rewardFixed8).toBe(10_000_000n);
    expect(easy.targetAccuracy).toBe(3);

    expect(medium.difficulty).toBe(1);
    expect(medium.key).toBe("medium");
    expect(medium.entryFixed8).toBe(10_000_000n);
    expect(medium.rewardFixed8).toBe(50_000_000n);
    expect(medium.targetAccuracy).toBe(5);

    expect(hard.difficulty).toBe(2);
    expect(hard.key).toBe("hard");
    expect(hard.entryFixed8).toBe(20_000_000n);
    expect(hard.rewardFixed8).toBe(100_000_000n);
    expect(hard.targetAccuracy).toBe(7);
  });

  it("ruleOf returns the correct rule for each difficulty", () => {
    expect(ruleOf(0).targetAccuracy).toBe(3);
    expect(ruleOf(1).targetAccuracy).toBe(5);
    expect(ruleOf(2).targetAccuracy).toBe(7);
  });

  it("payoutFixed8ForAccuracy computes proportional payout", () => {
    // Easy: reward 10M, targetAccuracy 3. Hitting all 3 → full reward
    expect(payoutFixed8ForAccuracy(0, 3)).toBe(10_000_000n);
    // Hitting 2 of 3 → floor(10M * 2/3) = 6,666,666
    expect(payoutFixed8ForAccuracy(0, 2)).toBe(6_666_666n);
    // Hitting 0 → 0
    expect(payoutFixed8ForAccuracy(0, 0)).toBe(0n);
  });

  it("payoutFixed8ForAccuracy caps ringsHit at targetAccuracy", () => {
    // Easy: hitting 5 but target is 3 → treated as 3 → full reward
    expect(payoutFixed8ForAccuracy(0, 5)).toBe(10_000_000n);
  });

  it("never turns malformed or negative hit counters into a negative payout", () => {
    expect(payoutFixed8ForAccuracy(0, -1)).toBe(0n);
    expect(payoutFixed8ForAccuracy(0, Number.NaN)).toBe(0n);
  });

  it("preserves pending settlement status and gates recovery until grace passes", () => {
    expect(statusOf(5)).toBe("unknown");
    expect(statusOf(99)).toBe("unknown");
    expect(canReleaseAfterGrace(1_000, 601_000, 600_000)).toBe(false);
    expect(canReleaseAfterGrace(1_000, 601_001, 600_000)).toBe(true);
  });
});

describe("aim-master display helpers", () => {
  it("gasDisplay formats bigint Fixed8 values as GAS strings", () => {
    expect(gasDisplay(0n)).toBe("0");
    expect(gasDisplay(100_000_000n)).toBe("1");
    expect(gasDisplay(10_000_000n)).toBe("0.1");
    expect(gasDisplay(15_000_000n)).toBe("0.15");
    expect(gasDisplay(1_000_000n)).toBe("0.01");
    expect(gasDisplay(12_345_678n)).toBe("0.12345678");
  });

  it("gasDisplay omits trailing zeros after the decimal", () => {
    expect(gasDisplay(10_000_000n)).toBe("0.1");
    expect(gasDisplay(11_000_000n)).toBe("0.11");
  });

  it("formatClock returns MM:SS for various ms inputs", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(30_000)).toBe("00:30");
    expect(formatClock(60_000)).toBe("01:00");
    expect(formatClock(90_000)).toBe("01:30");
    expect(formatClock(120_000)).toBe("02:00");
    expect(formatClock(300_000)).toBe("05:00");
  });

  it("formatClock floors fractional seconds", () => {
    // 61_999 ms → floor(61.999) = 61s → 01:01
    expect(formatClock(61_999)).toBe("01:01");
    // 59_999 ms → 59s → 00:59
    expect(formatClock(59_999)).toBe("00:59");
  });
});
