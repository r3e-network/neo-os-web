/**
 * useCoinFlip — V2 commit/reveal flow tests.
 *
 * Exercises the two-step play that replaced the v1 single-tx flip:
 *   1. commit (deposit-then-commit via invokeWithPayment) → read betId from the
 *      Committed event + persist the pending bet.
 *   2. wait for the beacon, settle once (permissionless), then confirm the
 *      exact outcome/won/payout from canonical getPendingBet state.
 * Plus the robustness paths: a failed reveal leaves the pending bet set for a
 * revealResult() retry, "already settled" reads the recorded result back, and a
 * never-claim-before-Settled guarantee.
 *
 * Lives in the app dir (not apps/shared) per the migration ownership rules.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCoinFlip } from "./useCoinFlip";
import type { UseCoinFlipOptions } from "./useCoinFlip";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { DepositConfirmedActionFailedError } from "@shared/composables/useContractInteraction";
import { addressToScriptHash } from "@shared/utils/neo";

const PLAYER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const PLAYER_HASH = addressToScriptHash(PLAYER);
const CONTRACT = "0x611c3d97dd98792a3c31a0e695704c657f143cda";
const BET_MEMO = "miniapp-fogplay:bet";

/** 1 GAS in base units (the default preset bet is "1"). */
const ONE_GAS = "100000000";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    tokenGas: "GAS",
    youWon: "You Won!",
    youLost: "You Lost",
    commitFailed: "Bet could not be placed",
    connectWallet: "Connect wallet to continue",
    gameErrorFallback: "Something went wrong",
    invalidBetAmount: "Invalid bet amount",
    invalidAmountNumber: "Enter a valid number",
    minBetError: "Minimum bet is {min} {tokenGas}",
    maxBetError: "Maximum bet is {max} {tokenGas}",
    invalidAmountDecimals: "Maximum 8 decimal places",
    betPrepaidNoCommit: "Wager prepaid but the bet didn't commit",
    bankrollTooLow: "House bankroll too low for this bet",
    bankrollTooLowCap: "House bankroll too low for this bet — max payable bet is {max} {tokenGas}",
    noCreditToWithdraw: "No prepaid credit to withdraw",
    betAlreadyPending: "A bet is already awaiting its reveal — reveal it first",
    noPendingBet: "No bet awaiting reveal",
    revealFailedRetry: "The reveal didn't land — tap Reveal result to try again",
    betCommitted: "Bet placed",
    commitNoBetId: "Bet placed but its id couldn't be read",
    revealPending: "Reveal not confirmed yet",
    paidLaneUnavailable: "Paid flips are unavailable on this network",
    pendingBetWrongNetwork: "Saved bet belongs to another network",
    settlementVerificationFailed: "Settlement verification failed",
    commitIdentityMismatch: "Commit identity mismatch",
    withdrawVerificationFailed: "Withdrawal verification failed",
    balanceReadUnavailable: "Prepaid balance unavailable",
  };
  let out = messages[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      out = out.replace(`{${k}}`, String(v));
    }
  }
  return out;
}

/** Build a Committed(betId, player, choice, amount, commitIndex) event payload. */
function committedEvent(
  betId: number,
  choice: number,
  amount = ONE_GAS,
  commitIndex = 100,
) {
  return {
    state: [
      { type: "Integer", value: String(betId) },
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: String(choice) },
      { type: "Integer", value: amount },
      { type: "Integer", value: String(commitIndex) },
    ],
  };
}

function creditWithdrawnEvent(amount: string) {
  return {
    state: [
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: amount },
    ],
  };
}

/** Build a Settled(betId, player, choice, outcome, won, payout) event payload. */
function settledEvent(opts: {
  betId: number;
  choice: number;
  outcome: number;
  won: boolean;
  payout: string;
}) {
  return {
    state: [
      { type: "Integer", value: String(opts.betId) },
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: String(opts.choice) },
      { type: "Integer", value: String(opts.outcome) },
      { type: "Boolean", value: opts.won },
      { type: "Integer", value: opts.payout },
    ],
  };
}

interface MakeDepsOpts {
  credit?: string;
  creditReadFault?: boolean;
  bankroll?: string;
  freeBankroll?: string;
  // commit controls
  commitFault?: string;
  commitDepositConfirmed?: boolean; // throw DepositConfirmedActionFailedError
  betId?: number;
  emitCommittedEvent?: boolean;
  committedEvents?: unknown[];
  // settle controls
  outcome?: number;
  won?: boolean;
  payout?: string;
  settleFault?: string; // when set, settle() throws this message every attempt
  emitSettledEvent?: boolean;
  pendingBetRecord?: Record<string, unknown> | null; // getPendingBet fixture
  network?: string;
  contract?: string;
}

