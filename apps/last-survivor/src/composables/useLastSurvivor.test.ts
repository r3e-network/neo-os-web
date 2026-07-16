import { describe, expect, it, vi } from "vitest";
import { useLastSurvivor } from "./useLastSurvivor";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const PLAYER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const PLAYER_HASH = addressToScriptHash(PLAYER);
const CONTRACT = "0xff122a6cf7f22a88d059d61a9d9c07e84a2b56b9";
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const BUY_MEMO = "miniapp-lastsurvivor:buy";
const ZERO_HASH = "0x0000000000000000000000000000000000000000";
const TX_BUY = `0x${"b0".repeat(32)}`;
const TX_BATCH = `0x${"ba".repeat(32)}`;
const TX_TRANSFER = `0x${"c1".repeat(32)}`;
const TX_SETTLE = `0x${"d2".repeat(32)}`;
const TX_WITHDRAW = `0x${"e3".repeat(32)}`;

const t = (key: string, params?: Record<string, string | number>) => {
  const messages: Record<string, string> = {
    invalidKeyCount: "Invalid key count",
    maxKeyCountExceeded: "Maximum 1000 keys per transaction",
    walletNotConnected: "Connect your wallet to play",
    missingContract: "Contract not configured",
    settleBeforeBuy: "Settle the round first",
    keyPurchaseDepositHeld: "Deposit held — try again",
    keyPurchasePending: "Purchase confirmation pending",
    keyDepositConfirmationPending: "Deposit confirmation pending — refresh credit",
    settlementConfirmationPending: "Settlement confirmation pending — refresh round",
    settlementNotReady: "Countdown still running",
    withdrawConfirmationPending: "Withdrawal confirmation pending — refresh credit",
    creditReadUnavailable: "Prepaid credit could not be verified",
    noCredit: "No prepaid credit to withdraw",
    roundStateUnavailable: "Round state unavailable",
    contractUpgradeRequired: "Legacy payout contract; purchases paused",
    recoveryStorageUnavailable: "Recovery storage unavailable",
    recoveryStorageUnavailableAfterBroadcast: "Transaction {txid} broadcast; recovery storage unavailable",
    transactionFault: "Transaction faulted",
    transactionEventMismatch: "Transaction event mismatch",
    recoveryRecordInvalid: "Recovery record invalid",
    transactionRecoveryPending: "Transaction recovery pending",
    transactionRecoveryStillPending: "Transaction recovery still pending",
    transactionRecoveryConfirmed: "Transaction recovery confirmed",
    pendingWriteMustResolve: "Resolve the pending transaction first",
    chainBindingMismatch: "Chain binding mismatch",
    walletBindingMismatch: "Wallet binding mismatch",
    contractReadUnavailable: "Contract read unavailable",
    keyQuoteUnavailable: "Live key quote unavailable",
    operationBusy: "Arena busy",
    notAvailable: "N/A",
    tokenGas: "GAS",
  };
  let out = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) out = out.replace(`{${k}}`, String(v));
  return out;
};

/** A live current round: active, with one key already sold and a running clock. */
function liveRound(overrides: Record<string, unknown> = {}) {
  return {
    roundId: "1",
    pot: "20000000", // 0.2 GAS in base units
    totalKeys: "1",
    lastBuyer: PLAYER_HASH,
    endTime: String(Date.now() + 3600_000),
    settled: false,
    active: true,
    remainingTime: "3600",
    ...overrides,
  };
}

function endedRound(overrides: Record<string, unknown> = {}) {
  return liveRound({
    endTime: String(Date.now() - 1_000),
    active: false,
    remainingTime: "0",
    ...overrides,
  });
}

/** A KeysBought event (the buy waits for it). */
function keysBoughtEvent(
  round = "1",
  cost = "10000000",
  metadata: Record<string, unknown> = {},
) {
  return {
    ...metadata,
    state: [
      { type: "Integer", value: round },
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: "1" },
      { type: "Integer", value: cost },
    ],
  };
}

