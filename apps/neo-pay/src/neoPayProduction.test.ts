import { afterEach, describe, expect, it, vi } from "vitest";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { createObservable, type MiniAppFramework } from "@shared/react";
import { eventValue } from "@shared/utils/chain-events";
import {
  deriveExactNeoPaySchedule,
  formatAssetBaseUnits,
  nudgeNeoPayAmount,
  parseAssetToBaseUnits,
  parseNeoPayStream,
  useNeoPayProduction,
} from "./useNeoPayProduction";
import {
  isPendingNeoPayOperation,
  isExactNeoPayTxid,
  neoPayAccountMatches,
  type PendingNeoPayOperation,
} from "./neo-pay-safety";

const CREATOR = "0x6d0656f6dd91469db1c90cc1e574380613f43738";
const CREATOR_CHAIN_ORDER = "0x3837f413063874e5c10cc9b19d4691ddf656066d";
const BENEFICIARY = "0xc0f2741cb16c02d9c2988f30fda9c92ca499e7fe";
const TXID = `0x${"12".repeat(32)}`;

afterEach(() => vi.unstubAllGlobals());

function rawStream(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    creator: CREATOR_CHAIN_ORDER,
    beneficiary: BENEFICIARY,
    asset: BLOCKCHAIN_CONSTANTS.GAS_HASH,
    totalAmount: 300_000_000,
    releasedAmount: 100_000_000,
    remainingAmount: 200_000_000,
    rateAmount: 100_000_000,
    intervalSeconds: 86_400,
    status: "active",
    claimable: 100_000_000,
    title: "Payroll",
    notes: "July",
    ...overrides,
  };
}

describe("neo-pay exact Fixed8 input", () => {
  it("parses GAS without floating point and rejects ambiguous precision", () => {
    expect(parseAssetToBaseUnits("GAS", "0.00000001")).toBe(1n);
    expect(parseAssetToBaseUnits("GAS", "123456789.12345678")).toBe(12_345_678_912_345_678n);
    expect(parseAssetToBaseUnits("GAS", "1.000000001")).toBeNull();
    expect(parseAssetToBaseUnits("GAS", "1e-8")).toBeNull();
    expect(formatAssetBaseUnits("GAS", 12_345_678_912_345_678n)).toBe("123456789.12345678");
  });

  it("keeps NEO indivisible", () => {
    expect(parseAssetToBaseUnits("NEO", "5")).toBe(5n);
    expect(parseAssetToBaseUnits("NEO", "5.1")).toBeNull();
    expect(parseAssetToBaseUnits("NEO", "0")).toBeNull();
  });

  it("nudges very large values with exact integer arithmetic", () => {
    expect(nudgeNeoPayAmount("9007199254740993", "NEO", 1)).toBe("9007199254740994");
    expect(nudgeNeoPayAmount("9007199254740993.12345678", "GAS", 1))
      .toBe("9007199254740998.12345678");
    expect(nudgeNeoPayAmount("5", "GAS", -1)).toBe("0");
  });

  it("uses ceiling division so GAS completes within the requested horizon", () => {
    expect(deriveExactNeoPaySchedule("1", "3", "GAS")).toMatchObject({
      totalBase: 100_000_000n,
      rateBase: 33_333_334n,
      intervalSeconds: 86_400n,
      kind: "linear",
      rateDisplay: "0.33333334",
    });
  });

  it("discloses the indivisible NEO cliff instead of inventing a fractional rate", () => {
    expect(deriveExactNeoPaySchedule("5", "30", "NEO")).toMatchObject({
      totalBase: 5n,
      rateBase: 5n,
      intervalDays: 30,
      intervalSeconds: 2_592_000n,
      kind: "cliff",
    });
    expect(deriveExactNeoPaySchedule("60", "30", "NEO")).toMatchObject({
      rateBase: 2n,
      intervalDays: 1,
      kind: "linear",
    });
  });
});

