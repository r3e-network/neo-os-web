import { describe, expect, it } from "vitest";

import {
  canClaim,
  deriveSchedule,
  deriveSchedulePreview,
  isFinalizedStatus,
  releasePerDayDisplay,
  statusLabelKey,
} from "@shared/composables/neo-pay";

describe("neo-pay status badge i18n", () => {
  it("maps each normalized status to its locale key (never raw English)", () => {
    expect(statusLabelKey("active")).toBe("statusActive");
    expect(statusLabelKey("completed")).toBe("statusCompleted");
    expect(statusLabelKey("cancelled")).toBe("statusCancelled");
    // An unknown/undefined status defaults to active, not a blank string.
    expect(statusLabelKey(undefined)).toBe("statusActive");
    expect(statusLabelKey("weird")).toBe("statusActive");
  });
});

describe("neo-pay claim gating", () => {
  it("enables Claim only for an active stream with a positive claimable", () => {
    expect(canClaim("active", true)).toBe(true);
  });

  it("disables Claim when nothing is vested yet", () => {
    expect(canClaim("active", false)).toBe(false);
  });

  it("disables Claim on a finalized stream regardless of claimable", () => {
    expect(canClaim("completed", true)).toBe(false);
    expect(canClaim("cancelled", true)).toBe(false);
    expect(isFinalizedStatus("completed")).toBe(true);
    expect(isFinalizedStatus("cancelled")).toBe(true);
    expect(isFinalizedStatus("active")).toBe(false);
  });
});

describe("neo-pay schedule disclosure mirrors deriveSchedule (NEO cliff)", () => {
  it("warns about the cliff exactly when deriveSchedule collapses to a single interval", () => {
    // 5 NEO over 30 days: < 1 NEO/day -> the contract gets rate=total,
    // intervalDays=duration (a single end-of-term cliff). The disclosure must
    // flag that.
    const schedule = deriveSchedule("5", "30", "NEO");
    expect(schedule).toEqual({ rate: "5", intervalDays: "30" });

    const preview = deriveSchedulePreview("5", "30", "NEO");
    expect(preview).toEqual({ kind: "cliff", amount: "5", days: "30" });
  });

  it("shows a linear per-day NEO release when >= 1 NEO/day", () => {
    expect(deriveSchedule("60", "30", "NEO")).toEqual({ rate: "2", intervalDays: "1" });
    expect(deriveSchedulePreview("60", "30", "NEO")).toEqual({
      kind: "linear",
      amount: "2",
      days: "30",
    });
  });

  it("does not truncate fractional NEO into a valid-looking schedule", () => {
    expect(deriveSchedule("1.5", "30", "NEO")).toEqual({ rate: "0", intervalDays: "1" });
    expect(deriveSchedulePreview("1.5", "30", "NEO")).toBeNull();
  });

  it("shows a linear per-day GAS release", () => {
    const preview = deriveSchedulePreview("30", "30", "GAS");
    expect(preview).toEqual({ kind: "linear", amount: "1", days: "30" });
  });

  it("returns null for incomplete or non-positive input", () => {
    expect(deriveSchedulePreview("", "30", "GAS")).toBeNull();
    expect(deriveSchedulePreview("10", "", "GAS")).toBeNull();
    expect(deriveSchedulePreview("0", "30", "GAS")).toBeNull();
    expect(deriveSchedulePreview("10", "0", "GAS")).toBeNull();
  });
});

describe("neo-pay created-stream per-day release", () => {
  it("treats a 1-day interval rate as the per-day GAS amount", () => {
    // 1 GAS/day = 1e8 base units, intervalDays 1.
    expect(releasePerDayDisplay(100000000n, 1, "GAS")).toBe("1");
  });

  it("divides a multi-day GAS interval into a per-day figure", () => {
    // 3 GAS over a 3-day interval -> 1 GAS/day.
    expect(releasePerDayDisplay(300000000n, 3, "GAS")).toBe("1");
  });

  it("shows whole NEO/day for an integer NEO rate", () => {
    expect(releasePerDayDisplay(2n, 1, "NEO")).toBe("2");
  });

  it("omits the per-day figure for a sub-1-NEO/day cliff", () => {
    // 5 NEO over a 30-day cliff interval -> < 1 NEO/day, not shown.
    expect(releasePerDayDisplay(5n, 30, "NEO")).toBeNull();
  });

  it("returns null when there is no parsed rate", () => {
    expect(releasePerDayDisplay(undefined, 1, "GAS")).toBeNull();
    expect(releasePerDayDisplay(0n, 1, "GAS")).toBeNull();
  });
});
