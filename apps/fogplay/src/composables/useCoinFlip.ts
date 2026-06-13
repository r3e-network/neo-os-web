/**
 * useCoinFlip — Domain logic for the FogPlay (coin flip) miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppCoinFlip) via
 * ctx.services.chain. The earlier path routed bets through the OS
 * game/payment/storage/badge kernel, which TOOK the wager and never paid: it
 * expected a Morpheus VRF oracle to call back and settle the flip, but that
 * off-chain signer is non-operational, so bets resolved to nothing.
 *
 * MiniAppCoinFlip is self-contained: flip() consumes a prepaid wager, settles a
 * heads/tails bet ON-CHAIN with Runtime.GetRandom, and pays the winner 2x
 * ATOMICALLY in the same transaction out of a house bankroll — no oracle, no
 * pending bet. This composable drives it directly, so the payout is real.
 *
 * Contract interaction model (verified against MiniAppCoinFlip.cs / ABI):
 *
 *   READS (chain.read, default app contract script hash):
 *     bankroll()                         -> Integer (house bankroll, base units)
 *     creditOf(player)                   -> Integer (prepaid bet credit, base units)
 *     getStats(player)                   -> Map{wins,losses,totalWon}
 *     playerGameCount(player)            -> Integer
 *     getPlayerGames(player,off,limit)   -> Integer[] (game ids, newest last)
 *     getGame(gameId)                    -> Map{id,player,choice,outcome,won,wager,payout,time}
 *
 *   MUTATIONS (chain.invoke):
 *     1. DEPOSIT (fund a bet) — a GAS transfer to the contract with the memo
 *        "miniapp-fogplay:bet" so OnNEP17Payment credits the player's bet
 *        balance:
 *          transfer(player, CONTRACT, amount, "miniapp-fogplay:bet")
 *          { scriptHash: GAS_HASH }
 *     2. flip(player, choice, amount) -> outcome. choice 0=heads, 1=tails.
 *        Consumes the wager from credit, settles the flip in the SAME tx, and on
 *        a win pays 2x. The result is read from the "Flipped" event:
 *          Flipped(gameId, player, choice, outcome, won, payout)
 *        i.e. state slots [3]=outcome, [4]=won, [5]=payout.
 *
 * Post-deposit flip failure: if the deposit lands but flip() reverts, the credit
 * simply remains on the contract under the player as REUSABLE PREPAID credit for
 * the next bet — there is no refund call (and none is needed; funds are not
 * lost). The next bet skips the deposit when creditOf(player) already covers the
 * wager.
 *
 * The contract rejects a bet the house cannot cover ("bankroll cannot cover this
 * bet") so EVERY win is fully payable; that fault is surfaced as a clear
 * "house bankroll too low" message (with the bankroll cap when readable).
 *
 * AMOUNT CONVENTION: the contract takes BASE UNITS (GAS × 1e8). MIN_BET 0.05,
 * MAX_BET 100 GAS — also enforced on-chain. totalWon is cumulative net profit.
 *
 * The composable owns:
 *   - Reactive state (observables + derived) for manifest/PlayArea bindings
 *   - Bet validation logic (min/max, decimals, choice)
 *   - Win/loss UI updates (overlay, amounts, counters)
 *   - Loading/flipping UI flags
 *   - The outcome/won/payout read from the Flipped event of the flip tx
 *   - The player's stats + game history read straight from chain
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { ChainService } from "@shared/services/ChainService";
import type { EventBus } from "@shared/services";
import { DepositConfirmedActionFailedError } from "@shared/composables/useContractInteraction";
import { gasToBaseUnits as toBaseUnits } from "@shared/utils/amounts";
import { eventValue } from "@shared/utils/chain-events";
import { addressToScriptHash } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { formatNum, fromFixed8, formatGas } from "@shared/utils/format";

// ============================================================================
// Constants
// ============================================================================

/** Memo the contract requires on the bet-funding transfer (appId + ":bet"). */
const BET_MEMO = "miniapp-fogplay:bet";

