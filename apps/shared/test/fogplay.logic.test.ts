import { describe, expect, it, vi } from "vitest";

import { useCoinFlip } from "../../fogplay/src/composables/useCoinFlip";
import type { UseCoinFlipOptions } from "../../fogplay/src/composables/useCoinFlip";
import type { ContractArg, TxResult } from "../services/ChainService";
import { DepositConfirmedActionFailedError } from "../composables/useContractInteraction";
import { addressToScriptHash } from "../utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "../constants";

const PLAYER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const PLAYER_HASH = addressToScriptHash(PLAYER);
const CONTRACT = "0x238488397884ad0bf1db99aecce62290e9f47971";
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const BET_MEMO = "miniapp-fogplay:bet";

// 1 GAS in base units (the default preset bet is "1").
const ONE_GAS = "100000000";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    tokenGas: "GAS",
    youWon: "You Won!",
    youLost: "You Lost",
    flipFailed: "Flip failed",
    connectWallet: "Connect wallet to continue",
    gameErrorFallback: "Something went wrong",
    invalidBetAmount: "Invalid bet amount",
    invalidAmountNumber: "Enter a valid number",
    minBetError: "Minimum bet is {min} {tokenGas}",
    maxBetError: "Maximum bet is {max} {tokenGas}",
    invalidAmountDecimals: "Maximum 8 decimal places",
    betPrepaidNoFlip: "Wager prepaid but the flip didn't settle",
    bankrollTooLow: "House bankroll too low for this bet",
    bankrollTooLowCap: "House bankroll too low for this bet — max payable bet is {max} {tokenGas}",
    noCreditToWithdraw: "No prepaid credit to withdraw",
  };
  let out = messages[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      out = out.replace(`{${k}}`, String(v));
    }
  }
  return out;
}

/**
 * Build a `Flipped` event payload:
 *   Flipped(gameId, player, choice, outcome, won, payout)
 * outcome slot [3], won slot [4], payout slot [5] — same shape the live
 * MiniAppCoinFlip emits.
 */
function flippedEvent(opts: {
  gameId: number;
  choice: number;
  outcome: number;
  won: boolean;
  payout: string;
}) {
  return {
    state: [
      { type: "Integer", value: String(opts.gameId) },
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: String(opts.choice) },
      { type: "Integer", value: String(opts.outcome) },
      { type: "Boolean", value: opts.won },
      { type: "Integer", value: opts.payout },
    ],
  };
}

/**
 * Minimal ChainService stand-in resolving creditOf / bankroll / getStats /
 * playerGameCount / getPlayerGames / getGame against fixtures, and emitting a
 * Flipped event from flip().
 */
