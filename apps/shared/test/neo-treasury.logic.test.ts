import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { BLOCKCHAIN_CONSTANTS } from "../constants";
import { createMiniAppFramework } from "../react";
import { createObservable } from "../react/context";
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

/**
 * Framework-migration invariants (Wave 5): the disbursement write moved onto
 * app.chain.write with notify:'silent' and the dashboard cache moved onto
 * app.storage.local pinned to the legacy "neo_treasury_" namespace. Both
 * must be byte-identical to the pre-framework behavior: same wallet payload,
 * no framework toast (the handler owns its own status copy), and the same
 * on-disk localStorage key so existing users keep their cached dashboard.
 */
describe("neo-treasury framework migration invariants", () => {
  function makeApp(overrides: { invoke?: ReturnType<typeof vi.fn> } = {}) {
    const invoke = overrides.invoke ?? vi.fn(async () => ({ txid: "0xtx", success: true }));
    const notify = {
      success: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      guardResult: vi.fn(),
    };
    const chain = {
      address: createObservable<string | null>(SENDER),
      ensureWallet: vi.fn(async () => SENDER),
      read: vi.fn(async () => null),
      invoke,
      invokeWithPayment: vi.fn(),
    };
    const app = createMiniAppFramework(
      { services: { chain, notify }, t: (key: string) => key } as never,
      // Same options main.tsx passes: legacy runtime-cache namespace pin.
      { appId: "miniapp-neo-treasury", storagePrefix: "neo_treasury_" },
    );
    return { app, invoke, notify };
  }

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("sends the disbursement write with the exact pre-migration wallet payload and no framework toast", async () => {
    const { app, invoke, notify } = makeApp();
    const intent = buildTreasuryTransferIntent(SENDER, {
      asset: "GAS",
      amount: "0.1",
      recipient: RECIPIENT,
      memo: "treasury-disbursement",
    });

    // Mirrors the submitDisbursement handler in apps/neo-treasury/src/main.tsx.
    const result = await app.chain.write({
      operation: "transfer",
      args: intent.args,
      scriptHash: intent.scriptHash,
      notify: "silent",
    });

    // Byte-identical to the legacy raw chain.invoke("transfer", args, {scriptHash}).
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("transfer", intent.args, {
      scriptHash: intent.scriptHash,
    });
    expect(result).toMatchObject({ txid: "0xtx" });
    // notify:'silent' — the handler owns disbursementStatus/disbursementError.
    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
    expect(notify.guardResult).not.toHaveBeenCalled();
  });

  it("rethrows write failures unchanged so the handler's formatErrorMessage lane keeps working", async () => {
    const boom = new Error("User rejected the request");
    const { app, notify } = makeApp({ invoke: vi.fn(async () => { throw boom; }) });

    await expect(
      app.chain.write({
        operation: "transfer",
        args: [],
        scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
        notify: "silent",
      }),
    ).rejects.toBe(boom);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("keeps the dashboard cache on the legacy neo_treasury_cache localStorage key", () => {
    // Existing user data written by the pre-framework runtime-cache lane...
    localStorage.setItem("neo_treasury_cache", JSON.stringify({ totalNeo: 42 }));

    const { app } = makeApp();
    // ...still resolves through app.storage.local under the pinned prefix.
    expect(app.storage.local.get<{ totalNeo: number }>("cache")).toEqual({ totalNeo: 42 });

    // And a fresh write lands on the SAME key, byte-for-byte.
    app.storage.local.set("cache", { totalNeo: 43 });
    expect(localStorage.getItem("neo_treasury_cache")).toBe(JSON.stringify({ totalNeo: 43 }));
  });

  it("keeps main.tsx off runtime-cache and tags the exempt RPC failover sweep", () => {
    const appRoot = resolve(__dirname, "../../neo-treasury");
    const main = readFileSync(resolve(appRoot, "src/main.tsx"), "utf8");
    const treasury = readFileSync(resolve(appRoot, "src/utils/treasury.ts"), "utf8");

    expect(main).not.toContain("@shared/utils/runtime-cache");
    expect(main).toContain('storagePrefix: "neo_treasury_"');
    expect(main).toContain('notify: "silent"');
    // §3.6: the external-address multi-endpoint RPC balance sweep stays raw
    // (no framework surface until n3index lands) and must carry the tag.
    expect(treasury).toContain("framework-exempt: external-wallet RPC balance failover");
  });
});
