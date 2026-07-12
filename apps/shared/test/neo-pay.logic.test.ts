import { describe, expect, it, vi } from "vitest";

import { useNeoPayApp, deriveSchedule } from "../composables/neo-pay";
import { createMiniAppFramework } from "../react";
import type { ChainService, ContractArg } from "../services/ChainService";
import { addressToScriptHash } from "../utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "../constants";
import type { StreamItem } from "../composables/neo-pay";

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const BENEFICIARY = "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq";
const CONTRACT = "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e";

const OWNER_HASH = addressToScriptHash(OWNER);
const BENEFICIARY_HASH = addressToScriptHash(BENEFICIARY);
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const PAYMENT_MEMO = "miniapp-neo-pay:fund";

function t(key: string) {
  const messages: Record<string, string> = {
    invalidAmount: "Enter a valid amount",
    invalidAddress: "Invalid beneficiary address",
    intervalInvalid: "Interval out of range",
    rateTooHigh: "Release amount exceeds total",
    walletNotConnected: "Wallet not connected",
    contractMissing: "Contract address not configured",
    streamListUnavailable: "The payment stream index could not be loaded right now.",
    streamActionUnavailable: "The stream action could not be completed right now.",
  };
  return messages[key] ?? key;
}

/**
 * Minimal ChainService stand-in. Records read/readArray/invoke/invokeMultiple
 * calls so tests can assert the atomic deposit + createStream transaction.
 */
function makeChain() {
  let batchSubmitted = false;
  const invoke = vi.fn(
    async (_op: string, _args: ContractArg[], _opts?: unknown): Promise<unknown> => ({
      txid: "0xtx",
      success: true,
    }),
  );
  const read = vi.fn(
    async (_op: string, _args?: ContractArg[], _opts?: unknown): Promise<unknown> => ({}),
  );
  const readArray = vi.fn(
    async (op: string, _args?: ContractArg[], _opts?: unknown): Promise<unknown[]> =>
      op === "getUserStreams" && batchSubmitted ? ["1"] : [],
  );
  const invokeMultiple = vi.fn(
    async (_calls: unknown[], _opts?: unknown): Promise<unknown> => {
      batchSubmitted = true;
      return {
        txid: "0xbatch",
        success: true,
        verified: true,
      };
    },
  );

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => OWNER },
    invoke,
    invokeMultiple,
    read,
    readArray,
  } as unknown as ChainService & {
    invoke: typeof invoke;
    invokeMultiple: typeof invokeMultiple;
    read: typeof read;
    readArray: typeof readArray;
  };
  return { chain, invoke, invokeMultiple, read, readArray };
}

function setup() {
  const { chain, invoke, invokeMultiple, read, readArray } = makeChain();
  // The composable consumes the framework SDK for every chain/arg/amount
  // touchpoint (incl. app.chain.readArray). Build the framework from the same
  // mock chain so recorded read/readArray/invoke calls are byte-identical.
  const framework = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-neo-pay" },
  );
  const app = useNeoPayApp({ app: framework, t });
  return { app, framework, chain, invoke, invokeMultiple, read, readArray };
}

function streamItem(overrides: Partial<StreamItem> = {}): StreamItem {
  return {
    id: "1",
    creator: OWNER,
    beneficiary: BENEFICIARY,
    asset: GAS_HASH,
    assetSymbol: "GAS",
    totalAmount: 200_000_000n,
    releasedAmount: 0n,
    remainingAmount: 200_000_000n,
    rateAmount: 100_000_000n,
    intervalSeconds: 86_400n,
    intervalDays: 1,
    status: "active",
    claimable: 0n,
    title: "Payroll",
    notes: "Monthly",
    ...overrides,
  };
}

/** Find the recorded invoke call for an operation. */
function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((c) => c[0] === op);
}

function batchCallFor(invokeMultiple: ReturnType<typeof vi.fn>, op: string) {
  const calls = (invokeMultiple.mock.calls[0]?.[0] ?? []) as Array<{
    scriptHash?: string;
    operation: string;
    args: ContractArg[];
  }>;
  return calls.find((call) => call.operation === op);
}