/** A Credited(from, amount, balance) event. */
function creditedEvent(
  amountBase: string,
  balanceBase: string,
  account = PLAYER_HASH,
  metadata: Record<string, unknown> = {},
) {
  return {
    ...metadata,
    state: [
      { type: "Hash160", value: account },
      { type: "Integer", value: amountBase },
      { type: "Integer", value: balanceBase },
    ],
  };
}

/** A RoundSettled(round, winner, pot, nextRound) event. */
function roundSettledEvent(
  winner = PLAYER_HASH,
  metadata: Record<string, unknown> = {},
) {
  return {
    ...metadata,
    state: [
      { type: "Integer", value: "1" },
      { type: "Hash160", value: winner },
      { type: "Integer", value: "20000000" },
      { type: "Integer", value: "2" },
    ],
  };
}

/** A CreditWithdrawn(account, amount) event — amount at state slot 1. */
function creditWithdrawnEvent(
  amountBase: string,
  account = PLAYER_HASH,
  metadata: Record<string, unknown> = {},
) {
  return {
    ...metadata,
    state: [
      { type: "Hash160", value: account },
      { type: "Integer", value: amountBase },
    ],
  };
}

function makeChain(
  opts: {
    credit?: string;
    currentKeyCost?: string;
    round?: Record<string, unknown>;
    buyThrows?: boolean;
    buyError?: string;
    withdrawAmount?: string;
    atomicBatch?: boolean;
    batchConfirms?: boolean;
    legacyContract?: boolean;
    depositResult?: TxResult;
    settleResult?: TxResult;
    withdrawResult?: TxResult;
    creditReadThrows?: boolean;
    purchaseReadbackInvalid?: boolean;
    contract?: string;
  } = {},
) {
  const round = opts.round ?? liveRound();
  const cost = opts.currentKeyCost ?? "10000000"; // 0.1 GAS
  const initialRoundId = Number(round.roundId ?? 1);
  let liveCredit = BigInt(opts.credit ?? "0");
  let bought = false;
  let settled = false;

  const invoke = vi.fn(
    async (
      op: string,
      _args: ContractArg[],
      options?: { waitForEvent?: string; onTransactionSent?: (txid: string) => void },
    ): Promise<TxResult> => {
      if (op === "buyKeys") {
        if (opts.buyThrows) throw new Error(opts.buyError ?? "buy reverted");
        bought = true;
        liveCredit = 0n;
        options?.onTransactionSent?.(TX_BUY);
        return {
          txid: TX_BUY,
          event: options?.waitForEvent === "KeysBought" ? keysBoughtEvent() : undefined,
          success: true,
          verified: true,
        };
      }
      if (op === "withdraw") {
        options?.onTransactionSent?.(TX_WITHDRAW);
        liveCredit = 0n;
        return opts.withdrawResult ? { ...opts.withdrawResult, txid: TX_WITHDRAW } : {
          txid: TX_WITHDRAW,
          event:
            options?.waitForEvent === "CreditWithdrawn"
              ? creditWithdrawnEvent(opts.withdrawAmount ?? opts.credit ?? "0")
              : undefined,
          success: true,
          verified: true,
        };
      }
      if (op === "settle") {
        options?.onTransactionSent?.(TX_SETTLE);
        settled = true;
        return opts.settleResult ? { ...opts.settleResult, txid: TX_SETTLE } : {
          txid: TX_SETTLE,
          event:
            options?.waitForEvent === "RoundSettled"
              ? roundSettledEvent()
              : undefined,
          success: true,
          verified: true,
        };
      }
      // transfer (deposit)
      const amount = String(_args[2]?.value ?? "0");
      liveCredit += BigInt(amount);
      const balance = liveCredit.toString();
      options?.onTransactionSent?.(TX_TRANSFER);
      return opts.depositResult ? { ...opts.depositResult, txid: TX_TRANSFER } : {
        txid: TX_TRANSFER,
        event:
          options?.waitForEvent === "Credited"
            ? creditedEvent(amount, balance)
            : undefined,
        success: true,
        verified: true,
      };
    },
  );

  const invokeMultiple = opts.atomicBatch
    ? vi.fn(async (
        _calls: unknown[],
        options?: { onTransactionSent?: (txid: string) => void },
      ) => {
        bought = true;
        liveCredit = 0n;
        options?.onTransactionSent?.(TX_BATCH);
        return { txid: TX_BATCH, success: true, verified: true, state: "HALT" };
      })
    : undefined;
  const waitForEvent = opts.atomicBatch
    ? vi.fn(async () => opts.batchConfirms === false ? null : keysBoughtEvent())
    : undefined;

  const read = vi.fn(async (op: string, args?: ContractArg[]): Promise<unknown> => {
    if (op === "getOwner") return PLAYER_HASH;
    if (op === "getCurrentRound") {
      if (!settled) return round;
      return liveRound({
        roundId: String(initialRoundId + 1),
        pot: "0",
        totalKeys: "0",
        lastBuyer: ZERO_HASH,
        settled: false,
        active: true,
      });
    }
    if (op === "getRound") {
      const requestedId = Number(args?.[0]?.value ?? initialRoundId);
      if (opts.purchaseReadbackInvalid && bought) return {};
      if (settled && requestedId === initialRoundId) {
        return { ...round, settled: true, active: false, remainingTime: "0" };
      }
      return liveRound({
        roundId: String(requestedId),
        pot: bought ? cost : String(round.pot ?? "20000000"),
        totalKeys: bought ? "1" : String(round.totalKeys ?? "1"),
        lastBuyer: bought ? PLAYER_HASH : String(round.lastBuyer ?? PLAYER_HASH),
      });
    }
    if (op === "creditOf") {
      if (opts.creditReadThrows) throw new Error("RPC unavailable");
      return liveCredit.toString();
    }
    if (op === "currentKeyCost") {
      if (opts.legacyContract) throw new Error("method not found");
      return cost;
    }
    if (op === "playerKeys") return "1";
    return {};
  });

  const chain = {
    contractAddress: { get: () => opts.contract ?? CONTRACT },
    address: { get: () => PLAYER },
    ensureWallet: vi.fn(async () => PLAYER),
    invoke,
    ...(invokeMultiple ? { invokeMultiple } : {}),
    ...(waitForEvent ? { waitForEvent } : {}),
    read,
  } as unknown as ChainService;

  return { chain, invoke, invokeMultiple, waitForEvent, read };
}

