import { describe, expect, it } from "vitest";

import {
  COLOR_GLOW,
  COLOR_HEX,
  COLOR_NAMES,
  DIFFICULTY_RULES,
  formatClock,
  gasDisplay,
  payoutFixed8,
  rewardPctAfterUndos,
  ruleOf,
  statusOf,
} from "../../color-clash/src/logic/game-rules";

/**
 * Color Clash engine tests.
 *
 * The engine logic lives in game-rules.ts — there is no separate engine file.
 * These tests cover difficulty rules, payout math, clock formatting, status
 * mapping, and the colour constants.
 */

describe("color-clash difficulty rules", () => {
  it("defines three difficulty tiers with correct values", () => {
    expect(DIFFICULTY_RULES).toHaveLength(3);

    const [easy, medium, hard] = DIFFICULTY_RULES;

    expect(easy.difficulty).toBe(0);
    expect(easy.entry).toBe(2_000_000);
    expect(easy.reward).toBe(10_000_000);
    expect(easy.limitMs).toBe(120_000);
    expect(easy.minSolveMs).toBe(15_000);
    expect(easy.targetSeq).toBe(8);

    expect(medium.difficulty).toBe(1);
    expect(medium.entry).toBe(10_000_000);
    expect(medium.reward).toBe(50_000_000);
    expect(medium.limitMs).toBe(180_000);
    expect(medium.minSolveMs).toBe(30_000);
    expect(medium.targetSeq).toBe(12);

    expect(hard.difficulty).toBe(2);
    expect(hard.entry).toBe(20_000_000);
    expect(hard.reward).toBe(100_000_000);
    expect(hard.limitMs).toBe(300_000);
    expect(hard.minSolveMs).toBe(45_000);
    expect(hard.targetSeq).toBe(16);
  });

  it("ruleOf returns the correct rule for each difficulty", () => {
    expect(ruleOf(0).targetSeq).toBe(8);
    expect(ruleOf(1).targetSeq).toBe(12);
    expect(ruleOf(2).targetSeq).toBe(16);
  });

  it("ruleOf throws for an unknown difficulty", () => {
    expect(() => ruleOf(99)).toThrow("unknown difficulty 99");
  });
});

describe("color-clash payout calculation", () => {
  it("rewardPctAfterUndos returns correct percentages", () => {
    expect(rewardPctAfterUndos(0)).toBe(100);
    expect(rewardPctAfterUndos(1)).toBe(70);
    expect(rewardPctAfterUndos(2)).toBe(40);
    expect(rewardPctAfterUndos(3)).toBe(10);
  });

  it("payoutFixed8 returns full reward with zero undos", () => {
    expect(payoutFixed8(10_000_000, 0)).toBe(10_000_000);
    expect(payoutFixed8(50_000_000, 0)).toBe(50_000_000);
    expect(payoutFixed8(100_000_000, 0)).toBe(100_000_000);
  });

  it("payoutFixed8 applies penalty per undo", () => {
    // 10M * 70% = 7M
    expect(payoutFixed8(10_000_000, 1)).toBe(7_000_000);
    // 50M * 40% = 20M
    expect(payoutFixed8(50_000_000, 2)).toBe(20_000_000);
    // 100M * 10% = 10M
    expect(payoutFixed8(100_000_000, 3)).toBe(10_000_000);
  });

  it("payoutFixed8 floors fractional results", () => {
    // 3_000_000 * 70% = 2_100_000 (exact)
    expect(payoutFixed8(3_000_000, 1)).toBe(2_100_000);
    // 3_000_000 * 40% = 1_200_000
    expect(payoutFixed8(3_000_000, 2)).toBe(1_200_000);
  });
});

describe("color-clash display helpers", () => {
  it("gasDisplay formats Fixed8 values as GAS strings", () => {
    expect(gasDisplay(0)).toBe("0.00");
    expect(gasDisplay(100_000_000)).toBe("1.00");
    expect(gasDisplay(10_000_000)).toBe("0.10");
    expect(gasDisplay(15_000_000)).toBe("0.15");
    expect(gasDisplay(1_000_000)).toBe("0.01");
    expect(gasDisplay(123_456_789)).toBe("1.23");
  });

  it("formatClock returns MM:SS for various ms inputs", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(30_000)).toBe("0:30");
    expect(formatClock(60_000)).toBe("1:00");
    expect(formatClock(90_000)).toBe("1:30");
    expect(formatClock(120_000)).toBe("2:00");
    expect(formatClock(179_999)).toBe("3:00"); // ceil(179.999) = 180s = 3:00
    expect(formatClock(300_000)).toBe("5:00");
  });

  it("formatClock handles sub-second rounding", () => {
    // 1 ms → ceil(0.001) = 1s → 0:01
    expect(formatClock(1)).toBe("0:01");
    // 59_999 ms → ceil(59.999) = 60s → 1:00
    expect(formatClock(59_999)).toBe("1:00");
  });
});

describe("color-clash status mapping", () => {
  it("maps numeric status codes to strings", () => {
    expect(statusOf(0)).toBe("awaiting-bind");
    expect(statusOf(1)).toBe("playing");
    expect(statusOf(2)).toBe("solved");
    expect(statusOf(3)).toBe("expired");
    expect(statusOf(4)).toBe("refunded");
  });

  it("maps unknown codes to 'unknown'", () => {
    expect(statusOf(5)).toBe("unknown");
    expect(statusOf(-1)).toBe("unknown");
  });
});

describe("color-clash colour constants", () => {
  it("COLOR_NAMES has four entries in the expected order", () => {
    expect(COLOR_NAMES).toHaveLength(4);
    expect(COLOR_NAMES[0]).toBe("red");
    expect(COLOR_NAMES[1]).toBe("blue");
    expect(COLOR_NAMES[2]).toBe("green");
    expect(COLOR_NAMES[3]).toBe("yellow");
  });

  it("COLOR_HEX has matching hex values", () => {
    expect(COLOR_HEX).toHaveLength(4);
    expect(COLOR_HEX[0]).toBe("#e74c3c");
    expect(COLOR_HEX[1]).toBe("#3498db");
    expect(COLOR_HEX[2]).toBe("#2ecc71");
    expect(COLOR_HEX[3]).toBe("#f1c40f");
  });

  it("COLOR_GLOW has matching glow values", () => {
    expect(COLOR_GLOW).toHaveLength(4);
    expect(COLOR_GLOW[0]).toBe("rgba(231,76,60,0.5)");
    expect(COLOR_GLOW[1]).toBe("rgba(52,152,219,0.5)");
    expect(COLOR_GLOW[2]).toBe("rgba(46,204,113,0.5)");
    expect(COLOR_GLOW[3]).toBe("rgba(241,196,15,0.5)");
  });
});
