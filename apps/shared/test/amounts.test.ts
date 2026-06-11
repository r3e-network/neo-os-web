import { describe, expect, it } from "vitest";

import {
  GAS_DECIMALS_MULTIPLIER,
  amountToBaseUnits,
  gasToBaseUnits,
  neoToInteger,
} from "../utils/amounts";

describe("gasToBaseUnits", () => {
  it("scales whole GAS to base units without floats", () => {
    expect(gasToBaseUnits("1")).toBe(100000000n);
    expect(gasToBaseUnits("2.5")).toBe(250000000n);
    expect(gasToBaseUnits("0.00000001")).toBe(1n);
    expect(gasToBaseUnits("123456789.12345678")).toBe(12345678912345678n);
  });

  it("avoids the float drift the helper exists to prevent", () => {
    // String(0.7 / 7) === "0.09999999999999999" — the legacy float bug.
    expect(gasToBaseUnits("0.1")).toBe(10000000n);
    expect(gasToBaseUnits("0.09999999")).toBe(9999999n);
  });

  it("trims surrounding whitespace", () => {
    expect(gasToBaseUnits("  1.5  ")).toBe(150000000n);
  });

  it("rejects invalid or non-positive input with 0n", () => {
    expect(gasToBaseUnits("")).toBe(0n);
    expect(gasToBaseUnits("0")).toBe(0n);
    expect(gasToBaseUnits("0.0")).toBe(0n);
    expect(gasToBaseUnits("-1")).toBe(0n);
    expect(gasToBaseUnits(".5")).toBe(0n);
    expect(gasToBaseUnits("1.")).toBe(0n);
    expect(gasToBaseUnits("1.123456789")).toBe(0n); // 9 decimals
    expect(gasToBaseUnits("1e8")).toBe(0n);
    expect(gasToBaseUnits("0x10")).toBe(0n);
    expect(gasToBaseUnits("abc")).toBe(0n);
    expect(gasToBaseUnits(undefined as unknown as string)).toBe(0n);
    expect(gasToBaseUnits(null as unknown as string)).toBe(0n);
  });

  it("exposes the canonical 1e8 multiplier", () => {
    expect(GAS_DECIMALS_MULTIPLIER).toBe(100000000n);
  });
});

describe("neoToInteger", () => {
  it("parses whole NEO without scaling (NEO is indivisible)", () => {
    expect(neoToInteger("1")).toBe(1n);
    expect(neoToInteger("100")).toBe(100n);
    expect(neoToInteger(" 7 ")).toBe(7n);
  });

  it("rejects fractional, invalid, or non-positive input with 0n", () => {
    expect(neoToInteger("1.5")).toBe(0n);
    expect(neoToInteger("0")).toBe(0n);
    expect(neoToInteger("-3")).toBe(0n);
    expect(neoToInteger("")).toBe(0n);
    expect(neoToInteger("abc")).toBe(0n);
    expect(neoToInteger(undefined as unknown as string)).toBe(0n);
  });
});

describe("amountToBaseUnits", () => {
  it("routes GAS through base-unit scaling", () => {
    expect(amountToBaseUnits("1.5", "GAS")).toBe(150000000n);
  });

  it("routes NEO through integer parsing with no scaling", () => {
    expect(amountToBaseUnits("3", "NEO")).toBe(3n);
    expect(amountToBaseUnits("3.5", "NEO")).toBe(0n);
  });

  it("rejects empty input for both assets", () => {
    expect(amountToBaseUnits("", "GAS")).toBe(0n);
    expect(amountToBaseUnits("   ", "NEO")).toBe(0n);
  });
});