/** Minimum bet in GAS (mirrors the contract's MIN_BET = 0.05 GAS). */
export const MIN_BET = 0.05;

/** Maximum bet in GAS (mirrors the contract's MAX_BET = 100 GAS). */
export const MAX_BET = 100;

/** Preset wager amounts shown in the UI. */
export const BET_PRESETS = ["1", "5", "10", "50"] as const;

/** How many of the player's most-recent games to page in per refresh. */
const HISTORY_PAGE_LIMIT = 20;

// ============================================================================
// Types
// ============================================================================

export interface GameResult {
  won: boolean;
  outcome: string;
}

export interface GameHistoryItem {
  betId: string;
  amount: number;
  choice: "heads" | "tails";
  outcome: "heads" | "tails";
  won: boolean;
  payout: number;
  time: string;
}

export interface UseCoinFlipOptions {
  /** Shared chain service from ctx.services.chain. */
  chain: ChainService;
  /** EventBus instance from ctx.services.events. */
  eventBus: EventBus;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Amount + choice mapping
// ============================================================================
// toBaseUnits (gasToBaseUnits) comes from @shared/utils/amounts — the SINGLE
// scaling point; the contract scales nothing.

/** Map a UI choice ("heads"|"tails") to the contract's integer (0|1). */
const choiceToInt = (side: "heads" | "tails"): number => (side === "heads" ? 0 : 1);

/** Map a contract outcome integer (0|1) to the UI side ("heads"|"tails"). */
const outcomeToSide = (outcome: number): "heads" | "tails" => (outcome === 0 ? "heads" : "tails");

// ============================================================================
// Event / map parsing
// ============================================================================

/** Coerce a NeoVM boolean (true / "true" / 1 / "1") to a JS boolean. */
const asBool = (value: unknown): boolean =>
  value === true || value === "true" || value === 1 || value === "1";

// ============================================================================
// Composable
// ============================================================================

export function useCoinFlip({ chain, eventBus, t }: UseCoinFlipOptions) {
  // -- Game State -------------------------------------------------------------
  const betAmount = createObservable("1");
  const choice = createObservable<"heads" | "tails">("heads");
  const isFlipping = createObservable(false);
  const result = createObservable<GameResult | null>(null);
  const displayOutcome = createObservable<"heads" | "tails" | null>(null);
  const showWinOverlay = createObservable(false);
  const winAmount = createObservable("0");
  const validationError = createObservable<string | null>(null);

  // -- Stats ------------------------------------------------------------------
  const wins = createObservable(0);
  const losses = createObservable(0);
  const totalWon = createObservable(0);
  const totalGames = createDerived(() => wins.get() + losses.get(), []);

  // -- House bankroll + prepaid credit (base units) ---------------------------
  // bankroll caps the maximum payable bet (the contract refuses any bet it
  // cannot cover 2x); prepaid credit is reusable GAS sitting on the contract
  // under the player after an aborted flip — surfaced so it never looks lost.
  const bankrollBase = createObservable(0n);
  const creditBase = createObservable(0n);

  /** Maximum playable bet in GAS = min(MAX_BET, bankroll / 2x payout). */
  const maxPayableBet = createDerived(() => {
    const bank = bankrollBase.get();
    if (bank <= 0n) return MAX_BET;
    // Payout is 2x; the house must hold at least the payout to settle a win.
    const payable = fromFixed8(bank) / 2;
    return Math.min(MAX_BET, payable);
  }, [bankrollBase]);

  /** Live "house can pay up to X GAS" hint shown next to the wager input. */
  const formattedMaxPayable = createDerived(
    () => `${maxPayableBet.get().toFixed(2)} ${t("tokenGas")}`,
    [bankrollBase],
  );

  /** Prepaid bet credit in GAS, surfaced to the player as a recoverable chip. */
  const formattedCredit = createDerived(
    () => `${fromFixed8(creditBase.get()).toFixed(2)} ${t("tokenGas")}`,
    [creditBase],
  );
  const hasCredit = createDerived(() => creditBase.get() > 0n, [creditBase]);

  // -- History ----------------------------------------------------------------
  const gameHistory = createObservable<GameHistoryItem[]>([]);

  // -- Connected wallet address (synced from main.tsx / chain) ----------------
  const address = createObservable<string | null>(chain.address.get() ?? null);

  const setAddress = (addr: string | null) => {
    address.set(addr ?? null);
  };

  // -- Formatted display values -----------------------------------------------
  // These are consumed by the manifest stat/sidebar bindings via the state
  // object returned from defineMiniApp's setup().
  const formattedTotalWon = createDerived(() => `${formatNum(totalWon.get())} ${t("tokenGas")}`, []);

  const canBet = createDerived(() => {
    const n = parseFloat(betAmount.get());
    return n >= MIN_BET && n <= MAX_BET && !validationError.get() && !isFlipping.get();
  }, []);

  // -- Validation -------------------------------------------------------------

  const validateBetAmount = (amount: string): string | null => {
    const num = parseFloat(amount);
    if (isNaN(num)) return t("invalidAmountNumber");
    if (num < MIN_BET) return t("minBetError", { min: MIN_BET, tokenGas: t("tokenGas") });
    if (num > MAX_BET) return t("maxBetError", { max: MAX_BET, tokenGas: t("tokenGas") });
    if (!/^\d+(\.\d{1,8})?$/.test(amount.trim())) return t("invalidAmountDecimals");
    return null;
  };

  /**
   * Update the wager amount and recompute the live validation error.
   *
   * Recomputing here keeps validationError in sync with the current amount so a
   * stale error (e.g. from an earlier too-many-decimals entry) self-heals as
   * soon as the user types a valid value. Without this, validationError would
   * stay non-null for the rest of the session and canBet would keep the Flip
   * button disabled forever.
   */
  const setBetAmount = (amount: string) => {
    betAmount.set(amount);
    validationError.set(validateBetAmount(amount));
  };

  // -- Data Loading (direct chain reads) --------------------------------------

  /**
   * Load player stats from getStats(player) → { wins, losses, totalWon }.
   * totalWon is cumulative net profit (base units); display it as whole GAS.
   */
  const loadStats = async () => {
    const playerAddr = address.get();
    const playerHash = playerAddr ? addressToScriptHash(playerAddr) || null : null;
    if (!playerHash) {
      wins.set(0);
      losses.set(0);
      totalWon.set(0);
      return;
    }
    try {
      const raw = await chain.read("getStats", [{ type: "Hash160", value: playerHash }]);
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const record = raw as Record<string, unknown>;
        wins.set(Number(parseBigInt(record.wins)));
        losses.set(Number(parseBigInt(record.losses)));
        totalWon.set(fromFixed8(parseBigInt(record.totalWon)));
      }
    } catch (e) {
      console.warn("[useCoinFlip] loadStats failed:", e instanceof Error ? e.message : String(e));
    }
  };

