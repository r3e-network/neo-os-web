import { describe, expect, it } from "vitest";

import {
  STAT_PLACEHOLDER,
  formatStat,
  parsePositiveFixed8,
  toFixed8,
} from "../utils/format";

describe("formatStat", () => {
  it("renders the em-dash placeholder when data has not loaded", () => {
    expect(formatStat(12.5, false)).toBe(STAT_PLACEHOLDER);
    expect(formatStat(0, false)).toBe(STAT_PLACEHOLDER);
    expect(formatStat("0.7 GAS", false)).toBe(STAT_PLACEHOLDER);
  });

  it("shows a genuine loaded zero as a real value, not the placeholder", () => {
    expect(formatStat(0, true)).toBe("0.00");
    expect(formatStat(0, true, 0)).toBe("0");
  });

  it("formats loaded numbers with the requested decimals", () => {
    expect(formatStat(12.5, true)).toBe("12.50");
    expect(formatStat(12.5, true, 0)).toBe("13");
    expect(formatStat(1000, true, 0)).toBe("1,000");
  });

  it("returns an already-formatted string verbatim when loaded", () => {
    expect(formatStat("0.7 GAS", true)).toBe("0.7 GAS");
    expect(formatStat("—", true)).toBe("—");
  });

  it("falls back to the placeholder for null/undefined even when loaded", () => {
    expect(formatStat(null, true)).toBe(STAT_PLACEHOLDER);
    expect(formatStat(undefined, true)).toBe(STAT_PLACEHOLDER);
  });

  it("exposes the canonical em-dash placeholder constant", () => {
    expect(STAT_PLACEHOLDER).toBe("—");
  });
});

describe("parsePositiveFixed8", () => {
  it("parses positive Fixed8 amounts without floating point math", () => {
    expect(parsePositiveFixed8("1")).toBe("100000000");
    expect(parsePositiveFixed8("1.25")).toBe("125000000");
    expect(parsePositiveFixed8("0.00000001")).toBe("1");
  });

  it("rejects malformed, zero, negative, and over-precision amounts", () => {
    expect(parsePositiveFixed8("1abc")).toBeNull();
    expect(parsePositiveFixed8("0")).toBeNull();
    expect(parsePositiveFixed8("-1")).toBeNull();
    expect(parsePositiveFixed8("1.000000001")).toBeNull();
  });

  it("keeps legacy toFixed8 truncation separate from strict parsing", () => {
    expect(toFixed8("1.000000001")).toBe("100000000");
    expect(parsePositiveFixed8("1.000000001")).toBeNull();
  });
});