describe("neo-pay strict chain decoding", () => {
  it("accepts the live Map shape and preserves base-unit accounting", () => {
    const stream = parseNeoPayStream(rawStream(), "7");
    expect(stream).toMatchObject({
      id: "7",
      assetSymbol: "GAS",
      totalAmount: 300_000_000n,
      releasedAmount: 100_000_000n,
      remainingAmount: 200_000_000n,
      claimable: 100_000_000n,
      status: "active",
    });
    expect(neoPayAccountMatches(stream.creator, CREATOR)).toBe(true);
  });

  it("rejects unknown assets, statuses, and impossible accounting", () => {
    expect(() => parseNeoPayStream(rawStream({ asset: "0x1111111111111111111111111111111111111111" }), "7"))
      .toThrow("Malformed stream asset");
    expect(() => parseNeoPayStream(rawStream({ status: "mystery" }), "7"))
      .toThrow("Malformed stream status");
    expect(() => parseNeoPayStream(rawStream({ claimable: 300_000_000 }), "7"))
      .toThrow("Malformed stream accounting");
    expect(() => parseNeoPayStream(rawStream({ remainingAmount: 199_999_999 }), "7"))
      .toThrow("Malformed stream accounting");
    expect(() => parseNeoPayStream(rawStream({ status: "cancelled", remainingAmount: 1, claimable: 0 }), "7"))
      .toThrow("Malformed stream accounting");
  });
});

describe("neo-pay durable pending binding", () => {
  const pending: PendingNeoPayOperation = {
    version: 1,
    kind: "create",
    eventName: "StreamCreated",
    network: "testnet",
    contractHash: "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e",
    actorHash: CREATOR,
    txid: TXID,
    createdAt: 1,
    beneficiaryHash: BENEFICIARY,
    assetHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
    totalBase: "100000000",
    rateBase: "50000000",
    intervalSeconds: "86400",
    title: "Payroll",
    notes: "July",
  };

  it("requires the exact network, contract, actor, event, and positive values", () => {
    expect(isPendingNeoPayOperation(pending)).toBe(true);
    expect(isPendingNeoPayOperation({ ...pending, eventName: "StreamClaimed" })).toBe(false);
    expect(isPendingNeoPayOperation({ ...pending, totalBase: "0" })).toBe(false);
    expect(isPendingNeoPayOperation({ ...pending, rateBase: "100000001" })).toBe(false);
    expect(isPendingNeoPayOperation({ ...pending, txid: "0x1234567890abcdef" })).toBe(false);
    expect(isPendingNeoPayOperation({ ...pending, assetHash: BENEFICIARY })).toBe(false);
    expect(isPendingNeoPayOperation({ ...pending, createdAt: 1.5 })).toBe(false);
    expect(isExactNeoPayTxid(TXID)).toBe(true);
  });

  it("matches Hash160 event byte order without weakening canonical hash checks", () => {
    expect(neoPayAccountMatches(CREATOR_CHAIN_ORDER, CREATOR)).toBe(true);
    expect(neoPayAccountMatches(CREATOR, BENEFICIARY)).toBe(false);
  });

  it("accepts a platform-vesting journal with its configured engine hash", () => {
    expect(isPendingNeoPayOperation({
      ...pending,
      engine: "platform-vesting",
    })).toBe(true);
    expect(isPendingNeoPayOperation({
      ...pending,
      engine: "platform-vesting",
      contractHash: BENEFICIARY,
    })).toBe(true);
    expect(isPendingNeoPayOperation({
      ...pending,
      engine: "platform-vesting",
      contractHash: "not-a-hash",
    })).toBe(false);
  });
});

