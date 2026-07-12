import { beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "@shared/react/context";
import { createMiniAppFramework } from "@shared/react";
import { GAS_HASH, getMiniAppContractHash } from "@shared/constants/rpc";
import { parseStackItem } from "@shared/utils/neo";
import type { ChainService, ContractArg, InvokeOptions, TxResult } from "../services/ChainService";
import {
  GAS_SPONSOR_PAYMENT_MEMO,
  gasSponsorAccountsMatch,
  isPendingGasSponsorOperation,
  parseGasSponsorPlatformStats,
  parseGasSponsorPool,
  type GasSponsorTransactionOutcome,
} from "../../gas-sponsor/src/gas-sponsor-chain";
import { useGasSponsorApp } from "../../gas-sponsor/src/composables/useGasSponsor";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const BOB = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const CONTRACT = getMiniAppContractHash("miniapp-gas-sponsor", "testnet");
const PAYMENT_TX = `0x${"a".repeat(64)}`;
const ACTION_TX = `0x${"b".repeat(64)}`;

function t(key: string) {
  return key;
}

function stats(totalPools = 1) {
  return {
    totalPools,
    activePools: totalPools,
    totalSponsored: String(totalPools * 100_000_000),
    totalClaimed: "0",
    totalSponsors: totalPools ? 1 : 0,
    totalBeneficiaries: 0,
    minSponsorship: "100000000",
    maxClaimPerTx: "10000000",
    defaultExpirySeconds: "2592000",
    topUpMin: "50000000",
    maxWhitelistSize: 100,
  };
}

function pool(id: number, overrides: Partial<Record<string, unknown>> = {}) {
  const created = Date.now() - 60_000;
  return {
    id,
    sponsor: ALICE,
    poolType: 1,
    initialAmount: "100000000",
    remainingAmount: "100000000",
    maxClaimPerUser: "10000000",
    totalClaimed: "0",
    claimCount: 0,
    createTime: created,
    expiryTime: created + 2_592_000,
    active: true,
    description: `Pool ${id}`,
    status: "active",
    ...overrides,
  };
}

function makeHarness(options: {
  totalPools?: number;
  failPoolId?: () => string;
  failWalletRead?: { value: boolean };
  poolReadGate?: (id: string) => Promise<void>;
  failAfterPayment?: { value: boolean };
  topUpReadbackMode?: "both" | "remaining-only" | "initial-only";
  claimEventState?: unknown[];
  transactionOutcome?: (txid: string) => GasSponsorTransactionOutcome;
} = {}) {
  const total = options.totalPools ?? 1;
  const poolRows = new Map<string, Record<string, unknown>>();
  for (let id = 1; id <= total; id += 1) poolRows.set(String(id), pool(id));
  let platform = stats(total);
  const claimedByPool = new Map<string, string>();
  const address = createObservable<string | null>(ALICE);
  const contractAddress = createObservable<string | null>(CONTRACT);

  const read = vi.fn(async (operation: string, args: ContractArg[] = []) => {
    if (operation === "getPlatformStats") return platform;
    if (operation === "getPoolCount") return platform.totalPools;
    if (operation === "getPoolDetails") {
      const id = String(args[0]?.value ?? "");
      await options.poolReadGate?.(id);
      if (options.failPoolId?.() === id) throw new Error("pool read unavailable");
      const value = poolRows.get(id);
      if (!value) throw new Error("unknown pool");
      return { ...value };
    }
    if (operation === "getUserClaimedFromPool") {
      return claimedByPool.get(String(args[1]?.value ?? "")) ?? "0";
    }
    if (operation === "balanceOf") return "900000000";
    throw new Error(`unexpected read ${operation}`);
  });

  const applyTopUp = (current: Record<string, unknown>, amount: bigint) => {
    const mode = options.topUpReadbackMode ?? "both";
    if (mode !== "remaining-only") {
      current.initialAmount = (BigInt(String(current.initialAmount)) + amount).toString();
    }
    if (mode !== "initial-only") {
      current.remainingAmount = (BigInt(String(current.remainingAmount)) + amount).toString();
    }
  };

  const invoke = vi.fn(async (
    operation: string,
    args: ContractArg[],
    invokeOptions?: InvokeOptions,
  ): Promise<TxResult> => {
    invokeOptions?.onTransactionSent?.(ACTION_TX);
    if (operation === "topUpPool") {
      const id = String(args[1]?.value);
      const amount = BigInt(String(args[2]?.value));
      const current = poolRows.get(id)!;
      applyTopUp(current, amount);
      return { txid: ACTION_TX, success: true, verified: true };
    }
    if (operation === "claimSponsorship") {
      const id = String(args[1]?.value);
      const amount = BigInt(String(args[2]?.value));
      const current = poolRows.get(id)!;
      current.remainingAmount = (BigInt(String(current.remainingAmount)) - amount).toString();
      current.totalClaimed = (BigInt(String(current.totalClaimed)) + amount).toString();
      current.claimCount = Number(current.claimCount) + 1;
      claimedByPool.set(id, (BigInt(claimedByPool.get(id) ?? "0") + amount).toString());
      return {
        txid: ACTION_TX,
        success: true,
        verified: true,
        event: {
          state: (options.claimEventState ?? [ALICE, amount.toString(), id])
            .map((value) => ({ value })),
        },
      };
    }
    throw new Error(`unexpected invoke ${operation}`);
  });

  const invokeWithPayment = vi.fn(async (
    amount: string,
    _memo: string,
    operation: string,
    args: ContractArg[],
    invokeOptions?: InvokeOptions,
  ): Promise<TxResult> => {
    invokeOptions?.onPaymentSent?.(PAYMENT_TX);
    if (options.failAfterPayment?.value) throw new Error("target was not broadcast");
    invokeOptions?.onTransactionSent?.(ACTION_TX);
    if (operation === "createPool") {
      const id = String(Number(platform.totalPools) + 1);
      poolRows.set(id, pool(Number(id), {
        sponsor: args[0]?.value,
        initialAmount: amount,
        remainingAmount: amount,
        maxClaimPerUser: args[2]?.value,
        description: args[4]?.value,
      }));
      platform = {
        ...platform,
        totalPools: Number(id),
        activePools: Number(platform.activePools) + 1,
        totalSponsored: (BigInt(String(platform.totalSponsored)) + BigInt(amount)).toString(),
      };
      return {
        txid: ACTION_TX,
        success: true,
        verified: true,
        event: {
          state: [
            { value: ALICE },
            { value: amount },
            { value: id },
            { value: "1" },
          ],
        },
      };
    }
    if (operation === "topUpPool") {
      const id = String(args[1]?.value);
      const topUp = BigInt(String(args[2]?.value));
      const current = poolRows.get(id)!;
      applyTopUp(current, topUp);
      return { txid: ACTION_TX, success: true, verified: true };
    }
    throw new Error(`unexpected paid invoke ${operation}`);
  });

  const ensureWallet = vi.fn(async () => ALICE);
  const chain = {
    address,
    contractAddress,
    ensureWallet,
    detectNetwork: vi.fn(async () => "testnet"),
    read,
    readArray: vi.fn(async (operation: string, args: ContractArg[] = []) => {
      const value = await read(operation, args);
      return Array.isArray(value) ? value : [value];
    }),
    invoke,
    invokeWithPayment,
    listEvents: vi.fn(async () => []),
  } as unknown as ChainService;

  const balance = {
    getBalance: vi.fn(async () => 9),
    getRawBalance: vi.fn(async () => {
      if (options.failWalletRead?.value) throw new Error("wallet balance unavailable");
      return 900_000_000n;
    }),
  };
  const app = createMiniAppFramework(
    {
      services: { chain, balance },
      t,
      launchContext: { network: "testnet" },
    } as never,
    { appId: "miniapp-gas-sponsor" },
  );
  const transactionOutcomeReader = vi.fn(async (_network: "mainnet" | "testnet", txid: string) =>
    options.transactionOutcome?.(txid) ?? { state: "halt", notifications: [] });
  const sponsor = useGasSponsorApp({ app, t, network: "testnet", transactionOutcomeReader });
  return {
    app,
    sponsor,
    read,
    invoke,
    invokeWithPayment,
    ensureWallet,
    poolRows,
    claimedByPool,
    transactionOutcomeReader,
    setPlatform(next: ReturnType<typeof stats>) {
      platform = next;
    },
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("Gas Sponsor v2 strict chain decoding", () => {
  it("parses the deployed millisecond expiry without turning it into 30 days", () => {
    const parsedStats = parseGasSponsorPlatformStats(stats(36), 123);
    expect(parsedStats.defaultExpiryMs).toBe(2_592_000);
    expect(parsedStats.loadedAtMs).toBe(123);

    const parsedPool = parseGasSponsorPool(pool(36, {
      createTime: 1_779_760_108_200,
      expiryTime: 1_779_762_700_200,
    }), "36", ALICE);
    expect(parsedPool.expiryTimeMs - parsedPool.createTimeMs).toBe(2_592_000);
    expect(parsedPool.isMine).toBe(true);
  });

  it("normalizes the deployed VM ByteString sponsor into canonical display-order Hash160", () => {
    const liveSponsor = parseStackItem({
      type: "ByteString",
      value: "ODf0EwY4dOXBDMmxnUaR3fZWBm0=",
    });
    const parsed = parseGasSponsorPool(pool(36, { sponsor: liveSponsor }), "36");
    expect(parsed.sponsor).toBe("0x6d0656f6dd91469db1c90cc1e574380613f43738");
    expect(gasSponsorAccountsMatch(parsed.sponsor, "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32")).toBe(true);
  });

  it("rejects malformed maps and corrupt durable pending values", () => {
    expect(() => parseGasSponsorPlatformStats({ ...stats(), totalPools: "1.5" })).toThrow();
    expect(() => parseGasSponsorPool({ ...pool(1), sponsor: "not-a-hash" }, "1")).toThrow();
    expect(isPendingGasSponsorOperation({ version: 2, poolId: "NaN" })).toBe(false);
    expect(gasSponsorAccountsMatch(ALICE, ALICE)).toBe(true);
  });
});

describe("Gas Sponsor v2 wallet-free pool desk", () => {
  it("loads newest pools in a bounded concurrent page without connecting a wallet", async () => {
    const h = makeHarness({ totalPools: 10 });
    h.app.chain.address.set(null);

    await h.sponsor.loadPlatform();

    expect(h.sponsor.platformStats.get()?.totalPools).toBe(10);
    expect(h.sponsor.pools.get().map((entry) => entry.id)).toEqual(["10", "9", "8", "7", "6", "5", "4", "3"]);
    expect(h.sponsor.hasMorePools.get()).toBe(true);
    expect(h.ensureWallet).not.toHaveBeenCalled();
  });

  it("keeps the last complete same-scope snapshot when one pool read fails", async () => {
    let failing = "";
    const h = makeHarness({ totalPools: 10, failPoolId: () => failing });
    await h.sponsor.loadPlatform();
    const beforeStats = h.sponsor.platformStats.get();
    const beforePools = h.sponsor.pools.get();

    h.setPlatform(stats(11));
    failing = "11";
    await h.sponsor.loadPlatform();

    expect(h.sponsor.platformStats.get()).toBe(beforeStats);
    expect(h.sponsor.pools.get()).toBe(beforePools);
    expect(h.sponsor.poolsError.get()).toContain("pool read unavailable");
  });

  it("derives ownership from the current wallet when a public page resolves late", async () => {
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const readStarted = new Promise<void>((resolve) => { started = resolve; });
    let announced = false;
    const h = makeHarness({
      poolReadGate: async () => {
        if (!announced) {
          announced = true;
          started();
        }
        await gate;
      },
    });

    const loading = h.sponsor.loadPlatform();
    await readStarted;
    h.app.chain.address.set(BOB);
    release();
    await loading;

    expect(h.sponsor.walletHash.get()).not.toBe("");
    expect(h.sponsor.pools.get()[0]?.isMine).toBe(false);
    expect(h.sponsor.selectedPool.get()?.isMine).toBe(false);
  });

  it("clears the previous wallet's known values when the new wallet read fails", async () => {
    const failWalletRead = { value: false };
    const h = makeHarness({ failWalletRead });
    await Promise.all([h.sponsor.loadPlatform(), h.sponsor.refreshWalletScope()]);
    expect(h.sponsor.walletGasBalanceKnown.get()).toBe(true);
    expect(h.sponsor.selectedPool.get()?.isMine).toBe(true);

    failWalletRead.value = true;
    h.app.chain.address.set(BOB);
    await h.sponsor.refreshWalletScope();

    expect(h.sponsor.walletAddress.get()).toBe(BOB);
    expect(h.sponsor.walletContextReady.get()).toBe(false);
    expect(h.sponsor.walletGasBalanceFixed8.get()).toBe("");
    expect(h.sponsor.walletGasBalanceKnown.get()).toBe(false);
    expect(h.sponsor.userClaimedFixed8.get()).toBe("");
    expect(h.sponsor.userClaimedKnown.get()).toBe(false);
    expect(h.sponsor.selectedPool.get()?.isMine).toBe(false);
  });
});

describe("Gas Sponsor v2 writes and recovery", () => {
  it("is ready to create from the visible 1 GAS preset after stats and wallet scope load", async () => {
    const h = makeHarness({ totalPools: 0 });
    await Promise.all([h.sponsor.loadPlatform(), h.sponsor.refreshWalletScope()]);

    expect(h.sponsor.createAmount.get()).toBe("1");
    expect(h.sponsor.createMaxClaim.get()).toBe("0.05");
    expect(h.sponsor.createDescription.get()).toBe("defaultPoolDescription");
    expect(h.sponsor.canCreate.get()).toBe(true);
  });

  it("creates a public pool with exact Fixed8/payment memo and clears pending only after event + readback", async () => {
    const h = makeHarness({ totalPools: 0 });
    await Promise.all([h.sponsor.loadPlatform(), h.sponsor.refreshWalletScope()]);
    h.sponsor.createAmount.set("1");
    h.sponsor.createMaxClaim.set("0.05");
    h.sponsor.createDescription.set("Neighbourhood refill");

    await h.sponsor.createPublicPool();

    expect(h.invokeWithPayment).toHaveBeenCalledWith(
      "100000000",
      GAS_SPONSOR_PAYMENT_MEMO,
      "createPool",
      [
        { type: "Hash160", value: expect.stringMatching(/^0x[0-9a-f]{40}$/) },
        { type: "Integer", value: "100000000" },
        { type: "Integer", value: "5000000" },
        { type: "Integer", value: "1" },
        { type: "String", value: "Neighbourhood refill" },
      ],
      expect.objectContaining({
        scriptHash: CONTRACT,
        waitForEvent: "SponsorshipCreated",
        onPaymentSent: expect.any(Function),
        onTransactionSent: expect.any(Function),
      }),
    );
    expect(h.sponsor.pendingOperation.get()).toBeNull();
    expect(h.sponsor.outcome.get()).toMatchObject({ status: "confirmed", operation: "create", poolId: "1" });
    expect(h.sponsor.selectedPool.get()?.description).toBe("Neighbourhood refill");
  });

  it("claims only a public active pool and verifies the exact beneficiary/amount/pool event", async () => {
    const h = makeHarness();
    await Promise.all([h.sponsor.loadPlatform(), h.sponsor.refreshWalletScope()]);
    await h.sponsor.selectPool("1");
    h.sponsor.claimAmount.set("0.05");

    await h.sponsor.claimFromSelectedPool();

    expect(h.invoke).toHaveBeenCalledWith(
      "claimSponsorship",
      [
        { type: "Hash160", value: expect.stringMatching(/^0x[0-9a-f]{40}$/) },
        { type: "Integer", value: "1" },
        { type: "Integer", value: "5000000" },
      ],
      expect.objectContaining({ waitForEvent: "SponsorshipClaimed" }),
    );
    expect(h.sponsor.userClaimedFixed8.get()).toBe("5000000");
    expect(h.sponsor.pendingOperation.get()).toBeNull();
    expect(h.sponsor.outcome.get().status).toBe("confirmed");
  });

  it("keeps an exact transaction pending when its claim event contradicts the requested amount", async () => {
    const h = makeHarness({ claimEventState: [ALICE, "4000000", "1"] });
    await Promise.all([h.sponsor.loadPlatform(), h.sponsor.refreshWalletScope()]);
    await h.sponsor.selectPool("1");
    h.sponsor.claimAmount.set("0.05");

    await h.sponsor.claimFromSelectedPool();

    expect(h.sponsor.pendingOperation.get()).toMatchObject({
      kind: "claim",
      phase: "target-broadcast",
      amountRaw: "5000000",
      txid: ACTION_TX,
    });
    expect(h.sponsor.outcome.get()).toMatchObject({ status: "unknown", operation: "claim" });
  });

  it("recovers a payment-phase top-up by resuming only the target call, never transferring twice", async () => {
    const failAfterPayment = { value: true };
    const h = makeHarness({
      failAfterPayment,
      transactionOutcome: (txid) => txid === PAYMENT_TX
        ? {
            state: "halt",
            notifications: [{
              contract: GAS_HASH,
              eventName: "Transfer",
              state: [ALICE, CONTRACT, "50000000"],
            }],
          }
        : { state: "halt", notifications: [] },
    });
    await Promise.all([h.sponsor.loadPlatform(), h.sponsor.refreshWalletScope()]);
    await h.sponsor.selectPool("1");
    h.sponsor.topUpAmount.set("0.5");

    await h.sponsor.topUpSelectedPool();
    expect(h.sponsor.pendingOperation.get()).toMatchObject({ phase: "payment-broadcast", paymentTxid: PAYMENT_TX });
    expect(h.sponsor.canResumePending.get()).toBe(false);
    expect(h.invokeWithPayment).toHaveBeenCalledTimes(1);

    failAfterPayment.value = false;
    await expect(h.sponsor.recoverPendingOperation()).resolves.toMatchObject({ status: "resume" });
    expect(h.sponsor.pendingOperation.get()).toMatchObject({ phase: "payment-confirmed" });
    expect(h.sponsor.canResumePending.get()).toBe(true);
    await h.sponsor.resumePendingAction();

    expect(h.invokeWithPayment).toHaveBeenCalledTimes(1);
    expect(h.invoke).toHaveBeenCalledWith(
      "topUpPool",
      [
        { type: "Hash160", value: expect.stringMatching(/^0x[0-9a-f]{40}$/) },
        { type: "Integer", value: "1" },
        { type: "Integer", value: "50000000" },
      ],
      expect.objectContaining({ onTransactionSent: expect.any(Function) }),
    );
    expect(h.sponsor.pendingOperation.get()).toBeNull();
    expect(h.sponsor.outcome.get()).toMatchObject({ status: "confirmed", operation: "topUp" });
    expect(h.sponsor.selectedPool.get()?.remainingAmountRaw).toBe("150000000");
  });

  it("blocks an expired pool before any top-up payment can be broadcast", async () => {
    const h = makeHarness();
    const expired = h.poolRows.get("1")!;
    expired.expiryTime = Date.now() - 1;
    expired.active = true;
    await Promise.all([h.sponsor.loadPlatform(), h.sponsor.refreshWalletScope()]);
    await h.sponsor.selectPool("1");

    expect(h.sponsor.canTopUp.get()).toBe(false);
    await expect(h.sponsor.topUpSelectedPool()).rejects.toThrow("sponsorTopUpInvalid");
    expect(h.invokeWithPayment).not.toHaveBeenCalled();
    expect(h.sponsor.pendingOperation.get()).toBeNull();
  });

  it("keeps a top-up pending when either authoritative balance field misses the exact delta", async () => {
    const h = makeHarness({ topUpReadbackMode: "remaining-only" });
    await Promise.all([h.sponsor.loadPlatform(), h.sponsor.refreshWalletScope()]);
    await h.sponsor.selectPool("1");
    h.sponsor.topUpAmount.set("0.5");

    await h.sponsor.topUpSelectedPool();

    expect(h.sponsor.pendingOperation.get()).toMatchObject({
      kind: "topUp",
      phase: "target-broadcast",
      amountRaw: "50000000",
    });
    expect(h.sponsor.outcome.get()).toMatchObject({ status: "unknown", operation: "topUp" });
  });
});
