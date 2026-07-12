/**
 * useCoinFlip — Domain logic for the FogPlay (coin flip) miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppCoinFlipV2)
 * via ctx.framework.chain.
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
 *      Emits Committed(betId, player, choice, amount, commitIndex).
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
 * "Bet placed — waiting for the three-block beacon…" pending state, waits for the
 * complete beacon window, then settles and shows the real result. The pending bet
 * {betId, choice, amount} is
 * persisted via app.state.persisted (localStorage) so a reload mid-reveal resumes
 * with the manual "Reveal result" path, and settle() is exposed via revealResult()
 * as a safe, idempotent retry. A win/loss is NEVER claimed before the exact
 * getPendingBet snapshot is read and validated.
 *
 * Contract interaction model (verified against MiniAppCoinFlipV2 ABI):
 *
 *   READS (app.chain.readRaw, default app contract script hash):
 *     bankroll()                         -> Integer (total house bankroll, base)
 *     reservedBankroll()                 -> Integer (exposure reserved by open bets)
 *     freeBankroll()                     -> Integer (bankroll available to back a bet)
 *     creditOf(player)                   -> Integer (prepaid bet credit, base units)
 *     getStats(player)                   -> Map{wins,losses,totalWon}
 *     getPendingBet(betId)               -> Map (pending/settled bet snapshot) or empty
 *     playerBetCount(player)             -> Integer
 *     getPlayerBets(player,off,limit)    -> Integer[] (bet ids, newest last)
 *
 *   MUTATIONS (app.chain):
 *     commit(player, choice, amount) -> betId  (DEPOSIT-then-commit in one tx via
 *        invokeWithPayment: the wager rides the "miniapp-fogplay:bet" GAS transfer
 *        so OnNEP17Payment credits the player, then commit escrows it. choice
 *        0=heads, 1=tails. betId is read from the Committed event slot [0].)
 *     settle(betId) -> outcome  (PERMISSIONLESS reveal; the returned event is
 *        only a hint and the result is confirmed from getPendingBet.)
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
 *   - Win/loss UI updates only after exact getPendingBet state readback
 *   - Loading/flipping UI flags
 *   - The player's stats + game history read straight from chain
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { DepositConfirmedActionFailedError } from "@shared/composables/useContractInteraction";
import { gasToBaseUnits as toBaseUnits } from "@shared/utils/amounts";
import { eventValue } from "@shared/utils/chain-events";
import { addressToScriptHash } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { formatNum, fromFixed8, formatGas, sleep } from "@shared/utils/format";

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
export const BET_PRESETS = ["0.25", "0.50", "1.00", "2.00"] as const;

/** Published contract binding retained for readback and future redeployment work. */
export const FOGPLAY_TESTNET_CONTRACT =
  "0x611c3d97dd98792a3c31a0e695704c657f143cda";

/**
 * Production compatibility gate.
 *
 * The public N3 deployments currently report NEF checksum 2385475183 while
 * the reviewed local MiniAppCoinFlipV2 artifact reports 4009970425 and exposes
 * a different ABI. Keep every paid mutation unreachable until a reviewed
 * artifact is deployed and an explicitly authorised live write flow passes.
 */
export const FOGPLAY_PAID_LANE_ENABLED = false;

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
 * before spending gas on a settle that would otherwise revert. If production is
 * slower, the exact pending bet stays recoverable through one deliberate manual
 * retry instead of opening repeated wallet prompts.
 */
const REVEAL_WAIT_MS = (BEACON_BLOCKS + 1) * 15_000 + 3_000;

/**
 * One automatic settle transaction is allowed. Canonical state may be polled
 * read-only afterward; another transaction is always a deliberate user retry.
 */
const SETTLE_MAX_ATTEMPTS = 1;

/** Read-only polls after a settle attempt; these never open another wallet prompt. */
const CANONICAL_READBACK_ATTEMPTS = 4;
const CANONICAL_READBACK_DELAY_MS = 2_000;

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
  /** Exact commit transaction for refresh-safe betId recovery. */
  txid?: string;
  player?: string;
  contract?: string;
  network?: "neo-n3-testnet";
  amountFixed8?: string;
}

