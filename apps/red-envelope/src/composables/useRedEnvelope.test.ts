import { describe, expect, it, vi } from "vitest";

import { useRedEnvelope } from "./useRedEnvelope";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CONTRACT = "0x5a5ecc80cd5225acd7431a5dd6f0e32bb9260a87";
const ALICE_HASH = addressToScriptHash(ALICE);
// A different creator's script hash (any non-zero hash that is not ALICE's).
const BOB_HASH = `0x${"ab".repeat(20)}`;
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const CREATE_MEMO = "miniapp-redenvelope:create";

const toChainOrderHash = (displayHash: string): string => {
  const bytes = displayHash.replace(/^0x/, "").match(/../g) ?? [];
  return `0x${bytes.reverse().join("")}`;
};

const ALICE_CHAIN_HASH = toChainOrderHash(ALICE_HASH);
const BOB_CHAIN_HASH = toChainOrderHash(BOB_HASH);

const t = (key: string) => key;

/** A getEnvelope() Map as chain.read parses it (plain object, base units). */
function envelopeMap(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    creator: ALICE_CHAIN_HASH,
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
  /** Optional gate used to prove claim UI state does not resolve before confirmation. */
  claimGate?: Promise<void>;
  /** Force claim to fail/reject before a Claimed event is available. */
  claimThrows?: Error;
  /** Per-operation confirmation bit; absent defaults to confirmed. */
  verified?: Partial<Record<"transfer" | "createEnvelope" | "claim" | "reclaim" | "withdraw", boolean>>;
  /** Omit the inline event for an operation. */
  missingEvent?: Array<"transfer" | "createEnvelope" | "claim" | "reclaim" | "withdraw">;
  /** Keep authoritative state unchanged after this operation. */
  noReadback?: Array<"transfer" | "createEnvelope" | "claim" | "reclaim" | "withdraw">;
  /** Exact-tx event returned by app.events.waitFor. */
  exactEvent?: Partial<Record<"Credited" | "EnvelopeCreated" | "Claimed" | "Reclaimed" | "CreditWithdrawn", unknown>>;
  /** Start disconnected; ensureWallet remains available for the explicit connect action. */
  disconnected?: boolean;
  /** Simulate the legacy unbounded ABI, which has no getOwner method. */
  legacyCreateContract?: boolean;
  /** Force selected read methods to fail (retry/error-recovery coverage). */
  readThrows?: string[];
  /** Creator/claimer indexes exposed to this wallet; unrelated ids stay private. */
  creatorIds?: string[];
  claimerIds?: string[];
  attestationCompatible?: boolean;
  executionState?: "halt" | "fault" | "pending" | "unreachable";
  operationStorageAvailable?: boolean;
}

/**
 * Minimal ChainService stand-in. Records invoke/read calls so tests can assert
 * the shortfall-only deposit (with its "Credited" settle wait), the reclaim and
 * the credit-withdraw argument shapes against the standalone contract.
 */
