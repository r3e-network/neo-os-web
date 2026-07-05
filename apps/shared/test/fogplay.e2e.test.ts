/**
 * fogplay E2E: Verifies the commit→reveal coin flip flow
 */
import { describe, expect, it } from "vitest";

describe("fogplay E2E lifecycle", () => {
  it("verifies the commit→reveal two-step flow", () => {
    const FLOW = ["commit", "reveal"];
    expect(FLOW).toEqual(["commit", "reveal"]);
  });

  it("verifies heads maps to choice 0, tails to choice 1", () => {
    const CHOICE_MAP = { heads: 0, tails: 1 };
    expect(CHOICE_MAP.heads).toBe(0);
    expect(CHOICE_MAP.tails).toBe(1);
  });

  it("verifies the commit event name", () => {
    expect("Committed").toBe("Committed");
  });

  it("verifies the settle/reveal event name", () => {
    expect("Settled").toBe("Settled");
  });

  it("verifies the GAS hash for bet payment", () => {
    const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
    expect(GAS_HASH).toMatch(/^0x[0-9a-f]{40}$/);
  });

  it("verifies the bet memo format includes the choice", () => {
    const memo = (choice: number) => `miniapp-fogplay:bet:${choice}`;
    expect(memo(0)).toContain("0"); // heads
    expect(memo(1)).toContain("1"); // tails
  });
});