function makeDeps(opts: MakeDepsOpts = {}) {
  const emitCommitted = opts.emitCommittedEvent !== false;
  const emitSettled = opts.emitSettledEvent !== false;
  const betId = opts.betId ?? 42;
  let creditValue = opts.credit ?? "0";
  let committedChoice = 0;
  let committedAmount = ONE_GAS;
  let settledOnChain = false;
  let settledBetId = String(betId);

  const invokeWithPayment = vi.fn(
    async (
      amount: string,
      memo: string,
      operation: string,
      args: ContractArg[],
      options?: { waitForEvent?: string; onTransactionSent?: (txid: string) => void },
    ): Promise<TxResult> => {
      void amount;
      void memo;
      void args;
      if (opts.commitDepositConfirmed) {
        throw new DepositConfirmedActionFailedError(operation, "0xdeposit", new Error("commit reverted"));
      }
      if (opts.commitFault) throw new Error(opts.commitFault);
      committedChoice = Number(args[1]?.value ?? 0);
      committedAmount = String(args[2]?.value ?? ONE_GAS);
      options?.onTransactionSent?.("0xcommit");
      const event =
        emitCommitted && options?.waitForEvent === "Committed"
          ? committedEvent(betId, committedChoice, committedAmount)
          : undefined;
      return { txid: "0xcommit", event, success: true };
    },
  );

  const invoke = vi.fn(
    async (
      op: string,
      args: ContractArg[],
      options?: { waitForEvent?: string; onTransactionSent?: (txid: string) => void },
    ): Promise<TxResult> => {
      if (op === "commit") {
        if (opts.commitFault) throw new Error(opts.commitFault);
        committedChoice = Number(args[1]?.value ?? 0);
        committedAmount = String(args[2]?.value ?? ONE_GAS);
        options?.onTransactionSent?.("0xcredit-commit");
        const event =
          emitCommitted && options?.waitForEvent === "Committed"
            ? committedEvent(betId, committedChoice, committedAmount)
            : undefined;
        return { txid: "0xcredit-commit", event, success: true };
      }
      if (op === "settle") {
        if (opts.settleFault) throw new Error(opts.settleFault);
        settledBetId = String(args[0]?.value ?? betId);
        const outcome = opts.outcome ?? 0;
        const won = opts.won ?? outcome === committedChoice;
        const event =
          emitSettled && options?.waitForEvent === "Settled"
            ? settledEvent({
                betId: Number(args[0]?.value ?? betId),
                choice: committedChoice,
                outcome,
                won,
                payout: opts.payout ?? (won ? "200000000" : "0"),
              })
            : undefined;
        settledOnChain = true;
        return { txid: "0xsettle", event, success: true };
      }
      if (op === "withdraw") {
        const amount = creditValue;
        creditValue = "0";
        return {
          txid: "0xwithdraw",
          event: options?.waitForEvent === "CreditWithdrawn"
            ? creditWithdrawnEvent(amount)
            : undefined,
          success: true,
        };
      }
      return { txid: "0xtx", success: true };
    },
  );

  const read = vi.fn(async (op: string, args?: ContractArg[]): Promise<unknown> => {
    if (op === "creditOf") {
      if (opts.creditReadFault) throw new Error("credit index unavailable");
      return creditValue;
    }
    if (op === "bankroll") return opts.bankroll ?? "100000000000";
    if (op === "freeBankroll") return opts.freeBankroll ?? opts.bankroll ?? "100000000000";
    if (op === "getStats") return { wins: "0", losses: "0", totalWon: "0" };
    if (op === "playerBetCount") return "0";
    if (op === "getPlayerBets") return [];
    if (op === "getPendingBet") {
      void args;
      if (opts.pendingBetRecord !== undefined) return opts.pendingBetRecord;
      if (!settledOnChain) return null;
      const outcome = opts.outcome ?? 0;
      const won = opts.won ?? outcome === committedChoice;
      return {
        id: settledBetId,
        player: PLAYER_HASH,
        choice: String(committedChoice),
        wager: committedAmount,
        settled: true,
        outcome: String(outcome),
        won,
        payout: opts.payout ?? (won ? (BigInt(committedAmount) * 2n).toString() : "0"),
      };
    }
    return {};
  });

  const chain = {
    contractAddress: { get: () => opts.contract ?? CONTRACT },
    address: { get: () => PLAYER },
    ensureWallet: vi.fn(async () => PLAYER),
    invoke,
    invokeWithPayment,
    read,
    readArray: vi.fn(async (): Promise<unknown[]> => []),
    listEvents: vi.fn(async (eventName: string): Promise<unknown[]> =>
      eventName === "Committed" ? opts.committedEvents ?? [] : [],
    ),
    detectNetwork: vi.fn(async () => opts.network ?? "testnet"),
  } as unknown as ChainService;

  const app = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-fogplay" },
  ) as unknown as UseCoinFlipOptions["app"];

  return {
    chain,
    app,
    invoke,
    invokeWithPayment,
    read,
    markSettled: () => {
      settledOnChain = true;
    },
  };
}

