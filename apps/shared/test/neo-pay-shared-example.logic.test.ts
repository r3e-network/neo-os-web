import { describe, expect, it } from "vitest";
import {
  NEOPAY_CONTRACTS,
  hasCanonicalNeoPayBinding,
  normalizeStudioNetwork,
  validAmountForAsset,
  validDuration,
  validateStreamDraft,
} from "../../neo-pay-shared-example/src/stream-studio";

const RECIPIENT = "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq";

describe("NeoPay Stream Studio input and binding logic", () => {
  it("requires positive whole-token NEO without truncation semantics", () => {
    expect(validAmountForAsset("12", "NEO")).toBe(true);
    expect(validAmountForAsset("12.9", "NEO")).toBe(false);
    expect(validAmountForAsset("0", "NEO")).toBe(false);
    expect(validAmountForAsset("01", "NEO")).toBe(false);
  });

  it("accepts positive GAS through Fixed8 and rejects excessive precision", () => {
    expect(validAmountForAsset("0.00000001", "GAS")).toBe(true);
    expect(validAmountForAsset("12.12345678", "GAS")).toBe(true);
    expect(validAmountForAsset("0.000000001", "GAS")).toBe(false);
    expect(validAmountForAsset("1e-8", "GAS")).toBe(false);
    expect(validAmountForAsset("0", "GAS")).toBe(false);
  });

  it("requires a whole duration from 1 through 365", () => {
    expect(validDuration("1")).toBe(true);
    expect(validDuration("365")).toBe(true);
    expect(validDuration("0")).toBe(false);
    expect(validDuration("366")).toBe(false);
    expect(validDuration("1.5")).toBe(false);
  });

  it("uses Neo N3 checksum validation for recipients", () => {
    expect(validateStreamDraft({ recipient: RECIPIENT, amount: "1", duration: "30", asset: "GAS" }).valid).toBe(true);
    expect(validateStreamDraft({ recipient: "Nrecipient", amount: "1", duration: "30", asset: "GAS" }))
      .toMatchObject({ valid: false, recipientIssue: "invalidAddress" });
  });

  it("binds both declared networks to the exact canonical MiniAppNeoPay hash", () => {
    expect(normalizeStudioNetwork("neo-n3-mainnet")).toBe("mainnet");
    expect(normalizeStudioNetwork("testnet")).toBe("testnet");
    expect(normalizeStudioNetwork("unknown")).toBeNull();
    expect(hasCanonicalNeoPayBinding("neo-n3-mainnet", NEOPAY_CONTRACTS.mainnet)).toBe(true);
    expect(hasCanonicalNeoPayBinding("neo-n3-testnet", NEOPAY_CONTRACTS.testnet)).toBe(true);
    expect(hasCanonicalNeoPayBinding("neo-n3-mainnet", NEOPAY_CONTRACTS.testnet)).toBe(false);
    expect(hasCanonicalNeoPayBinding("unknown", NEOPAY_CONTRACTS.mainnet)).toBe(false);
  });
});

