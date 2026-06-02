import { describe, expect, it } from "vitest";

import { BLOCKCHAIN_CONSTANTS } from "../constants";
import { addressToScriptHash } from "../utils/neo";
import {
  buildTreasuryDisbursementPreview,
  buildTreasuryTransferIntent,
  scaleTreasuryAmount,
} from "../../neo-treasury/src/utils/treasuryOperations";

const SENDER = "NgebdUkFxSbzLMruXopuBw4aKsXX8sTyxw";
const RECIPIENT = "NZeAarn3UMCqNsTymTMF2Pn6X7Yw3GhqDv";

describe("neo-treasury treasury operations", () => {
  it("builds a GAS NEP-17 transfer intent with fixed8 amount and Hash160 args", () => {
    const intent = buildTreasuryTransferIntent(SENDER, {
      asset: "GAS",
      amount: "0.1",
      recipient: RECIPIENT,
      memo: "treasury-disbursement",
    });

    expect(intent).toMatchObject({
      asset: "GAS",
      amount: "0.1",
      scaledAmount: "10000000",
      senderHash: addressToScriptHash(SENDER),
      recipientHash: addressToScriptHash(RECIPIENT),
      memo: "treasury-disbursement",
      scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
    });
    expect(intent.args).toEqual([
      { type: "Hash160", value: addressToScriptHash(SENDER) },
      { type: "Hash160", value: addressToScriptHash(RECIPIENT) },
      { type: "Integer", value: "10000000" },
      { type: "String", value: "treasury-disbursement" },
    ]);
  });

  it("uses whole units for NEO and rejects fractional NEO", () => {
    expect(scaleTreasuryAmount("NEO", "3")).toBe("3");
    expect(() => scaleTreasuryAmount("NEO", "3.5")).toThrow(
      "whole token amounts",
    );
  });

  it("rejects invalid recipients before wallet invocation", () => {
    expect(() =>
      buildTreasuryTransferIntent(SENDER, {
        asset: "GAS",
        amount: "1",
        recipient: "not-a-neo-address",
      }),
    ).toThrow("Recipient must be a valid Neo N3 address or Hash160");
  });

  it("builds a pre-signing review without requiring a connected wallet", () => {
    const preview = buildTreasuryDisbursementPreview({
      asset: "GAS",
      amount: "0.1",
      recipient: RECIPIENT,
      memo: "ops",
    });

    expect(preview).toMatchObject({
      asset: "GAS",
      amount: "0.1",
      scaledAmount: "10000000",
      recipientHash: addressToScriptHash(RECIPIENT),
      memo: "ops",
      scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
    });
    expect(preview.senderHash).toBeUndefined();
  });
});
