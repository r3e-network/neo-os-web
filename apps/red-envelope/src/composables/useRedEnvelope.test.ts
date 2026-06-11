import { describe, expect, it, vi } from "vitest";

import { useRedEnvelope } from "./useRedEnvelope";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CONTRACT = "0x68ef0ead081d2263acc51ce82f5c70c46440cca4";
const ALICE_HASH = addressToScriptHash(ALICE);
// A different creator's script hash (any non-zero hash that is not ALICE's).
const BOB_HASH = `0x${"ab".repeat(20)}`;
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const CREATE_MEMO = "miniapp-redenvelope:create";

const t = (key: string) => key;

/** A getEnvelope() Map as chain.read parses it (plain object, base units). */
function envelopeMap(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    creator: ALICE_HASH,
    totalAmount: "100000000",
    remainingAmount: "40000000",
    packetCount: "4",
    openedCount: "2",
    expiryTime: String(Date.now() + 3_600_000),
    bestLuckAddress: "0x0000000000000000000000000000000000000000",
    bestLuckAmount: "0",
    active: true,
    ...overrides,
  };
}

interface ChainOpts {
  /** creditOf(account) read — GAS base units. */
  credit?: string;
  /** lastEnvelopeId() read. */
  lastEnvelopeId?: string;
  /** getEnvelope(id) fixtures, keyed by envelope id. */
  envelopes?: Record<string, Record<string, unknown>>;
  /** Force createEnvelope to throw (deposit-held recovery path). */
  createThrows?: Error;
  /** Share (base units) the Claimed event reports for claim(). */
  claimShare?: string;
}

/**
 * Minimal ChainService stand-in. Records invoke/read calls so tests can assert
 * the shortfall-only deposit (with its "Credited" settle wait), the reclaim and
 * the credit-withdraw argument shapes against the standalone contract.
 */
function makeChain(opts: ChainOpts = {}) {
  const invoke = vi.fn(
    async (op: string, args: ContractArg[], options?: { waitForEvent?: string }): Promise<TxResult> => {
      let event: unknown;
      if (op === "createEnvelope") {
        if (opts.createThrows) throw opts.createThrows;
        if (options?.waitForEvent === "EnvelopeCreated") {
          event = { state: [{ type: "Integer", value: "1" }] };
        }
      }
      if (op === "claim" && options?.waitForEvent === "Claimed") {
        // OnClaimed(id, claimer, share, remainingPackets)
        event = {
          state: [
            { type: "Integer", value: String(args[0]?.value ?? "0") },
            { type: "Hash160", value: ALICE_HASH },
            { type: "Integer", value: opts.claimShare ?? "50000000" },
            { type: "Integer", value: "1" },
          ],
        };
      }
      if (op === "reclaim" && options?.waitForEvent === "Reclaimed") {
        // OnReclaimed(id, creator, amount)
        event = {
          state: [
            { type: "Integer", value: String(args[0]?.value ?? "0") },
            { type: "Hash160", value: ALICE_HASH },
            { type: "Integer", value: "250000000" },
          ],
        };
      }
      if (op === "withdraw" && options?.waitForEvent === "CreditWithdrawn") {
        // OnCreditWithdrawn(account, amount)
        event = {
          state: [
            { type: "Hash160", value: ALICE_HASH },
            { type: "Integer", value: opts.credit ?? "0" },
          ],
        };
      }
      return { txid: "0xtx", event, success: true };
    },
  );

  const read = vi.fn(async (op: string, args?: ContractArg[]): Promise<unknown> => {
    switch (op) {
      case "lastEnvelopeId":
        return opts.lastEnvelopeId ?? "0";
      case "getEnvelope":
        return opts.envelopes?.[String(args?.[0]?.value ?? "")] ?? null;
      case "hasClaimed":
        return false;
      case "claimedAmount":
        return "0";
      case "creditOf":
        return opts.credit ?? "0";
      default:
        return "0";
    }
  });

  const readArray = vi.fn(async (): Promise<unknown[]> => []);

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => ALICE },
    ensureWallet: vi.fn(async () => ALICE),
    invoke,
    read,
    readArray,
  } as unknown as ChainService;
  return { chain, invoke, read };
}

function setup(opts: ChainOpts = {}) {
  const { chain, invoke, read } = makeChain(opts);
  const app = useRedEnvelope({ chain, t });
  app.setAddress(ALICE);
  return { app, invoke, read };
}

/** Find a recorded invoke call for an operation. */
function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((c) => c[0] === op);
}

