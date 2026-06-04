import { describe, expect, it, vi } from "vitest";

import { useNeoPayApp } from "../../neo-pay/src/composables/useNeoPayApp";
import type { ChainService, ContractArg } from "../services/ChainService";
import { addressToScriptHash } from "../utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "../constants";
import type { StreamItem } from "../../neo-pay/src/types";

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
    depositStrandedRecoverable: "prepaid credit held, retry",
    streamListUnavailable: "The payment stream index could not be loaded right now.",
  };
  return messages[key] ?? key;
}

/**
 * Minimal ChainService stand-in. Records read/readArray/invoke calls so tests
 * can assert the direct-contract deposit + createStream argument shapes.
 */
function makeChain() {
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
    async (_op: string, _args?: ContractArg[], _opts?: unknown): Promise<unknown[]> => [],
  );

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => OWNER },
    invoke,
    read,
    readArray,
  } as unknown as ChainService & {
    invoke: typeof invoke;
    read: typeof read;
    readArray: typeof readArray;
  };
  return { chain, invoke, read, readArray };
}

function setup() {
  const { chain, invoke, read, readArray } = makeChain();
  const app = useNeoPayApp({ chain, t });
  return { app, chain, invoke, read, readArray };
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

describe("useNeoPayApp (direct contract)", () => {
  it("deposits then creates a GAS stream with base-unit (1e8) integers and the asset memo", async () => {
    const { app, invoke } = setup();

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
    const deposit = callFor(invoke, "transfer");
    expect(deposit).toBeTruthy();
    expect(deposit![1]).toEqual([
      { type: "Hash160", value: OWNER_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "200000000" },
      { type: "String", value: PAYMENT_MEMO },
    ]);
    expect(deposit![2]).toMatchObject({ scriptHash: GAS_HASH });

    // Step 2: createStream with base-unit integers, asset Hash160, actor-first.
    const create = callFor(invoke, "createStream");
    expect(create).toBeTruthy();
    const args = create![1] as ContractArg[];
    expect(args[0]).toEqual({ type: "Hash160", value: OWNER_HASH });
    expect(args[1]).toEqual({ type: "Hash160", value: BENEFICIARY_HASH });
    expect(args[2]).toEqual({ type: "Hash160", value: GAS_HASH });
    expect(args[3]).toEqual({ type: "Integer", value: "200000000" }); // total
    expect(args[4]).toEqual({ type: "Integer", value: "50000000" }); // rate 0.5 GAS
    expect(args[5]).toEqual({ type: "Integer", value: String(7 * 86400) }); // intervalSeconds
    expect(args[6]).toEqual({ type: "String", value: "Payroll stream" });

    // The deposit must precede createStream.
    const order = invoke.mock.calls.map((c) => c[0]);
    expect(order.indexOf("transfer")).toBeLessThan(order.indexOf("createStream"));
  });

  it("creates a NEO stream with the NEO token + integer count (no scaling)", async () => {
    const { app, invoke } = setup();

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

    const deposit = callFor(invoke, "transfer");
    // NEO is indivisible: 5 base units, NOT 5e8.
    expect(deposit![1]).toContainEqual({ type: "Integer", value: "5" });
    expect(deposit![2]).toMatchObject({ scriptHash: NEO_HASH });

    const create = callFor(invoke, "createStream");
    const args = create![1] as ContractArg[];
    expect(args[2]).toEqual({ type: "Hash160", value: NEO_HASH });
    expect(args[3]).toEqual({ type: "Integer", value: "5" }); // total
    expect(args[4]).toEqual({ type: "Integer", value: "1" }); // rate
    expect(args[5]).toEqual({ type: "Integer", value: "86400" }); // intervalSeconds
  });

  it("rejects fractional NEO amounts (NEO is indivisible)", async () => {
    const { app, invoke } = setup();

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
  });

  it("rejects a rate greater than the total before any chain call", async () => {
    const { app, invoke } = setup();

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
  });

  it("rejects an out-of-range interval before any chain call", async () => {
    const { app, invoke } = setup();

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
  });

  it("rejects a malformed beneficiary address before any chain call", async () => {
    const { app, invoke } = setup();

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
  });

  it("surfaces a prepaid-credit-held error if createStream fails after deposit", async () => {
    const { app, invoke } = setup();

    // Deposit succeeds, createStream throws — credit is held under the creator.
    invoke.mockImplementation(async (op: string) => {
      if (op === "createStream") throw new Error("on-chain revert");
      return { txid: "0xtx", success: true };
    });

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
    ).rejects.toThrow("prepaid credit held, retry");

    // The deposit transfer was still broadcast.
    expect(callFor(invoke, "transfer")).toBeTruthy();
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
});