function makeChain(opts: ChainOpts = {}) {
  let liveCredit = BigInt(opts.credit ?? "0");
  const creatorIds = [...(opts.creatorIds ?? [])];
  const claimerIds = [...(opts.claimerIds ?? [])];
  let creatorCount = BigInt(creatorIds.length);
  const claimed = new Set<string>(claimerIds);
  const claimAmounts = new Map<string, bigint>();
  const omit = (op: string) => opts.missingEvent?.includes(op as never) ?? false;
  const mutates = (op: string) => !(opts.noReadback?.includes(op as never) ?? false);
  const isVerified = (op: keyof NonNullable<ChainOpts["verified"]>) =>
    opts.verified?.[op] ?? true;
  const invoke = vi.fn(
    async (
      op: string,
      args: ContractArg[],
      options?: { waitForEvent?: string; onTransactionSent?: (txid: string) => void },
    ): Promise<TxResult> => {
      let event: unknown;
      const txid = `0x${op.toLowerCase()}`;
      if (op === "transfer") {
        options?.onTransactionSent?.(txid);
        const amount = BigInt(String(args[2]?.value ?? "0"));
        if (mutates(op)) liveCredit += amount;
        if (options?.waitForEvent === "Credited" && !omit(op)) {
          event = {
            tx_hash: txid,
            state: [
              { type: "Hash160", value: ALICE_HASH },
              { type: "Integer", value: amount.toString() },
              { type: "Integer", value: liveCredit.toString() },
            ],
          };
        }
      }
      if (op === "createEnvelope") {
        if (opts.createThrows) throw opts.createThrows;
        options?.onTransactionSent?.(txid);
        if (mutates(op)) {
          creatorCount += 1n;
          creatorIds.push(creatorCount.toString());
        }
        if (options?.waitForEvent === "EnvelopeCreated" && !omit(op)) {
          event = {
            tx_hash: txid,
            state: [
              { type: "Integer", value: creatorCount.toString() },
              { type: "Hash160", value: ALICE_HASH },
              { type: "Integer", value: String(args[1]?.value ?? "0") },
              { type: "Integer", value: String(args[2]?.value ?? "0") },
              { type: "Integer", value: String(Date.now() + 86_400_000) },
            ],
          };
        }
      }
      if (op === "claim") {
        if (opts.claimGate) await opts.claimGate;
        if (opts.claimThrows) throw opts.claimThrows;
        options?.onTransactionSent?.(txid);
      }
      if (op === "claim" && options?.waitForEvent === "Claimed") {
        const id = String(args[0]?.value ?? "0");
        const share = BigInt(opts.claimShare ?? "50000000");
        if (mutates(op)) {
          claimed.add(id);
          claimAmounts.set(id, share);
        }
        // OnClaimed(id, claimer, share, remainingPackets)
        if (!omit(op)) event = {
          tx_hash: txid,
          state: [
            { type: "Integer", value: id },
            { type: "Hash160", value: ALICE_HASH },
            { type: "Integer", value: share.toString() },
            { type: "Integer", value: "1" },
          ],
        };
      }
      if (op === "reclaim" && options?.waitForEvent === "Reclaimed") {
        options?.onTransactionSent?.(txid);
        // OnReclaimed(id, creator, amount)
        const id = String(args[0]?.value ?? "0");
        const raw = opts.envelopes?.[id];
        const amount = String(raw?.remainingAmount ?? "250000000");
        if (mutates(op) && raw) {
          raw.remainingAmount = "0";
          raw.active = false;
        }
        if (!omit(op)) event = {
          tx_hash: txid,
          state: [
            { type: "Integer", value: id },
            { type: "Hash160", value: ALICE_HASH },
            { type: "Integer", value: amount },
          ],
        };
      }
      if (op === "withdraw" && options?.waitForEvent === "CreditWithdrawn") {
        options?.onTransactionSent?.(txid);
        // OnCreditWithdrawn(account, amount)
        const amount = liveCredit;
        if (mutates(op)) liveCredit = 0n;
        if (!omit(op)) event = {
          tx_hash: txid,
          state: [
            { type: "Hash160", value: ALICE_HASH },
            { type: "Integer", value: amount.toString() },
          ],
        };
      }
      return {
        txid,
        event,
        success: true,
        verified: isVerified(op as keyof NonNullable<ChainOpts["verified"]>),
      };
    },
  );

  const read = vi.fn(async (op: string, args?: ContractArg[]): Promise<unknown> => {
    if (opts.readThrows?.includes(op)) throw new Error(`read failed: ${op}`);
    switch (op) {
      case "getOwner":
        if (opts.legacyCreateContract) throw new Error("method not found");
        return ALICE_CHAIN_HASH;
      case "lastEnvelopeId":
        return opts.lastEnvelopeId ?? "0";
      case "getEnvelope":
        return opts.envelopes?.[String(args?.[0]?.value ?? "")] ?? null;
      case "hasClaimed":
        return claimed.has(String(args?.[0]?.value ?? ""));
      case "claimedAmount":
        return (claimAmounts.get(String(args?.[0]?.value ?? "")) ?? 0n).toString();
      case "creditOf":
        return liveCredit.toString();
      case "creatorEnvelopeCount":
        return creatorCount.toString();
      case "claimerEnvelopeCount":
        return String(claimerIds.length);
      default:
        return "0";
    }
  });

  const readArray = vi.fn(async (op: string, args?: ContractArg[]): Promise<unknown[]> => {
    if (op === "getCreatorEnvelopes") {
      const offset = Number(args?.[1]?.value ?? 0);
      const limit = Number(args?.[2]?.value ?? 100);
      return creatorIds.slice(offset, offset + limit);
    }
    if (op === "getClaimerEnvelopes") {
      const offset = Number(args?.[1]?.value ?? 0);
      const limit = Number(args?.[2]?.value ?? 100);
      return claimerIds.slice(offset, offset + limit);
    }
    return [];
  });
  const waitForEvent = vi.fn(async (_txid: string, eventName: string) =>
    opts.exactEvent?.[eventName as keyof NonNullable<ChainOpts["exactEvent"]>] ?? null,
  );

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => (opts.disconnected ? null : ALICE) },
    ensureWallet: vi.fn(async () => ALICE),
    detectNetwork: vi.fn(async () => "neo-n3-testnet"),
    invoke,
    read,
    readArray,
    waitForEvent,
  } as unknown as ChainService;
  return { chain, invoke, read, readArray, waitForEvent };
}