describe("useRedEnvelope — create() deposit (shortfall-only, Credited settle wait)", () => {
  it("tops up only the SHORTFALL beyond existing credit and waits for the Credited event", async () => {
    const { app, invoke } = setup({ credit: "40000000" }); // 0.4 GAS stale credit

    await app.create({ amount: "1", count: "4", expiryHours: "24" });

    // Step 1: GAS transfer of the shortfall (1 GAS - 0.4 credit = 0.6 GAS).
    const deposit = callFor(invoke, "transfer");
    expect(deposit).toBeTruthy();
    expect(deposit![1]).toEqual([
      { type: "Hash160", value: ALICE_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "60000000" },
      { type: "String", value: CREATE_MEMO },
    ]);
    // The regression: the deposit must settle on the contract's Credited event
    // before createEnvelope consumes it (a fire-and-forget transfer races the
    // consuming call into the same block and faults).
    expect(deposit![2]).toMatchObject({ scriptHash: GAS_HASH, waitForEvent: "Credited" });

    // Step 2: createEnvelope(creator, total, packetCount, durationSeconds)
    // only after the confirmed deposit.
    const create = callFor(invoke, "createEnvelope");
    expect(create).toBeTruthy();
    expect(create![1]).toEqual([
      { type: "Hash160", value: ALICE_HASH },
      { type: "Integer", value: "100000000" },
      { type: "Integer", value: "4" },
      { type: "Integer", value: "86400" },
    ]);
    const order = invoke.mock.calls.map((c) => c[0]);
    expect(order.indexOf("transfer")).toBeLessThan(order.indexOf("createEnvelope"));
  });

  it("skips the deposit entirely when prepaid credit already covers the total", async () => {
    const { app, invoke } = setup({ credit: "100000000" }); // 1 GAS credit

    await app.create({ amount: "1", count: "4", expiryHours: "24" });

    expect(callFor(invoke, "transfer")).toBeUndefined();
    expect(callFor(invoke, "createEnvelope")).toBeTruthy();
  });

  it("surfaces the held-credit message when createEnvelope faults after the deposit", async () => {
    const { app, invoke } = setup({ credit: "0", createThrows: new Error("chain fault") });

    await expect(app.create({ amount: "1", count: "4", expiryHours: "24" })).rejects.toThrow(
      "depositPrepaidNoEnvelope",
    );
    expect(callFor(invoke, "transfer")).toBeTruthy();
  });
});

