import { describe, expect, it } from "vitest";

import {
  ACTION_NAMES,
  DIFFICULTY_RULES,
  EVOLUTION_STAGES,
  MAX_MOVES,
  MAX_UNDOS,
  POTION_RECIPE,
  UNDO_PENALTY_PCT,
  SETTLEMENT_GRACE_MS,
  canExpireAfterGrace,
  evolutionStage,
  emptyIngredientCounts,
  formatClock,
  gasDisplay,
  ingredientCountsOf,
  payoutFixed8,
  recipeReady,
  rewardPctAfterUndos,
  ruleOf,
  statusOf,
} from "../../pet-potion/src/logic/game-rules";

/**
 * Pet Potion engine tests.
 *
 * The engine exports game rules (difficulty tiers, undo penalty, payout math),
 * pet evolution logic, action constants, and display helpers.
 */

describe("pet-potion difficulty rules", () => {
  it("defines three difficulty tiers with correct targetHappiness and entry/reward", () => {
    expect(DIFFICULTY_RULES).toHaveLength(3);

    const [easy, medium, hard] = DIFFICULTY_RULES;

    expect(easy.difficulty).toBe(0);
    expect(easy.targetHappiness).toBe(50);
    expect(easy.entry).toBe(2_000_000);
    expect(easy.reward).toBe(10_000_000);
    expect(easy.limitMs).toBe(180_000);
    expect(easy.minSolveMs).toBe(30_000);

    expect(medium.difficulty).toBe(1);
    expect(medium.targetHappiness).toBe(70);
    expect(medium.entry).toBe(10_000_000);
    expect(medium.reward).toBe(50_000_000);
    expect(medium.limitMs).toBe(300_000);
    expect(medium.minSolveMs).toBe(60_000);

    expect(hard.difficulty).toBe(2);
    expect(hard.targetHappiness).toBe(100);
    expect(hard.entry).toBe(20_000_000);
    expect(hard.reward).toBe(100_000_000);
    expect(hard.limitMs).toBe(600_000);
    expect(hard.minSolveMs).toBe(120_000);
  });

  it("ruleOf returns the correct rule for each difficulty", () => {
    expect(ruleOf(0).targetHappiness).toBe(50);
    expect(ruleOf(1).targetHappiness).toBe(70);
    expect(ruleOf(2).targetHappiness).toBe(100);
  });

  it("ruleOf throws for an unknown difficulty", () => {
    expect(() => ruleOf(-1)).toThrow("unknown difficulty -1");
    expect(() => ruleOf(3)).toThrow("unknown difficulty 3");
  });
});

describe("pet-potion undo penalty and payout", () => {
  it("rewardPctAfterUndos returns 100% minus 30% per undo", () => {
    expect(rewardPctAfterUndos(0)).toBe(100);
    expect(rewardPctAfterUndos(1)).toBe(70);
    expect(rewardPctAfterUndos(2)).toBe(40);
    expect(rewardPctAfterUndos(3)).toBe(10);
  });

  it("payoutFixed8 returns full reward with no undos", () => {
    expect(payoutFixed8(10_000_000, 0)).toBe(10_000_000);
    expect(payoutFixed8(50_000_000, 0)).toBe(50_000_000);
    expect(payoutFixed8(100_000_000, 0)).toBe(100_000_000);
  });

  it("payoutFixed8 applies undo penalty correctly", () => {
    expect(payoutFixed8(10_000_000, 1)).toBe(7_000_000);
    expect(payoutFixed8(10_000_000, 2)).toBe(4_000_000);
    expect(payoutFixed8(10_000_000, 3)).toBe(1_000_000);
  });

  it("MAX_UNDOS and UNDO_PENALTY_PCT are as expected", () => {
    expect(MAX_UNDOS).toBe(3);
    expect(UNDO_PENALTY_PCT).toBe(30);
  });

  it("MAX_MOVES is 40", () => {
    expect(MAX_MOVES).toBe(40);
  });

  it("matches the contract's strict settlement recovery grace", () => {
    const deadline = 1_000_000;
    expect(SETTLEMENT_GRACE_MS).toBe(600_000);
    expect(canExpireAfterGrace(deadline, deadline + SETTLEMENT_GRACE_MS)).toBe(false);
    expect(canExpireAfterGrace(deadline, deadline + SETTLEMENT_GRACE_MS + 1)).toBe(true);
    expect(canExpireAfterGrace(0, Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});

describe("pet-potion display helpers", () => {
  it("gasDisplay formats Fixed8 values with two decimal places", () => {
    expect(gasDisplay(0)).toBe("0.00");
    expect(gasDisplay(1)).toBe("0.00");
    expect(gasDisplay(100_000_000)).toBe("1.00");
    expect(gasDisplay(10_000_000)).toBe("0.10");
    expect(gasDisplay(50_000_000)).toBe("0.50");
    expect(gasDisplay(2_000_000)).toBe("0.02");
  });

  it("formatClock uses ceil-based conversion and M:SS format", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(-100)).toBe("0:00");
    // 61_999 ms → ceil(61.999) = 62 → 1:02
    expect(formatClock(61_999)).toBe("1:02");
    // 60_000 ms → ceil(60) = 60 → 1:00
    expect(formatClock(60_000)).toBe("1:00");
    // 180_000 ms → 3:00
    expect(formatClock(180_000)).toBe("3:00");
    // 600_000 ms → 10:00
    expect(formatClock(600_000)).toBe("10:00");
  });

  it("statusOf maps numeric status to string", () => {
    expect(statusOf(0)).toBe("awaiting-bind");
    expect(statusOf(1)).toBe("playing");
    expect(statusOf(2)).toBe("solved");
    expect(statusOf(3)).toBe("expired");
    expect(statusOf(4)).toBe("refunded");
    expect(statusOf(99)).toBe("unknown");
  });
});

describe("pet-potion evolution stage", () => {
  it("evolutionStage returns 0 (baby) for happiness below 30", () => {
    expect(evolutionStage(0)).toBe(0);
    expect(evolutionStage(15)).toBe(0);
    expect(evolutionStage(29)).toBe(0);
  });

  it("evolutionStage returns 1 (child) for happiness 30–59", () => {
    expect(evolutionStage(30)).toBe(1);
    expect(evolutionStage(45)).toBe(1);
    expect(evolutionStage(59)).toBe(1);
  });

  it("evolutionStage returns 2 (adult) for happiness 60 and above", () => {
    expect(evolutionStage(60)).toBe(2);
    expect(evolutionStage(85)).toBe(2);
    expect(evolutionStage(100)).toBe(2);
  });
});

describe("pet-potion constants", () => {
  it("ACTION_NAMES contains the four actions", () => {
    expect(ACTION_NAMES).toEqual(["feed", "play", "pet", "rest"]);
  });

  it("EVOLUTION_STAGES contains the three stages", () => {
    expect(EVOLUTION_STAGES).toEqual(["baby", "child", "adult"]);
  });

  it("requires one essence from every illustrated care tool", () => {
    expect(POTION_RECIPE).toEqual({ feed: 1, play: 1, pet: 1, rest: 1 });
    expect(recipeReady(emptyIngredientCounts())).toBe(false);
    expect(recipeReady(ingredientCountsOf(["feed", "play", "pet", "rest"]))).toBe(true);
    expect(ingredientCountsOf(["feed", "feed", "unknown"])).toEqual({
      feed: 2,
      play: 0,
      pet: 0,
      rest: 0,
    });
  });
});