function setup(opts: ChainOpts = {}) {
  const { chain, invoke, read, readArray, waitForEvent } = makeChain(opts);
  const framework = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-redenvelope" },
  );
  const values = new Map<string, unknown>();
  const operationStorage = {
    get: <T,>(key: string, fallback: T | null = null) =>
      values.has(key) ? values.get(key) as T : fallback,
    set: (key: string, value: unknown) => {
      if (opts.operationStorageAvailable !== false) values.set(key, value);
    },
    delete: (key: string) => { values.delete(key); },
  };
  const app = useRedEnvelope({
    app: framework,
    t,
    launchNetwork: "testnet",
    attestContract: async () => ({
      compatible: opts.attestationCompatible !== false,
      boundedCreate: !opts.legacyCreateContract,
      checksum: 4_293_893_390,
      version: opts.legacyCreateContract ? "1.0.0" : "1.1.0",
      reason: opts.attestationCompatible === false ? "checksum" : "ok",
    }),
    readExecutionState: async () => opts.executionState ?? "unreachable",
    operationStorage,
  });
  app.setAddress(opts.disconnected ? null : ALICE);
  return {
    app,
    invoke,
    read,
    readArray,
    waitForEvent,
    framework,
    chain,
    operationStorage,
  };
}

/** Find a recorded invoke call for an operation. */
function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((c) => c[0] === op);
}

