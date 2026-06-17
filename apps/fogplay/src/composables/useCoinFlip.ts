/**
 * useCoinFlip — Domain logic for the FogPlay (coin flip) miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppCoinFlipV2)
 * via ctx.services.chain.
 *
 * WHY V2 (commit/reveal): the v1 contract settled a flip in the SAME transaction
 * that took the wager (Runtime.GetRandom read at bet time). That made the outcome
 * knowable inside the betting tx, so a script could abort the transaction whenever
 * it was about to lose and keep retrying for free — a drain. V2 splits every play
 * into two on-chain steps:
 *
 *   1. commit(player, choice, amount)  — escrows the wager, reserves the 2x house
 *      exposure, and records the CURRENT block as the commit block. The outcome
 *      is NOT decided here, so it cannot be peeked/aborted on a loss.
 *      Emits Committed(betId, player, choice, commitIndex).
 *   2. settle(betId)                   — PERMISSIONLESS; reverts unless
 *      Ledger.CurrentIndex > commitIndex + K (K = 3 beacon blocks), i.e. the full
 *      K-block beacon window has cleared. It reveals the outcome from a FIXED
 *      multi-block beacon — the concat-hash of the hashes of the K blocks
 *      commitIndex+1 .. commitIndex+K (all unknown at commit, immutable once
 *      produced) — and pays the winner 2x atomically. Mixing K consecutive block
 *      hashes raises the grinding cost (a single-block beacon could be biased by
 *      that one block's producer); it is NOT VRF-grade, so high-value play should
 *      use the VRF oracle. Emits Settled(betId, player, choice, outcome, won,
 *      payout). Because the beacon is a set of fixed past blocks, re-running settle
 *      in any later block yields the SAME outcome; once a bet is settled, re-calling
 *      settle reverts ("already settled"), so the recorded result is read back.
 *
 * TWO-STEP UX: a play is no longer instant. placeBet() commits, surfaces a clear
 * "Bet placed — revealing on the next block…" pending state, waits one block, then
 * settles and shows the real result. The pending betId is persisted in component
 * state (pendingBetId observable) so a reload can resume, and settle() is exposed
 * via revealResult() as a safe, idempotent retry. A win/loss is NEVER claimed
 * before the Settled event is read.
 *
 * Contract interaction model (verified against MiniAppCoinFlipV2 ABI):
 *
 *   READS (chain.read, default app contract script hash):
 *     bankroll()                         -> Integer (total house bankroll, base)
 *     reservedBankroll()                 -> Integer (exposure reserved by open bets)
 *     freeBankroll()                     -> Integer (bankroll available to back a bet)
 *     creditOf(player)                   -> Integer (prepaid bet credit, base units)
 *     getStats(player)                   -> Map{wins,losses,totalWon}
 *     getPendingBet(betId)               -> Map (pending/settled bet snapshot) or empty
 *     playerGameCount(player)            -> Integer
 *     getPlayerGames(player,off,limit)   -> Integer[] (game/bet ids, newest last)
 *     getGame(gameId)                    -> Map{id,player,choice,outcome,won,wager,payout,time}
 *
 *   MUTATIONS (chain):
 *     commit(player, choice, amount) -> betId  (DEPOSIT-then-commit in one tx via
 *        invokeWithPayment: the wager rides the "miniapp-fogplay:bet" GAS transfer
 *        so OnNEP17Payment credits the player, then commit escrows it. choice
 *        0=heads, 1=tails. betId is read from the Committed event slot [0].)
 *     settle(betId) -> outcome  (PERMISSIONLESS reveal; outcome read from the
 *        Settled event: outcome slot [3], won slot [4], payout slot [5].)
 *     withdraw(account)  (refund any unused prepaid credit to the player.)
 *
 * AMOUNT CONVENTION: the contract takes BASE UNITS (GAS × 1e8). MIN_BET 0.05,
 * MAX_BET 100 GAS — also enforced on-chain. Payout is 2x; the house must hold the
 * full 2x in FREE bankroll, so maxPayableBet = freeBankroll() / 2.
 *
 * The composable owns:
 *   - Reactive state (observables + derived) for manifest/PlayArea bindings
 *   - Bet validation logic (min/max, decimals, choice)
 *   - The commit -> wait-K-block-beacon -> settle lifecycle + a safe settle retry
 *   - Pending-bet persistence (betId/choice/amount) so a reload resumes the reveal
 *   - Win/loss UI updates (overlay, amounts, counters) read from the Settled event
 *   - Loading/flipping UI flags
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

/**
 * Number of consecutive beacon blocks the contract mixes into the reveal entropy
 * (mirrors the contract's BEACON_BLOCKS). settle() reverts until
 * Ledger.CurrentIndex > commitIndex + BEACON_BLOCKS, i.e. the full K-block beacon
 * window has been produced.
 */
