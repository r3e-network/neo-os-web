import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
  ? path.resolve(process.cwd(), "..")
  : path.resolve(process.cwd(), "apps");
const source = readFileSync(
  path.join(appsRoot, "fogplay/src/composables/useCoinFlip.ts"),
  "utf8",
);

describe("FogPlay commit/reveal lifecycle guard", () => {
  it("uses the contract memo and exact Fixed8 amount once", () => {
    expect(source).toContain('const BET_MEMO = "miniapp-fogplay:bet"');
    expect(source).toContain("const amountBase = toBaseUnits(betAmount.get())");
    expect(source).toContain("app.chain.arg.integer(amountBase)");
    expect(source).not.toContain("miniapp-fogplay:bet:${choice}");
  });

  it("maps heads/tails to the deployed integer ABI", () => {
    expect(source).toContain('side === "heads" ? 0 : 1');
    expect(source).toContain('outcome === 0 ? "heads" : "tails"');
  });

  it("persists commit identity and confirms settlement from exact state", () => {
    expect(source).toContain('waitForEvent: "Committed"');
    expect(source).toContain('waitForEvent: "Settled"');
    expect(source).toContain('readRaw("getPendingBet"');
    expect(source).toContain("waitForCanonicalSettlement");
    expect(source).toContain("payoutBase !== expectedPayout");
  });

  it("keeps the public paid lane fail closed until artifact compatibility", () => {
    expect(source).toContain("export const FOGPLAY_PAID_LANE_ENABLED = false");
    expect(source).toContain("if (!paidLaneEnabled)");
  });
});