function productionApp(options: {
  storageMode?: "healthy" | "noop";
  deletePendingNoop?: boolean;
  initialPending?: PendingNeoPayOperation | null;
  detectNetwork?: "neo-n3-testnet" | "neo-n3-mainnet" | "unavailable";
  sharedVesting?: boolean;
} = {}) {
  const address = createObservable<string | null>(CREATOR);
  const contractAddress = createObservable<string | null>("0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e");
  const storage = new Map<string, unknown>();
  const persisted = createObservable<PendingNeoPayOperation | null>(options.initialPending ?? null);
  if (options.initialPending) storage.set("state/neo-pay/pending-operation", options.initialPending);
  const readArray = vi.fn(async (operation: string, _args?: Array<{ value: string }>): Promise<unknown[]> => {
    if (operation === "getUserStreams") return [1];
    if (operation === "getBeneficiaryStreams") return [2];
    return [];
  });
  const readRaw = vi.fn(async (operation: string, args: Array<{ value: string }> = []) => {
    if (operation === "isPaused") return false;
    const id = String(args[0]?.value ?? "");
    if (id === "1") return rawStream({ id: 1, creator: CREATOR, beneficiary: BENEFICIARY });
    if (id === "2") return rawStream({ id: 2, creator: BENEFICIARY, beneficiary: CREATOR });
    return {};
  });
  const invokeMultiple = vi.fn();
  const invoke = vi.fn();
  const waitFor = vi.fn();
  const sharedStreams: Array<Record<string, unknown>> = options.sharedVesting
    ? [
      rawStream({ id: 1, creator: CREATOR, beneficiary: BENEFICIARY }),
      rawStream({ id: 2, creator: BENEFICIARY, beneficiary: CREATOR }),
    ]
    : [];
  const sharedStream = (id: string) => sharedStreams.find((stream) => String(stream.id) === id);
  const platformVesting = {
    available: options.sharedVesting === true,
    configuredHash: options.sharedVesting ? "0x" + "ab".repeat(20) : null,
    getUserStreams: vi.fn(async (creator?: string, offset = 0, limit = 20) => sharedStreams
      .filter((stream) => neoPayAccountMatches(stream.creator, creator))
      .slice(Number(offset), Number(offset) + Number(limit))
      .map((stream) => stream.id)),
    getBeneficiaryStreams: vi.fn(async (beneficiary?: string, offset = 0, limit = 20) => sharedStreams
      .filter((stream) => neoPayAccountMatches(stream.beneficiary, beneficiary))
      .slice(Number(offset), Number(offset) + Number(limit))
      .map((stream) => stream.id)),
    getStreamDetails: vi.fn(async (id: string) => sharedStream(String(id)) ?? {}),
    createStream: vi.fn(async (input: {
      beneficiary: string;
      asset: "GAS" | "NEO";
      totalAmount: bigint;
      rateAmount: bigint;
      intervalSeconds: bigint;
      title?: string;
      notes?: string;
      options?: { onTransactionSent?: (txid: string) => void };
    }) => {
      sharedStreams.push(rawStream({
        id: 7,
        creator: CREATOR,
        beneficiary: input.beneficiary,
        asset: input.asset === "GAS" ? BLOCKCHAIN_CONSTANTS.GAS_HASH : BLOCKCHAIN_CONSTANTS.NEO_HASH,
        totalAmount: input.totalAmount,
        releasedAmount: 0,
        remainingAmount: input.totalAmount,
        rateAmount: input.rateAmount,
        intervalSeconds: input.intervalSeconds,
        claimable: 0,
        title: input.title,
        notes: input.notes,
      }));
      input.options?.onTransactionSent?.(TXID);
      return { txid: TXID, success: true };
    }),
    claimStream: vi.fn(async (id: string, _beneficiary?: string, options?: { onTransactionSent?: (txid: string) => void }) => {
      const stream = sharedStream(String(id));
      if (stream) {
        const claimable = BigInt(String(stream.claimable ?? "0"));
        const released = BigInt(String(stream.releasedAmount ?? "0")) + claimable;
        stream.releasedAmount = released;
        stream.remainingAmount = BigInt(String(stream.remainingAmount ?? "0")) - claimable;
        stream.claimable = 0;
        if (stream.remainingAmount === 0n) stream.status = "completed";
      }
      options?.onTransactionSent?.(TXID);
      return { txid: TXID, success: true };
    }),
    cancelStream: vi.fn(async (id: string, _creator?: string, options?: { onTransactionSent?: (txid: string) => void }) => {
      const stream = sharedStream(String(id));
      if (stream) {
        stream.remainingAmount = 0;
        stream.claimable = 0;
        stream.status = "cancelled";
      }
      options?.onTransactionSent?.(TXID);
      return { txid: TXID, success: true };
    }),
  };
  const app = {
    platform: { launch: { network: "neo-n3-testnet" } },
    state: { persisted: () => persisted },
    storage: {
      local: {
        get: (key: string, fallback: unknown = null) => storage.has(key) ? storage.get(key) : fallback,
        set: (key: string, value: unknown) => {
          if (options.storageMode !== "noop") storage.set(key, value);
        },
        delete: (key: string) => {
          if (options.storageMode === "noop") return;
          if (options.deletePendingNoop && key === "state/neo-pay/pending-operation") return;
          storage.delete(key);
        },
      },
    },
    chain: {
      address,
      contractAddress,
      detectNetwork: async () => {
        if (options.detectNetwork === "unavailable") throw new Error("wallet network unavailable");
        return options.detectNetwork ?? "neo-n3-testnet";
      },
      ensureWallet: async () => CREATOR,
      readArray,
      readRaw,
      invokeMultiple,
      invoke,
      arg: {
        hash160: (value: string) => ({ type: "Hash160", value }),
        integer: (value: unknown) => ({ type: "Integer", value: String(value) }),
        string: (value: unknown) => ({ type: "String", value: String(value) }),
      },
    },
    events: { waitFor, value: eventValue },
    platformVesting,
    // Harness mirror of the framework surfaces the composable adopted in the
    // RFC migration (wallet.onAccountChanged identity diff + errors.messageOf
    // Error-message extraction). No assertion depends on these bodies beyond
    // the framework-documented semantics.
    wallet: {
      onAccountChanged: (
        handler: (change: { previous: string | null; current: string | null }) => void,
      ) => {
        let last = address.get() || null;
        return address.subscribe(() => {
          const next = address.get() || null;
          if (next === last) return;
          const previous = last;
          last = next;
          handler({ previous, current: next });
        });
      },
    },
    errors: {
      messageOf: (error: unknown, fallback?: string) =>
        error instanceof Error && error.message
          ? error.message
          : typeof error === "string" && error
            ? error
            : fallback ?? "error",
    },
  } as unknown as MiniAppFramework;
  return { app, address, persisted, storage, readArray, readRaw, invokeMultiple, invoke, waitFor, platformVesting };
}