  /** Read one game record (getGame) into a GameHistoryItem, or null on failure. */
  const readGame = async (gameId: bigint): Promise<GameHistoryItem | null> => {
    try {
      const raw = await chain.read("getGame", [{ type: "Integer", value: gameId.toString() }]);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const record = raw as Record<string, unknown>;
      const won = asBool(record.won);
      const choiceInt = Number(parseBigInt(record.choice));
      const outcomeInt = Number(parseBigInt(record.outcome));
      const wager = parseBigInt(record.wager);
      const payout = parseBigInt(record.payout);
      const time = parseBigInt(record.time);
      return {
        betId: gameId.toString(),
        amount: fromFixed8(wager),
        choice: outcomeToSide(choiceInt),
        outcome: outcomeToSide(outcomeInt),
        won,
        payout: fromFixed8(payout),
        time: time > 0n ? new Date(Number(time)).toISOString() : "",
      };
    } catch (e) {
      console.warn(
        "[useCoinFlip] getGame failed for",
        gameId.toString(),
        ":",
        e instanceof Error ? e.message : String(e),
      );
      return null;
    }
  };

  /**
   * Load the player's game history from getPlayerGames(player, offset, limit) →
   * game ids, then getGame for each. Newest first (the index is appended in
   * play order, so the returned id list is reversed for display).
   */
  const loadHistory = async () => {
    const playerAddr = address.get();
    const playerHash = playerAddr ? addressToScriptHash(playerAddr) || null : null;
    if (!playerHash) {
      gameHistory.set([]);
      return;
    }
    try {
      // The on-chain index is appended in play order; page in the most-recent
      // window from the highest offset so the newest games are returned.
      let total = 0n;
      try {
        total = parseBigInt(
          await chain.read("playerGameCount", [{ type: "Hash160", value: playerHash }]),
        );
      } catch {
        total = 0n;
      }
      if (total <= 0n) {
        gameHistory.set([]);
        return;
      }
      const limit = BigInt(HISTORY_PAGE_LIMIT);
      const offset = total > limit ? total - limit : 0n;

      const idsRaw = await chain.read("getPlayerGames", [
        { type: "Hash160", value: playerHash },
        { type: "Integer", value: offset.toString() },
        { type: "Integer", value: HISTORY_PAGE_LIMIT.toString() },
      ]);
      const ids = Array.isArray(idsRaw)
        ? idsRaw
            .map((id) => parseBigInt(id))
            .filter((id) => id > 0n)
            // Newest first for display.
            .reverse()
        : [];

      const items = (await Promise.all(ids.map((id) => readGame(id)))).filter(
        (item): item is GameHistoryItem => item !== null,
      );
      gameHistory.set(items);
    } catch (e) {
      console.warn("[useCoinFlip] loadHistory failed:", e instanceof Error ? e.message : String(e));
    }
  };