export interface UseCoinFlipOptions {
  /** MiniApp framework SDK from ctx.framework (chain args / reads / invokes). */
  app: MiniAppFramework;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Test-only override. Production callers must use the fail-closed default. */
  paidLaneEnabled?: boolean;
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

const normalizedId = (value: unknown): string =>
  String(value ?? "").trim().toLowerCase();

const eventTransactionId = (event: unknown): string => {
  if (!event || typeof event !== "object") return "";
  const record = event as Record<string, unknown>;
  return normalizedId(
    record.tx_hash ?? record.txid ?? record.transaction_hash ?? record.transactionHash,
  );
};

const sameHash = (left: unknown, right: unknown): boolean =>
  normalizedId(left).replace(/^0x/, "") === normalizedId(right).replace(/^0x/, "");

const eventPlayerMatches = (value: unknown, expected: unknown): boolean => {
  const target = normalizedId(expected).replace(/^0x/, "");
  const raw = String(value ?? "").trim();
  const direct = normalizedId(raw).replace(/^0x/, "");
  if (!target || !direct) return false;
  if (direct === target) return true;
  if (/^[0-9a-f]{40}$/i.test(direct)) {
    return (direct.match(/../g) ?? []).reverse().join("") === target;
  }
  try {
    const bytes = Uint8Array.from(globalThis.atob(raw), (char) => char.charCodeAt(0));
    if (bytes.length !== 20) return false;
    const forward = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const reverse = Array.from(bytes).reverse().map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return forward === target || reverse === target;
  } catch {
    return false;
  }
};

const normalizedNetwork = (value: unknown): string => {
  const raw = normalizedId(value);
  if (raw === "testnet" || raw === "neo-n3-testnet") return "neo-n3-testnet";
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "neo-n3-mainnet";
  return raw;
};

class SettlementVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettlementVerificationError";
  }
}

// ============================================================================
// Composable
// ============================================================================