function setup(opts: MakeDepsOpts = {}) {
  const deps = makeDeps(opts);
  const flip = useCoinFlip({ app: deps.app, t, paidLaneEnabled: true });
  flip.setAddress(PLAYER);
  return { flip, ...deps };
}

function callFor(mock: ReturnType<typeof vi.fn>, op: string) {
  return mock.mock.calls.find((c) => c[0] === op);
}

/**
 * Drive a placeBet/revealResult promise to resolution while flushing the
 * fake-timer sleeps (REVEAL_WAIT_MS + settle backoff) it awaits internally.
 *
 * The promise is observed exactly once: we attach a single settle tracker
 * (swallowing the rejection here so it is never "unhandled"), pump timers until
 * it settles, then re-surface the original outcome to the caller's await.
 */
async function runWithTimers<T>(promise: Promise<T>): Promise<T> {
  // Mutable holder (object property, not a narrowed `let`) so TS doesn't collapse
  // the closure-assigned state to `never` after the settle check.
  const box: { outcome: { ok: true; value: T } | { ok: false; error: unknown } | null } = {
    outcome: null,
  };
  // Single observation point — prevents an unhandled rejection while we pump.
  void promise.then(
    (value) => {
      box.outcome = { ok: true, value };
    },
    (error) => {
      box.outcome = { ok: false, error };
    },
  );
  // Flush pending timers repeatedly until the chain of awaits settles.
  for (let i = 0; i < 50 && box.outcome === null; i += 1) {
    await Promise.resolve();
    await vi.runAllTimersAsync();
  }
  const settled = box.outcome;
  if (settled === null) throw new Error("runWithTimers: promise did not settle");
  if (settled.ok) return settled.value;
  throw settled.error;
}

