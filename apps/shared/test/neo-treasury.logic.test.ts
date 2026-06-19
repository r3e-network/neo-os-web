import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BLOCKCHAIN_CONSTANTS } from "../constants";
import { addressToScriptHash } from "../utils/neo";
import {
  buildTreasuryDisbursementPreview,
  buildTreasuryTransferIntent,
  scaleTreasuryAmount,
} from "../../neo-treasury/src/utils/treasuryOperations";
import { fetchDaHongfeiData } from "../../neo-treasury/src/utils/treasury";
import type { PriceData } from "../../neo-treasury/src/utils/treasury";

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

/**
 * neo-treasury data-flow findings:
 *  - a partial RPC failure must flag the failed wallet (failed:true) and carry a
 *    failedCount, NOT silently report 0/0 as a real balance;
 *  - a null price feed must yield totalUsd:null (rendered as "—"), not $0.
 */
describe("neo-treasury balance fetching resilience", () => {
  const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
  beforeEach(() => {
    // Decide success/failure by the queried ADDRESS (in params[0]) so the
    // decision is stable across rpcCall's 5-endpoint fail-over loop: an address
    // that "fails" returns an RPC-level error on every endpoint, so the wallet
    // is genuinely flagged failed. Addresses ending in a hex-ish low char fail.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { params?: string[] };
        const address = String(body.params?.[0] ?? "");
        // Deterministic ~half split by the last character's code so some
        // wallets succeed (real balance) and some fail (flagged failed).
        const shouldFail = address.charCodeAt(address.length - 1) % 2 === 0;
        if (shouldFail) {
          return {
            ok: true,
            json: async () => ({ jsonrpc: "2.0", id: 1, error: { message: "boom" } }),
          } as unknown as Response;
        }
        return {
          ok: true,
          json: async () => ({
            jsonrpc: "2.0",
            id: 1,
            result: { balance: [{ assethash: NEO_HASH, amount: "1" }] },
          }),
        } as unknown as Response;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("flags failed wallets and reports a failedCount instead of zeroing silently", async () => {
    const category = await fetchDaHongfeiData({ neo: 5, gas: 1 } as PriceData);

    expect(category.failedCount).toBeGreaterThan(0);
    // At least one wallet is explicitly flagged failed (not a real 0 balance).
    expect(category.wallets.some((w) => w.failed === true)).toBe(true);
    // Successful wallets still contribute their real balance to the total.
    expect(category.totalNeo).toBeGreaterThan(0);
  });

  it("returns null USD when the price feed is unavailable (prices=null)", async () => {
    const category = await fetchDaHongfeiData(null);
    expect(category.totalUsd).toBeNull();
  });

  it("treats a resolved-but-zeroed price feed as unavailable (no fake $0 total)", async () => {
    // A frozen/zeroed feed that resolves with a non-positive NEO leg must not be
    // presented as a live USD total — it yields null (rendered as "—"), the same
    // as a missing feed, rather than a misleading $0.
    const zeroed = await fetchDaHongfeiData({ neo: 0, gas: 0 } as PriceData);
    expect(zeroed.totalUsd).toBeNull();

    const negative = await fetchDaHongfeiData({ neo: -1, gas: 1 } as PriceData);
    expect(negative.totalUsd).toBeNull();

    // A positive quote still produces a real total.
    const live = await fetchDaHongfeiData({ neo: 5, gas: 1 } as PriceData);
    expect(live.totalUsd).not.toBeNull();
    expect(live.totalUsd as number).toBeGreaterThan(0);
  });
});