function makeDeps(
  opts: {
    credit?: string;
    bankroll?: string;
    // Flip outcome controls.
    outcome?: number; // 0 = heads, 1 = tails
    won?: boolean;
    payout?: string;
    gameId?: number;
    emitEvent?: boolean;
    flipFault?: string; // when set, flip() throws this message
    // Stats + history fixtures.
    stats?: { wins: string; losses: string; totalWon: string };
    playerGameCount?: string;
    playerGames?: number[];
    games?: Record<number, Record<string, unknown>>;
  } = {},
) {
  const emitEvent = opts.emitEvent !== false;

  // The flip handler shared by the direct invoke('flip') path and the
  // prepayAndInvoke deposit→flip path.
  const runFlip = (args: ContractArg[], options?: { waitForEvent?: string }): TxResult => {
    if (opts.flipFault) throw new Error(opts.flipFault);
    const choiceInt = Number(args[1]?.value ?? 0);
    const outcome = opts.outcome ?? choiceInt; // default: a winning flip
    const won = opts.won ?? outcome === choiceInt;
    const event =
      emitEvent && options?.waitForEvent === "Flipped"
        ? flippedEvent({
            gameId: opts.gameId ?? 1,
            choice: choiceInt,
            outcome,
            won,
            payout: opts.payout ?? (won ? "200000000" : "0"),
          })
        : undefined;
    return { txid: "0xflip", event, success: true };
  };

  const invoke = vi.fn(
    async (op: string, args: ContractArg[], options?: { waitForEvent?: string }): Promise<TxResult> => {
      if (op === "flip") return runFlip(args, options);
      if (op === "withdraw") return { txid: "0xwithdraw", success: true };
      return { txid: "0xtransfer", success: true };
    },
  );

  // Mirrors ChainService.prepayAndInvoke: record the GAS transfer, then run the
  // follow-up op. When the deposit is confirmed but the op faults, surface the
  // DepositConfirmedActionFailedError the real service throws.
  const prepayAndInvoke = vi.fn(
    async (
      gasAmount: string,
      memo: string,
      operation: string,
      args: ContractArg[],
      options?: { waitForEvent?: string },
    ): Promise<TxResult> => {
      await invoke(
        "transfer",
        [
          { type: "Hash160", value: PLAYER_HASH },
          { type: "Hash160", value: CONTRACT },
          { type: "Integer", value: gasAmount },
          { type: "String", value: memo },
        ],
        { scriptHash: GAS_HASH },
      );
      try {
        if (operation === "flip") return runFlip(args, options);
        return await invoke(operation, args, options);
      } catch (e) {
        throw new DepositConfirmedActionFailedError(operation, "0xtransfer", e);
      }
    },
  );

  const read = vi.fn(async (op: string, args?: ContractArg[]): Promise<unknown> => {
    if (op === "creditOf") return opts.credit ?? "0";
    if (op === "bankroll") return opts.bankroll ?? "100000000000";
    if (op === "getStats") {
      const s = opts.stats ?? { wins: "0", losses: "0", totalWon: "0" };
      return { wins: s.wins, losses: s.losses, totalWon: s.totalWon };
    }
    if (op === "playerGameCount") return opts.playerGameCount ?? "0";
    if (op === "getPlayerGames") return opts.playerGames ?? [];
    if (op === "getGame") {
      const id = Number(args?.[0]?.value ?? 0);
      return opts.games?.[id] ?? null;
    }
    return {};
  });

  const eventBus = { emit: vi.fn() };

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => PLAYER },
    ensureWallet: vi.fn(async () => PLAYER),
    invoke,
    prepayAndInvoke,
    read,
    readArray: vi.fn(async (): Promise<unknown[]> => []),
  } as unknown as UseCoinFlipOptions["chain"];

  return {
    chain,
    eventBus: eventBus as unknown as UseCoinFlipOptions["eventBus"],
    invoke,
    prepayAndInvoke,
    read,
    eventBusMock: eventBus,
  };
}

function setup(opts: Parameters<typeof makeDeps>[0] = {}) {
  const deps = makeDeps(opts);
  const flip = useCoinFlip({ chain: deps.chain, eventBus: deps.eventBus, t });
  flip.setAddress(PLAYER);
  return { flip, ...deps };
}

function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((c) => c[0] === op);
}