describe("useCoinFlip V2 (commit/reveal)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // pendingBet is persisted via app.state.persisted (localStorage-backed when
    // available) — clear it so a retained pending bet never leaks across tests.
    if (typeof localStorage !== "undefined") localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("commits with an exact Committed identity, settles once, then confirms the win from canonical state", async () => {
    const { flip, invokeWithPayment, invoke, read } = setup({
      betId: 7,
      outcome: 0, // heads
      won: true,
      payout: "200000000",
    });

    flip.choice.set("heads");
    flip.setBetAmount("1");

    const result = await runWithTimers(flip.placeBet());

    // -- Step 1: commit via invokeWithPayment (wager rides the bet memo) --
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);
    const [amount, memo, op, commitArgs, commitOpts] = invokeWithPayment.mock.calls[0]!;
    expect(amount).toBe(ONE_GAS);
    expect(memo).toBe(BET_MEMO);
    expect(op).toBe("commit");
    expect(commitArgs).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: "0" }, // heads -> 0
      { type: "Integer", value: ONE_GAS },
    ]);
    expect(commitOpts).toMatchObject({ waitForEvent: "Committed" });

    // The free-bankroll pre-flight gate is read before committing.
    expect(read.mock.calls.some((c) => c[0] === "freeBankroll")).toBe(true);

    // -- Step 2: settle (permissionless) with the betId from Committed --
    const settleCall = callFor(invoke, "settle");
    expect(settleCall).toBeTruthy();
    expect(settleCall![1]).toEqual([{ type: "Integer", value: "7" }]);
    expect(settleCall![2]).toMatchObject({ waitForEvent: "Settled" });

    // -- Result is read from the exact persisted bet, never the event alone. --
    expect(read.mock.calls.some((c) => c[0] === "getPendingBet")).toBe(true);
    expect(result).toEqual({ won: true, outcome: "HEADS" });
    expect(flip.result.get()).toEqual({ won: true, outcome: "HEADS" });
    expect(flip.displayOutcome.get()).toBe("heads");
    expect(flip.showWinOverlay.get()).toBe(true);
    expect(flip.winAmount.get()).toBe("2.00");

    // Pending bet cleared + flags reset once revealed.
    expect(flip.pendingBet.get()).toBeNull();
    expect(flip.hasPendingBet.get()).toBe(false);
    expect(flip.isFlipping.get()).toBe(false);
    expect(flip.revealing.get()).toBe(false);
  });

  it("tops up only the shortfall beyond reusable prepaid credit", async () => {
    const { flip, invokeWithPayment } = setup({
      credit: "40000000",
      betId: 17,
    });
    flip.setBetAmount("1");

    await runWithTimers(flip.placeBet());

    expect(invokeWithPayment).toHaveBeenCalledWith(
      "60000000",
      BET_MEMO,
      "commit",
      expect.any(Array),
      expect.objectContaining({ waitForEvent: "Committed" }),
    );
  });

  it("commits without another transfer when prepaid credit covers the wager", async () => {
    const { flip, invokeWithPayment, invoke } = setup({
      credit: ONE_GAS,
      betId: 18,
    });
    flip.setBetAmount("1");

    await runWithTimers(flip.placeBet());

    expect(invokeWithPayment).not.toHaveBeenCalled();
    expect(callFor(invoke, "commit")?.[2]).toMatchObject({
      waitForEvent: "Committed",
    });
  });

  it("maps tails to choice 1 and reveals a loss with no payout", async () => {
    const { flip, invokeWithPayment } = setup({
      betId: 3,
      outcome: 0, // heads outcome → loss for a tails bet
      won: false,
      payout: "0",
    });

    flip.choice.set("tails");
    flip.setBetAmount("5");

    const result = await runWithTimers(flip.placeBet());

    const [, , op, commitArgs] = invokeWithPayment.mock.calls[0]!;
    expect(op).toBe("commit");
    expect(commitArgs).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: "1" }, // tails -> 1
      { type: "Integer", value: "500000000" }, // 5 GAS base units
    ]);

    expect(result).toEqual({ won: false, outcome: "HEADS" });
    expect(flip.showWinOverlay.get()).toBe(false);
  });

  it("persists the pending bet during the reveal so a reload can resume (set after commit)", async () => {
    // Settle hangs (faults) so the pending bet stays observable; we assert it.
    const { flip } = setup({ betId: 99, settleFault: "reveal block not reached" });

    flip.setBetAmount("1");
    const promise = flip.placeBet();

    // Drive the commit + first reveal attempts; settle keeps failing.
    await expect(runWithTimers(promise)).rejects.toThrow(
      "The reveal didn't land — tap Reveal result to try again",
    );

    // The committed bet is retained for a manual retry — never claimed lost.
    expect(flip.pendingBet.get()).toMatchObject({
      betId: "99",
      txid: "0xcommit",
      choice: "heads",
      amount: 1,
      amountFixed8: ONE_GAS,
    });
    expect(flip.hasPendingBet.get()).toBe(true);
    expect(flip.revealFailed.get()).toBe(true);
    expect(flip.result.get()).toBeNull();
    expect(flip.showWinOverlay.get()).toBe(false);
  });

  it("persists the exact commit tx before event indexing and recovers its bet id", async () => {
    const exactCommitted = {
      ...committedEvent(73, 0),
      tx_hash: "0xcommit",
    };
    const { flip, chain } = setup({
      emitCommittedEvent: false,
      committedEvents: [
        { ...committedEvent(999, 0), tx_hash: "0xother" },
        exactCommitted,
      ],
      outcome: 1,
      won: false,
    });
    flip.setBetAmount("1");

    await expect(flip.placeBet()).rejects.toThrow(
      "Bet placed but its id couldn't be read",
    );
    expect(flip.pendingBet.get()).toMatchObject({
      betId: "",
      txid: "0xcommit",
      player: PLAYER_HASH,
      contract: CONTRACT,
      amountFixed8: ONE_GAS,
    });

    const result = await runWithTimers(flip.revealResult());
    expect(result).toEqual({ won: false, outcome: "TAILS" });
    expect(flip.pendingBet.get()).toBeNull();
    expect(chain.listEvents).toHaveBeenCalledWith("Committed", { limit: 100 });
  });

  it("never substitutes another transaction while recovering a missing bet id", async () => {
    const { flip } = setup({
      emitCommittedEvent: false,
      committedEvents: [
        { ...committedEvent(999, 0), tx_hash: "0xother" },
      ],
    });
    flip.setBetAmount("1");

    await expect(flip.placeBet()).rejects.toThrow();
    await expect(flip.revealResult()).rejects.toThrow(
      "Bet placed but its id couldn't be read",
    );
    expect(flip.pendingBet.get()).toMatchObject({
      betId: "",
      txid: "0xcommit",
    });
    expect(flip.result.get()).toBeNull();
  });

  it("revealResult() retries settle for the persisted pending bet and resolves the outcome", async () => {
    // First placeBet leaves a failed reveal; then a fresh, succeeding settle path.
    const deps = makeDeps({ betId: 55, settleFault: "reveal block not reached" });
    const flip = useCoinFlip({ app: deps.app, t, paidLaneEnabled: true });
    flip.setAddress(PLAYER);
    flip.setBetAmount("1");
    await expect(runWithTimers(flip.placeBet())).rejects.toThrow();
    expect(flip.hasPendingBet.get()).toBe(true);

    // Now make settle succeed (win) and retry via revealResult().
    deps.invoke.mockImplementation(async (op: string, args: ContractArg[], options?: { waitForEvent?: string }) => {
      if (op === "settle") {
        deps.markSettled();
        const event =
          options?.waitForEvent === "Settled"
            ? settledEvent({ betId: Number(args[0]?.value ?? 55), choice: 0, outcome: 0, won: true, payout: "200000000" })
            : undefined;
        return { txid: "0xsettle2", event, success: true };
      }
      return { txid: "0xtx", success: true };
    });

    const result = await runWithTimers(flip.revealResult());
    expect(result).toEqual({ won: true, outcome: "HEADS" });
    expect(flip.pendingBet.get()).toBeNull();
    expect(flip.showWinOverlay.get()).toBe(true);
  });

  it("on 'already settled' reads the recorded outcome back from getPendingBet instead of erroring", async () => {
    const { flip } = setup({
      betId: 12,
      settleFault: "bet already settled",
      pendingBetRecord: {
        id: "12",
        player: PLAYER_HASH,
        settled: true,
        choice: "1",
        wager: "500000000",
        outcome: "1", // tails
        won: true,
        payout: "1000000000", // 10 GAS
      },
    });

    flip.choice.set("tails");
    flip.setBetAmount("5");

    const result = await runWithTimers(flip.placeBet());
    expect(result).toEqual({ won: true, outcome: "TAILS" });
    expect(flip.winAmount.get()).toBe("10.00");
    expect(flip.pendingBet.get()).toBeNull();
  });

  it("refuses an over-bankroll bet BEFORE committing (pre-flight on freeBankroll)", async () => {
    // freeBankroll 2 GAS → max payable 1 GAS (2x). A 2 GAS bet is refused early.
    const { flip, invokeWithPayment, read } = setup({ freeBankroll: "200000000" });

    flip.setBetAmount("2");
    await expect(runWithTimers(flip.placeBet())).rejects.toThrow(
      "House bankroll too low for this bet — max payable bet is 1.00 GAS",
    );

    expect(invokeWithPayment).not.toHaveBeenCalled();
    expect(read.mock.calls.some((c) => c[0] === "freeBankroll")).toBe(true);
    expect(flip.isFlipping.get()).toBe(false);
    expect(flip.pendingBet.get()).toBeNull();
  });

  it("keeps an empty or unreadable house table paused before any wallet payment", async () => {
    const { flip, invokeWithPayment, invoke } = setup({
      bankroll: "0",
      freeBankroll: "0",
    });

    await flip.loadAll();
    expect(flip.bankrollLoaded.get()).toBe(true);
    expect(flip.bankrollAvailable.get()).toBe(false);
    expect(flip.maxPayableBet.get()).toBe(0);
    expect(flip.canBet.get()).toBe(false);

    flip.setBetAmount("0.05");
    await expect(flip.placeBet()).rejects.toThrow("House bankroll too low");
    expect(invokeWithPayment).not.toHaveBeenCalled();
    expect(callFor(invoke, "commit")).toBeUndefined();
  });

  it("does not send a wager when the reusable-credit read is unavailable", async () => {
    const { flip, invokeWithPayment, invoke } = setup({ creditReadFault: true });

    await expect(flip.placeBet()).rejects.toThrow("Prepaid balance unavailable");

    expect(invokeWithPayment).not.toHaveBeenCalled();
    expect(callFor(invoke, "commit")).toBeUndefined();
    expect(flip.creditLoaded.get()).toBe(false);
  });

  it("notes the prepaid credit as reusable when commit reverts after the deposit", async () => {
    const { flip } = setup({ commitDepositConfirmed: true });

    flip.setBetAmount("1");
    await expect(runWithTimers(flip.placeBet())).rejects.toThrow(
      "Wager prepaid but the bet didn't commit",
    );

    expect(flip.pendingBet.get()).toBeNull();
    expect(flip.result.get()).toBeNull();
    expect(flip.isFlipping.get()).toBe(false);
  });

  it("blocks a new bet while one is awaiting reveal (canBet false + commit refused)", async () => {
    const { flip } = setup({ betId: 5, settleFault: "reveal block not reached" });
    flip.setBetAmount("1");
    await expect(runWithTimers(flip.placeBet())).rejects.toThrow();
    expect(flip.hasPendingBet.get()).toBe(true);
    expect(flip.canBet.get()).toBe(false);

    await expect(flip.placeBet()).rejects.toThrow(
      "A bet is already awaiting its reveal — reveal it first",
    );
  });

  it("revealResult() with no pending bet throws", async () => {
    const { flip } = setup();
    await expect(flip.revealResult()).rejects.toThrow("No bet awaiting reveal");
  });

  it("loadAll() surfaces a restored pending bet as a stalled reveal (reload resume path)", async () => {
    const { flip } = setup();
    // Simulate the persisted pending bet a reload would restore.
    flip.pendingBet.set({ betId: "77", choice: "heads", amount: 1 });
    expect(flip.revealFailed.get()).toBe(false);

    await flip.loadAll();

    // The manual "Reveal result" path must be visible again after a reload.
    expect(flip.revealFailed.get()).toBe(true);
    expect(flip.hasPendingBet.get()).toBe(true);
  });

  it("rejects an out-of-range wager before any chain call", async () => {
    const { flip, invokeWithPayment, invoke } = setup();

    flip.setBetAmount("0.01"); // below MIN_BET 0.05
    await expect(flip.placeBet()).rejects.toThrow("Minimum bet is 0.05 GAS");

    expect(invokeWithPayment).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    expect(flip.validationError.get()).toBe("Minimum bet is 0.05 GAS");
  });

  it("surfaces the player's prepaid credit and the max payable bet (freeBankroll/2) after loadAll", async () => {
    const { flip } = setup({ credit: "150000000", freeBankroll: "300000000" }); // 1.5 GAS credit, 3 GAS free

    await flip.loadAll();

    expect(flip.creditBase.get()).toBe(150000000n);
    expect(flip.hasCredit.get()).toBe(true);
    expect(flip.formattedCredit.get()).toBe("1.50 GAS");
    expect(flip.maxPayableBet.get()).toBeCloseTo(1.5, 8);
    expect(flip.formattedMaxPayable.get()).toBe("1.50 GAS");
  });

  it("withdraws the prepaid credit via withdraw(account) and reloads", async () => {
    const { flip, invoke, read } = setup({ credit: ONE_GAS });

    await flip.loadAll();
    expect(flip.hasCredit.get()).toBe(true);

    await flip.withdrawCredit();

    const withdrawCall = callFor(invoke, "withdraw");
    expect(withdrawCall).toBeTruthy();
    expect(withdrawCall![1]).toEqual([{ type: "Hash160", value: PLAYER_HASH }]);
    expect(withdrawCall![2]).toMatchObject({ waitForEvent: "CreditWithdrawn" });
    expect(read.mock.calls.filter((c) => c[0] === "creditOf").length).toBeGreaterThanOrEqual(2);
    expect(flip.creditBase.get()).toBe(0n);
  });

  it("fails closed on an unvalidated network before any wallet mutation", async () => {
    const { flip, invoke, invokeWithPayment, chain } = setup({ network: "mainnet" });

    await expect(flip.placeBet()).rejects.toThrow(
      "Paid flips are unavailable on this network",
    );

    expect(invoke).not.toHaveBeenCalled();
    expect(invokeWithPayment).not.toHaveBeenCalled();
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(flip.paidRuntimeValidated.get()).toBe(false);
  });

  it("uses the deployed V2 history ABI and settled bet snapshots", async () => {
    const { flip, read } = setup();
    read.mockImplementation(async (op: string): Promise<unknown> => {
      if (op === "bankroll" || op === "freeBankroll") return "100000000000";
      if (op === "creditOf") return "0";
      if (op === "getStats") return { wins: "1", losses: "0", totalWon: ONE_GAS };
      if (op === "playerBetCount") return "1";
      if (op === "getPlayerBets") return ["9"];
      if (op === "getPendingBet") {
        return {
          id: "9",
          player: PLAYER_HASH,
          choice: "0",
          wager: ONE_GAS,
          settled: true,
          outcome: "0",
          won: true,
          payout: "200000000",
          settleTime: "1778385591875",
        };
      }
      return null;
    });

    await flip.loadAll();

    expect(read.mock.calls.some((call) => call[0] === "playerBetCount")).toBe(true);
    expect(read.mock.calls.some((call) => call[0] === "getPlayerBets")).toBe(true);
    expect(read.mock.calls.some((call) => call[0] === "playerGameCount")).toBe(false);
    expect(flip.gameHistory.get()).toEqual([
      expect.objectContaining({
        betId: "9",
        choice: "heads",
        outcome: "heads",
        won: true,
        amount: 1,
        payout: 2,
      }),
    ]);
  });

  it("never applies a settlement event that belongs to another bet without canonical state", async () => {
    const { flip, invoke } = setup({ betId: 31 });
    invoke.mockImplementation(async (op: string, _args: ContractArg[], options?: { waitForEvent?: string }) => {
      if (op === "settle") {
        return {
          txid: "0xwrong-settle",
          event: options?.waitForEvent === "Settled"
            ? settledEvent({ betId: 999, choice: 0, outcome: 0, won: true, payout: "200000000" })
            : undefined,
          success: true,
        };
      }
      return { txid: "0xtx", success: true };
    });

    await expect(runWithTimers(flip.placeBet())).rejects.toThrow(
      "The reveal didn't land",
    );
    expect(flip.result.get()).toBeNull();
    expect(flip.pendingBet.get()).toMatchObject({ betId: "31" });
    expect(flip.revealFailed.get()).toBe(true);
  });

  it("keeps a persisted bet isolated from a different contract", async () => {
    const { flip, invoke } = setup();
    flip.pendingBet.set({
      betId: "81",
      choice: "heads",
      amount: 1,
      contract: "0x0000000000000000000000000000000000000081",
      network: "neo-n3-testnet",
      amountFixed8: ONE_GAS,
    });

    await expect(flip.revealResult()).rejects.toThrow(
      "Saved bet belongs to another network",
    );
    expect(callFor(invoke, "settle")).toBeUndefined();
    expect(flip.pendingBet.get()).not.toBeNull();
  });

  it("never claims a win/loss before the Settled event (no event => keeps retrying then fails to a retryable state)", async () => {
    // commit emits Committed, but settle never emits Settled AND getPendingBet
    // returns no recorded outcome → the flow must NOT fabricate a result.
    const { flip } = setup({ betId: 21, emitSettledEvent: false, pendingBetRecord: null });

    flip.setBetAmount("1");
    await expect(runWithTimers(flip.placeBet())).rejects.toThrow();

    expect(flip.result.get()).toBeNull();
    expect(flip.showWinOverlay.get()).toBe(false);
    expect(flip.hasPendingBet.get()).toBe(true); // retained for retry
    expect(flip.revealFailed.get()).toBe(true);
  });

  it("rejects a plausible Settled event when canonical payout arithmetic is invalid", async () => {
    const { flip } = setup({
      betId: 88,
      outcome: 0,
      won: true,
      payout: "200000000",
      pendingBetRecord: {
        id: "88",
        player: PLAYER_HASH,
        choice: "0",
        wager: ONE_GAS,
        settled: true,
        outcome: "0",
        won: true,
        payout: "199999999",
      },
    });

    await expect(runWithTimers(flip.placeBet())).rejects.toThrow();
    expect(flip.result.get()).toBeNull();
    expect(flip.pendingBet.get()).toMatchObject({ betId: "88" });
    expect(flip.revealFailed.get()).toBe(true);
  });
});
