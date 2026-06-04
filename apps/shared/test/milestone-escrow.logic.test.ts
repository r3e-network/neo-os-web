import { describe, expect, it, vi } from "vitest";

import { useMilestoneEscrow } from "../../milestone-escrow/src/composables/useMilestoneEscrow";
import type { EscrowItem } from "../../milestone-escrow/src/pages/index/components/EscrowList";
import type { ChainService, ContractArg } from "../services/ChainService";
import { addressToScriptHash } from "../utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "../constants";

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const BENEFICIARY = "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq";
const CONTRACT = "0x442162de25008ac78d4cce62ed8d8a64401b7ece";

const OWNER_HASH = addressToScriptHash(OWNER);
const BENEFICIARY_HASH = addressToScriptHash(BENEFICIARY);
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const PAYMENT_MEMO = "miniapp-milestone-escrow:fund";

function t(key: string) {
  const messages: Record<string, string> = {
    invalidAmount: "Enter a valid amount",
    invalidAddress: "Invalid beneficiary address",
    milestoneLimit: "Milestones must be between 1 and 12",
    milestoneSumMismatch: "Milestone sum must equal total",
    minNeo: "Minimum escrow is 1 NEO",
    minGas: "Minimum escrow is 0.1 GAS",
    walletNotConnected: "Wallet not connected",
    contractMissing: "Contract address not configured",
    depositPrepaidNoEscrow: "funds prepaid, escrow not created",
    statusActive: "Active",
    statusCancelled: "Cancelled",
    statusCompleted: "Completed",
  };
  return messages[key] ?? key;
}

/**
 * Minimal ChainService stand-in. Records read/readArray/invoke calls so tests
 * can assert the direct-contract deposit + createEscrow argument shapes.
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
  const app = useMilestoneEscrow({ chain, t });
  app.setAddress(OWNER);
  return { app, chain, invoke, read, readArray };
}

function escrowItem(overrides: Partial<EscrowItem> = {}): EscrowItem {
  return {
    id: "1",
    creator: OWNER,
    beneficiary: BENEFICIARY,
    assetSymbol: "GAS",
    totalAmount: 10_000_000n,
    releasedAmount: 0n,
    status: "active",
    milestoneAmounts: [10_000_000n],
    milestoneApproved: [false],
    milestoneClaimed: [false],
    title: "Website delivery",
    notes: "Ship the UI",
    active: true,
    ...overrides,
  };
}

/** Find the recorded invoke call for an operation. */
function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((c) => c[0] === op);
}