describe("useNeoPayApp (direct contract)", () => {
  it("atomically funds and creates a GAS stream with base-unit integers and the asset memo", async () => {
    const { app, invoke, invokeMultiple } = setup();

    // 2 GAS total, 0.5 GAS per day over a 7-day interval-days choice.
    await app.handleCreateVault({
      name: "Payroll stream",
      beneficiary: BENEFICIARY,
      asset: "GAS",
      total: "2",
      rate: "0.5",
      intervalDays: "7",
      notes: "Engineering payroll",
    });

    // Step 1: NEP-17 deposit transfer to the contract, targeting the GAS token
    // (scriptHash override), with the required memo. 2 GAS = 200_000_000 base.
    const deposit = batchCallFor(invokeMultiple, "transfer");
    expect(deposit).toBeTruthy();
    expect(deposit!.args).toEqual([
      { type: "Hash160", value: OWNER_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "200000000" },
      { type: "String", value: PAYMENT_MEMO },
    ]);
    expect(deposit!.scriptHash).toBe(GAS_HASH);

    // Step 2: createStream with base-unit integers, asset Hash160, actor-first.
    const create = batchCallFor(invokeMultiple, "createStream");
    expect(create).toBeTruthy();
    const args = create!.args;
    expect(args[0]).toEqual({ type: "Hash160", value: OWNER_HASH });
    expect(args[1]).toEqual({ type: "Hash160", value: BENEFICIARY_HASH });
    expect(args[2]).toEqual({ type: "Hash160", value: GAS_HASH });
    expect(args[3]).toEqual({ type: "Integer", value: "200000000" }); // total
    expect(args[4]).toEqual({ type: "Integer", value: "50000000" }); // rate 0.5 GAS
    expect(args[5]).toEqual({ type: "Integer", value: String(7 * 86400) }); // intervalSeconds
    expect(args[6]).toEqual({ type: "String", value: "Payroll stream" });

    // Both scripts ride one transaction, in deposit-before-create order.
    const order = (invokeMultiple.mock.calls[0]?.[0] as Array<{ operation: string }>).map((call) => call.operation);
    expect(order).toEqual(["transfer", "createStream"]);
    expect(invokeMultiple.mock.calls[0]?.[1]).toMatchObject({
      signers: [{ account: OWNER, scopes: 1 }],
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("creates a NEO stream with the NEO token + integer count (no scaling)", async () => {
    const { app, invokeMultiple } = setup();

    // 5 NEO total, 1 NEO per day.
    await app.handleCreateVault({
      name: "NEO stream",
      beneficiary: BENEFICIARY,
      asset: "NEO",
      total: "5",
      rate: "1",
      intervalDays: "1",
      notes: "",
    });

    const deposit = batchCallFor(invokeMultiple, "transfer");
    // NEO is indivisible: 5 base units, NOT 5e8.
    expect(deposit!.args).toContainEqual({ type: "Integer", value: "5" });
    expect(deposit!.scriptHash).toBe(NEO_HASH);

    const create = batchCallFor(invokeMultiple, "createStream");
    const args = create!.args;
    expect(args[2]).toEqual({ type: "Hash160", value: NEO_HASH });
    expect(args[3]).toEqual({ type: "Integer", value: "5" }); // total
    expect(args[4]).toEqual({ type: "Integer", value: "1" }); // rate
    expect(args[5]).toEqual({ type: "Integer", value: "86400" }); // intervalSeconds
  });

  it("rejects fractional NEO amounts (NEO is indivisible)", async () => {
    const { app, invoke, invokeMultiple } = setup();

    await expect(
      app.handleCreateVault({
        name: "Frac",
        beneficiary: BENEFICIARY,
        asset: "NEO",
        total: "1.5",
        rate: "1",
        intervalDays: "1",
        notes: "",
      }),
    ).rejects.toThrow("Enter a valid amount");

    expect(invoke).not.toHaveBeenCalled();
    expect(invokeMultiple).not.toHaveBeenCalled();
  });

  it("rejects a rate greater than the total before any chain call", async () => {
    const { app, invoke, invokeMultiple } = setup();

    await expect(
      app.handleCreateVault({
        name: "Too fast",
        beneficiary: BENEFICIARY,
        asset: "GAS",
        total: "1",
        rate: "2",
        intervalDays: "1",
        notes: "",
      }),
    ).rejects.toThrow("Release amount exceeds total");

    expect(invoke).not.toHaveBeenCalled();
    expect(invokeMultiple).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range interval before any chain call", async () => {
    const { app, invoke, invokeMultiple } = setup();

    await expect(
      app.handleCreateVault({
        name: "Bad interval",
        beneficiary: BENEFICIARY,
        asset: "GAS",
        total: "1",
        rate: "1",
        intervalDays: "0",
        notes: "",
      }),
    ).rejects.toThrow("Interval out of range");

    expect(invoke).not.toHaveBeenCalled();
    expect(invokeMultiple).not.toHaveBeenCalled();
  });

  it("rejects a malformed beneficiary address before any chain call", async () => {
    const { app, invoke, invokeMultiple } = setup();

    await expect(
      app.handleCreateVault({
        name: "Bad beneficiary",
        beneficiary: "not-a-neo-address",
        asset: "GAS",
        total: "1",
        rate: "1",
        intervalDays: "1",
        notes: "",
      }),
    ).rejects.toThrow("Invalid beneficiary address");

    expect(invoke).not.toHaveBeenCalled();
    expect(invokeMultiple).not.toHaveBeenCalled();
  });

  it("keeps funding and creation atomic when the batch faults", async () => {
    const { app, invoke, invokeMultiple } = setup();
    invokeMultiple.mockRejectedValue(new Error("on-chain revert"));

    await expect(
      app.handleCreateVault({
        name: "Will fail",
        beneficiary: BENEFICIARY,
        asset: "GAS",
        total: "1",
        rate: "1",
        intervalDays: "1",
        notes: "",
      }),
    ).rejects.toThrow("on-chain revert");

    expect(invokeMultiple).toHaveBeenCalledTimes(1);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects an empty batch result instead of claiming the stream was created", async () => {
    const { app, invokeMultiple } = setup();
    invokeMultiple.mockResolvedValue({ txid: "", success: false, verified: false });

    await expect(
      app.handleCreateVault({
        name: "No broadcast",
        beneficiary: BENEFICIARY,
        asset: "GAS",
        total: "1",
        rate: "1",
        intervalDays: "1",
        notes: "",
      }),
    ).rejects.toThrow("The stream action could not be completed right now.");
  });

  it("persists an unknown confirmation and blocks duplicate funding on retry", async () => {
    const { app, framework, invokeMultiple, readArray } = setup();
    readArray.mockResolvedValue([]);
    vi.spyOn(framework.chain, "waitForState").mockResolvedValue(null);

    const form = {
      name: "Pending",
      beneficiary: BENEFICIARY,
      asset: "GAS",
      total: "1",
      rate: "1",
      intervalDays: "1",
      notes: "",
    };

    await expect(app.handleCreateVault(form)).rejects.toThrow("streamConfirmationPending");
    expect(app.pendingCreateTxid.get()).toBe("0xbatch");
    expect(invokeMultiple).toHaveBeenCalledTimes(1);

    await expect(app.handleCreateVault(form)).rejects.toThrow("streamConfirmationPending");
    expect(invokeMultiple).toHaveBeenCalledTimes(1);

    localStorage.removeItem("neo:miniapp-neo-pay:pending-create");
  });

  it("claims with the beneficiary witness first (actor-first)", async () => {
    const { app, invoke } = setup();

    await app.claimStream(streamItem({ id: "9" }));

    const call = callFor(invoke, "claimStream");
    expect(call![1]).toEqual([
      { type: "Hash160", value: OWNER_HASH },
      { type: "Integer", value: "9" },
    ]);
  });

  it("cancels with the creator witness first (actor-first)", async () => {
    const { app, invoke } = setup();

    await app.cancelStream(streamItem({ id: "7" }));

    const call = callFor(invoke, "cancelStream");
    expect(call![1]).toEqual([
      { type: "Hash160", value: OWNER_HASH },
      { type: "Integer", value: "7" },
    ]);
  });

  it("reads streams by role and parses on-chain detail Maps into items", async () => {
    const { app, read, readArray } = setup();

    // Creator owns stream id 1; beneficiary list empty.
    readArray.mockImplementation(async (op: string) =>
      op === "getUserStreams" ? [1] : [],
    );
    read.mockImplementation(async (_op: string, args?: ContractArg[]) => {
      const id = args?.[0]?.value;
      if (String(id) !== "1") return {};
      return {
        creator: OWNER_HASH,
        beneficiary: BENEFICIARY_HASH,
        assetSymbol: "GAS",
        totalAmount: 200_000_000,
        claimedAmount: 50_000_000,
        rateAmount: 100_000_000,
        intervalSeconds: 86_400,
        status: "active",
        title: "Payroll May",
        notes: "Engineering",
      };
    });

    await app.refreshStreams();

    const created = app.createdStreams.get();
    expect(created).toHaveLength(1);
    expect(created[0].id).toBe("1");
    expect(created[0].assetSymbol).toBe("GAS");
    expect(created[0].totalAmount).toBe(200_000_000n);
    // claimedAmount maps onto releasedAmount.
    expect(created[0].releasedAmount).toBe(50_000_000n);
    expect(created[0].remainingAmount).toBe(150_000_000n);
    expect(created[0].rateAmount).toBe(100_000_000n);
    expect(created[0].intervalSeconds).toBe(86_400n);
    expect(created[0].intervalDays).toBe(1);
    expect(created[0].title).toBe("Payroll May");

    // The creator read used getUserStreams with the owner's script hash + range.
    const creatorRead = readArray.mock.calls.find((c) => c[0] === "getUserStreams");
    expect(creatorRead![1]).toEqual([
      { type: "Hash160", value: OWNER_HASH },
      { type: "Integer", value: "0" },
      { type: "Integer", value: "200" },
    ]);
  });

  it("keeps the workspace usable and posts a notice when reads fail", async () => {
    const { app, readArray } = setup();

    readArray.mockImplementation(async () => {
      throw new Error("index unreachable");
    });

    await expect(app.loadAll()).resolves.toBeUndefined();
    expect(app.createdStreams.get()).toEqual([]);
    expect(app.beneficiaryStreams.get()).toEqual([]);
    expect(app.serviceNotice.get()).toBe(
      "The payment stream index could not be loaded right now.",
    );
  });

  it("tracks creation with a dedicated isCreating flag, leaving isLoading for the list spinners", async () => {
    const { app, invokeMultiple, readArray } = setup();

    // isCreating must flip true during the create flow and back to false after,
    // without ever touching isLoading (which drives the created/incoming list
    // spinners — those must NOT flash while a stream is being created).
    let sawCreatingDuringInvoke = false;
    invokeMultiple.mockImplementation(async () => {
      if (app.isCreating.get()) sawCreatingDuringInvoke = true;
      expect(app.isLoading.get()).toBe(false);
      readArray.mockResolvedValue(["1"]);
      return { txid: "0xbatch", success: true, verified: true };
    });

    expect(app.isCreating.get()).toBe(false);
    await app.handleCreateVault({
      name: "Payroll",
      beneficiary: BENEFICIARY,
      asset: "GAS",
      total: "2",
      rate: "0.5",
      intervalDays: "7",
      notes: "",
    });

    expect(sawCreatingDuringInvoke).toBe(true);
    expect(app.isCreating.get()).toBe(false);
    expect(app.isLoading.get()).toBe(false);
  });
});

/**
 * deriveSchedule turns the PlayArea form (total + duration in days) into the
 * contract's per-interval rate. The historical bug: GAS rates that don't divide
 * evenly produced a 17-digit float string (e.g. 5/30 -> "0.16666666666666666")
 * that the 8-decimal amount validator rejected, so "Create Stream" failed
 * before any deposit fired. The rate must always be representable as <=8 GAS
 * decimals and survive a round-trip through handleCreateVault.
 */
describe("deriveSchedule (form -> contract rate)", () => {
  // Mirror of the composable's GAS validator: rate strings must satisfy this to
  // be accepted by toBaseUnits (and therefore not abort the create flow).
  const GAS_RATE_RE = /^\d+(\.\d{1,8})?$/;

  it("quantizes a non-evenly-dividing GAS rate to <=8 decimals (5 GAS / 30 days)", () => {
    const { rate, intervalDays } = deriveSchedule("5", "30", "GAS");
    // String(5 / 30) === "0.16666666666666666" (17 digits) would be rejected.
    expect(rate).toBe("0.16666667");
    expect(rate).toMatch(GAS_RATE_RE);
    expect(intervalDays).toBe("1");
    expect(Number.parseFloat(rate)).toBeGreaterThan(0);
  });

  it("quantizes the manifest placeholder (0.03 GAS / 7 days) to a valid rate", () => {
    const { rate } = deriveSchedule("0.03", "7", "GAS");
    // 0.03 / 7 === 0.004285714285714286 — must round to 8 dp, not stringify raw.
    expect(rate).toBe("0.00428571");
    expect(rate).toMatch(GAS_RATE_RE);
    expect(Number.parseFloat(rate)).toBeGreaterThan(0);
  });

  it("keeps an evenly-dividing GAS rate exact", () => {
    const { rate, intervalDays } = deriveSchedule("2", "4", "GAS");
    expect(rate).toBe("0.50000000");
    expect(rate).toMatch(GAS_RATE_RE);
    expect(intervalDays).toBe("1");
  });

  it("collapses sub-1-NEO/day into a single full-duration interval", () => {
    // 5 NEO / 30 days truncates to 0/day, so release all 5 at the 30-day horizon.
    const { rate, intervalDays } = deriveSchedule("5", "30", "NEO");
    expect(rate).toBe("5");
    expect(intervalDays).toBe("30");
  });

  it("uses an integer per-day NEO rate when total >= days", () => {
    const { rate, intervalDays } = deriveSchedule("30", "10", "NEO");
    expect(rate).toBe("3");
    expect(intervalDays).toBe("1");
  });

  it("does not truncate fractional NEO into a valid schedule", () => {
    const { rate, intervalDays } = deriveSchedule("1.5", "10", "NEO");
    expect(rate).toBe("0");
    expect(intervalDays).toBe("1");
  });
});

/**
 * End-to-end guard for the high-severity bug: feeding deriveSchedule's output
 * into handleCreateVault for the previously-broken 5 GAS / 30 days case must
 * deposit + createStream with valid base-unit integers (no invalidAmount abort).
 */
describe("create flow accepts derived GAS rates (regression)", () => {
  it("creates a 5 GAS / 30 day stream via the derived rate without rejecting", async () => {
    const { app, invokeMultiple } = setup();

    const { rate, intervalDays } = deriveSchedule("5", "30", "GAS");
    await app.handleCreateVault({
      name: "Payroll",
      beneficiary: BENEFICIARY,
      asset: "GAS",
      total: "5",
      rate,
      intervalDays,
      notes: "",
    });

    const deposit = batchCallFor(invokeMultiple, "transfer");
    expect(deposit).toBeTruthy();
    // 5 GAS = 500_000_000 base units.
    expect(deposit!.args).toContainEqual({ type: "Integer", value: "500000000" });

    const create = batchCallFor(invokeMultiple, "createStream");
    expect(create).toBeTruthy();
    const args = create!.args;
    expect(args[3]).toEqual({ type: "Integer", value: "500000000" }); // total
    // 0.16666667 GAS rate -> 16666667 base units (no float-string rejection).
    expect(args[4]).toEqual({ type: "Integer", value: "16666667" });
    expect(args[5]).toEqual({ type: "Integer", value: String(86400) }); // 1-day interval
  });
});
