import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { BLOCKCHAIN_CONSTANTS } from "../constants";
import { createMiniAppFramework } from "../react";
import { createObservable } from "../react/context";
import { addressToScriptHash } from "../utils/neo";
import {
  assertTreasurySpendableBalance,
  assertTreasuryWalletNetwork,
  buildPendingTreasuryTransfer,
  buildTreasuryDisbursementPreview,
  buildTreasuryTransferIntent,
  inspectPendingTreasuryTransfer,
  matchesPendingTreasuryTransfer,
  parsePendingTreasuryTransfer,
  scaleTreasuryAmount,
} from "../../neo-treasury/src/utils/treasuryOperations";
import {
  DA_HONGFEI_ADDRESSES,
  ERIK_ZHANG_ADDRESSES,
  fetchDaHongfeiData,
  formatTreasuryTokenAmount,
} from "../../neo-treasury/src/utils/treasury";
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

  it("binds review to network, token contract, signer, recipient, amount, and memo", () => {
    const now = 1_800_000_000_000;
    const intent = buildTreasuryTransferIntent(SENDER, {
      asset: "GAS",
      amount: "01.2500",
      recipient: RECIPIENT,
      memo: "ops-42",
    }, "testnet", now);

    expect(intent).toMatchObject({
      version: 1,
      network: "testnet",
      asset: "GAS",
      amount: "1.25",
      scaledAmount: "125000000",
      scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
      senderHash: addressToScriptHash(SENDER).toLowerCase(),
      recipientHash: addressToScriptHash(RECIPIENT).toLowerCase(),
      memo: "ops-42",
      createdAt: now,
    });
    expect(intent).not.toHaveProperty("reviewExpiresAt");
    expect(intent.bindingKey).toContain('"testnet"');
    expect(intent.bindingKey).toContain('"125000000"');
  });

  it("fails closed on unknown/mismatched wallet networks and self transfers", () => {
    expect(assertTreasuryWalletNetwork("testnet", "neo-n3-testnet")).toBe("testnet");
    expect(() => assertTreasuryWalletNetwork("testnet", "neo-n3-mainnet")).toThrow("switch");
    expect(() => assertTreasuryWalletNetwork("testnet", "neo-n3")).toThrow("could not be verified");
    expect(() => assertTreasuryWalletNetwork("testnet", "neo-x-testnet")).toThrow("could not be verified");
    expect(() => buildTreasuryTransferIntent(SENDER, {
      asset: "NEO",
      amount: "1",
      recipient: SENDER,
    }, "mainnet")).toThrow("different from the connected wallet");
  });

  it("checks spendability and preserves GAS fee headroom", () => {
    const gasIntent = buildTreasuryTransferIntent(SENDER, {
      asset: "GAS",
      amount: "1",
      recipient: RECIPIENT,
    });
    expect(() => assertTreasurySpendableBalance(gasIntent, "100000000")).toThrow("network fees");
    expect(assertTreasurySpendableBalance(gasIntent, "100000001")).toBe(100000001n);
    expect(() => assertTreasurySpendableBalance(gasIntent, "99999999")).toThrow("Insufficient GAS");
  });

  it("persists and validates an exact immutable recovery binding", () => {
    const intent = buildTreasuryTransferIntent(SENDER, {
      asset: "NEO",
      amount: "3",
      recipient: RECIPIENT,
      memo: "grant",
    }, "mainnet", 1_800_000_000_000);
    const pending = buildPendingTreasuryTransfer(
      intent,
      `${"ab".repeat(32)}`,
      "10",
      "2",
      1_800_000_000_100,
    );
    // Pin `now` just after the fixture's broadcast so the fail-closed
    // future-timestamp skew guard evaluates the record the way production
    // does (records created at wall-clock time, parsed at wall-clock time),
    // and so the mutation cases below reject for the mutated field rather
    // than incidentally via clock skew.
    const parseNow = 1_800_000_000_200;
    expect(parsePendingTreasuryTransfer(pending, parseNow)).toEqual(pending);
    expect(pending.txid).toBe(`0x${"ab".repeat(32)}`);
    expect(parsePendingTreasuryTransfer({ ...pending, recipientHash: `0x${"1".repeat(40)}` }, parseNow)).toBeNull();
    expect(parsePendingTreasuryTransfer({ ...pending, txid: "0xshort" }, parseNow)).toBeNull();
  });

  it("matches the indexed native Transfer event on every bound field", () => {
    const intent = buildTreasuryTransferIntent(SENDER, {
      asset: "GAS",
      amount: "0.1",
      recipient: RECIPIENT,
    }, "testnet", 1_800_000_000_000);
    const pending = buildPendingTreasuryTransfer(intent, `0x${"cd".repeat(32)}`, "50000000", "2", 1_800_000_000_100);
    const row = {
      txid: pending.txid,
      network: "testnet",
      contract_hash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
      from_address: SENDER,
      to_address: RECIPIENT,
      amount_raw: "10000000",
    };
    expect(matchesPendingTreasuryTransfer(row, pending)).toBe(true);
    expect(matchesPendingTreasuryTransfer({ ...row, amount_raw: "10000001" }, pending)).toBe(false);
    expect(matchesPendingTreasuryTransfer({ ...row, to_address: SENDER }, pending)).toBe(false);
    expect(matchesPendingTreasuryTransfer({ ...row, contract_hash: BLOCKCHAIN_CONSTANTS.NEO_HASH }, pending)).toBe(false);
  });

  it("requires both an exact Transfer event and authoritative balance readback", async () => {
    const intent = buildTreasuryTransferIntent(SENDER, {
      asset: "NEO",
      amount: "3",
      recipient: RECIPIENT,
    }, "mainnet", 1_800_000_000_000);
    const pending = buildPendingTreasuryTransfer(intent, `0x${"ef".repeat(32)}`, "10", "2", 1_800_000_000_100);
    const exactRow = {
      txid: pending.txid,
      network: "mainnet",
      contract_hash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
      from_address: SENDER,
      to_address: RECIPIENT,
      amount_raw: "3",
    };

    await expect(inspectPendingTreasuryTransfer(pending, {
      listTransfers: async () => [exactRow],
      readRecipientBalance: async () => "5",
      readSenderBalance: async () => "7",
    })).resolves.toEqual({ status: "confirmed", eventMatched: true, stateReadback: true });

    await expect(inspectPendingTreasuryTransfer(pending, {
      listTransfers: async () => [exactRow],
      readRecipientBalance: async () => "2",
      readSenderBalance: async () => "10",
    })).resolves.toEqual({ status: "readback-pending", eventMatched: true, stateReadback: false });

    // One-sided movement is not enough: both native balances must be
    // consistent with the saved pre-transfer baseline before the UI can use
    // confirmed-success language.
    await expect(inspectPendingTreasuryTransfer(pending, {
      listTransfers: async () => [exactRow],
      readRecipientBalance: async () => "5",
      readSenderBalance: async () => "10",
    })).resolves.toEqual({ status: "readback-pending", eventMatched: true, stateReadback: false });

    await expect(inspectPendingTreasuryTransfer(pending, {
      listTransfers: async () => [exactRow],
      readRecipientBalance: async () => "2",
      readSenderBalance: async () => "7",
    })).resolves.toEqual({ status: "readback-pending", eventMatched: true, stateReadback: false });

    await expect(inspectPendingTreasuryTransfer(pending, {
      listTransfers: async () => [{ ...exactRow, amount_raw: "4" }],
      readRecipientBalance: async () => "6",
      readSenderBalance: async () => "6",
    })).resolves.toEqual({ status: "binding-mismatch", eventMatched: false, stateReadback: false });
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

  it("keeps the two 22-address founder groups complete, valid, unique, and disjoint", () => {
    expect(DA_HONGFEI_ADDRESSES).toHaveLength(22);
    expect(ERIK_ZHANG_ADDRESSES).toHaveLength(22);
    const combined = [...DA_HONGFEI_ADDRESSES, ...ERIK_ZHANG_ADDRESSES];
    expect(new Set(combined).size).toBe(44);
    for (const account of combined) {
      expect(addressToScriptHash(account)).toMatch(/^0x[0-9a-f]{40}$/);
    }
  });

  it("formats native balances above Number.MAX_SAFE_INTEGER without rounding", () => {
    expect(formatTreasuryTokenAmount("9007199254740993", 0)).toBe("9,007,199,254,740,993");
    expect(formatTreasuryTokenAmount("9007199254740993", 8)).toBe("90,071,992.54740993");
    expect(formatTreasuryTokenAmount("100000000", 8)).toBe("1");
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

    // A good NEO leg cannot paper over a missing/zero GAS leg; doing so would
    // make every GAS holding disappear from a plausible-looking USD total.
    const missingGas = await fetchDaHongfeiData({ neo: 5 } as PriceData);
    expect(missingGas.totalUsd).toBeNull();
    const zeroGas = await fetchDaHongfeiData({ neo: 5, gas: 0 } as PriceData);
    expect(zeroGas.totalUsd).toBeNull();

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
    expect(main).toContain("assertTreasuryWalletNetwork(transferNetwork, walletNetwork)");
    expect(main).toContain("onTransactionSent: rememberBroadcast");
    expect(main).toContain("inspectPendingTreasuryTransfer(recovery");
    expect(main).toContain('verified: settlement?.status === "confirmed"');
    expect(main).toContain('ctx.framework.actions.register("recoverDisbursement"');
    // §3.6: the external-address multi-endpoint RPC balance sweep stays raw
    // (no framework surface until n3index lands) and must carry the tag.
    expect(treasury).toContain("framework-exempt: external-wallet RPC balance failover");
  });
});
