import { describe, expect, it } from "vitest";

import { decodeSessionKey, formatGasBaseUnits } from "./sessionKeyDecode";

describe("formatGasBaseUnits", () => {
  it("formats base-unit (1e8) integers into decimal GAS, trimming trailing zeros", () => {
    expect(formatGasBaseUnits(100000000)).toBe("1");
    expect(formatGasBaseUnits(150000000)).toBe("1.5");
    expect(formatGasBaseUnits("250000000")).toBe("2.5");
    expect(formatGasBaseUnits(0)).toBe("0");
    expect(formatGasBaseUnits(1)).toBe("0.00000001");
  });

  it("returns 0 for non-numeric / malformed input", () => {
    expect(formatGasBaseUnits(undefined)).toBe("0");
    expect(formatGasBaseUnits("abc")).toBe("0");
    expect(formatGasBaseUnits(null)).toBe("0");
  });
});

describe("decodeSessionKey", () => {
  it("decodes a getSessionKey struct into labeled fields (ms expiry -> seconds)", () => {
    // [PubKey, TargetContract, Method, ValidUntil(ms), SpendingLimit(base units)]
    const validUntilMs = 1_900_000_000_000; // far-future ms epoch
    const decoded = decodeSessionKey([
      "0xabcdef",
      "0x1111111111111111111111111111111111111111",
      "transfer",
      validUntilMs,
      500000000, // 5 GAS
    ]);
    expect(decoded).not.toBeNull();
    expect(decoded!.pubKey).toBe("abcdef");
    expect(decoded!.targetContract).toBe(
      "0x1111111111111111111111111111111111111111",
    );
    expect(decoded!.method).toBe("transfer");
    expect(decoded!.expirySeconds).toBe(Math.floor(validUntilMs / 1000));
    expect(decoded!.spendingLimitGas).toBe("5");
    expect(decoded!.spendingLimitUnlimited).toBe(false);
  });

  it("treats a 0 spending limit as unlimited", () => {
    const decoded = decodeSessionKey([
      "0xpub",
      "0x2222222222222222222222222222222222222222",
      "",
      1_900_000_000_000,
      0,
    ]);
    expect(decoded!.spendingLimitUnlimited).toBe(true);
    // A blank method decodes to an empty string; the UI maps that to "Any method".
    expect(decoded!.method).toBe("");
  });

  it("returns null for a non-struct / empty / short read", () => {
    expect(decodeSessionKey(null)).toBeNull();
    expect(decodeSessionKey([])).toBeNull();
    expect(decodeSessionKey(["only", "two"])).toBeNull();
    expect(decodeSessionKey("not-an-array")).toBeNull();
  });
});