function prepareConfirmedCreate(
  mock: ReturnType<typeof productionApp>,
  streamOverrides: Record<string, unknown> = {},
) {
  const title = `Stream to ${BENEFICIARY.slice(0, 8)}…`;
  mock.readArray.mockResolvedValue([]);
  mock.readRaw.mockImplementation(async (operation: string, args: Array<{ value: string }> = []) => {
    if (operation === "isPaused") return false;
    if (String(args[0]?.value) !== "7") return {};
    return rawStream({
      id: 7,
      creator: CREATOR,
      beneficiary: BENEFICIARY,
      totalAmount: 100_000_000,
      releasedAmount: 0,
      remainingAmount: 100_000_000,
      rateAmount: 33_333_334,
      claimable: 0,
      title,
      notes: "Quarterly grant",
      ...streamOverrides,
    });
  });
  mock.invokeMultiple.mockImplementation(async (_calls: unknown[], options: { onTransactionSent?: (txid: string) => void }) => {
    options.onTransactionSent?.(TXID);
    return { txid: TXID, success: true, verified: true };
  });
  mock.waitFor.mockResolvedValue({
    state: ["7", CREATOR, BENEFICIARY, BLOCKCHAIN_CONSTANTS.GAS_HASH, "100000000"]
      .map((value) => ({ value })),
  });
}