describe("useRedEnvelope — reclaim (creator recovers an expired remainder)", () => {
  it("calls reclaim(envelopeId, creator) waiting for Reclaimed and returns the amount", async () => {
    const { app, invoke } = setup();

    const result = await app.reclaimEnvelope("7");

    const reclaim = callFor(invoke, "reclaim");
    expect(reclaim).toBeTruthy();
    expect(reclaim![1]).toEqual([
      { type: "Integer", value: "7" },
      { type: "Hash160", value: ALICE_HASH },
    ]);
    expect(reclaim![2]).toMatchObject({ waitForEvent: "Reclaimed" });
    // OnReclaimed amount 250000000 base units -> 2.5 GAS.
    expect(result.amount).toBeCloseTo(2.5, 8);
  });

  it("rejects an empty envelope id before any chain call", async () => {
    const { app, invoke } = setup();
    await expect(app.reclaimEnvelope("")).rejects.toThrow("envelopeIdRequired");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("marks only the viewer's OWN expired envelopes with a remainder as reclaimable", async () => {
    const { app } = setup({
      lastEnvelopeId: "3",
      credit: "120000000", // 1.2 GAS prepaid credit
      envelopes: {
        // Mine, expired, remainder left -> reclaimable.
        "3": envelopeMap({ expiryTime: String(Date.now() - 1000) }),
        // Someone else's expired envelope -> NOT mine, not reclaimable.
        "2": envelopeMap({ creator: BOB_HASH, expiryTime: String(Date.now() - 1000) }),
        // Mine but still live -> not reclaimable.
        "1": envelopeMap(),
      },
    });

    await app.loadEnvelopes();

    const byId = new Map(app.envelopes.get().map((e) => [e.id, e]));
    expect(byId.get("3")?.reclaimable).toBe(true);
    expect(byId.get("2")?.reclaimable).toBe(false);
    expect(byId.get("1")?.reclaimable).toBe(false);
    // The prepaid credit loads alongside (base units ÷1e8).
    expect(app.prepaidCredit.get()).toBeCloseTo(1.2, 8);
  });
});

describe("useRedEnvelope — withdraw prepaid credit", () => {
  it("withdraws the whole credit via withdraw(account) waiting for CreditWithdrawn", async () => {
    const { app, invoke } = setup({ credit: "70000000" }); // 0.7 GAS

    const result = await app.withdrawCredit();

    const withdraw = callFor(invoke, "withdraw");
    expect(withdraw).toBeTruthy();
    expect(withdraw![1]).toEqual([{ type: "Hash160", value: ALICE_HASH }]);
    expect(withdraw![2]).toMatchObject({ waitForEvent: "CreditWithdrawn" });
    expect(result.amount).toBeCloseTo(0.7, 8);
  });

  it("refuses to withdraw when there is no credit", async () => {
    const { app, invoke } = setup({ credit: "0" });
    await expect(app.withdrawCredit()).rejects.toThrow("noCredit");
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("useRedEnvelope — paged refresh (newest page, bounded concurrency)", () => {
  it("reads only the newest 30 envelopes per refresh, not the whole history", async () => {
    // Regression: the old refresh scanned 200 ids per refresh — with a long
    // history that is up to ~400 parallel reads through the host bridge.
    const envelopes: Record<string, Record<string, unknown>> = {};
    for (let id = 1; id <= 100; id += 1) envelopes[String(id)] = envelopeMap();
    const { app, read } = setup({ lastEnvelopeId: "100", envelopes });

    await app.loadEnvelopes();

    const envReads = read.mock.calls.filter((c) => c[0] === "getEnvelope");
    expect(envReads).toHaveLength(30);
    const ids = envReads.map((c) => String((c[1] as ContractArg[])[0]?.value));
    expect(ids).toContain("100");
    expect(ids).toContain("71");
    expect(ids).not.toContain("70");
    expect(app.envelopes.get()).toHaveLength(30);
  });

  it("keeps at most 8 chain reads in flight during a refresh", async () => {
    const fixtures: Record<string, Record<string, unknown>> = {};
    for (let id = 1; id <= 30; id += 1) fixtures[String(id)] = envelopeMap();

    let inFlight = 0;
    let maxInFlight = 0;
    const read = vi.fn(async (op: string, args?: ContractArg[]): Promise<unknown> => {
      if (op === "lastEnvelopeId") return "30";
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      switch (op) {
        case "getEnvelope":
          return fixtures[String(args?.[0]?.value ?? "")] ?? null;
        case "hasClaimed":
          return false;
        default:
          return "0";
      }
    });
    const chain = {
      contractAddress: { get: () => CONTRACT },
      address: { get: () => ALICE },
      ensureWallet: vi.fn(async () => ALICE),
      invoke: vi.fn(),
      read,
      readArray: vi.fn(async () => []),
    } as unknown as ChainService;
    const app = useRedEnvelope({ chain, t });
    app.setAddress(ALICE);

    await app.loadEnvelopes();

    expect(app.envelopes.get()).toHaveLength(30);
    expect(maxInFlight).toBeGreaterThan(1); // still parallel…
    expect(maxInFlight).toBeLessThanOrEqual(8); // …but bounded
  });
});

describe("useRedEnvelope — post-claim surgical refresh", () => {
  it("re-reads ONLY the claimed envelope and appends the claim locally", async () => {
    const envelopes: Record<string, Record<string, unknown>> = {
      "1": envelopeMap(),
      "2": envelopeMap({ openedCount: "2" }),
    };
    const { app, invoke, read } = setup({ lastEnvelopeId: "2", envelopes });

    await app.loadEnvelopes();
    expect(app.envelopes.get()).toHaveLength(2);

    // The claim changes envelope 2 on-chain; the next read reflects it.
    envelopes["2"] = envelopeMap({ openedCount: "3", remainingAmount: "10000000" });
    read.mockClear();

    await app.handleClaimFromPool("2");

    // The claim was submitted with the Claimed settle wait.
    const claim = callFor(invoke, "claim");
    expect(claim).toBeTruthy();
    expect(claim![2]).toMatchObject({ waitForEvent: "Claimed" });

    // Surgical refresh: no full rescan (no lastEnvelopeId), and the only
    // envelope re-read is the claimed one.
    expect(read.mock.calls.filter((c) => c[0] === "lastEnvelopeId")).toHaveLength(0);
    const envReads = read.mock.calls.filter((c) => c[0] === "getEnvelope");
    expect(envReads).toHaveLength(1);
    expect(String((envReads[0]![1] as ContractArg[])[0]?.value)).toBe("2");

    // The claimed envelope was patched in place…
    const patched = app.envelopes.get().find((e) => e.id === "2");
    expect(patched?.openedCount).toBe(3);
    expect(patched?.remainingAmount).toBeCloseTo(0.1, 8);
    // …its sibling untouched…
    expect(app.envelopes.get().find((e) => e.id === "1")?.openedCount).toBe(2);
    // …and the wallet's new claim is recorded from the Claimed event share
    // (50000000 base units -> 0.5 GAS) without re-walking claim history.
    expect(app.claims.get()[0]).toMatchObject({ poolId: "2", amount: 0.5 });
    expect(read.mock.calls.filter((c) => c[0] === "claimedAmount")).toHaveLength(0);
  });
});