describe("useMilestoneEscrow (direct contract)", () => {
  it("deposits then creates in GAS with base-unit (1e8) integers and the asset memo", async () => {
    const { app, invoke } = setup();

    await app.createEscrow({
      name: "Website delivery",
      beneficiary: BENEFICIARY,
      asset: "GAS",
      notes: "Frontend acceptance",
      milestones: [{ amount: "0.05" }, { amount: "0.05" }],
    });

    // Step 1: NEP-17 deposit transfer to the contract, targeting the GAS token
    // (scriptHash override), with the required memo. 0.05 + 0.05 = 0.1 GAS =
    // 10_000_000 base units.
    const deposit = callFor(invoke, "transfer");
    expect(deposit).toBeTruthy();
    expect(deposit![1]).toEqual([
      { type: "Hash160", value: OWNER_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "10000000" },
      { type: "String", value: PAYMENT_MEMO },
    ]);
    expect(deposit![2]).toMatchObject({ scriptHash: GAS_HASH });

    // Step 2: createEscrow with base-unit integers, asset Hash160, actor-first.
    const create = callFor(invoke, "createEscrow");
    expect(create).toBeTruthy();
    const args = create![1] as ContractArg[];
    expect(args[0]).toEqual({ type: "Hash160", value: OWNER_HASH });
    expect(args[1]).toEqual({ type: "Hash160", value: BENEFICIARY_HASH });
    expect(args[2]).toEqual({ type: "Hash160", value: GAS_HASH });
    expect(args[3]).toEqual({ type: "Integer", value: "10000000" });
    // milestoneAmounts is a nested Array<Integer> of base units.
    expect(args[4]).toEqual({
      type: "Array",
      value: [
        { type: "Integer", value: "5000000" },
        { type: "Integer", value: "5000000" },
      ],
    });
    expect(args[5]).toEqual({ type: "String", value: "Website delivery" });

    // The deposit must precede createEscrow.
    const order = invoke.mock.calls.map((c) => c[0]);
    expect(order.indexOf("transfer")).toBeLessThan(order.indexOf("createEscrow"));
  });

  it("creates a NEO escrow with the NEO token + integer count (no scaling)", async () => {
    const { app, invoke } = setup();

    await app.createEscrow({
      name: "NEO escrow",
      beneficiary: BENEFICIARY,
      asset: "NEO",
      notes: "",
      milestones: [{ amount: "2" }, { amount: "3" }],
    });

    const deposit = callFor(invoke, "transfer");
    // NEO is indivisible: 2 + 3 = 5 base units, NOT 5e8.
    expect(deposit![1]).toContainEqual({ type: "Integer", value: "5" });
    expect(deposit![2]).toMatchObject({ scriptHash: NEO_HASH });

    const create = callFor(invoke, "createEscrow");
    const args = create![1] as ContractArg[];
    expect(args[2]).toEqual({ type: "Hash160", value: NEO_HASH });
    expect(args[3]).toEqual({ type: "Integer", value: "5" });
    expect(args[4]).toEqual({
      type: "Array",
      value: [
        { type: "Integer", value: "2" },
        { type: "Integer", value: "3" },
      ],
    });
  });

  it("rejects fractional NEO amounts (NEO is indivisible)", async () => {
    const { app, invoke } = setup();

    await expect(
      app.createEscrow({
        name: "Frac",
        beneficiary: BENEFICIARY,
        asset: "NEO",
        notes: "",
        milestones: [{ amount: "1.5" }],
      }),
    ).rejects.toThrow("Enter a valid amount");

    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects a sub-minimum NEO escrow (< 1 NEO)", async () => {
    const { app, invoke } = setup();

    await expect(
      app.createEscrow({
        name: "Tiny NEO",
        beneficiary: BENEFICIARY,
        asset: "NEO",
        notes: "",
        milestones: [{ amount: "0" }],
      }),
    ).rejects.toThrow("Enter a valid amount");

    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects a sub-minimum GAS escrow (< 0.1 GAS)", async () => {
    const { app, invoke } = setup();

    await expect(
      app.createEscrow({
        name: "Tiny GAS",
        beneficiary: BENEFICIARY,
        asset: "GAS",
        notes: "",
        milestones: [{ amount: "0.05" }],
      }),
    ).rejects.toThrow("Minimum escrow is 0.1 GAS");

    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects invalid amounts before any chain call", async () => {
    const { app, invoke } = setup();

    await expect(
      app.createEscrow({
        name: "Bad",
        beneficiary: BENEFICIARY,
        asset: "GAS",
        notes: "",
        milestones: [{ amount: "-1" }],
      }),
    ).rejects.toThrow("Enter a valid amount");

    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects a malformed beneficiary address before any chain call", async () => {
    const { app, invoke } = setup();

    await expect(
      app.createEscrow({
        name: "Bad beneficiary",
        beneficiary: "not-a-neo-address",
        asset: "GAS",
        notes: "",
        milestones: [{ amount: "0.1" }],
      }),
    ).rejects.toThrow("Invalid beneficiary address");

    expect(invoke).not.toHaveBeenCalled();
  });

  it("surfaces a prepaid-credit-held error if createEscrow fails after deposit", async () => {
    const { app, invoke } = setup();

    // Deposit succeeds, createEscrow throws — credit is held under the creator.
    invoke.mockImplementation(async (op: string) => {
      if (op === "createEscrow") throw new Error("on-chain revert");
      return { txid: "0xtx", success: true };
    });

    await expect(
      app.createEscrow({
        name: "Will fail",
        beneficiary: BENEFICIARY,
        asset: "GAS",
        notes: "",
        milestones: [{ amount: "0.1" }],
      }),
    ).rejects.toThrow("funds prepaid, escrow not created");

    // The deposit transfer was still broadcast.
    expect(callFor(invoke, "transfer")).toBeTruthy();
  });

  it("approves with a 1-based milestone index and actor-first args", async () => {
    const { app, invoke } = setup();
    const active = escrowItem();

    // UI passes 0-based index; the contract call must be 1-based.
    await app.approveMilestone(active, 0);

    const call = callFor(invoke, "approveMilestone");
    expect(call![1]).toEqual([
      { type: "Hash160", value: OWNER_HASH },
      { type: "Integer", value: "1" },
      { type: "Integer", value: "1" }, // 0-based UI -> 1-based contract
    ]);
  });

  it("claims with a 1-based milestone index and the beneficiary first", async () => {
    const { app, invoke } = setup();
    const claimable = escrowItem({
      milestoneApproved: [true],
      milestoneClaimed: [false],
    });

    await app.claimMilestone(claimable, 0);

    const call = callFor(invoke, "claimMilestone");
    expect(call![1]).toEqual([
      { type: "Hash160", value: OWNER_HASH },
      { type: "Integer", value: "1" },
      { type: "Integer", value: "1" }, // 0-based UI -> 1-based contract
    ]);
  });

  it("cancels via cancelEscrow with the creator first", async () => {
    const { app, invoke } = setup();
    const cancellable = escrowItem({ id: "7" });

    await app.cancelEscrow(cancellable);

    const call = callFor(invoke, "cancelEscrow");
    expect(call![1]).toEqual([
      { type: "Hash160", value: OWNER_HASH },
      { type: "Integer", value: "7" },
    ]);
  });

  it("reads escrows by role and parses on-chain details into items", async () => {
    const { app, read, readArray } = setup();

    // Creator has escrow id 1; beneficiary list empty.
    readArray.mockImplementation(async (op: string) =>
      op === "getCreatorEscrows" ? [1] : [],
    );
    read.mockImplementation(async (_op: string, args?: ContractArg[]) => {
      const id = args?.[0]?.value;
      if (String(id) !== "1") return {};
      return {
        creator: OWNER_HASH,
        beneficiary: BENEFICIARY_HASH,
        assetSymbol: "GAS",
        totalAmount: 10_000_000,
        releasedAmount: 0,
        milestoneCount: 2,
        status: "active",
        title: "Website delivery",
        notes: "Acceptance",
        milestoneAmounts: [5_000_000, 5_000_000],
        milestoneApproved: [true, false],
        milestoneClaimed: [false, false],
      };
    });

    await app.refreshEscrows();

    const created = app.creatorEscrows.get();
    expect(created).toHaveLength(1);
    expect(created[0].id).toBe("1");
    expect(created[0].totalAmount).toBe(10_000_000n);
    expect(created[0].milestoneAmounts).toEqual([5_000_000n, 5_000_000n]);
    expect(created[0].milestoneApproved).toEqual([true, false]);
    expect(created[0].assetSymbol).toBe("GAS");

    // The creator read used getCreatorEscrows with the owner's script hash.
    const creatorRead = readArray.mock.calls.find((c) => c[0] === "getCreatorEscrows");
    expect(creatorRead![1]).toEqual([
      { type: "Hash160", value: OWNER_HASH },
      { type: "Integer", value: "0" },
      { type: "Integer", value: "200" },
    ]);
  });
});