  /**
   * Read the house bankroll (caps the max payable bet) and the player's prepaid
   * bet credit (reusable GAS held on the contract). Both feed pre-flight checks
   * and the recoverable-credit chip, so the user never deposits more than the
   * house can pay and always sees stranded credit.
   */
  const loadBankrollAndCredit = async () => {
    try {
      bankrollBase.set(parseBigInt(await chain.read("bankroll", [])));
    } catch (e) {
      console.warn(
        "[useCoinFlip] bankroll read failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
    const playerAddr = address.get();
    const playerHash = playerAddr ? addressToScriptHash(playerAddr) || null : null;
    if (!playerHash) {
      creditBase.set(0n);
      return;
    }
    try {
      creditBase.set(
        parseBigInt(await chain.read("creditOf", [{ type: "Hash160", value: playerHash }])),
      );
    } catch (e) {
      console.warn(
        "[useCoinFlip] creditOf read failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  /**
   * Load all data (player stats, game history, bankroll + prepaid credit).
   * Called by defineMiniApp on mount and when the wallet connects.
   */
  const loadAll = async () => {
    setAddress(chain.address.get() ?? null);
    await Promise.all([loadStats(), loadHistory(), loadBankrollAndCredit()]);
  };

  // -- Actions (direct on-chain deposit + flip) -------------------------------

  /**
   * Reset the game UI to its initial state.
   */
  const resetGame = () => {
    isFlipping.set(false);
    result.set(null);
    displayOutcome.set(null);
    showWinOverlay.set(false);
  };

  /**
   * Place a coin-flip bet against the standalone contract.
   *
   * Two signed steps, both by the player:
   *   1. DEPOSIT — if creditOf(player) < wager, transfer the wager in GAS to the
   *      contract with the "miniapp-fogplay:bet" memo so OnNEP17Payment credits
   *      the player's bet balance.
   *   2. flip(player, choice, amount) — consumes the wager from credit, settles
   *      the flip ON-CHAIN in the same tx, and on a win pays 2x. The result is
   *      read from the "Flipped" event (outcome slot [3], won slot [4], payout
   *      slot [5]) and drives the win/loss UI.
   *
   * If step 1 lands but step 2 reverts, the prepaid credit persists on the
   * contract under the player and is reused on the next bet — no refund call.
   * When the house bankroll cannot cover the bet, the flip fault is surfaced as
   * a clear "house bankroll too low" message (with the bankroll cap if readable).
   */
  const placeBet = async (): Promise<GameResult> => {
    // -- Validate ---
    const validation = validateBetAmount(betAmount.get());
    if (validation) {
      validationError.set(validation);
      throw new Error(validation);
    }
    validationError.set(null);

    const amountBase = toBaseUnits(betAmount.get());
    if (amountBase <= 0n) {
      validationError.set(t("invalidBetAmount"));
      throw new Error(t("invalidBetAmount"));
    }

    const side = choice.get();
    const choiceInt = choiceToInt(side);

    isFlipping.set(true);
    result.set(null);
    displayOutcome.set(null);
    showWinOverlay.set(false);

    try {
      const playerAddr = address.get() || (await chain.ensureWallet());
      const playerHash = addressToScriptHash(playerAddr || "");
      if (!playerAddr || !playerHash) {
        throw new Error(t("connectWallet"));
      }
      setAddress(playerAddr);

      const contractHash = chain.contractAddress.get();
      if (!contractHash) {
        throw new Error(t("gameErrorFallback"));
      }

      // Pre-flight: read the live bankroll + prepaid credit and refuse a bet the
      // house cannot pay 2x BEFORE depositing, so the wager is never stranded as
      // non-recoverable-without-a-button credit on a guaranteed-to-revert flip.
      await loadBankrollAndCredit();
      const bankroll = bankrollBase.get();
      // The house must hold the full 2x payout to settle a win.
      if (bankroll > 0n && amountBase * 2n > bankroll) {
        throw new Error(
          t("bankrollTooLowCap", {
            max: maxPayableBet.get().toFixed(2),
            tokenGas: t("tokenGas"),
          }),
        );
      }

      // Step 1+2: DEPOSIT then flip. Only top up when existing bet credit can't
      // cover the wager (credit may persist from a prior aborted flip). The
      // prepaid path waits for the deposit to confirm in a block before flip()
      // runs, so the consuming call never test-invokes against pre-deposit state
      // (the deposit→flip race that forced a second click).
      const credit = creditBase.get();
      const flipArgs = [
        { type: "Hash160" as const, value: playerHash },
        { type: "Integer" as const, value: String(choiceInt) },
        { type: "Integer" as const, value: amountBase.toString() },
      ];

      let txResult;
      try {
        if (credit < amountBase) {
          txResult = await chain.prepayAndInvoke(
            amountBase.toString(),
            BET_MEMO,
            "flip",
            flipArgs,
            { waitForEvent: "Flipped" },
          );
        } else {
          // Credit already covers the wager — flip directly, no deposit.
          txResult = await chain.invoke("flip", flipArgs, { waitForEvent: "Flipped" });
        }
      } catch (flipErr) {
        const raw = flipErr instanceof Error ? flipErr.message : String(flipErr);
        // The house bankroll could not cover this bet — surface a clear,
        // actionable message with the bankroll cap when readable.
        if (/bankroll cannot cover/i.test(raw)) {
          throw new Error(await bankrollTooLowMessage());
        }
        // Deposit confirmed but flip reverted — credit is held under the player,
        // reusable on the next bet AND withdrawable. Point the user at recovery.
        if (flipErr instanceof DepositConfirmedActionFailedError) {
          await loadBankrollAndCredit();
          throw new Error(t("betPrepaidNoFlip"));
        }
        throw new Error(raw || t("flipFailed"));
      }

      // Flipped(gameId, player, choice, outcome, won, payout): outcome slot 3,
      // won slot 4, payout slot 5.
      const outcomeInt = Number(parseBigInt(eventValue(txResult.event, 3)));
      const wonFromEvent = eventValue(txResult.event, 4);
      const payoutBase = parseBigInt(eventValue(txResult.event, 5));

      // The event may be unavailable (timeout); fall back to deriving the result
      // from the authoritative win flag — outcome equals the choice on a win.
      const hasEvent = txResult.event != null;
      const won = hasEvent ? asBool(wonFromEvent) : false;
      const outcome: "heads" | "tails" = hasEvent ? outcomeToSide(outcomeInt) : side;

      // Update UI.
      displayOutcome.set(outcome);
      isFlipping.set(false);
      const gameResult: GameResult = { won, outcome: outcome.toUpperCase() };
      result.set(gameResult);

      if (won) {
        const payoutGas = fromFixed8(payoutBase);
        winAmount.set(payoutGas.toFixed(2));
        showWinOverlay.set(true);
        eventBus.emit("coinflip:win", { action: t("youWon"), payout: payoutGas });
      } else {
        eventBus.emit("coinflip:loss", { action: t("youLost") });
      }

      // Reconcile stats + history + bankroll/credit from authoritative state.
      await loadAll();
      return gameResult;
    } catch (e) {
      const message = e instanceof Error ? e.message : t("flipFailed");
      eventBus.emit("coinflip:error", { message });
      isFlipping.set(false);
      throw new Error(message);
    }
  };

  /**
   * Withdraw the player's prepaid bet credit back to their wallet via the
   * contract's withdraw(account) method, then reconcile the credit chip. Used
   * to recover GAS stranded by an aborted flip (money-in with money-out).
   */
  const withdrawCredit = async (): Promise<void> => {
    const playerAddr = address.get() || (await chain.ensureWallet());
    const playerHash = addressToScriptHash(playerAddr || "");
    if (!playerAddr || !playerHash) {
      throw new Error(t("connectWallet"));
    }
    setAddress(playerAddr);
    if (creditBase.get() <= 0n) {
      throw new Error(t("noCreditToWithdraw"));
    }
    await chain.invoke(
      "withdraw",
      [{ type: "Hash160", value: playerHash }],
      { waitForEvent: "CreditWithdrawn" },
    );
    await loadBankrollAndCredit();
  };

  /**
   * Build the "house bankroll too low" message, appending the current bankroll
   * cap when it can be read so the player sees the maximum playable bet.
   */
  const bankrollTooLowMessage = async (): Promise<string> => {
    try {
      const bankrollBase = parseBigInt(await chain.read("bankroll", []));
      if (bankrollBase > 0n) {
        return t("bankrollTooLowCap", { max: formatGas(bankrollBase, 4), tokenGas: t("tokenGas") });
      }
    } catch {
      // Fall through to the generic message when the bankroll can't be read.
    }
    return t("bankrollTooLow");
  };

  /**
   * Dismiss the win overlay.
   */
  const dismissOverlay = () => {
    showWinOverlay.set(false);
  };

  return {
    // -- Raw State ------------------------------------------------------------
    betAmount,
    choice,
    isFlipping,
    result,
    displayOutcome,
    showWinOverlay,
    winAmount,
    validationError,
    wins,
    losses,
    totalWon,
    gameHistory,
    address,
    bankrollBase,
    creditBase,

    // -- Computed --------------------------------------------------------------
    totalGames,
    canBet,
    formattedTotalWon,
    maxPayableBet,
    formattedMaxPayable,
    formattedCredit,
    hasCredit,

    // -- Constants ------------------------------------------------------------
    MIN_BET,
    MAX_BET,
    BET_PRESETS,

    // -- Actions --------------------------------------------------------------
    placeBet,
    withdrawCredit,
    setBetAmount,
    setAddress,
    resetGame,
    dismissOverlay,
    loadAll,
    formatNum,
  };
}

/** Return type of useCoinFlip for use in inject/provide typing */
export type UseCoinFlipReturn = ReturnType<typeof useCoinFlip>;