const BEACON_BLOCKS = 3;

/**
 * How long to wait, after the commit confirms, before the FIRST settle attempt.
 * settle() reverts until the K-block beacon window has cleared (CurrentIndex >
 * commitIndex + BEACON_BLOCKS), i.e. BEACON_BLOCKS + 1 later blocks must exist. A
 * Neo N3 block is ~15s, so we wait ~(BEACON_BLOCKS + 1) blocks plus a small margin
 * before spending gas on a settle that would otherwise revert. The capped settle
 * retry loop below still covers any remaining lag.
 */
const REVEAL_WAIT_MS = (BEACON_BLOCKS + 1) * 15_000 + 3_000;

/**
 * Backoff between settle retries when the reveal block has not arrived yet (the
 * contract reverts "reveal block not reached"). Capped attempts keep the flow
 * from hanging forever; the user can always retry via revealResult().
 */
const SETTLE_RETRY_DELAY_MS = 8_000;
const SETTLE_MAX_ATTEMPTS = 4;

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

/** A committed-but-not-yet-revealed bet, persisted so a reload can resume. */
export interface PendingBet {
  betId: string;
  choice: "heads" | "tails";
  amount: number;
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

/** Detect "already settled" reverts so a retry reads the recorded result. */
const isAlreadySettled = (raw: string): boolean => /already settled|bet settled|not pending/i.test(raw);

/** Detect "reveal block not reached yet" reverts so we back off and retry. */
const isRevealNotReady = (raw: string): boolean =>
  /reveal block|not reached|too early|same block|current.?index/i.test(raw);

/** Sleep helper for the inter-block reveal wait + settle backoff. */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// Composable
// ============================================================================

export function useCoinFlip({ chain, eventBus, t }: UseCoinFlipOptions) {
  // -- Game State -------------------------------------------------------------
  const betAmount = createObservable("1");
  const choice = createObservable<"heads" | "tails">("heads");
  // isFlipping covers the whole commit -> reveal lifecycle (the Flip button's
  // loading state); revealing narrows it to the post-commit wait/settle phase so
  // the UI can show "revealing on the next block…" distinctly from "committing".
  const isFlipping = createObservable(false);
  const revealing = createObservable(false);
  const result = createObservable<GameResult | null>(null);
  const displayOutcome = createObservable<"heads" | "tails" | null>(null);
  const showWinOverlay = createObservable(false);
  const winAmount = createObservable("0");
  const validationError = createObservable<string | null>(null);

  // -- Pending bet (committed, awaiting reveal) -------------------------------
  // Persisted so a reload can resume the settle and a failed settle can be
  // retried via revealResult(). pendingBet is set the moment commit confirms and
  // cleared once the Settled outcome is read.
  const pendingBet = createObservable<PendingBet | null>(null);
  const hasPendingBet = createDerived(() => pendingBet.get() !== null, [pendingBet]);
  /** True when a committed bet failed to settle and needs a manual retry. */
  const revealFailed = createObservable(false);

  // -- Stats ------------------------------------------------------------------
  const wins = createObservable(0);
  const losses = createObservable(0);
  const totalWon = createObservable(0);
  const totalGames = createDerived(() => wins.get() + losses.get(), []);

  // -- House bankroll + prepaid credit (base units) ---------------------------
  // freeBankroll caps the maximum payable bet (the contract refuses any bet whose
  // 2x exposure the FREE bankroll cannot reserve); prepaid credit is reusable GAS
  // sitting on the contract under the player — surfaced so it never looks lost.
  const bankrollBase = createObservable(0n);
  const freeBankrollBase = createObservable(0n);
  const creditBase = createObservable(0n);

  /** Maximum playable bet in GAS = min(MAX_BET, freeBankroll / 2x payout). */
  const maxPayableBet = createDerived(() => {
    const free = freeBankrollBase.get();
    if (free <= 0n) return MAX_BET;
    // Payout is 2x; the house must reserve the full payout to back a win.
    const payable = fromFixed8(free) / 2;
    return Math.min(MAX_BET, payable);
  }, [freeBankrollBase]);

  /** Live "house can pay up to X GAS" hint shown next to the wager input. */
  const formattedMaxPayable = createDerived(
    () => `${maxPayableBet.get().toFixed(2)} ${t("tokenGas")}`,
    [freeBankrollBase],
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
    return (
      n >= MIN_BET &&
      n <= MAX_BET &&
      !validationError.get() &&
      !isFlipping.get() &&
      // A bet cannot be committed while a prior bet is still awaiting its reveal.
      pendingBet.get() === null
    );
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
   * soon as the user types a valid value.
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
   * Read the house bankroll (total + free) and the player's prepaid bet credit
   * (reusable GAS held on the contract). freeBankroll caps the max payable bet so
   * the user never commits more than the house can reserve 2x; credit feeds the
   * recoverable-credit chip.
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
    try {
      freeBankrollBase.set(parseBigInt(await chain.read("freeBankroll", [])));
    } catch (e) {
      // freeBankroll is the v2 cap; if it can't be read, fall back to the total
      // bankroll so the cap stays conservative rather than unbounded.
      freeBankrollBase.set(bankrollBase.get());
      console.warn(
        "[useCoinFlip] freeBankroll read failed:",
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
   * Called by defineMiniApp on mount and when the wallet connects. Also resumes
   * a settle for any bet that was committed but never revealed (e.g. a reload
   * mid-flow) — kicked off without blocking the load.
   */
  const loadAll = async () => {
    setAddress(chain.address.get() ?? null);
    await Promise.all([loadStats(), loadHistory(), loadBankrollAndCredit()]);
  };

  // -- Actions (commit -> wait K-block beacon -> settle) ----------------------

  /**
   * Reset the game UI to its initial state. Leaves any pending bet intact so the
   * reveal can still be resumed.
   */
  const resetGame = () => {
    isFlipping.set(false);
    revealing.set(false);
    result.set(null);
    displayOutcome.set(null);
    showWinOverlay.set(false);
  };

  /** Clear the in-flight reveal flags + persisted pending bet. */
  const clearPending = () => {
    pendingBet.set(null);
    revealing.set(false);
    revealFailed.set(false);
  };

  /**
   * Apply a revealed Settled outcome to the UI and reconcile chain state.
   * Shared by the in-line reveal and the manual revealResult() retry.
   */
  const applyOutcome = (
    side: "heads" | "tails",
    outcome: "heads" | "tails",
    won: boolean,
    payoutBase: bigint,
  ): GameResult => {
    void side;
    displayOutcome.set(outcome);
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
    return gameResult;
  };

  /**
   * Read the recorded outcome of an already-settled bet from getPendingBet(betId)
   * (the contract keeps the settled snapshot). Returns null when the bet is not
   * found or still unsettled. Used after an "already settled" revert so a retry
   * shows the real result instead of an error.
   */
  const readSettledFromPendingBet = async (betId: string): Promise<GameResult | null> => {
    try {
      const raw = await chain.read("getPendingBet", [{ type: "Integer", value: betId }]);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const record = raw as Record<string, unknown>;
      // A bet that hasn't been settled yet has no recorded outcome.
      if (record.settled !== undefined && !asBool(record.settled)) return null;
      if (record.outcome === undefined) return null;
      const outcomeInt = Number(parseBigInt(record.outcome));
      const won = asBool(record.won);
      const payoutBase = parseBigInt(record.payout);
      const side = outcomeToSide(Number(parseBigInt(record.choice ?? "0")));
      return applyOutcome(side, outcomeToSide(outcomeInt), won, payoutBase);
    } catch (e) {
      console.warn(
        "[useCoinFlip] getPendingBet read failed:",
        e instanceof Error ? e.message : String(e),
      );
      return null;
    }
  };

  /**
   * Settle (reveal) a committed bet. PERMISSIONLESS + idempotent:
   *   - Reverts until a block strictly later than the commit block exists → we
   *     back off and retry up to SETTLE_MAX_ATTEMPTS times.
   *   - Reverts "already settled" once the outcome is recorded → we read the
   *     recorded result from getPendingBet instead of treating it as a failure.
   * Returns the revealed GameResult, or throws if the reveal could not complete
   * within the attempt budget (the caller leaves the pending bet set for a manual
   * retry via revealResult()).
   */
  const settleBet = async (bet: PendingBet): Promise<GameResult> => {
    const settleArgs = [{ type: "Integer" as const, value: bet.betId }];
    let lastError: unknown;

    for (let attempt = 0; attempt < SETTLE_MAX_ATTEMPTS; attempt += 1) {
      try {
        const txResult = await chain.invoke("settle", settleArgs, { waitForEvent: "Settled" });

        // Settled(betId, player, choice, outcome, won, payout): outcome slot 3,
        // won slot 4, payout slot 5. The event is authoritative for the outcome.
        if (txResult.event != null) {
          const outcomeInt = Number(parseBigInt(eventValue(txResult.event, 3)));
          const won = asBool(eventValue(txResult.event, 4));
          const payoutBase = parseBigInt(eventValue(txResult.event, 5));
          return applyOutcome(bet.choice, outcomeToSide(outcomeInt), won, payoutBase);
        }

        // The tx confirmed but the Settled event wasn't indexed in time — the bet
        // IS settled on-chain, so read the recorded outcome back rather than guess.
        const recorded = await readSettledFromPendingBet(bet.betId);
        if (recorded) return recorded;
        // Fall through to retry: the event/state may simply be lagging the indexer.
        lastError = new Error(t("revealPending"));
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        lastError = err;

        // Already settled by us or anyone (permissionless): read the result back.
        if (isAlreadySettled(raw)) {
          const recorded = await readSettledFromPendingBet(bet.betId);
          if (recorded) return recorded;
        }

        // The reveal block hasn't been produced yet — back off and retry.
        if (isRevealNotReady(raw) && attempt < SETTLE_MAX_ATTEMPTS - 1) {
          await sleep(SETTLE_RETRY_DELAY_MS);
          continue;
        }

        // Transient/indexer error — retry within budget before giving up.
        if (attempt < SETTLE_MAX_ATTEMPTS - 1) {
          await sleep(SETTLE_RETRY_DELAY_MS);
          continue;
        }
      }

      if (attempt < SETTLE_MAX_ATTEMPTS - 1) {
        await sleep(SETTLE_RETRY_DELAY_MS);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(t("revealFailedRetry"));
  };

  /**
   * Place a coin-flip bet against the V2 commit/reveal contract.
   *
   * Step 1 — COMMIT: deposit-then-commit in one tx via invokeWithPayment. The
   * wager rides the "miniapp-fogplay:bet" GAS transfer (OnNEP17Payment credits
   * the player); commit then escrows it and reserves the 2x house exposure,
   * recording the current block as the commit block. The betId is read from the
   * Committed event and PERSISTED in pendingBet so a reload/retry can resume.
   * The outcome is NOT decided here.
   *
   * Step 2 — WAIT the K-block beacon window: settle() reverts until
   * CurrentIndex > commitIndex + BEACON_BLOCKS, so we wait ~(BEACON_BLOCKS + 1)
   * blocks (REVEAL_WAIT_MS) before revealing.
   *
   * Step 3 — SETTLE (reveal): settleBet() reveals the outcome from the FIXED
   * K-block beacon (the hashes of blocks commitIndex+1 .. commitIndex+K) and pays
   * the winner 2x. The win/loss UI is driven from the Settled event. If the reveal
   * can't complete, the pending bet is left set so revealResult() can retry — a
   * win/loss is never claimed early.
   */
  const placeBet = async (): Promise<GameResult> => {
    // -- Validate ---
    const validation = validateBetAmount(betAmount.get());
    if (validation) {
      validationError.set(validation);
      throw new Error(validation);
    }
    validationError.set(null);

    if (pendingBet.get() !== null) {
      throw new Error(t("betAlreadyPending"));
    }

    const amountBase = toBaseUnits(betAmount.get());
    if (amountBase <= 0n) {
      validationError.set(t("invalidBetAmount"));
      throw new Error(t("invalidBetAmount"));
    }

    const side = choice.get();
    const choiceInt = choiceToInt(side);
    const amountGas = fromFixed8(amountBase);

    isFlipping.set(true);
    revealing.set(false);
    revealFailed.set(false);
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

      // Pre-flight: read the live FREE bankroll and refuse a bet whose 2x exposure
      // the house cannot reserve BEFORE committing, so the wager is never escrowed
      // against a bet the contract would reject.
      await loadBankrollAndCredit();
      const free = freeBankrollBase.get();
      if (free > 0n && amountBase * 2n > free) {
        throw new Error(
          t("bankrollTooLowCap", {
            max: maxPayableBet.get().toFixed(2),
            tokenGas: t("tokenGas"),
          }),
        );
      }

      // -- Step 1: COMMIT (deposit-then-commit in one tx) ---
      const commitArgs = [
        { type: "Hash160" as const, value: playerHash },
        { type: "Integer" as const, value: String(choiceInt) },
        { type: "Integer" as const, value: amountBase.toString() },
      ];

      let commitResult;
      try {
        commitResult = await chain.invokeWithPayment(
          amountBase.toString(),
          BET_MEMO,
          "commit",
          commitArgs,
          { waitForEvent: "Committed" },
        );
      } catch (commitErr) {
        const raw = commitErr instanceof Error ? commitErr.message : String(commitErr);
        if (/bankroll cannot cover|insufficient (free )?bankroll/i.test(raw)) {
          throw new Error(await bankrollTooLowMessage());
        }
        // Deposit confirmed but commit reverted — credit is held under the player,
        // reusable on the next bet AND withdrawable. Point the user at recovery.
        if (commitErr instanceof DepositConfirmedActionFailedError) {
          await loadBankrollAndCredit();
          throw new Error(t("betPrepaidNoCommit"));
        }
        throw new Error(raw || t("commitFailed"));
      }

      // Committed(betId, player, choice, commitIndex): betId slot 0.
      const betId =
        commitResult.event != null ? parseBigInt(eventValue(commitResult.event, 0)).toString() : "";
      if (!betId || betId === "0") {
        // The commit landed but the betId couldn't be read — the wager is
        // escrowed; surface a recoverable message and refresh credit/bankroll.
        await loadBankrollAndCredit();
        throw new Error(t("commitNoBetId"));
      }

      const bet: PendingBet = { betId, choice: side, amount: amountGas };
      pendingBet.set(bet);

      // -- Step 2: WAIT the K-block beacon window, then -- Step 3: SETTLE (reveal) ---
      revealing.set(true);
      eventBus.emit("coinflip:committed", { action: t("betCommitted"), betId });
      await sleep(REVEAL_WAIT_MS);

      let gameResult: GameResult;
      try {
        gameResult = await settleBet(bet);
      } catch (settleErr) {
        // The bet is committed + escrowed on-chain; the reveal just didn't land.
        // Keep the pending bet so revealResult() can retry — never claim a result.
        revealing.set(false);
        revealFailed.set(true);
        isFlipping.set(false);
        const message = settleErr instanceof Error ? settleErr.message : t("revealFailedRetry");
        eventBus.emit("coinflip:error", { message });
        throw new Error(t("revealFailedRetry"));
      }

      // Reveal complete — clear the pending bet + reconcile authoritative state.
      clearPending();
      isFlipping.set(false);
      await loadAll();
      return gameResult;
    } catch (e) {
      const message = e instanceof Error ? e.message : t("commitFailed");
      // Only emit a generic error when we didn't already emit a settle-specific
      // one (revealFailed is set in the settle catch above).
      if (!revealFailed.get()) {
        eventBus.emit("coinflip:error", { message });
      }
      isFlipping.set(false);
      revealing.set(false);
      throw new Error(message);
    }
  };

  /**
   * Manually reveal (settle) the persisted pending bet. Safe to call repeatedly:
   * settle is permissionless and idempotent. Used by the "Reveal result" retry
   * button and to resume a reveal after a reload. Throws if there is no pending
   * bet or if the reveal still can't complete (the pending bet stays set).
   */
  const revealResult = async (): Promise<GameResult> => {
    const bet = pendingBet.get();
    if (!bet) {
      throw new Error(t("noPendingBet"));
    }
    isFlipping.set(true);
    revealing.set(true);
    revealFailed.set(false);
    try {
      const gameResult = await settleBet(bet);
      clearPending();
      isFlipping.set(false);
      await loadAll();
      return gameResult;
    } catch (settleErr) {
      revealing.set(false);
      revealFailed.set(true);
      isFlipping.set(false);
      const message = settleErr instanceof Error ? settleErr.message : t("revealFailedRetry");
      eventBus.emit("coinflip:error", { message });
      throw new Error(t("revealFailedRetry"));
    }
  };

  /**
   * Withdraw the player's prepaid bet credit back to their wallet via the
   * contract's withdraw(account) method, then reconcile the credit chip. Used
   * to recover GAS stranded by an aborted commit (money-in with money-out).
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
   * Build the "house bankroll too low" message, appending the current free
   * bankroll cap when it can be read so the player sees the maximum playable bet.
   */
  const bankrollTooLowMessage = async (): Promise<string> => {
    try {
      const free = parseBigInt(await chain.read("freeBankroll", []));
      if (free > 0n) {
        return t("bankrollTooLowCap", { max: formatGas(free, 4), tokenGas: t("tokenGas") });
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
    revealing,
    result,
    displayOutcome,
    showWinOverlay,
    winAmount,
    validationError,
    pendingBet,
    revealFailed,
    wins,
    losses,
    totalWon,
    gameHistory,
    address,
    bankrollBase,
    freeBankrollBase,
    creditBase,

    // -- Computed --------------------------------------------------------------
    totalGames,
    canBet,
    hasPendingBet,
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
    revealResult,
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