export function useCoinFlip({
  app,
  t,
  paidLaneEnabled = FOGPLAY_PAID_LANE_ENABLED,
}: UseCoinFlipOptions) {
  // -- Game State -------------------------------------------------------------
  const betAmount = createObservable("1");
  const choice = createObservable<"heads" | "tails">("heads");
  // isFlipping covers the whole commit -> reveal lifecycle (the Flip button's
  // loading state); revealing narrows it to the post-commit wait/settle phase so
  // the UI can show the multi-block beacon wait distinctly from "committing".
  const isFlipping = createObservable(false);
  const revealing = createObservable(false);
  const result = createObservable<GameResult | null>(null);
  const displayOutcome = createObservable<"heads" | "tails" | null>(null);
  const showWinOverlay = createObservable(false);
  const winAmount = createObservable("0");
  const validationError = createObservable<string | null>(null);

  // -- Pending bet (committed, awaiting reveal) -------------------------------
  // Persisted (app.state.persisted → localStorage under the app's namespace) so
  // a reload can resume the settle and a failed settle can be retried via
  // revealResult(). pendingBet is set the moment commit confirms and cleared
  // once the Settled outcome is read; loadAll() surfaces a restored pending bet
  // as a stalled reveal so the manual "Reveal result" path is visible again.
  const pendingBet = app.state.persisted<PendingBet | null>("pendingBet", null);
  const hasPendingBet = createDerived(() => pendingBet.get() !== null, [pendingBet]);
  /** True when a committed bet failed to settle and needs a manual retry. */
  const revealFailed = createObservable(false);

  // -- Stats ------------------------------------------------------------------
  const wins = createObservable(0);
  const losses = createObservable(0);
  const totalWon = createObservable(0);
  const totalGames = createDerived(() => wins.get() + losses.get(), [wins, losses]);

  // -- House bankroll + prepaid credit (base units) ---------------------------
  // freeBankroll caps the maximum payable bet (the contract refuses any bet whose
  // 2x exposure the FREE bankroll cannot reserve); prepaid credit is reusable GAS
  // sitting on the contract under the player — surfaced so it never looks lost.
  const bankrollBase = createObservable(0n);
  const freeBankrollBase = createObservable(0n);
  const creditBase = createObservable(0n);
  const creditLoaded = createObservable(false);
  const bankrollLoaded = createObservable(false);
  const paidRuntimeValidated = createObservable(false);
  const bankrollAvailable = createDerived(
    () =>
      app.mode.isGuest() ||
      (paidRuntimeValidated.get() && bankrollLoaded.get() && freeBankrollBase.get() > 0n),
    [paidRuntimeValidated, bankrollLoaded, freeBankrollBase],
  );

  /** Maximum playable bet in GAS = min(MAX_BET, freeBankroll / 2x payout). */
  const maxPayableBet = createDerived(() => {
    if (app.mode.isGuest()) return MAX_BET;
    if (!paidRuntimeValidated.get() || !bankrollLoaded.get()) return 0;
    const free = freeBankrollBase.get();
    if (free <= 0n) return 0;
    // Payout is 2x; the house must reserve the full payout to back a win.
    const payable = fromFixed8(free) / 2;
    return Math.min(MAX_BET, payable);
  }, [paidRuntimeValidated, bankrollLoaded, freeBankrollBase]);

  /** Live "house can pay up to X GAS" hint shown next to the wager input. */
  const formattedMaxPayable = createDerived(
    () => `${maxPayableBet.get().toFixed(2)} ${t("tokenGas")}`,
    [paidRuntimeValidated, bankrollLoaded, freeBankrollBase],
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
  const address = createObservable<string | null>(app.chain.address.get() ?? null);

  const setAddress = (addr: string | null) => {
    address.set(addr ?? null);
  };

  /**
   * The V2 contract exists on more than one network, but only the testnet
   * deployment has a current end-to-end commit/reveal/withdraw validation.
   * Resolve the host network and exact contract before any wallet prompt or
   * mutation so stale manifests cannot open an unverified paid lane.
   */
  const validatePaidRuntime = async (): Promise<boolean> => {
    if (app.mode.isGuest()) {
      paidRuntimeValidated.set(false);
      return false;
    }
    if (!paidLaneEnabled) {
      paidRuntimeValidated.set(false);
      return false;
    }
    try {
      const [network, contract] = await Promise.all([
        app.chain.detectNetwork(),
        Promise.resolve(app.chain.contractAddress.get()),
      ]);
      const valid =
        normalizedNetwork(network) === "neo-n3-testnet" &&
        sameHash(contract, FOGPLAY_TESTNET_CONTRACT);
      paidRuntimeValidated.set(valid);
      return valid;
    } catch {
      paidRuntimeValidated.set(false);
      return false;
    }
  };

  const assertPaidRuntime = async (): Promise<"neo-n3-testnet"> => {
    if (!(await validatePaidRuntime())) {
      throw new Error(t("paidLaneUnavailable"));
    }
    return "neo-n3-testnet";
  };

  const assertPendingContext = (bet: PendingBet): void => {
    const currentContract = app.chain.contractAddress.get();
    if (!bet.contract || !sameHash(bet.contract, currentContract)) {
      throw new Error(t("pendingBetWrongNetwork"));
    }
    if (bet.network !== "neo-n3-testnet") {
      throw new Error(t("pendingBetWrongNetwork"));
    }
  };

  // -- Formatted display values -----------------------------------------------
  // These are consumed by the manifest stat/sidebar bindings via the state
  // object returned from defineMiniApp's setup().
  const formattedTotalWon = createDerived(
    () => `${formatNum(totalWon.get())} ${t("tokenGas")}`,
    [totalWon],
  );

  const canBet = createDerived(() => {
    const amount = betAmount.get();
    const amountBase = toBaseUnits(amount);
    if (amountBase <= 0n || validateBetAmount(amount)) return false;
    return (
      // The house must be able to back the 2x payout — gate the button on the
      // live payable cap so an over-cap bet is disabled rather than enabled then
      // rejected at pre-flight. (maxPayableBet is MAX_BET until bankroll loads.)
      fromFixed8(amountBase) <= maxPayableBet.get() &&
      bankrollAvailable.get() &&
      !isFlipping.get() &&
      // A bet cannot be committed while a prior bet is still awaiting its reveal.
      pendingBet.get() === null
    );
  }, [betAmount, maxPayableBet, bankrollAvailable, isFlipping, pendingBet]);

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
      const raw = await app.chain.readRaw("getStats", [app.chain.arg.hash160(playerHash)]);
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

  /** Read one exact, internally consistent deployed-V2 bet snapshot. */
  const readBet = async (
    betId: bigint,
    playerHash: string,
  ): Promise<GameHistoryItem | null> => {
    try {
      const raw = await app.chain.readRaw("getPendingBet", [app.chain.arg.integer(betId)]);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const record = raw as Record<string, unknown>;
      if (
        parseBigInt(record.id) !== betId ||
        !eventPlayerMatches(record.player, playerHash) ||
        !asBool(record.settled)
      ) return null;
      const won = asBool(record.won);
      const choiceInt = Number(parseBigInt(record.choice));
      const outcomeInt = Number(parseBigInt(record.outcome));
      const wager = parseBigInt(record.wager);
      const payout = parseBigInt(record.payout);
      const time = parseBigInt(record.settleTime ?? record.commitTime);
      if (![0, 1].includes(choiceInt) || ![0, 1].includes(outcomeInt)) return null;
      const expectedWon = choiceInt === outcomeInt;
      const expectedPayout = expectedWon ? wager * 2n : 0n;
      if (won !== expectedWon || payout !== expectedPayout) return null;
      return {
        betId: betId.toString(),
        amount: fromFixed8(wager),
        choice: outcomeToSide(choiceInt),
        outcome: outcomeToSide(outcomeInt),
        won,
        payout: fromFixed8(payout),
        time: time > 0n ? new Date(Number(time)).toISOString() : "",
      };
    } catch (e) {
      console.warn(
        "[useCoinFlip] getPendingBet failed for",
        betId.toString(),
        ":",
        e instanceof Error ? e.message : String(e),
      );
      return null;
    }
  };

  /**
   * Load the player's game history from getPlayerBets(player, offset, limit) →
   * bet ids, then getPendingBet for each. Newest first (the index is appended in
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
      const total = await app.chain
        .query("playerBetCount", [app.chain.arg.hash160(playerHash)])
        .asBigInt(0n);
      if (total <= 0n) {
        gameHistory.set([]);
        return;
      }
      const limit = BigInt(HISTORY_PAGE_LIMIT);
      const offset = total > limit ? total - limit : 0n;

      const idsRaw = await app.chain.readRaw("getPlayerBets", [
        app.chain.arg.hash160(playerHash),
        app.chain.arg.integer(offset),
        app.chain.arg.integer(HISTORY_PAGE_LIMIT),
      ]);
      const ids = Array.isArray(idsRaw)
        ? idsRaw
            .map((id) => parseBigInt(id))
            .filter((id) => id > 0n)
            // Newest first for display.
            .reverse()
        : [];

      const items = (await Promise.all(ids.map((id) => readBet(id, playerHash)))).filter(
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
      bankrollBase.set(await app.chain.query("bankroll", []).asBigInt());
    } catch (e) {
      console.warn(
        "[useCoinFlip] bankroll read failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
    try {
      freeBankrollBase.set(await app.chain.query("freeBankroll", []).asBigInt());
      bankrollLoaded.set(true);
    } catch (e) {
      // Never substitute total bankroll for free bankroll: reserved exposure may
      // make that quote unsafe. Keep the wager action gated until this read works.
      freeBankrollBase.set(0n);
      bankrollLoaded.set(false);
      console.warn(
        "[useCoinFlip] freeBankroll read failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
    const playerAddr = address.get();
    const playerHash = playerAddr ? addressToScriptHash(playerAddr) || null : null;
    if (!playerHash) {
      creditBase.set(0n);
      creditLoaded.set(true);
      return;
    }
    try {
      creditBase.set(
        await app.chain.query("creditOf", [app.chain.arg.hash160(playerHash)]).asBigInt(),
      );
      creditLoaded.set(true);
    } catch (e) {
      creditBase.set(0n);
      creditLoaded.set(false);
      console.warn(
        "[useCoinFlip] creditOf read failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  /**
   * Load all data (player stats, game history, bankroll + prepaid credit).
   * Called by defineMiniApp on mount and when the wallet connects. Also checks
   * for a persisted committed-but-unrevealed bet (e.g. a reload mid-reveal) and
   * surfaces it as a stalled reveal so the manual "Reveal result" retry is
   * visible — settle stays user-triggered (permissionless + idempotent), so no
   * transaction is auto-fired here.
   */
  const loadAll = async () => {
    setAddress(app.chain.address.get() ?? null);
    if (!(await validatePaidRuntime())) {
      bankrollBase.set(0n);
      freeBankrollBase.set(0n);
      creditBase.set(0n);
      creditLoaded.set(false);
      bankrollLoaded.set(false);
      if (pendingBet.get() !== null) revealFailed.set(true);
      validationError.set(t("paidLaneUnavailable"));
      return;
    }
    if (validationError.get() === t("paidLaneUnavailable")) {
      validationError.set(null);
    }
    const storedPending = pendingBet.get();
    if (storedPending && !storedPending.betId) {
      await recoverCommittedBet(storedPending);
    }
    if (pendingBet.get() !== null && !isFlipping.get() && !revealing.get()) {
      revealFailed.set(true);
    }
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
    winAmount.set("0");
  };

  /** Clear the in-flight reveal flags + persisted pending bet. */
  const clearPending = () => {
    pendingBet.set(null);
    revealing.set(false);
    revealFailed.set(false);
  };

  /**
   * Recover only the Committed event belonging to the exact persisted txid.
   * Never substitutes the player's newest event, which could be another tab's
   * wager. This is read-only and safe to run during load or a manual retry.
   */
  const recoverCommittedBet = async (bet: PendingBet): Promise<PendingBet | null> => {
    if (bet.betId) return bet;
    assertPendingContext(bet);
    const expectedTxid = normalizedId(bet.txid);
    if (!expectedTxid) return null;
    try {
      const events = await app.chain.events("Committed", { limit: 100 });
      const event = events.find(
        (candidate) => sameHash(eventTransactionId(candidate), expectedTxid),
      );
      if (!event) return null;
      if (bet.player && !eventPlayerMatches(eventValue(event, 1), bet.player)) return null;
      if (Number(parseBigInt(eventValue(event, 2))) !== choiceToInt(bet.choice)) return null;
      const expectedAmount = parseBigInt(bet.amountFixed8 ?? toBaseUnits(String(bet.amount)));
      if (parseBigInt(eventValue(event, 3)) !== expectedAmount) return null;
      const betId = parseBigInt(eventValue(event, 0)).toString();
      if (!betId || betId === "0") return null;
      const recovered = { ...bet, betId };
      pendingBet.set(recovered);
      return recovered;
    } catch {
      return null;
    }
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
    if (won !== (outcome === side)) {
      throw new SettlementVerificationError(t("settlementVerificationFailed"));
    }
    displayOutcome.set(outcome);
    const gameResult: GameResult = { won, outcome: outcome.toUpperCase() };
    result.set(gameResult);
    if (won) {
      const payoutGas = fromFixed8(payoutBase);
      winAmount.set(payoutGas.toFixed(2));
      showWinOverlay.set(true);
    } else {
      winAmount.set("0");
      showWinOverlay.set(false);
    }
    return gameResult;
  };

  const expectedWagerBase = (bet: PendingBet): bigint =>
    parseBigInt(bet.amountFixed8 ?? toBaseUnits(String(bet.amount)));

  const applyVerifiedSettlement = (
    bet: PendingBet,
    outcomeRaw: unknown,
    wonRaw: unknown,
    payoutRaw: unknown,
  ): GameResult => {
    const outcomeInt = Number(parseBigInt(outcomeRaw));
    if (outcomeInt !== 0 && outcomeInt !== 1) {
      throw new SettlementVerificationError(t("settlementVerificationFailed"));
    }
    const outcome = outcomeToSide(outcomeInt);
    const won = asBool(wonRaw);
    const payoutBase = parseBigInt(payoutRaw);
    const expectedPayout = won ? expectedWagerBase(bet) * 2n : 0n;
    if (won !== (outcome === bet.choice) || payoutBase !== expectedPayout) {
      throw new SettlementVerificationError(t("settlementVerificationFailed"));
    }
    return applyOutcome(bet.choice, outcome, won, payoutBase);
  };

  /**
   * Read the recorded outcome of an already-settled bet from getPendingBet(betId)
   * (the contract keeps the settled snapshot). Returns null when the bet is not
   * found or still unsettled. Used after an "already settled" revert so a retry
   * shows the real result instead of an error.
   */
  const readSettledFromPendingBet = async (bet: PendingBet): Promise<GameResult | null> => {
    try {
      assertPendingContext(bet);
      const raw = await app.chain.readRaw("getPendingBet", [app.chain.arg.integer(bet.betId)]);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const record = raw as Record<string, unknown>;
      if (
        parseBigInt(record.id) !== parseBigInt(bet.betId) ||
        !bet.player ||
        !eventPlayerMatches(record.player, bet.player) ||
        Number(parseBigInt(record.choice)) !== choiceToInt(bet.choice) ||
        parseBigInt(record.wager) !== expectedWagerBase(bet)
      ) {
        throw new SettlementVerificationError(t("settlementVerificationFailed"));
      }
      // A canonical terminal flag is mandatory. Presence of outcome-like fields
      // alone is never enough to label the wager settled.
      if (!asBool(record.settled)) return null;
      if (record.outcome === undefined || record.won === undefined || record.payout === undefined) {
        throw new SettlementVerificationError(t("settlementVerificationFailed"));
      }
      return applyVerifiedSettlement(bet, record.outcome, record.won, record.payout);
    } catch (e) {
      if (e instanceof SettlementVerificationError) throw e;
      console.warn(
        "[useCoinFlip] getPendingBet read failed:",
        e instanceof Error ? e.message : String(e),
      );
      return null;
    }
  };

  /**
   * Wait briefly for the exact persisted state to become readable after a
   * confirmed settle. This is read-only polling: it cannot choose an outcome,
   * spend GAS, or create repeated wallet prompts.
   */
  const waitForCanonicalSettlement = async (
    bet: PendingBet,
  ): Promise<GameResult | null> => {
    for (let attempt = 0; attempt < CANONICAL_READBACK_ATTEMPTS; attempt += 1) {
      const recorded = await readSettledFromPendingBet(bet);
      if (recorded) return recorded;
      if (attempt + 1 < CANONICAL_READBACK_ATTEMPTS) {
        await sleep(CANONICAL_READBACK_DELAY_MS);
      }
    }
    return null;
  };

  /**
   * Settle (reveal) a committed bet. PERMISSIONLESS + idempotent:
   *   - Reverts until a block strictly later than the beacon window exists.
   *   - Reverts "already settled" once the outcome is recorded → we read the
   *     recorded result from getPendingBet instead of treating it as a failure.
   * Returns the revealed GameResult, or throws if the reveal could not complete
   * within the attempt budget (the caller leaves the pending bet set for a manual
   * retry via revealResult()).
   */
  const settleBet = async (bet: PendingBet): Promise<GameResult> => {
    assertPendingContext(bet);
    const settleArgs = [app.chain.arg.integer(bet.betId)];
    let lastError: unknown;

    // Another permissionless caller may already have settled this exact bet.
    const beforeInvoke = await readSettledFromPendingBet(bet);
    if (beforeInvoke) return beforeInvoke;

    for (let attempt = 0; attempt < SETTLE_MAX_ATTEMPTS; attempt += 1) {
      try {
        const txResult = await app.chain.invoke("settle", settleArgs, {
          waitForEvent: "Settled",
          waitTimeoutMs: 30_000,
        });

        // The event is only an envelope hint. Never read outcome/won/payout from
        // it into the UI; exact persisted state is the sole confirmation source.
        let eventIdentityMatches = true;
        if (txResult.event != null) {
          const event = txResult.event;
          eventIdentityMatches =
            parseBigInt(eventValue(event, 0)) === parseBigInt(bet.betId) &&
            (!bet.player || eventPlayerMatches(eventValue(event, 1), bet.player)) &&
            Number(parseBigInt(eventValue(event, 2))) === choiceToInt(bet.choice);
        }

        const recorded = await waitForCanonicalSettlement(bet);
        if (recorded) return recorded;
        if (!eventIdentityMatches) {
          throw new SettlementVerificationError(t("settlementVerificationFailed"));
        }
        // A tx broadcast or matching event without canonical readback remains
        // unresolved. The exact pending bet is retained for deliberate retry.
        lastError = new Error(t("revealPending"));
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        lastError = err;

        // Already settled by us or anyone (permissionless): read the result back.
        if (isAlreadySettled(raw)) {
          const recorded = await waitForCanonicalSettlement(bet);
          if (recorded) return recorded;
        }

        // A confirmed event/state identity mismatch is not transient. Never
        // spend more GAS retrying a transaction whose result cannot be proven.
        if (err instanceof SettlementVerificationError) throw err;

        // One automatic settle attempt avoids surprising repeated wallet
        // prompts. A not-ready or transient failure remains manually retryable.
        if (isRevealNotReady(raw)) lastError = err;
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
   * the winner 2x. The win/loss UI is driven only from exact canonical
   * getPendingBet readback after settlement. If the reveal can't complete, the
   * pending bet is left set so revealResult() can retry — a win/loss is never
   * claimed early from animation, broadcast, or an event envelope.
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

    // Fail closed before ensureWallet() so an old host, wrong network, or
    // wrong contract cannot even open a signing prompt for a new wager.
    const network = await assertPaidRuntime();

    const side = choice.get();
    const choiceInt = choiceToInt(side);
    const amountGas = fromFixed8(amountBase);

    isFlipping.set(true);
    revealing.set(false);
    revealFailed.set(false);
    result.set(null);
    displayOutcome.set(null);
    showWinOverlay.set(false);
    winAmount.set("0");

    try {
      const playerAddr = address.get() || (await app.chain.ensureWallet());
      const playerHash = addressToScriptHash(playerAddr || "");
      if (!playerAddr || !playerHash) {
        throw new Error(t("connectWallet"));
      }
      setAddress(playerAddr);

      const contractHash = app.chain.contractAddress.get();
      if (!contractHash) {
        throw new Error(t("gameErrorFallback"));
      }

      // Pre-flight: read the live FREE bankroll and refuse a bet whose 2x exposure
      // the house cannot reserve BEFORE committing, so the wager is never escrowed
      // against a bet the contract would reject.
      await loadBankrollAndCredit();
      const free = freeBankrollBase.get();
      if (!bankrollLoaded.get() || free <= 0n || amountBase * 2n > free) {
        throw new Error(
          t("bankrollTooLowCap", {
            max: maxPayableBet.get().toFixed(2),
            tokenGas: t("tokenGas"),
          }),
        );
      }
      if (!creditLoaded.get()) {
        throw new Error(t("balanceReadUnavailable"));
      }

      // -- Step 1: COMMIT (deposit-then-commit in one tx) ---
      const commitArgs = [
        app.chain.arg.hash160(playerHash),
        app.chain.arg.integer(choiceInt),
        app.chain.arg.integer(amountBase),
      ];

      // Existing prepaid credit is real player money. Consume it first and send
      // only the missing amount; otherwise every retry would charge the wallet
      // again while leaving the recoverable credit untouched.
      const reusableCredit = creditBase.get();
      const paymentShortfall = amountBase > reusableCredit
        ? amountBase - reusableCredit
        : 0n;
      let commitResult;
      const broadcastRecord = (txid: string): void => {
        if (!txid) return;
        pendingBet.set({
          betId: "",
          txid,
          player: playerHash,
          contract: contractHash,
          network,
          amountFixed8: amountBase.toString(),
          choice: side,
          amount: amountGas,
        });
      };
      try {
        commitResult = paymentShortfall > 0n
          ? await app.chain.invokeWithPayment(
              paymentShortfall.toString(),
              BET_MEMO,
              "commit",
              commitArgs,
              {
                waitForEvent: "Committed",
                onTransactionSent: broadcastRecord,
              },
            )
          : await app.chain.invoke("commit", commitArgs, {
              waitForEvent: "Committed",
              onTransactionSent: broadcastRecord,
            });
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

      // Committed(betId, player, choice, amount, commitIndex). Do not accept a
      // bet id until every identity field matches the requested wager.
      let betId = "";
      if (commitResult.event != null) {
        const event = commitResult.event;
        const identityMatches =
          eventPlayerMatches(eventValue(event, 1), playerHash) &&
          Number(parseBigInt(eventValue(event, 2))) === choiceInt &&
          parseBigInt(eventValue(event, 3)) === amountBase;
        if (!identityMatches) {
          revealFailed.set(true);
          throw new Error(t("commitIdentityMismatch"));
        }
        betId = parseBigInt(eventValue(event, 0)).toString();
      }
      // Some host adapters do not expose the early callback; the returned txid
      // still closes the refresh window before we surface an indexer timeout.
      if (commitResult.txid && pendingBet.get() === null) {
        broadcastRecord(commitResult.txid);
      }
      if (!betId || betId === "0") {
        // The commit landed but the betId couldn't be read — the wager is
        // escrowed; surface a recoverable message and refresh credit/bankroll.
        await loadBankrollAndCredit();
        revealFailed.set(true);
        throw new Error(t("commitNoBetId"));
      }

      const bet: PendingBet = {
        betId,
        txid: commitResult.txid,
        player: playerHash,
        contract: contractHash,
        network,
        amountFixed8: amountBase.toString(),
        choice: side,
        amount: amountGas,
      };
      pendingBet.set(bet);

      // -- Step 2: WAIT the K-block beacon window, then -- Step 3: SETTLE (reveal) ---
      revealing.set(true);
      await sleep(REVEAL_WAIT_MS);

      let gameResult: GameResult;
      try {
        gameResult = await settleBet(bet);
      } catch {
        // The bet is committed + escrowed on-chain; the reveal just didn't land.
        // Keep the pending bet so revealResult() can retry — never claim a result.
        revealing.set(false);
        revealFailed.set(true);
        isFlipping.set(false);
        throw new Error(t("revealFailedRetry"));
      }

      // Reveal complete — clear the pending bet + reconcile authoritative state.
      clearPending();
      isFlipping.set(false);
      await loadAll();
      return gameResult;
    } catch (e) {
      const message = e instanceof Error ? e.message : t("commitFailed");
      isFlipping.set(false);
      revealing.set(false);
      if (pendingBet.get() !== null) revealFailed.set(true);
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
    await assertPaidRuntime();
    const storedBet = pendingBet.get();
    if (!storedBet) {
      throw new Error(t("noPendingBet"));
    }
    const bet = storedBet.betId
      ? storedBet
      : await recoverCommittedBet(storedBet);
    if (!bet) {
      revealFailed.set(true);
      throw new Error(t("commitNoBetId"));
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
    } catch (error) {
      revealing.set(false);
      revealFailed.set(true);
      isFlipping.set(false);
      if (
        error instanceof SettlementVerificationError ||
        (error instanceof Error && error.message === t("pendingBetWrongNetwork"))
      ) {
        throw error;
      }
      throw new Error(t("revealFailedRetry"));
    }
  };

  /**
   * Withdraw the player's prepaid bet credit back to their wallet via the
   * contract's withdraw(account) method, then reconcile the credit chip. Used
   * to recover GAS stranded by an aborted commit (money-in with money-out).
   */
  const withdrawCredit = async (): Promise<void> => {
    await assertPaidRuntime();
    const playerAddr = address.get() || (await app.chain.ensureWallet());
    const playerHash = addressToScriptHash(playerAddr || "");
    if (!playerAddr || !playerHash) {
      throw new Error(t("connectWallet"));
    }
    setAddress(playerAddr);
    await loadBankrollAndCredit();
    if (!creditLoaded.get()) {
      throw new Error(t("balanceReadUnavailable"));
    }
    const creditBefore = creditBase.get();
    if (creditBefore <= 0n) {
      throw new Error(t("noCreditToWithdraw"));
    }
    const txResult = await app.chain.invoke(
      "withdraw",
      [app.chain.arg.hash160(playerHash)],
      { waitForEvent: "CreditWithdrawn" },
    );
    if (txResult.event != null) {
      const accountMatches = eventPlayerMatches(eventValue(txResult.event, 0), playerHash);
      const amountMatches = parseBigInt(eventValue(txResult.event, 1)) === creditBefore;
      if (!accountMatches || !amountMatches) {
        throw new Error(t("withdrawVerificationFailed"));
      }
    }
    await loadBankrollAndCredit();
    if (creditBase.get() !== 0n) {
      throw new Error(t("withdrawVerificationFailed"));
    }
  };

  /**
   * Build the "house bankroll too low" message, appending the current free
   * bankroll cap when it can be read so the player sees the maximum playable bet.
   */
  const bankrollTooLowMessage = async (): Promise<string> => {
    try {
      const free = await app.chain.query("freeBankroll", []).asBigInt();
      if (free > 0n) {
        return t("bankrollTooLowCap", {
          max: formatGas(free / 2n, 4),
          tokenGas: t("tokenGas"),
        });
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
    creditLoaded,
    bankrollLoaded,
    paidRuntimeValidated,
    bankrollAvailable,
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
