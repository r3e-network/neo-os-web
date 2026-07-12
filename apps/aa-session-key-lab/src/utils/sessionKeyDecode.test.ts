import { describe, expect, it } from "vitest";

import { decodeSessionKey, formatGasBaseUnits } from "./sessionKeyDecode";

const PUBLIC_KEY = `02${"11".repeat(32)}`;
const TARGET = `0x${"22".repeat(20)}`;

function bytes(hex: string) {
  const raw = hex.replace(/^0x/, "");
  const binary = (raw.match(/../g) ?? []).map((pair) => String.fromCharCode(Number.parseInt(pair, 16))).join("");
  return { type: "ByteString", value: btoa(binary) };
}

function hash(display: string) {
  const pairs = display.replace(/^0x/, "").match(/../g) ?? [];
  return {
    type: "ByteString",
    value: btoa([...pairs].reverse().map((pair) => String.fromCharCode(Number.parseInt(pair, 16))).join("")),
  };
}

function text(value: string) {
  return { type: "ByteString", value: btoa(value) };
}

describe("session-key chain decoder", () => {
  it("formats GAS base units without losing digits", () => {
    expect(formatGasBaseUnits("150000000")).toBe("1.5");
    expect(formatGasBaseUnits("1")).toBe("0.00000001");
    expect(formatGasBaseUnits(undefined)).toBe("0");
  });

  it("decodes the mainnet five-field object and normalizes Hash160 byte order", () => {
    const decoded = decodeSessionKey({
      type: "Struct",
      value: [
        bytes(PUBLIC_KEY),
        hash(TARGET),
        text("transfer"),
        { type: "Integer", value: "1900000000000" },
        { type: "Integer", value: "500000000" },
      ],
    }, { spendingLimitSupported: true });

    expect(decoded).toMatchObject({
      pubKey: PUBLIC_KEY,
      targetContract: TARGET,
      method: "transfer",
      expirySeconds: 1_900_000_000,
      spendingLimitGas: "5",
      spendingLimitUnlimited: false,
      spendingLimitSupported: true,
    });
  });

  it("decodes the frozen testnet four-field object without inventing an allowance", () => {
    const decoded = decodeSessionKey({
      type: "Struct",
      value: [
        bytes(PUBLIC_KEY),
        hash(TARGET),
        text("mint"),
        { type: "Integer", value: "1900000000000" },
      ],
    }, { spendingLimitSupported: false });

    expect(decoded?.spendingLimitSupported).toBe(false);
    expect(decoded?.spendingLimitGas).toBe("");
    expect(decoded?.spendingLimitUnlimited).toBe(false);
  });

  it("rejects empty, malformed, and partial chain records", () => {
    expect(decodeSessionKey(null)).toBeNull();
    expect(decodeSessionKey([])).toBeNull();
    expect(decodeSessionKey(["only", "two"])).toBeNull();
    expect(decodeSessionKey({ type: "Struct", value: [bytes("01"), hash(TARGET), text("mint"), { type: "Integer", value: "0" }] })).toBeNull();
  });
});