function setup(
  opts: Parameters<typeof makeChain>[0] = {},
  transactionOutcome: { state: "halt" | "fault" | "unknown"; event: unknown | null } = { state: "unknown", event: null },
) {
  const deps = makeChain(opts);
  const app = createMiniAppFramework(
    { services: { chain: deps.chain }, t } as never,
    { appId: "miniapp-last-survivor" },
  );
  const stored = new Map<string, unknown>();
  Object.assign(app.storage.local, {
    get: <T,>(key: string, fallback: T | null = null) =>
      (stored.has(key) ? stored.get(key) : fallback) as T | null,
    set: (key: string, value: unknown) => { stored.set(key, value); },
    delete: (key: string) => { stored.delete(key); },
  });
  const game = useLastSurvivor({
    app,
    t,
    transactionOutcomeReader: async () => transactionOutcome,
  });
  game.setAddress(PLAYER);
  return { game, framework: app, ...deps };
}

function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((c) => c[0] === op);
}

describe("useLastSurvivor (direct MiniAppLastSurvivor contract)", () => {
  it("gates an incomplete payout ABI while preserving the credit exit read", async () => {
    const { game, invoke } = setup({ legacyContract: true, credit: "25000000" });
    await game.loadAll();

    expect(game.roundDataAvailable.get()).toBe(false);
    expect(game.serviceNotice.get()).toContain("Legacy payout contract");
    expect(game.prepaidCredit.get()).toBeCloseTo(0.25, 8);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("probes player-facing read/recovery methods without requiring getOwner", async () => {
    const { game, read } = setup();

    await game.loadAll();

    expect(game.roundDataAvailable.get()).toBe(true);
    expect(read.mock.calls.some((call) => call[0] === "getOwner")).toBe(false);
    expect(read.mock.calls.some((call) => call[0] === "creditOf")).toBe(true);
    expect(read.mock.calls.some((call) => call[0] === "currentKeyCost")).toBe(true);
  });

  it("raises the danger meter as the countdown approaches zero", async () => {
    const safe = setup({
      round: liveRound({
        endTime: String(Date.now() + 600_000),
        remainingTime: "600",
      }),
    }).game;
    const critical = setup({
      round: liveRound({
        endTime: String(Date.now() + 60_000),
        remainingTime: "60",
      }),
    }).game;

    await safe.loadAll();
    await critical.loadAll();

    expect(safe.dangerProgress.get()).toBeLessThan(critical.dangerProgress.get());
    expect(safe.shouldPulse.get()).toBe(false);
    expect(critical.shouldPulse.get()).toBe(true);
  });

  it("notifies lifecycle subscribers when the local live countdown expires", async () => {
    const { game } = setup({
      round: liveRound({
        endTime: String(Date.now() + 1_000),
        remainingTime: "1",
      }),
    });
    await game.loadAll();
    let notifications = 0;
    const unsubscribe = game.needsLifecycleSync.subscribe(() => { notifications += 1; });

    game.endTime.set(Date.now() - 1);
    game.updateNow();

    expect(game.isRoundActive.get()).toBe(true);
    expect(game.needsLifecycleSync.get()).toBe(true);
    expect(notifications).toBeGreaterThan(0);
    unsubscribe();
  });

  it("atomically batches a GAS shortfall and buyKeys when the host supports it", async () => {
    const { game, invoke, invokeMultiple, waitForEvent } = setup({
      credit: "0",
      currentKeyCost: "10000000",
      atomicBatch: true,
    });
    await game.loadAll();

    await game.buyKeys("1");

    expect(invokeMultiple).toHaveBeenCalledOnce();
    expect(invokeMultiple?.mock.calls[0]?.[0]).toEqual([
      {
        scriptHash: GAS_HASH,
        operation: "transfer",
        args: [
          { type: "Hash160", value: PLAYER_HASH },
          { type: "Hash160", value: CONTRACT },
          { type: "Integer", value: "10000000" },
          { type: "String", value: BUY_MEMO },
        ],
      },
      {
        operation: "buyKeys",
        args: [
          { type: "Hash160", value: PLAYER_HASH },
          { type: "Integer", value: "1" },
        ],
      },
    ]);
    expect(waitForEvent).toHaveBeenCalledWith(TX_BATCH, "KeysBought", 45_000);
    expect(callFor(invoke, "transfer")).toBeUndefined();
    expect(callFor(invoke, "buyKeys")).toBeUndefined();
    expect(game.purchasePending.get()).toBe(false);
  });

  it("keeps an unconfirmed atomic purchase locked for exact-tx recovery", async () => {
    const { game, invokeMultiple, waitForEvent } = setup({
      credit: "0",
      atomicBatch: true,
      batchConfirms: false,
    });
    await game.loadAll();

    await expect(game.buyKeys("1")).rejects.toThrow("Purchase confirmation pending");
    expect(invokeMultiple).toHaveBeenCalledOnce();
    expect(game.purchasePending.get()).toBe(true);
    await expect(game.buyKeys("1")).rejects.toThrow("Purchase confirmation pending");
    expect(invokeMultiple).toHaveBeenCalledOnce();
    waitForEvent?.mockResolvedValue(keysBoughtEvent());
    await expect(game.recoverPendingPurchase()).resolves.toBe(true);
    expect(game.purchasePending.get()).toBe(false);
  });

  it("recovers an exact purchase that landed after a permissionless round rollover", async () => {
    const { game, waitForEvent } = setup({
      credit: "0",
      currentKeyCost: "12000000",
      atomicBatch: true,
      batchConfirms: false,
    });
    await game.loadAll();
    await expect(game.buyKeys("1")).rejects.toThrow("Purchase confirmation pending");

    // The quote was from round 1 at 0.12 GAS. Before inclusion, someone settled;
    // the exact batch bought in round 2 at its authoritative event cost.
    waitForEvent?.mockResolvedValue(keysBoughtEvent("2", "10000000", {
      tx_hash: TX_BATCH,
    }));
    await expect(game.recoverPendingPurchase()).resolves.toBe(true);
    expect(game.purchasePending.get()).toBe(false);
  });

  it("deposits only the shortfall and waits for the Credited event before buyKeys", async () => {
    // creditOf < cost: a deposit must precede the buy, confirmed via Credited.
    const { game, invoke } = setup({ credit: "0", currentKeyCost: "10000000" });
    await game.loadAll();

    await game.buyKeys("1");

    const deposit = callFor(invoke, "transfer");
    expect(deposit).toBeTruthy();
    // Shortfall = cost - credit = 0.1 GAS, memo + GAS hash.
    expect(deposit![1]).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: "10000000" },
      { type: "String", value: BUY_MEMO },
    ]);
    // The deposit MUST wait for the contract's Credited event (race fix).
    expect(deposit![2]).toMatchObject({ scriptHash: GAS_HASH, waitForEvent: "Credited" });

    const buy = callFor(invoke, "buyKeys");
    expect(buy).toBeTruthy();
    expect(buy![2]).toMatchObject({ waitForEvent: "KeysBought" });

    // Deposit ordered before the consuming buy.
    const order = invoke.mock.calls.map((c) => c[0]);
    expect(order.indexOf("transfer")).toBeLessThan(order.indexOf("buyKeys"));
  });

  it("does not submit buyKeys when the fallback deposit is unverified", async () => {
    const { game, invoke } = setup({
      credit: "0",
      depositResult: {
        txid: TX_TRANSFER,
        event: null,
        success: true,
        verified: false,
      },
    });
    await game.loadAll();

    await expect(game.buyKeys("1"))
      .rejects.toThrow("Deposit confirmation pending");
    expect(callFor(invoke, "transfer")).toBeTruthy();
    expect(callFor(invoke, "buyKeys")).toBeUndefined();
  });

  it.each([
    [
      "wrong credited account",
      creditedEvent("10000000", "10000000", "0x1111111111111111111111111111111111111111"),
    ],
    [
      "wrong event name",
      creditedEvent("10000000", "10000000", PLAYER_HASH, {
        event_name: "NotCredited",
        tx_hash: TX_TRANSFER,
      }),
    ],
  ])("rejects a fallback deposit with %s", async (_label, event) => {
    const { game, invoke } = setup({
      credit: "0",
      depositResult: {
        txid: TX_TRANSFER,
        event,
        success: true,
        verified: true,
      },
    });
    await game.loadAll();

    await expect(game.buyKeys("1"))
      .rejects.toThrow("Deposit confirmation pending");
    expect(callFor(invoke, "buyKeys")).toBeUndefined();
  });

  it("nets an existing credit against the cost, depositing only the remainder", async () => {
    // Half the cost is already prepaid; only the remaining 0.06 GAS is deposited.
    const { game, invoke } = setup({ credit: "4000000", currentKeyCost: "10000000" });
    await game.loadAll();
    await game.buyKeys("1");

    const deposit = callFor(invoke, "transfer");
    expect(deposit).toBeTruthy();
    expect(deposit![1][2]).toEqual({ type: "Integer", value: "6000000" });
  });

  it("skips the deposit entirely when existing credit already covers the cost", async () => {
    const { game, invoke } = setup({ credit: "10000000", currentKeyCost: "10000000" });
    await game.loadAll();
    await game.buyKeys("1");

    expect(callFor(invoke, "transfer")).toBeUndefined();
    expect(callFor(invoke, "buyKeys")).toBeTruthy();
  });

  it("loads the connected wallet's prepaid credit into prepaidCredit / hasCredit", async () => {
    const { game } = setup({ credit: "25000000" }); // 0.25 GAS
    await game.loadAll();

    expect(game.prepaidCredit.get()).toBeCloseTo(0.25, 8);
    expect(game.hasCredit.get()).toBe(true);
  });

  it("settles only after the exact RoundSettled event is verified", async () => {
    const { game, invoke } = setup({ round: endedRound() });
    await game.loadAll();

    await expect(game.settleRound()).resolves.toBeUndefined();
    expect(callFor(invoke, "settle")?.[2]).toMatchObject({
      waitForEvent: "RoundSettled",
    });
    expect(game.isSettling.get()).toBe(false);
  });

  it("rejects an unverified settlement instead of resolving into a success toast", async () => {
    const { game } = setup({
      round: endedRound(),
      settleResult: {
        txid: TX_SETTLE,
        event: null,
        success: true,
        verified: false,
      },
    });
    await game.loadAll();

    await expect(game.settleRound())
      .rejects.toThrow("Settlement confirmation pending");
    expect(game.isSettling.get()).toBe(false);
  });

  it.each([
    [
      "wrong transaction",
      roundSettledEvent(PLAYER_HASH, {
        event_name: "RoundSettled",
        tx_hash: "0xother",
      }),
    ],
    [
      "wrong winner",
      roundSettledEvent("0x1111111111111111111111111111111111111111"),
    ],
  ])("rejects a verified RoundSettled event with %s", async (_label, event) => {
    const { game } = setup({
      round: endedRound(),
      settleResult: {
        txid: TX_SETTLE,
        event,
        success: true,
        verified: true,
      },
    });
    await game.loadAll();

    await expect(game.settleRound())
      .rejects.toThrow("Settlement confirmation pending");
  });

  it("does not prompt a settlement transaction while the countdown is running", async () => {
    const { game, invoke } = setup();
    await game.loadAll();

    await expect(game.settleRound()).rejects.toThrow("Countdown still running");
    expect(callFor(invoke, "settle")).toBeUndefined();
  });

  it("withdraws the unused prepaid credit, reading the amount from CreditWithdrawn", async () => {
    const { game, invoke } = setup({ credit: "25000000", withdrawAmount: "25000000" });
    await game.loadAll();

    const { amount } = await game.withdrawCredit();
    expect(amount).toBeCloseTo(0.25, 8);

    const withdraw = callFor(invoke, "withdraw");
    expect(withdraw).toBeTruthy();
    expect(withdraw![1]).toEqual([{ type: "Hash160", value: PLAYER_HASH }]);
    expect(withdraw![2]).toMatchObject({ waitForEvent: "CreditWithdrawn" });
  });

  it("blocks withdrawal while an exact purchase transaction is unresolved", async () => {
    const { game, invoke } = setup({
      credit: "2500000",
      currentKeyCost: "10000000",
      atomicBatch: true,
      batchConfirms: false,
      withdrawAmount: "2500000",
    });
    await game.loadAll();
    await expect(game.buyKeys("1")).rejects.toThrow("Purchase confirmation pending");
    expect(game.purchasePending.get()).toBe(true);

    await expect(game.withdrawCredit()).rejects.toThrow("Resolve the pending transaction first");
    expect(game.purchasePending.get()).toBe(true);
    expect(callFor(invoke, "withdraw")).toBeUndefined();
  });

  it("rejects an unverified withdrawal and never reports the pre-read credit as paid", async () => {
    const { game } = setup({
      credit: "25000000",
      withdrawResult: {
        txid: TX_WITHDRAW,
        event: null,
        success: true,
        verified: false,
      },
    });
    await game.loadAll();

    await expect(game.withdrawCredit())
      .rejects.toThrow("Withdrawal confirmation pending");
  });

  it.each([
    [
      "wrong account",
      creditWithdrawnEvent(
        "25000000",
        "0x1111111111111111111111111111111111111111",
      ),
    ],
    [
      "wrong transaction",
      creditWithdrawnEvent("25000000", PLAYER_HASH, {
        event_name: "CreditWithdrawn",
        tx_hash: "0xother",
      }),
    ],
  ])("rejects a verified CreditWithdrawn event with %s", async (_label, event) => {
    const { game } = setup({
      credit: "25000000",
      withdrawResult: {
        txid: TX_WITHDRAW,
        event,
        success: true,
        verified: true,
      },
    });
    await game.loadAll();

    await expect(game.withdrawCredit())
      .rejects.toThrow("Withdrawal confirmation pending");
  });

  it("surfaces a credit read outage instead of claiming there is no credit", async () => {
    const { game, invoke } = setup({ creditReadThrows: true });

    await expect(game.withdrawCredit())
      .rejects.toThrow("Prepaid credit could not be verified");
    expect(callFor(invoke, "withdraw")).toBeUndefined();
  });

  it("refuses a withdraw when there is no prepaid credit (clean message, no invoke)", async () => {
    const { game, invoke } = setup({ credit: "0" });
    await game.loadAll();

    await expect(game.withdrawCredit()).rejects.toThrow("No prepaid credit to withdraw");
    expect(callFor(invoke, "withdraw")).toBeUndefined();
  });

  it("surfaces the settle requirement when buyKeys faults on an ended round", async () => {
    const { game } = setup({
      credit: "10000000",
      buyThrows: true,
      buyError: "round ended; settle first",
    });
    await game.loadAll();

    await expect(game.buyKeys("1")).rejects.toThrow("Settle the round first");
  });

  it("keeps failed wallet reads unavailable instead of replacing known values with zero", async () => {
    const { game, read } = setup({ credit: "25000000" });
    await game.loadAll();
    expect(game.creditAvailable.get()).toBe(true);
    expect(game.userKeysAvailable.get()).toBe(true);
    expect(game.prepaidCredit.get()).toBeCloseTo(0.25, 8);
    game.userKeys.set(7);

    const original = read.getMockImplementation();
    read.mockImplementation(async (operation: string, args?: ContractArg[]) => {
      if (operation === "creditOf" || operation === "playerKeys") {
        throw new Error("RPC unavailable");
      }
      return original?.(operation, args);
    });

    await Promise.all([game.loadCredit(), game.loadUserKeys()]);
    expect(game.creditAvailable.get()).toBe(false);
    expect(game.userKeysAvailable.get()).toBe(false);
    expect(game.prepaidCredit.get()).toBeCloseTo(0.25, 8);
    expect(game.userKeys.get()).toBe(7);
  });

  it("marks a malformed round unavailable without overwriting the last verified round", async () => {
    const { game, read } = setup();
    await game.loadAll();
    expect(game.roundId.get()).toBe(1);
    expect(game.totalPot.get()).toBeCloseTo(0.2, 8);

    const original = read.getMockImplementation();
    read.mockImplementation(async (operation: string, args?: ContractArg[]) => {
      if (operation === "getCurrentRound") return { ...liveRound(), pot: "not-an-integer" };
      return original?.(operation, args);
    });
    await game.loadAll();

    expect(game.roundDataAvailable.get()).toBe(false);
    expect(game.roundId.get()).toBe(1);
    expect(game.totalPot.get()).toBeCloseTo(0.2, 8);
    expect(game.formattedRound.get()).toBe("N/A");
  });

  it("keeps an exact event pending until authoritative readback also succeeds", async () => {
    const { game, invoke } = setup({
      credit: "10000000",
      purchaseReadbackInvalid: true,
    });
    await game.loadAll();

    await expect(game.buyKeys("1")).rejects.toThrow("Purchase confirmation pending");
    expect(game.purchasePending.get()).toBe(true);
    const submitted = invoke.mock.calls.filter((call) => call[0] === "buyKeys").length;
    await expect(game.buyKeys("1")).rejects.toThrow("Purchase confirmation pending");
    expect(invoke.mock.calls.filter((call) => call[0] === "buyKeys")).toHaveLength(submitted);
  });

  it("releases a journal only when the application log proves VM FAULT", async () => {
    const { game } = setup(
      { credit: "10000000", purchaseReadbackInvalid: true },
      { state: "fault", event: null },
    );
    await game.loadAll();

    await expect(game.buyKeys("1")).rejects.toThrow("Transaction faulted");
    expect(game.purchasePending.get()).toBe(false);
    expect(game.pendingTransactionId.get()).toBe("");
    expect(game.recoveryNotice.get()).toBe("Transaction faulted");
  });

  it("blocks every wallet write when durable recovery storage fails its preflight", async () => {
    const { game, framework, invoke } = setup();
    vi.spyOn(framework.storage.local, "set").mockImplementation(() => {
      throw new Error("storage denied");
    });
    await game.loadAll();

    await expect(game.buyKeys("1")).rejects.toThrow("Recovery storage unavailable");
    expect(game.storageHealthy.get()).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("keeps the exact txid in memory when storage fails after broadcast", async () => {
    const { game, framework, invoke } = setup({ credit: "10000000" });
    await game.loadAll();
    const realSet = framework.storage.local.set.bind(framework.storage.local);
    vi.spyOn(framework.storage.local, "set").mockImplementation((key, value) => {
      if (key.startsWith("pending-operation/v2/") && !key.endsWith("storage-probe")) {
        throw new Error("quota changed after wallet approval");
      }
      realSet(key, value);
    });

    await expect(game.buyKeys("1")).rejects.toThrow("Purchase confirmation pending");
    expect(game.storageHealthy.get()).toBe(false);
    expect(game.purchasePending.get()).toBe(true);
    expect(game.pendingTransactionId.get()).toBe(TX_BUY);
    expect(game.recoveryNotice.get()).toContain(TX_BUY);
    expect(invoke.mock.calls.filter((call) => call[0] === "buyKeys")).toHaveLength(1);

    await expect(game.buyKeys("1")).rejects.toThrow("Purchase confirmation pending");
    expect(invoke.mock.calls.filter((call) => call[0] === "buyKeys")).toHaveLength(1);
  });

  it("rejects a configured contract that does not match the detected network", async () => {
    const { game, invoke } = setup({
      contract: "0x1111111111111111111111111111111111111111",
    });
    await game.loadAll();

    expect(game.roundDataAvailable.get()).toBe(false);
    expect(game.serviceNotice.get()).toBe("Chain binding mismatch");
    await expect(game.buyKeys("1")).rejects.toThrow("Chain binding mismatch");
    expect(invoke).not.toHaveBeenCalled();
  });

  // pendingKey migration guard. The stat rail / sidebar bind the round read-outs
  // with no loading gate, so `roundDataAvailable` alone published "N/A" — a
  // dashed prize pot on a pot-based game — the instant a visitor arrived, before
  // any read had run. `roundSettled` separates "not read yet" (→ undefined, the
  // shell's pendingKey trigger) from "read, and there is genuinely no round"
  // (→ a real "N/A" reading).
  it("holds the round read-outs unread (undefined) until a read settles, never a dashed prize pot", async () => {
    const { game } = setup();

    // Before loadAll: nothing has been read. Absence, not a fabricated "N/A" or
    // "0" — the shell renders the pendingKey copy for these.
    expect(game.roundSettled.get()).toBe(false);
    expect(game.formattedRound.get()).toBeUndefined();
    expect(game.totalPotDisplay.get()).toBeUndefined();
    expect(game.lastBuyerLabel.get()).toBeUndefined();
    expect(game.roundStatusDisplay.get()).toBeUndefined();
    expect(game.userKeysDisplay.get()).toBeUndefined();
    expect(game.countdown.get()).toBeUndefined();

    await game.loadAll();

    // Settled with a real round: real values, none of them the "N/A" void.
    expect(game.roundSettled.get()).toBe(true);
    expect(game.roundDataAvailable.get()).toBe(true);
    expect(game.formattedRound.get()).toMatch(/^#/);
    expect(game.formattedRound.get()).not.toBe(t("notAvailable"));
    expect(game.totalPotDisplay.get()).toContain(t("tokenGas"));
    expect(game.totalPotDisplay.get()).not.toBe(t("notAvailable"));
  });

  it("reads N/A only once a read has SETTLED with no round — never before it runs", async () => {
    const { game } = setup({ legacyContract: true });

    // Unread first: pendingKey, not "N/A".
    expect(game.formattedRound.get()).toBeUndefined();
    expect(game.totalPotDisplay.get()).toBeUndefined();

    await game.loadAll();

    // The read completed and found no usable round → a real, settled "N/A"
    // reading (kept verbatim), distinct from the unread pending phase.
    expect(game.roundSettled.get()).toBe(true);
    expect(game.roundDataAvailable.get()).toBe(false);
    expect(game.formattedRound.get()).toBe(t("notAvailable"));
    expect(game.totalPotDisplay.get()).toBe(t("notAvailable"));
    expect(game.roundStatusDisplay.get()).toBe(t("roundStateUnavailable"));
  });
});
