import { describe, expect, it } from "vitest";
import { formatErrorMessage } from "../utils/errors";

describe("formatErrorMessage", () => {
  const FALLBACK = "Something went wrong";

  it("keeps a short, clean error message", () => {
    expect(formatErrorMessage(new Error("Insufficient balance"), FALLBACK)).toBe(
      "Insufficient balance",
    );
  });

  it("keeps legitimate messages that merely contain the word 'at '", () => {
    // Regression: the bare "at " substring filter swallowed these into the
    // generic fallback even though they are clean, actionable, single-line.
    expect(
      formatErrorMessage(new Error("GAS supports at most 8 decimal places."), FALLBACK),
    ).toBe("GAS supports at most 8 decimal places.");
    expect(
      formatErrorMessage(
        new Error("Gas limit must be a whole number of at least 21000."),
        FALLBACK,
      ),
    ).toBe("Gas limit must be a whole number of at least 21000.");
  });

  it("still hides raw dumps (multi-line stack traces, hashes, URLs)", () => {
    expect(
      formatErrorMessage(new Error("boom\n    at Object.fn (file.js:1:2)"), FALLBACK),
    ).toBe(FALLBACK);
    expect(
      formatErrorMessage(new Error("revert at 0xabc123def4567890"), FALLBACK),
    ).toBe(FALLBACK);
    expect(
      formatErrorMessage(new Error("fetch failed http://rpc.example/api"), FALLBACK),
    ).toBe(FALLBACK);
  });

  it("falls back for non-Error inputs", () => {
    expect(formatErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(formatErrorMessage("a raw string", FALLBACK)).toBe(FALLBACK);
  });
});
