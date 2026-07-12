import { describe, expect, it } from "vitest";

import {
  COLOR_GLOW,
  COLOR_HEX,
  COLOR_NAMES,
  CUE_TIMINGS,
  DIFFICULTY_RULES,
  SETTLEMENT_GRACE_MS,
  canReleaseExpiredGame,
  cueTimingOf,
  formatClock,
  gasDisplay,
  payoutFixed8,
  releaseAtOf,
  rewardPctAfterUndos,
  ruleOf,
  statusOf,
} from "../../color-clash/src/logic/game-rules";
import {
  applyColorPress,
  createColorRun,
  hasColorDeadlinePassed,
  markColorSequenceShown,
  normalizeColorSequence,
  requireColorSequence,
} from "../../color-clash/src/logic/color-engine";

/**
 * Color Clash engine tests.
 *
 * Covers the pure progressive-Simon state machine plus difficulty, payout,
 * clock, status, and colour rules.
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

  it("speeds up cue playback across the three arcade modes", () => {
    expect(CUE_TIMINGS).toHaveLength(3);
    expect(cueTimingOf(0).litMs).toBeGreaterThan(cueTimingOf(1).litMs);
    expect(cueTimingOf(1).litMs).toBeGreaterThan(cueTimingOf(2).litMs);
    expect(cueTimingOf(0).gapMs).toBeGreaterThan(cueTimingOf(1).gapMs);
    expect(cueTimingOf(1).gapMs).toBeGreaterThan(cueTimingOf(2).gapMs);
  });

  it("matches the contract recovery boundary before enabling release", () => {
    const deadline = 1_000;
    expect(releaseAtOf(deadline)).toBe(deadline + SETTLEMENT_GRACE_MS);
    expect(canReleaseExpiredGame(deadline, SETTLEMENT_GRACE_MS, deadline + SETTLEMENT_GRACE_MS)).toBe(false);
    expect(canReleaseExpiredGame(deadline, SETTLEMENT_GRACE_MS, deadline + SETTLEMENT_GRACE_MS + 1)).toBe(true);
    expect(canReleaseExpiredGame(0, SETTLEMENT_GRACE_MS, Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});

describe("color-clash authoritative Simon run", () => {
  it("starts with one visible cue and locks input until playback finishes", () => {
    const run = createColorRun("0123", 4);
    expect(run.visibleSequence).toBe("0");
    expect(run.round).toBe(1);
    expect(run.phase).toBe("watching");
    expect(applyColorPress(run, 0).outcome).toBe("ignored");
  });

  it("grows the visible pattern one cue after each completed round", () => {
    let run = markColorSequenceShown(createColorRun("0123", 4));
    const first = applyColorPress(run, 0);
    expect(first.outcome).toBe("round-complete");
    expect(first.state.visibleSequence).toBe("01");
    expect(first.state.achieved).toBe(1);
    expect(first.state.round).toBe(2);
    expect(first.state.phase).toBe("watching");

    run = markColorSequenceShown(first.state);
    run = applyColorPress(run, 0).state;
    const second = applyColorPress(run, 1);
    expect(second.outcome).toBe("round-complete");
    expect(second.state.visibleSequence).toBe("012");
    expect(second.state.achieved).toBe(2);
  });

  it("keeps the longest completed round when the next round is wrong", () => {
    let run = markColorSequenceShown(createColorRun("012", 3));
    run = applyColorPress(run, 0).state;
    run = markColorSequenceShown(run);
    const wrong = applyColorPress(run, 3);
    expect(wrong.outcome).toBe("wrong");
    expect(wrong.expected).toBe(0);
    expect(wrong.state.achieved).toBe(1);
    expect(wrong.state.phase).toBe("wrong");
  });

  it("marks the final complete sequence as authoritative score", () => {
    let run = markColorSequenceShown(createColorRun("01", 2));
    run = applyColorPress(run, 0).state;
    run = markColorSequenceShown(run);
    run = applyColorPress(run, 0).state;
    const completed = applyColorPress(run, 1);
    expect(completed.outcome).toBe("complete");
    expect(completed.state.achieved).toBe(2);
    expect(completed.state.phase).toBe("complete");
  });

  it("normalizes malformed sequences and fails closed on incomplete secrets", () => {
    expect(normalizeColorSequence("0x1-2349", 4)).toBe("0123");
    expect(() => createColorRun("01x", 3)).toThrow("complete 0..3 secret sequence");
    expect(() => createColorRun("0x123", 4)).toThrow("complete 0..3 secret sequence");
    expect(() => requireColorSequence("01x", 3)).toThrow("invalid-color-sequence");
    expect(requireColorSequence("012", 3)).toBe("012");
  });

  it("treats only positive elapsed deadlines as expired", () => {
    expect(hasColorDeadlinePassed(0, 100)).toBe(false);
    expect(hasColorDeadlinePassed(101, 100)).toBe(false);
    expect(hasColorDeadlinePassed(100, 100)).toBe(true);
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