describe("useRedEnvelope — create() deposit (shortfall-only, Credited settle wait)", () => {
  it("pauses new envelopes on the legacy unbounded ABI before any wallet write", async () => {
    const { app, invoke } = setup({ legacyCreateContract: true });
    await app.loadAll();

    expect(app.createAvailable.get()).toBe(false);
    expect(app.transactionNotice.get()).toBe("createContractUpgradeRequired");
    await expect(app.create({ amount: "1", count: "4", expiryHours: "24" }))
      .rejects.toThrow("createContractUpgradeRequired");
    expect(invoke).not.toHaveBeenCalled();
  });

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

  it("enforces the low-stakes amount and seven-day expiry bounds before any wallet write", async () => {
    const { app, invoke } = setup({ credit: "10000000000" });

    await expect(app.create({ amount: "20.00000001", count: "4", expiryHours: "24" }))
      .rejects.toThrow("invalidAmount");
    await expect(app.create({ amount: "1", count: "4", expiryHours: "0.5" }))
      .rejects.toThrow("invalidExpiry");
    await expect(app.create({ amount: "1", count: "4", expiryHours: "169" }))
      .rejects.toThrow("invalidExpiry");
    await expect(app.create({ amount: "1", count: "1.5", expiryHours: "24" }))
      .rejects.toThrow("invalidPackets");
    await expect(app.create({ amount: "0.1", count: "11", expiryHours: "24" }))
      .rejects.toThrow("invalidPerPacket");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("fails closed before any wallet request when bytecode/ABI attestation drifts", async () => {
    const { app, invoke } = setup({ attestationCompatible: false });

    await expect(app.create({ amount: "1", count: "4", expiryHours: "24" }))
      .rejects.toThrow("contractCompatibilityUnproven");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("requires durable pending-operation storage before the deposit wallet prompt", async () => {
    const { app, invoke } = setup({ operationStorageAvailable: false });

    await expect(app.create({ amount: "1", count: "4", expiryHours: "24" }))
      .rejects.toThrow("transactionRecoveryUnavailable");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("does not deposit when the prepaid-credit read is unavailable", async () => {
    const { app, invoke } = setup({ readThrows: ["creditOf"] });

    await expect(app.create({ amount: "1", count: "4", expiryHours: "24" }))
      .rejects.toThrow("chainReadUnavailable");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("surfaces the held-credit message when createEnvelope faults after the deposit", async () => {
    const { app, invoke } = setup({ credit: "0", createThrows: new Error("chain fault") });

    await expect(app.create({ amount: "1", count: "4", expiryHours: "24" })).rejects.toThrow(
      "depositPrepaidNoEnvelope",
    );
    expect(callFor(invoke, "transfer")).toBeTruthy();
    // A failed create leaves no share id (no completed envelope to share).
    expect(app.lastCreatedEnvelopeId.get()).toBe("");
  });

  it("captures the new envelope id from EnvelopeCreated so the UI can offer a share link", async () => {
    const { app } = setup({ credit: "100000000" });
    expect(app.lastCreatedEnvelopeId.get()).toBe("");

    await app.create({ amount: "1", count: "4", expiryHours: "24" });

    // The id (EnvelopeCreated state[0] = "1") is captured for the share card.
    expect(app.lastCreatedEnvelopeId.get()).toBe("1");
  });
});

describe("useRedEnvelope — reclaim (creator recovers an expired remainder)", () => {
  it("calls reclaim(envelopeId, creator) waiting for Reclaimed and returns the amount", async () => {
    const { app, invoke } = setup({
      envelopes: {
        "7": envelopeMap({
          remainingAmount: "250000000",
          expiryTime: String(Date.now() - 1_000),
        }),
      },
    });

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
      creatorIds: ["1", "2", "3"],
      credit: "120000000", // 1.2 GAS prepaid credit
      envelopes: {
        // Mine, expired, remainder left -> reclaimable.
        "3": envelopeMap({ expiryTime: String(Date.now() - 1000) }),
        // Someone else's expired envelope -> NOT mine, not reclaimable.
        "2": envelopeMap({ creator: BOB_CHAIN_HASH, expiryTime: String(Date.now() - 1000) }),
        // Mine but still live -> not reclaimable.
        "1": envelopeMap(),
      },
    });

    await app.loadEnvelopes();

    const byId = new Map(app.envelopes.get().map((e) => [e.id, e]));
    expect(byId.get("3")?.reclaimable).toBe(true);
    expect(byId.get("3")?.creator).toBe(ALICE_HASH);
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

  it("does not prompt a withdrawal when the live credit read fails", async () => {
    const { app, invoke } = setup({ credit: "70000000", readThrows: ["creditOf"] });

    await expect(app.withdrawCredit()).rejects.toThrow("chainReadUnavailable");
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("useRedEnvelope — paged refresh (newest page, bounded concurrency)", () => {
  it("publishes a retryable service notice when the primary chain read fails", async () => {
    const { app } = setup({ readThrows: ["creatorEnvelopeCount"] });

    await app.loadEnvelopes();

    expect(app.serviceNotice.get()).toBe("chainReadUnavailable");
    expect(app.loadingEnvelopes.get()).toBe(false);
  });

  it("reads only the newest 30 wallet-indexed envelopes and never advertises global ids", async () => {
    // Regression: scanning sequential global ids exposed unrelated bearer-link
    // gifts as a public free-for-all and caused hundreds of bridge reads.
    const envelopes: Record<string, Record<string, unknown>> = {};
    for (let id = 1; id <= 100; id += 1) envelopes[String(id)] = envelopeMap();
    envelopes["999"] = envelopeMap();
    const creatorIds = Array.from({ length: 100 }, (_, index) => String(index + 1));
    const { app, read } = setup({ creatorIds, envelopes, lastEnvelopeId: "999" });

    await app.loadEnvelopes();

    const envReads = read.mock.calls.filter((c) => c[0] === "getEnvelope");
    expect(envReads).toHaveLength(30);
    const ids = envReads.map((c) => String((c[1] as ContractArg[])[0]?.value));
    expect(ids).toContain("100");
    expect(ids).toContain("71");
    expect(ids).not.toContain("70");
    expect(ids).not.toContain("999");
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
        case "creatorEnvelopeCount":
          return "30";
        case "claimerEnvelopeCount":
          return "0";
        case "getEnvelope":
          return fixtures[String(args?.[0]?.value ?? "")] ?? null;
        case "hasClaimed":
          return false;
        default:
          return "0";
      }
    });
    const creatorIds = Array.from({ length: 30 }, (_, index) => String(index + 1));
    const chain = {
      contractAddress: { get: () => CONTRACT },
      address: { get: () => ALICE },
      ensureWallet: vi.fn(async () => ALICE),
      detectNetwork: vi.fn(async () => "neo-n3-testnet"),
      invoke: vi.fn(),
      read,
      readArray: vi.fn(async (op: string, args?: ContractArg[]) => {
        if (op !== "getCreatorEnvelopes") return [];
        const offset = Number(args?.[1]?.value ?? 0);
        const limit = Number(args?.[2]?.value ?? 30);
        return creatorIds.slice(offset, offset + limit);
      }),
    } as unknown as ChainService;
    const framework = createMiniAppFramework(
      { services: { chain }, t } as never,
      { appId: "miniapp-redenvelope" },
    );
    const values = new Map<string, unknown>();
    const app = useRedEnvelope({
      app: framework,
      t,
      launchNetwork: "testnet",
      attestContract: async () => ({
        compatible: true,
        boundedCreate: true,
        checksum: 4_293_893_390,
        version: "1.1.0",
        reason: "ok",
      }),
      readExecutionState: async () => "unreachable",
      operationStorage: {
        get: <T,>(key: string, fallback: T | null = null) =>
          values.has(key) ? values.get(key) as T : fallback,
        set: (key: string, value: unknown) => { values.set(key, value); },
        delete: (key: string) => { values.delete(key); },
      },
    });
    app.setAddress(ALICE);

    await app.loadEnvelopes();

    expect(app.envelopes.get()).toHaveLength(30);
    expect(maxInFlight).toBeGreaterThan(1); // still parallel…
    expect(maxInFlight).toBeLessThanOrEqual(8); // …but bounded
  });
});

describe("useRedEnvelope — post-claim surgical refresh", () => {
  it("publishes the lucky result only after the Claimed confirmation resolves", async () => {
    let confirmClaim!: () => void;
    const claimGate = new Promise<void>((resolve) => {
      confirmClaim = resolve;
    });
    const { app } = setup({
      claimGate,
      envelopes: { "2": envelopeMap() },
    });

    const pending = app.handleClaimFromPool("2");
    expect(app.openingId.get()).toBe("2");
    expect(app.luckyMessage.get()).toBeNull();

    confirmClaim();
    await pending;

    expect(app.openingId.get()).toBeNull();
    expect(app.luckyMessage.get()).toEqual({ amount: 0.5, from: "#2" });
  });

  it("clears pending state after a rejected claim and allows an immediate retry", async () => {
    const { app, invoke } = setup({ claimThrows: new Error("Request rejected") });

    await expect(app.handleClaimFromPool("2")).rejects.toThrow("Request rejected");
    expect(app.openingId.get()).toBeNull();
    expect(app.luckyMessage.get()).toBeNull();

    await expect(app.handleClaimFromPool("2")).rejects.toThrow("Request rejected");
    expect(invoke.mock.calls.filter((call) => call[0] === "claim")).toHaveLength(2);
    expect(app.openingId.get()).toBeNull();
  });

  it("fails closed when duplicate-claim eligibility cannot be read", async () => {
    const { app, invoke } = setup({ readThrows: ["hasClaimed"] });

    await expect(app.handleClaimFromPool("2")).rejects.toThrow(
      "claimEligibilityUnavailable",
    );
    expect(invoke).not.toHaveBeenCalled();
    expect(app.luckyMessage.get()).toBeNull();
  });

  it("re-reads ONLY the claimed envelope and appends the claim locally", async () => {
    const envelopes: Record<string, Record<string, unknown>> = {
      "1": envelopeMap(),
      "2": envelopeMap({ openedCount: "2" }),
    };
    const { app, invoke, read } = setup({ creatorIds: ["1", "2"], envelopes });

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

    // Surgical refresh: the write-time compatibility probe reads
    // lastEnvelopeId once, but there is no account-index/full-list rescan; the
    // only envelope entity re-read is the claimed one.
    expect(read.mock.calls.filter((c) => c[0] === "lastEnvelopeId")).toHaveLength(1);
    expect(read.mock.calls.filter((c) => c[0] === "creatorEnvelopeCount")).toHaveLength(0);
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

describe("useRedEnvelope — confirmation authority and exact-tx recovery", () => {
  it("clears a terminal exact-tx FAULT without showing a reward", async () => {
    const { app } = setup({
      verified: { claim: false },
      missingEvent: ["claim"],
      noReadback: ["claim"],
      executionState: "fault",
    });

    await expect(app.handleClaimFromPool("2")).rejects.toThrow(
      "transactionExecutionFailed",
    );
    expect(app.pendingOperation.get()).toBeNull();
    expect(app.luckyMessage.get()).toBeNull();
  });

  it("does not treat verified:true as success when the corresponding event is missing", async () => {
    const { app } = setup({
      verified: { claim: true },
      missingEvent: ["claim"],
      noReadback: ["claim"],
    });

    await expect(app.handleClaimFromPool("2")).rejects.toThrow(
      "transactionConfirmationPending",
    );
    expect(app.luckyMessage.get()).toBeNull();
  });

  it("does not trust an inline Claim event when invoke reports verified:false", async () => {
    const { app } = setup({
      verified: { claim: false },
      noReadback: ["claim"],
    });

    await expect(app.handleClaimFromPool("2")).rejects.toThrow(
      "transactionConfirmationPending",
    );
    expect(app.luckyMessage.get()).toBeNull();
    expect(app.pendingOperation.get()).toMatchObject({
      phase: "claim",
      txid: "0xclaim",
      envelopeId: "2",
    });
  });

  it("accepts a matching exact-tx event after an unverified invoke", async () => {
    const opts: ChainOpts = {
      verified: { claim: false },
      missingEvent: ["claim"],
      noReadback: ["claim"],
      exactEvent: {
        Claimed: {
          tx_hash: "0xclaim",
          state: [
            { type: "Integer", value: "2" },
            { type: "Hash160", value: ALICE_HASH },
            { type: "Integer", value: "33000000" },
            { type: "Integer", value: "1" },
          ],
        },
      },
    };
    const { app, waitForEvent } = setup(opts);

    await app.handleClaimFromPool("2");

    expect(waitForEvent).toHaveBeenCalledWith("0xclaim", "Claimed", 2_500);
    expect(app.luckyMessage.get()).toEqual({ amount: 0.33, from: "#2" });
    expect(app.pendingOperation.get()).toBeNull();
  });

  it("uses claimedAmount + hasClaimed as authoritative claim readback", async () => {
    const { app } = setup({
      verified: { claim: false },
      missingEvent: ["claim"],
      claimShare: "42000000",
    });

    await app.handleClaimFromPool("9");

    expect(app.luckyMessage.get()).toEqual({ amount: 0.42, from: "#9" });
    expect(app.claims.get()[0]).toMatchObject({ poolId: "9", amount: 0.42 });
  });

  it("does not create after an unconfirmed shortfall deposit", async () => {
    const { app, invoke } = setup({
      credit: "40000000",
      verified: { transfer: false },
      missingEvent: ["transfer"],
      noReadback: ["transfer"],
    });

    await expect(
      app.create({ amount: "1", count: "4", expiryHours: "24" }),
    ).rejects.toThrow("transactionConfirmationPending");

    expect(callFor(invoke, "transfer")).toBeTruthy();
    expect(callFor(invoke, "createEnvelope")).toBeUndefined();
    expect(app.pendingOperation.get()).toMatchObject({
      phase: "deposit",
      amountBase: "60000000",
      creditBeforeBase: "40000000",
      targetCreditBase: "100000000",
    });
  });

  it("does not publish a share id for an unconfirmed create", async () => {
    const { app } = setup({
      credit: "100000000",
      verified: { createEnvelope: false },
      missingEvent: ["createEnvelope"],
      noReadback: ["createEnvelope"],
    });

    await expect(
      app.create({ amount: "1", count: "4", expiryHours: "24" }),
    ).rejects.toThrow("transactionConfirmationPending");
    expect(app.lastCreatedEnvelopeId.get()).toBe("");
    expect(app.pendingOperation.get()?.phase).toBe("create");
  });

  it("recovers a create only from the captured creator-list append index", async () => {
    const { app, readArray } = setup({
      credit: "100000000",
      verified: { createEnvelope: false },
      missingEvent: ["createEnvelope"],
      envelopes: {
        "1": envelopeMap({ totalAmount: "100000000", packetCount: "4" }),
      },
    });

    const result = await app.create({ amount: "1", count: "4", expiryHours: "24" });

    expect(result.envelopeId).toBe("1");
    expect(app.lastCreatedEnvelopeId.get()).toBe("1");
    expect(readArray).toHaveBeenCalledWith("getCreatorEnvelopes", [
      { type: "Hash160", value: ALICE_HASH },
      { type: "Integer", value: "0" },
      { type: "Integer", value: "1" },
    ], undefined);
  });

  it("never substitutes local reclaim/credit amounts when confirmation is absent", async () => {
    const reclaim = setup({
      verified: { reclaim: false },
      missingEvent: ["reclaim"],
      noReadback: ["reclaim"],
      envelopes: {
        "7": envelopeMap({
          remainingAmount: "250000000",
          expiryTime: String(Date.now() - 1_000),
        }),
      },
    });
    await expect(reclaim.app.reclaimEnvelope("7")).rejects.toThrow(
      "transactionConfirmationPending",
    );
    expect(reclaim.app.pendingOperation.get()?.phase).toBe("reclaim");

    const withdraw = setup({
      credit: "70000000",
      verified: { withdraw: false },
      missingEvent: ["withdraw"],
      noReadback: ["withdraw"],
    });
    await expect(withdraw.app.withdrawCredit()).rejects.toThrow(
      "transactionConfirmationPending",
    );
    expect(withdraw.app.pendingOperation.get()?.phase).toBe("withdraw");
  });

  it("blocks a second claim click while the first wallet request is in flight", async () => {
    let release!: () => void;
    const claimGate = new Promise<void>((resolve) => { release = resolve; });
    const { app, invoke } = setup({ claimGate });

    const first = app.handleClaimFromPool("2");
    await expect(app.handleClaimFromPool("2")).rejects.toThrow("operationBusy");
    release();
    await first;

    expect(invoke.mock.calls.filter((call) => call[0] === "claim")).toHaveLength(1);
  });

  it("serializes different financial actions before either can prompt a second wallet request", async () => {
    let release!: () => void;
    const claimGate = new Promise<void>((resolve) => { release = resolve; });
    const { app, invoke } = setup({ claimGate });

    const claim = app.claimEnvelope("2");
    await expect(
      app.create({ amount: "1", count: "4", expiryHours: "24" }),
    ).rejects.toThrow("operationBusy");

    release();
    await claim;
    expect(invoke.mock.calls.filter((call) => call[0] === "claim")).toHaveLength(1);
    expect(invoke.mock.calls.filter((call) => call[0] === "transfer")).toHaveLength(0);
    expect(invoke.mock.calls.filter((call) => call[0] === "createEnvelope")).toHaveLength(0);
  });

  it("restores an exact persisted tx after refresh without replaying claim", async () => {
    const values = new Map<string, string>();
    const storage = {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => { values.delete(key); },
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    vi.stubGlobal("localStorage", storage);
    try {
      const opts: ChainOpts = {
        verified: { claim: false },
        missingEvent: ["claim"],
        noReadback: ["claim"],
      };
      const first = setup(opts);
      await expect(first.app.handleClaimFromPool("12")).rejects.toThrow(
        "transactionConfirmationPending",
      );
      expect(first.invoke.mock.calls.filter((call) => call[0] === "claim")).toHaveLength(1);

      opts.exactEvent = {
        Claimed: {
          tx_hash: "0xclaim",
          state: [
            { type: "Integer", value: "12" },
            { type: "Hash160", value: ALICE_HASH },
            { type: "Integer", value: "51000000" },
            { type: "Integer", value: "1" },
          ],
        },
      };
      const refreshed = useRedEnvelope({
        app: first.framework,
        t,
        launchNetwork: "testnet",
        attestContract: async () => ({
          compatible: true,
          boundedCreate: true,
          checksum: 4_293_893_390,
          version: "1.1.0",
          reason: "ok",
        }),
        readExecutionState: async () => "unreachable",
        operationStorage: first.operationStorage,
      });
      refreshed.setAddress(ALICE);
      const recovery = await refreshed.recoverPendingOperation();

      expect(recovery.status).toBe("confirmed");
      expect(refreshed.luckyMessage.get()).toEqual({ amount: 0.51, from: "#12" });
      expect(first.waitForEvent).toHaveBeenLastCalledWith("0xclaim", "Claimed", 2_500);
      expect(first.invoke.mock.calls.filter((call) => call[0] === "claim")).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("financial methods never connect and transact in the same call", async () => {
    const { app, chain, invoke } = setup({ disconnected: true });

    await expect(
      app.create({ amount: "1", count: "4", expiryHours: "24" }),
    ).rejects.toThrow("walletNotConnected");
    await expect(app.handleClaimFromPool("2")).rejects.toThrow("walletNotConnected");

    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });
});