describe("neo-pay production orchestration", () => {
  it("reads creator and beneficiary indexes independently", async () => {
    const mock = productionApp();
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    await pay.refreshStreams();

    expect(mock.readArray.mock.calls.map((call) => call[0])).toEqual([
      "getUserStreams",
      "getBeneficiaryStreams",
    ]);
    expect(pay.createdStreams.get().map((stream) => stream.id)).toEqual(["1"]);
    expect(pay.beneficiaryStreams.get().map((stream) => stream.id)).toEqual(["2"]);
    expect(pay.listSource.get()).toBe("chain");

    mock.address.set(null);
    await vi.waitFor(() => expect(pay.listSource.get()).toBe("none"));
    expect(pay.createdStreams.get()).toEqual([]);
    expect(pay.beneficiaryStreams.get()).toEqual([]);
    pay.cleanup();
  });

  it("uses the shared vesting surface for reads instead of the legacy contract", async () => {
    const mock = productionApp({ sharedVesting: true });
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    await pay.refreshStreams();

    expect(mock.platformVesting.getUserStreams).toHaveBeenCalled();
    expect(mock.platformVesting.getBeneficiaryStreams).toHaveBeenCalled();
    expect(mock.platformVesting.getStreamDetails).toHaveBeenCalled();
    expect(mock.readArray).not.toHaveBeenCalled();
    expect(mock.readRaw).not.toHaveBeenCalled();
    expect(pay.createdStreams.get().map((stream) => stream.id)).toEqual(["1"]);
    expect(pay.beneficiaryStreams.get().map((stream) => stream.id)).toEqual(["2"]);
    expect(pay.listSource.get()).toBe("chain");
    pay.cleanup();
  });

  it("creates through shared vesting with atomic native funding and durable confirmation", async () => {
    const mock = productionApp({ sharedVesting: true });
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    const result = await pay.createStream({
      recipient: BENEFICIARY,
      amount: "1",
      durationDays: "3",
      asset: "GAS",
      notes: "Quarterly grant",
    });

    expect(result.status).toBe("confirmed");
    expect(mock.platformVesting.createStream).toHaveBeenCalledWith(expect.objectContaining({
      beneficiary: BENEFICIARY,
      asset: "GAS",
      totalAmount: 100_000_000n,
      fundAmount: 100_000_000n,
    }));
    expect(mock.invokeMultiple).not.toHaveBeenCalled();
    expect(mock.invoke).not.toHaveBeenCalled();
    expect(pay.pendingOperation.get()).toBeNull();
    pay.cleanup();
  });

  it("routes shared beneficiary claims and creator cancellations without legacy invokes", async () => {
    const claimMock = productionApp({ sharedVesting: true });
    const claimPay = useNeoPayProduction({ app: claimMock.app, t: (key) => key });
    const claimResult = await claimPay.claimStream("2");
    expect(claimResult.status).toBe("confirmed");
    expect(claimMock.platformVesting.claimStream).toHaveBeenCalledWith(
      "2",
      CREATOR,
      expect.objectContaining({ waitForEvent: "StreamClaimed" }),
    );
    expect(claimMock.invoke).not.toHaveBeenCalled();
    claimPay.cleanup();

    const cancelMock = productionApp({ sharedVesting: true });
    const cancelPay = useNeoPayProduction({ app: cancelMock.app, t: (key) => key });
    const cancelResult = await cancelPay.cancelStream("1");
    expect(cancelResult.status).toBe("confirmed");
    expect(cancelMock.platformVesting.cancelStream).toHaveBeenCalledWith(
      "1",
      CREATOR,
      expect.objectContaining({ waitForEvent: "StreamCancelled" }),
    );
    expect(cancelMock.invoke).not.toHaveBeenCalled();
    cancelPay.cleanup();
  });

  it("recovers a shared pending claim from stream readback without replaying it", async () => {
    const pending: PendingNeoPayOperation = {
      version: 1,
      engine: "platform-vesting",
      kind: "claim",
      eventName: "StreamClaimed",
      network: "testnet",
      contractHash: "0x" + "ab".repeat(20),
      actorHash: CREATOR,
      txid: TXID,
      createdAt: 1,
      streamId: "2",
      beforeReleased: "100000000",
    };
    const mock = productionApp({ sharedVesting: true, initialPending: pending });
    mock.platformVesting.getStreamDetails.mockResolvedValue(rawStream({
      id: 2,
      creator: BENEFICIARY,
      beneficiary: CREATOR,
      releasedAmount: 175_000_000,
      remainingAmount: 125_000_000,
      claimable: 0,
    }));
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    const result = await pay.recoverPending();

    expect(result?.status).toBe("confirmed");
    expect(mock.platformVesting.claimStream).not.toHaveBeenCalled();
    expect(mock.invoke).not.toHaveBeenCalled();
    expect(mock.invokeMultiple).not.toHaveBeenCalled();
    expect(pay.pendingOperation.get()).toBeNull();
    pay.cleanup();
  });

  it("pages role history and preserves stream ids beyond Number precision", async () => {
    const mock = productionApp();
    const largeId = "900719925474099312345";
    mock.readArray.mockImplementation(async (operation: string, args?: Array<{ value: string }>) => {
      if (operation === "getBeneficiaryStreams") return [];
      const offset = String(args?.[1]?.value ?? "0");
      if (offset === "0") return Array.from({ length: 100 }, (_, index) => index + 1);
      if (offset === "100") return [largeId];
      return [];
    });
    mock.readRaw.mockImplementation(async (operation: string, args: Array<{ value: string }> = []) => {
      if (operation === "isPaused") return false;
      const id = String(args[0]?.value ?? "");
      return rawStream({ id, creator: CREATOR, beneficiary: BENEFICIARY });
    });
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    await pay.refreshStreams();

    expect(pay.createdStreams.get()).toHaveLength(101);
    expect(pay.createdStreams.get()[0]?.id).toBe(largeId);
    expect(mock.readArray.mock.calls.filter((call) => call[0] === "getUserStreams")
      .map((call) => call[1]?.[1]?.value)).toEqual(["0", "100"]);
    expect(pay.listSource.get()).toBe("chain");
    pay.cleanup();
  });

  it("confirms atomic create only after the exact event and strict stream readback", async () => {
    const mock = productionApp();
    prepareConfirmedCreate(mock);
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    const result = await pay.createStream({
      recipient: BENEFICIARY,
      amount: "1",
      durationDays: "3",
      asset: "GAS",
      notes: "Quarterly grant",
    });

    expect(result.status).toBe("confirmed");
    expect(mock.invokeMultiple.mock.calls[0]?.[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: "transfer", scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH }),
      expect.objectContaining({ operation: "createStream" }),
    ]));
    expect(mock.waitFor).toHaveBeenCalledWith(
      TXID,
      "StreamCreated",
      30_000,
    );
    expect(mock.persisted.get()).toBeNull();
    pay.cleanup();
  });

  it("does not open a wallet write when the canonical contract is paused", async () => {
    const mock = productionApp();
    mock.readRaw.mockImplementation(async (operation: string) => operation === "isPaused" ? true : {});
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    await expect(pay.createStream({
      recipient: BENEFICIARY,
      amount: "1",
      durationDays: "30",
      asset: "GAS",
      notes: "",
    })).rejects.toThrow("neoPayContractPaused");
    expect(mock.invokeMultiple).not.toHaveBeenCalled();
    pay.cleanup();
  });

  it("keeps wallet writes closed when the wallet network cannot be positively detected", async () => {
    const mock = productionApp({ detectNetwork: "unavailable" });
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    await expect(pay.createStream({
      recipient: BENEFICIARY,
      amount: "1",
      durationDays: "30",
      asset: "GAS",
      notes: "",
    })).rejects.toThrow("neoPayNetworkUnverified");
    expect(mock.readRaw).not.toHaveBeenCalledWith("isPaused", expect.anything(), expect.anything());
    expect(mock.invokeMultiple).not.toHaveBeenCalled();
    pay.cleanup();
  });

  it("rejects non-Boolean pause state instead of coercing a wrong ABI value", async () => {
    const mock = productionApp();
    mock.readRaw.mockImplementation(async (operation: string) => operation === "isPaused" ? "false" : {});
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    await expect(pay.createStream({
      recipient: BENEFICIARY,
      amount: "1",
      durationDays: "30",
      asset: "GAS",
      notes: "",
    })).rejects.toThrow("neoPayCriticalDataUnavailable");
    expect(mock.invokeMultiple).not.toHaveBeenCalled();
    pay.cleanup();
  });

  it("blocks wallet actions when the transaction journal cannot be read back", async () => {
    const mock = productionApp({ storageMode: "noop" });
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    expect(pay.recoveryStorageHealthy.get()).toBe(false);
    await expect(pay.createStream({
      recipient: BENEFICIARY,
      amount: "1",
      durationDays: "30",
      asset: "GAS",
      notes: "",
    })).rejects.toThrow("neoPayRecoveryStorageUnavailable");
    expect(mock.invokeMultiple).not.toHaveBeenCalled();
    pay.cleanup();
  });

  it("rejects silently truncated notes before opening the wallet", async () => {
    const mock = productionApp();
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    await expect(pay.createStream({
      recipient: BENEFICIARY,
      amount: "1",
      durationDays: "30",
      asset: "GAS",
      notes: "x".repeat(241),
    })).rejects.toThrow("neoPayNotesTooLong");
    expect(mock.invokeMultiple).not.toHaveBeenCalled();
    pay.cleanup();
  });

  it("revalidates the wallet after asynchronous chain preflight", async () => {
    const mock = productionApp();
    mock.readRaw.mockImplementation(async (operation: string) => {
      if (operation === "isPaused") {
        mock.address.set(BENEFICIARY);
        return false;
      }
      return {};
    });
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    await expect(pay.createStream({
      recipient: BENEFICIARY,
      amount: "1",
      durationDays: "30",
      asset: "GAS",
      notes: "",
    })).rejects.toThrow("neoPayWriteContextChanged");
    expect(mock.invokeMultiple).not.toHaveBeenCalled();
    pay.cleanup();
  });

  it("joins an exact duplicate action and rejects a conflicting wallet action", async () => {
    const mock = productionApp();
    let rejectInvoke!: (reason?: unknown) => void;
    mock.invokeMultiple.mockImplementation(() => new Promise((_resolve, reject) => {
      rejectInvoke = reject;
    }));
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });
    const input = {
      recipient: BENEFICIARY,
      amount: "1",
      durationDays: "30",
      asset: "GAS" as const,
      notes: "Payroll",
    };

    const first = pay.createStream(input);
    await vi.waitFor(() => expect(mock.invokeMultiple).toHaveBeenCalledTimes(1));
    const duplicate = pay.createStream(input);
    expect(duplicate).toBe(first);
    await expect(pay.createStream({ ...input, amount: "2" })).rejects.toThrow("neoPayOperationBusy");
    await expect(pay.cancelStream("1")).rejects.toThrow("neoPayOperationBusy");

    rejectInvoke(new Error("wallet closed"));
    await expect(first).rejects.toThrow("wallet closed");
    await expect(duplicate).rejects.toThrow("wallet closed");
    expect(mock.invokeMultiple).toHaveBeenCalledTimes(1);
    pay.cleanup();
  });

  it("keeps a verified broadcast pending when journal deletion is not durable", async () => {
    const mock = productionApp({ deletePendingNoop: true });
    prepareConfirmedCreate(mock);
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    const result = await pay.createStream({
      recipient: BENEFICIARY,
      amount: "1",
      durationDays: "3",
      asset: "GAS",
      notes: "Quarterly grant",
    });

    expect(result.status).toBe("pending");
    expect(pay.pendingOperation.get()?.txid).toBe(TXID);
    expect(pay.recoveryStorageHealthy.get()).toBe(false);
    pay.cleanup();
  });

  it("confirms creation when immutable readback matches even if the stream has already progressed", async () => {
    const mock = productionApp();
    prepareConfirmedCreate(mock, {
      releasedAmount: 100_000_000,
      remainingAmount: 0,
      status: "completed",
    });
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    const result = await pay.createStream({
      recipient: BENEFICIARY,
      amount: "1",
      durationDays: "3",
      asset: "GAS",
      notes: "Quarterly grant",
    });

    expect(result.status).toBe("confirmed");
    expect(result.stream?.status).toBe("completed");
    pay.cleanup();
  });

  it("confirms a beneficiary claim from its event and monotonic stream readback", async () => {
    const mock = productionApp();
    let detailReads = 0;
    mock.readRaw.mockImplementation(async (operation: string, args: Array<{ value: string }> = []) => {
      if (operation === "isPaused") return false;
      if (String(args[0]?.value ?? "") !== "2") return {};
      detailReads += 1;
      return rawStream({
        id: 2,
        creator: BENEFICIARY,
        beneficiary: CREATOR,
        releasedAmount: detailReads === 1 ? 100_000_000 : 175_000_000,
        remainingAmount: detailReads === 1 ? 200_000_000 : 125_000_000,
        claimable: detailReads === 1 ? 75_000_000 : 0,
      });
    });
    const event = {
      state: ["2", CREATOR, "75000000", "175000000"].map((value) => ({ value })),
    };
    mock.invoke.mockImplementation(async (
      _operation: string,
      _args: unknown[],
      options: { onTransactionSent?: (txid: string) => void },
    ) => {
      options.onTransactionSent?.(TXID);
      return { txid: TXID, success: true, verified: true, event };
    });
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    const result = await pay.claimStream("2");

    expect(result.status).toBe("confirmed");
    expect(result.stream?.releasedAmount).toBe(175_000_000n);
    expect(mock.invoke).toHaveBeenCalledWith(
      "claimStream",
      [{ type: "Hash160", value: CREATOR }, { type: "Integer", value: "2" }],
      expect.objectContaining({ scriptHash: "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e" }),
    );
    expect(pay.pendingOperation.get()).toBeNull();
    pay.cleanup();
  });

  it("confirms creator cancellation only after cancelled stream readback", async () => {
    const mock = productionApp();
    let detailReads = 0;
    mock.readRaw.mockImplementation(async (operation: string, args: Array<{ value: string }> = []) => {
      if (operation === "isPaused") return false;
      if (String(args[0]?.value ?? "") !== "1") return {};
      detailReads += 1;
      return rawStream({
        id: 1,
        creator: CREATOR,
        beneficiary: BENEFICIARY,
        remainingAmount: detailReads === 1 ? 200_000_000 : 0,
        claimable: detailReads === 1 ? 50_000_000 : 0,
        status: detailReads === 1 ? "active" : "cancelled",
      });
    });
    const event = {
      state: ["1", CREATOR, "200000000", "100000000"].map((value) => ({ value })),
    };
    mock.invoke.mockImplementation(async (
      _operation: string,
      _args: unknown[],
      options: { onTransactionSent?: (txid: string) => void },
    ) => {
      options.onTransactionSent?.(TXID);
      return { txid: TXID, success: true, verified: true, event };
    });
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    const result = await pay.cancelStream("1");

    expect(result.status).toBe("confirmed");
    expect(result.stream?.status).toBe("cancelled");
    expect(mock.invoke).toHaveBeenCalledWith(
      "cancelStream",
      [{ type: "Hash160", value: CREATOR }, { type: "Integer", value: "1" }],
      expect.objectContaining({ scriptHash: "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e" }),
    );
    pay.cleanup();
  });

  it("recovers an indexed claim without replaying the wallet operation", async () => {
    const pending: PendingNeoPayOperation = {
      version: 1,
      kind: "claim",
      eventName: "StreamClaimed",
      network: "testnet",
      contractHash: "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e",
      actorHash: CREATOR,
      txid: TXID,
      createdAt: 1,
      streamId: "2",
      beforeReleased: "100000000",
    };
    const mock = productionApp({ initialPending: pending });
    mock.readRaw.mockImplementation(async (operation: string, args: Array<{ value: string }> = []) => {
      if (operation === "isPaused") return false;
      if (String(args[0]?.value ?? "") !== "2") return {};
      return rawStream({
        id: 2,
        creator: BENEFICIARY,
        beneficiary: CREATOR,
        releasedAmount: 175_000_000,
        remainingAmount: 125_000_000,
        claimable: 0,
      });
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      result: {
        executions: [{
          vmstate: "HALT",
          notifications: [{
            contract: "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e",
            eventname: "StreamClaimed",
            state: {
              value: [
                { type: "Integer", value: "2" },
                { type: "Hash160", value: CREATOR },
                { type: "Integer", value: "75000000" },
                { type: "Integer", value: "175000000" },
              ],
            },
          }],
        }],
      },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    const result = await pay.recoverPending();

    expect(result?.status).toBe("confirmed");
    expect(mock.invoke).not.toHaveBeenCalled();
    expect(mock.invokeMultiple).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pay.pendingOperation.get()).toBeNull();
    pay.cleanup();
  });

  it("discards an old wallet list and reloads the newly connected wallet", async () => {
    const mock = productionApp();
    let releaseOldReads!: () => void;
    const oldReads = new Promise<void>((resolve) => { releaseOldReads = resolve; });
    mock.readArray.mockImplementation(async (operation: string, args?: Array<{ value: string }>) => {
      const actor = String(args?.[0]?.value ?? "");
      if (neoPayAccountMatches(actor, CREATOR)) {
        await oldReads;
        return operation === "getUserStreams" ? [1] : [];
      }
      if (neoPayAccountMatches(actor, BENEFICIARY)) {
        return operation === "getUserStreams" ? [3] : [];
      }
      return [];
    });
    mock.readRaw.mockImplementation(async (operation: string, args: Array<{ value: string }> = []) => {
      if (operation === "isPaused") return false;
      const id = String(args[0]?.value ?? "");
      if (id === "1") return rawStream({ id: 1, creator: CREATOR });
      if (id === "3") return rawStream({ id: 3, creator: BENEFICIARY, beneficiary: CREATOR });
      return {};
    });
    const pay = useNeoPayProduction({ app: mock.app, t: (key) => key });

    const firstLoad = pay.refreshStreams();
    await vi.waitFor(() => expect(mock.readArray).toHaveBeenCalled());
    mock.address.set(BENEFICIARY);
    releaseOldReads();
    await firstLoad;
    await vi.waitFor(() => expect(pay.createdStreams.get().map((stream) => stream.id)).toEqual(["3"]));
    expect(pay.createdStreams.get().some((stream) => stream.id === "1")).toBe(false);
    pay.cleanup();
  });
});
