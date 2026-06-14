/**
 * useCoinFlip — V2 commit/reveal flow tests.
 *
 * Exercises the two-step play that replaced the v1 single-tx flip:
 *   1. commit (deposit-then-commit via invokeWithPayment) → read betId from the
 *      Committed event + persist the pending bet.
 *   2. wait one block, then settle (permissionless) → read outcome/won/payout
 *      from the Settled event.
 * Plus the robustness paths: a failed reveal leaves the pending bet set for a
 * revealResult() retry, "already settled" reads the recorded result back, and a
 * never-claim-before-Settled guarantee.
 *
 * Lives in the app dir (not apps/shared) per the migration ownership rules.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCoinFlip } from "./useCoinFlip";
import type { UseCoinFlipOptions } from "./useCoinFlip";
import type { ContractArg, TxResult } from "@shared/services/ChainService";
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
  };
  let out = messages[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      out = out.replace(`{${k}}`, String(v));
    }
  }
  return out;
}

/** Build a Committed(betId, player, choice, commitIndex) event payload. */
function committedEvent(betId: number, choice: number, commitIndex = 100) {
  return {
    state: [
      { type: "Integer", value: String(betId) },
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: String(choice) },
      { type: "Integer", value: String(commitIndex) },
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
  bankroll?: string;
  freeBankroll?: string;
  // commit controls
  commitFault?: string;
  commitDepositConfirmed?: boolean; // throw DepositConfirmedActionFailedError
  betId?: number;
  emitCommittedEvent?: boolean;
  // settle controls
  outcome?: number;
  won?: boolean;
  payout?: string;
  settleFault?: string; // when set, settle() throws this message every attempt
  emitSettledEvent?: boolean;
  pendingBetRecord?: Record<string, unknown> | null; // getPendingBet fixture
}

function makeDeps(opts: MakeDepsOpts = {}) {
  const emitCommitted = opts.emitCommittedEvent !== false;
  const emitSettled = opts.emitSettledEvent !== false;
  const betId = opts.betId ?? 42;

  const invokeWithPayment = vi.fn(
    async (
      amount: string,
      memo: string,
      operation: string,
      args: ContractArg[],
      options?: { waitForEvent?: string },
    ): Promise<TxResult> => {
      void amount;
      void memo;
      void args;
      if (opts.commitDepositConfirmed) {
        throw new DepositConfirmedActionFailedError(operation, "0xdeposit", new Error("commit reverted"));
      }
      if (opts.commitFault) throw new Error(opts.commitFault);
      const event =
        emitCommitted && options?.waitForEvent === "Committed"
          ? committedEvent(betId, Number(args[1]?.value ?? 0))
          : undefined;
      return { txid: "0xcommit", event, success: true };
    },
  );

  const invoke = vi.fn(
    async (op: string, args: ContractArg[], options?: { waitForEvent?: string }): Promise<TxResult> => {
      if (op === "settle") {
        if (opts.settleFault) throw new Error(opts.settleFault);
        const choiceInt = 0; // settle doesn't carry choice; outcome drives it
        void choiceInt;
        const outcome = opts.outcome ?? 0;
        const won = opts.won ?? false;
        const event =
          emitSettled && options?.waitForEvent === "Settled"
            ? settledEvent({
                betId: Number(args[0]?.value ?? betId),
                choice: outcome, // not used by the reader
                outcome,
                won,
                payout: opts.payout ?? (won ? "200000000" : "0"),
              })
            : undefined;
        return { txid: "0xsettle", event, success: true };
      }
      if (op === "withdraw") return { txid: "0xwithdraw", success: true };
      return { txid: "0xtx", success: true };
    },
  );

  const read = vi.fn(async (op: string, args?: ContractArg[]): Promise<unknown> => {
    if (op === "creditOf") return opts.credit ?? "0";
    if (op === "bankroll") return opts.bankroll ?? "100000000000";
    if (op === "freeBankroll") return opts.freeBankroll ?? opts.bankroll ?? "100000000000";
    if (op === "getStats") return { wins: "0", losses: "0", totalWon: "0" };
    if (op === "playerGameCount") return "0";
    if (op === "getPlayerGames") return [];
    if (op === "getGame") return null;
    if (op === "getPendingBet") {
      void args;
      return opts.pendingBetRecord ?? null;
    }
    return {};
  });

  const eventBus = { emit: vi.fn() };

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => PLAYER },
    ensureWallet: vi.fn(async () => PLAYER),
    invoke,
    invokeWithPayment,
    read,
    readArray: vi.fn(async (): Promise<unknown[]> => []),
  } as unknown as UseCoinFlipOptions["chain"];

  return {
    chain,
    eventBus: eventBus as unknown as UseCoinFlipOptions["eventBus"],
    invoke,
    invokeWithPayment,
    read,
    eventBusMock: eventBus,
  };
}

function setup(opts: MakeDepsOpts = {}) {
  const deps = makeDeps(opts);
  const flip = useCoinFlip({ chain: deps.chain, eventBus: deps.eventBus, t });
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
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("commits (deposit-then-commit) reading betId from Committed, then settles reading the win from Settled", async () => {
    const { flip, invokeWithPayment, invoke, read, eventBusMock } = setup({
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

    // -- Result is read from Settled, not commit --
    expect(result).toEqual({ won: true, outcome: "HEADS" });
    expect(flip.result.get()).toEqual({ won: true, outcome: "HEADS" });
    expect(flip.displayOutcome.get()).toBe("heads");
    expect(flip.showWinOverlay.get()).toBe(true);
    expect(flip.winAmount.get()).toBe("2.00");
    expect(eventBusMock.emit).toHaveBeenCalledWith("coinflip:win", expect.objectContaining({ payout: 2 }));

    // Pending bet cleared + flags reset once revealed.
    expect(flip.pendingBet.get()).toBeNull();
    expect(flip.hasPendingBet.get()).toBe(false);
    expect(flip.isFlipping.get()).toBe(false);
    expect(flip.revealing.get()).toBe(false);
  });

  it("maps tails to choice 1 and reveals a loss with no payout", async () => {
    const { flip, invokeWithPayment, eventBusMock } = setup({
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
    expect(eventBusMock.emit).toHaveBeenCalledWith("coinflip:loss", expect.anything());
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
    expect(flip.pendingBet.get()).toEqual({ betId: "99", choice: "heads", amount: 1 });
    expect(flip.hasPendingBet.get()).toBe(true);
    expect(flip.revealFailed.get()).toBe(true);
    expect(flip.result.get()).toBeNull();
    expect(flip.showWinOverlay.get()).toBe(false);
  });

  it("revealResult() retries settle for the persisted pending bet and resolves the outcome", async () => {
    // First placeBet leaves a failed reveal; then a fresh, succeeding settle path.
    const deps = makeDeps({ betId: 55, settleFault: "reveal block not reached" });
    const flip = useCoinFlip({ chain: deps.chain, eventBus: deps.eventBus, t });
    flip.setAddress(PLAYER);
    flip.setBetAmount("1");
    await expect(runWithTimers(flip.placeBet())).rejects.toThrow();
    expect(flip.hasPendingBet.get()).toBe(true);

    // Now make settle succeed (win) and retry via revealResult().
    deps.invoke.mockImplementation(async (op: string, args: ContractArg[], options?: { waitForEvent?: string }) => {
      if (op === "settle") {
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
        settled: true,
        choice: "1",
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
});