describe("useCoinFlip (direct MiniAppCoinFlip contract)", () => {
  it("deposits the wager then flips (via prepayAndInvoke, deposit confirmed first), reading the win/outcome/payout from the Flipped event", async () => {
    // choice heads (0); contract returns outcome 0 (win), payout 2 GAS.
    const { flip, invoke, prepayAndInvoke, read, eventBusMock } = setup({
      outcome: 0,
      won: true,
      payout: "200000000",
      gameId: 7,
    });

    flip.choice.set("heads");
    flip.setBetAmount("1");
    await flip.placeBet();

    // The deposit→flip happens through prepayAndInvoke, which waits for the
    // deposit to confirm before flip() runs (no more deposit→flip race).
    expect(prepayAndInvoke).toHaveBeenCalledTimes(1);
    const [gasAmount, memo, op, flipArgs, flipOpts] = prepayAndInvoke.mock.calls[0];
    expect(gasAmount).toBe(ONE_GAS);
    expect(memo).toBe(BET_MEMO);
    expect(op).toBe("flip");
    expect(flipArgs).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: "0" }, // heads -> 0
      { type: "Integer", value: ONE_GAS },
    ]);
    expect(flipOpts).toMatchObject({ waitForEvent: "Flipped" });

    // The deposit transfer carries the bet memo in base units.
    const deposit = callFor(invoke, "transfer");
    expect(deposit).toBeTruthy();
    expect(deposit![1]).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: ONE_GAS },
      { type: "String", value: BET_MEMO },
    ]);

    // The credit + bankroll gates are read from the contract before depositing.
    expect(read.mock.calls.some((c) => c[0] === "creditOf")).toBe(true);
    expect(read.mock.calls.some((c) => c[0] === "bankroll")).toBe(true);

    // Win drives the overlay + payout from the event (2 GAS).
    expect(flip.result.get()).toEqual({ won: true, outcome: "HEADS" });
    expect(flip.displayOutcome.get()).toBe("heads");
    expect(flip.showWinOverlay.get()).toBe(true);
    expect(flip.winAmount.get()).toBe("2.00");
    expect(eventBusMock.emit).toHaveBeenCalledWith("coinflip:win", expect.objectContaining({ payout: 2 }));
  });

  it("returns the resolved result so the caller can toast the actual outcome (win vs loss)", async () => {
    const win = setup({ outcome: 0, won: true, payout: "200000000" });
    win.flip.choice.set("heads");
    win.flip.setBetAmount("1");
    await expect(win.flip.placeBet()).resolves.toEqual({ won: true, outcome: "HEADS" });

    const loss = setup({ outcome: 1, won: false, payout: "0" });
    loss.flip.choice.set("heads");
    loss.flip.setBetAmount("1");
    await expect(loss.flip.placeBet()).resolves.toEqual({ won: false, outcome: "TAILS" });
  });

  it("maps tails to choice 1 and a losing outcome with no payout", async () => {
    // choice tails (1); contract returns outcome 0 (loss for tails).
    const { flip, prepayAndInvoke, eventBusMock } = setup({ outcome: 0, won: false, payout: "0" });

    flip.choice.set("tails");
    flip.setBetAmount("5");
    await flip.placeBet();

    const [, , op, flipArgs] = prepayAndInvoke.mock.calls[0];
    expect(op).toBe("flip");
    expect(flipArgs).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: "1" }, // tails -> 1
      { type: "Integer", value: "500000000" }, // 5 GAS base units
    ]);

    expect(flip.result.get()).toEqual({ won: false, outcome: "HEADS" });
    expect(flip.showWinOverlay.get()).toBe(false);
    expect(eventBusMock.emit).toHaveBeenCalledWith("coinflip:loss", expect.anything());
  });

  it("skips the deposit (and prepayAndInvoke) when existing bet credit already covers the wager", async () => {
    const { flip, invoke, prepayAndInvoke } = setup({
      credit: ONE_GAS,
      outcome: 0,
      won: true,
      payout: "200000000",
    });

    flip.choice.set("heads");
    flip.setBetAmount("1");
    await flip.placeBet();

    expect(prepayAndInvoke).not.toHaveBeenCalled();
    expect(callFor(invoke, "transfer")).toBeUndefined();
    expect(callFor(invoke, "flip")).toBeTruthy();
    expect(flip.result.get()?.won).toBe(true);
  });

  it("refuses an over-bankroll bet BEFORE depositing (pre-flight), so no GAS is stranded", async () => {
    // bankroll 2 GAS → max payable bet 1 GAS (2x payout). A 2 GAS bet must be
    // refused before the deposit lands — the real strand bug this guards against.
    const { flip, invoke, prepayAndInvoke, read } = setup({ bankroll: "200000000" }); // 2 GAS

    flip.setBetAmount("2");
    await expect(flip.placeBet()).rejects.toThrow(
      "House bankroll too low for this bet — max payable bet is 1.00 GAS",
    );

    // No deposit, no flip — the wager never left the wallet.
    expect(callFor(invoke, "transfer")).toBeUndefined();
    expect(prepayAndInvoke).not.toHaveBeenCalled();
    expect(read.mock.calls.some((c) => c[0] === "bankroll")).toBe(true);
    expect(flip.isFlipping.get()).toBe(false);
    expect(flip.showWinOverlay.get()).toBe(false);
  });

  it("surfaces a clear bankroll-too-low message if the flip itself faults (bankroll dropped after the pre-flight read)", async () => {
    // Pre-flight passes (bankroll high enough), but the flip reverts with the
    // contract's bankroll message; the fallback re-reads and reports the cap.
    let bankrollReads = 0;
    const deps = makeDeps({ flipFault: "bankroll cannot cover this bet" });
    // First bankroll read (pre-flight) reports a high balance; the message
    // re-read reports 0.5 GAS as the live cap.
    const origRead = deps.read.getMockImplementation()!;
    deps.read.mockImplementation(async (op: string, args?: ContractArg[]) => {
      if (op === "bankroll") {
        bankrollReads += 1;
        return bankrollReads === 1 ? "100000000000" : "50000000"; // 1000 GAS then 0.5 GAS
      }
      return origRead(op, args);
    });
    const flip = useCoinFlip({ chain: deps.chain, eventBus: deps.eventBus, t });
    flip.setAddress(PLAYER);

    flip.setBetAmount("1");
    await expect(flip.placeBet()).rejects.toThrow(
      "House bankroll too low for this bet — max payable bet is 0.5 GAS",
    );
    expect(flip.isFlipping.get()).toBe(false);
  });

  it("notes the prepaid credit as reusable when flip reverts after the deposit", async () => {
    const { flip, invoke } = setup({ flipFault: "insufficient bet credit" });

    flip.setBetAmount("1");
    await expect(flip.placeBet()).rejects.toThrow("Wager prepaid but the flip didn't settle");

    expect(callFor(invoke, "transfer")).toBeTruthy();
    expect(flip.result.get()).toBeNull();
    expect(flip.isFlipping.get()).toBe(false);
  });

  it("surfaces the raw flip fault (not the prepaid note) when the deposit was skipped", async () => {
    // Credit already covers the wager, so no deposit happens this round; a flip
    // fault should surface the contract error directly, not the prepaid note.
    const { flip, invoke } = setup({ credit: ONE_GAS, flipFault: "bet out of range" });

    flip.setBetAmount("1");
    await expect(flip.placeBet()).rejects.toThrow("bet out of range");

    expect(callFor(invoke, "transfer")).toBeUndefined();
    expect(flip.isFlipping.get()).toBe(false);
  });

  it("loads stats from getStats (wins/losses/totalWon) and history from getPlayerGames", async () => {
    const { flip, read } = setup({
      stats: { wins: "3", losses: "2", totalWon: "350000000" }, // 3.5 GAS net
      playerGameCount: "2",
      playerGames: [1, 2],
      games: {
        1: { id: 1, choice: 0, outcome: 0, won: true, wager: "100000000", payout: "200000000", time: 0 },
        2: { id: 2, choice: 1, outcome: 0, won: false, wager: "100000000", payout: "0", time: 0 },
      },
    });

    await flip.loadAll();

    expect(read.mock.calls.some((c) => c[0] === "getStats")).toBe(true);
    expect(flip.wins.get()).toBe(3);
    expect(flip.losses.get()).toBe(2);
    expect(flip.totalWon.get()).toBeCloseTo(3.5, 8);
    expect(flip.totalGames.get()).toBe(5);

    // History is newest-first; game 2 (loss) precedes game 1 (win).
    const history = flip.gameHistory.get();
    expect(history.map((g) => g.betId)).toEqual(["2", "1"]);
    expect(history[0]).toMatchObject({ choice: "tails", outcome: "heads", won: false, amount: 1, payout: 0 });
    expect(history[1]).toMatchObject({ choice: "heads", outcome: "heads", won: true, amount: 1, payout: 2 });
  });

  it("rejects an out-of-range wager before any chain call", async () => {
    const { flip, invoke } = setup();

    flip.setBetAmount("0.01"); // below MIN_BET 0.05
    await expect(flip.placeBet()).rejects.toThrow("Minimum bet is 0.05 GAS");

    expect(invoke).not.toHaveBeenCalled();
    expect(flip.validationError.get()).toBe("Minimum bet is 0.05 GAS");
  });

  it("surfaces the player's prepaid credit and the max payable bet after loadAll", async () => {
    const { flip } = setup({ credit: "150000000", bankroll: "300000000" }); // 1.5 GAS credit, 3 GAS bankroll

    await flip.loadAll();

    // Credit chip shows the stranded/reusable GAS.
    expect(flip.creditBase.get()).toBe(150000000n);
    expect(flip.hasCredit.get()).toBe(true);
    expect(flip.formattedCredit.get()).toBe("1.50 GAS");

    // Max payable = bankroll / 2x payout = 1.5 GAS.
    expect(flip.maxPayableBet.get()).toBeCloseTo(1.5, 8);
    expect(flip.formattedMaxPayable.get()).toBe("1.50 GAS");
  });

  it("withdraws the prepaid credit via withdraw(account) and reloads", async () => {
    const { flip, invoke, read } = setup({ credit: "100000000" }); // 1 GAS credit

    await flip.loadAll();
    expect(flip.hasCredit.get()).toBe(true);

    await flip.withdrawCredit();

    const withdrawCall = callFor(invoke, "withdraw");
    expect(withdrawCall).toBeTruthy();
    expect(withdrawCall![1]).toEqual([{ type: "Hash160", value: PLAYER_HASH }]);
    expect(withdrawCall![2]).toMatchObject({ waitForEvent: "CreditWithdrawn" });
    // creditOf re-read after the withdraw to refresh the chip.
    expect(read.mock.calls.filter((c) => c[0] === "creditOf").length).toBeGreaterThanOrEqual(2);
  });

  it("refuses to withdraw when there is no prepaid credit", async () => {
    const { flip, invoke } = setup({ credit: "0" });

    await flip.loadAll();
    await expect(flip.withdrawCredit()).rejects.toThrow("No prepaid credit to withdraw");
    expect(callFor(invoke, "withdraw")).toBeUndefined();
  });
});
