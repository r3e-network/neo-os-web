/**
 * useCoinFlip -- Domain logic for the FogPlay (coin flip) miniapp
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (GameProxy, PaymentProxy, StorageProxy, BadgeProxy) via edge
 * functions, so this file contains zero contract hashes, parameter encoding,
 * or event parsing logic. Oracle VRF randomness is still accessed through
 * ctx.services.oracle (a platform service, not an OS contract).
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.read("GetPlayerStats", [{ type: "Hash160", value: addr }])
 *     chain.invokeWithPayment(amount, memo, "placeBet", [...])
 *     chain.listEvents("BetResolved", { limit: 20 })
 *     chain.ensureWallet()
 *
 *   AFTER (OS proxy + oracle):
 *     ctx.os.storage.get("playerStats")              — load player stats
 *     ctx.os.payment.deposit(amount, "fogplay:bet")   — prepay GAS
 *     ctx.os.game.placeBet("current", betParams)      — place bet on contract
 *     ctx.os.game.getPoolState("resolve:<betId>")     — poll for settlement
 *     ctx.os.storage.list("history:", 20)              — load game history
 *     ctx.os.badge.award("first-flip", "")             — hint achievements
 *     ctx.services.oracle.requestRandom(context)       — VRF randomness
 *
 * The composable still owns:
 *   - Reactive state (refs + computed) for manifest bindings
 *   - Bet validation logic (min/max, decimals)
 *   - Win/loss UI updates (overlay, amounts, counters)
 *   - Loading/flipping UI flags
 *   - Formatted display values
 *
 * Key design decisions:
 *   - No onMounted/onUnmounted -- lifecycle is managed by defineMiniApp
 *     which calls loadAll via the returned `loadData` callback
 *   - No usePlatformServices() inject -- services are passed in explicitly
 *     so this composable works regardless of the component tree setup
 *   - OracleService integration: demonstrates how oracle.requestRandom()
 *     feeds VRF randomness into the game flow for provably fair results
 */

import { ref, computed } from "vue";
import type { GameProxy } from "@shared/services/os/GameProxy";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import type { OracleService, EventBus } from "@shared/services";
import { formatNum, toFixed8 } from "@shared/utils/format";

// ============================================================================
// Constants
// ============================================================================

const APP_ID = "miniapp-fogplay";

/** Minimum bet in GAS */
export const MIN_BET = 0.05;

/** Maximum bet in GAS */
export const MAX_BET = 100;

/** Preset wager amounts shown in the UI */
export const BET_PRESETS = ["1", "5", "10", "50"] as const;

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
  /** OS GameProxy instance from ctx.os.game */
  gameService: GameProxy;
  /** OS PaymentProxy instance from ctx.os.payment */
  paymentService: PaymentProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** OracleService instance from ctx.services.oracle (VRF randomness) */
  oracle: OracleService;
  /** EventBus instance from ctx.services.events */
  eventBus: EventBus;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * Shape of the pool state returned by GameProxy for FogPlay.
 * The edge function translates getPoolState("resolve:<betId>") into
 * a BetResolved event lookup and returns normalized data.
 */
interface ResolvedBetState {
  poolId: string;
  appId: string;
  status: "open" | "active" | "settled" | "cancelled";
  playerCount: number;
  totalBets: string;
  // Game-specific extensions from the edge function
  betId?: string;
  payout?: number;
  won?: boolean;
  outcome?: string;
}

/** Shape of a stored history entry from StorageProxy. */
interface StoredHistoryEntry {
  betId: string;
  amount: number;
  choice: "heads" | "tails";
  outcome: "heads" | "tails";
  won: boolean;
  payout: number;
  time: string;
}

/** Shape of player stats from StorageProxy. */
interface StoredPlayerStats {
  wins: number;
  losses: number;
  totalWon: number;
}

// ============================================================================
// Composable
// ============================================================================

export function useCoinFlip({
  gameService,
  paymentService,
  storageService,
  badgeService,
  oracle,
  eventBus,
  t,
}: UseCoinFlipOptions) {
  // -- Game State -------------------------------------------------------------
  const betAmount = ref("1");
  const choice = ref<"heads" | "tails">("heads");
  const isFlipping = ref(false);
  const result = ref<GameResult | null>(null);
  const displayOutcome = ref<"heads" | "tails" | null>(null);
  const showWinOverlay = ref(false);
  const winAmount = ref("0");
  const validationError = ref<string | null>(null);

  // -- Stats ------------------------------------------------------------------
  const wins = ref(0);
  const losses = ref(0);
  const totalWon = ref(0);
  const totalGames = computed(() => wins.value + losses.value);

  // -- History ----------------------------------------------------------------
  const gameHistory = ref<GameHistoryItem[]>([]);

  // -- Formatted display values -----------------------------------------------
  // These are consumed by the manifest stat/sidebar bindings via the
  // state object returned from defineMiniApp's setup().
  const formattedTotalWon = computed(() => `${formatNum(totalWon.value)} ${t("tokenGas")}`);

  const canBet = computed(() => {
    const n = parseFloat(betAmount.value);
    return n >= MIN_BET && n <= MAX_BET && !validationError.value && !isFlipping.value;
  });

  // -- Validation -------------------------------------------------------------

  const validateBetAmount = (amount: string): string | null => {
    const num = parseFloat(amount);
    if (isNaN(num)) return t("invalidAmountNumber");
    if (num < MIN_BET) return t("minBetError");
    if (num > MAX_BET) return t("maxBetError");
    if (!/^\d+(\.\d{1,8})?$/.test(amount)) return t("invalidAmountDecimals");
    return null;
  };

  // -- Data Loading (via OS services) -----------------------------------------

  /**
   * Load player stats via StorageProxy.
   * The edge function reads GetPlayerStats from the contract and returns
   * normalized { wins, losses, totalWon } data.
   */
  const loadStats = async () => {
    try {
      const data = await storageService.get("playerStats") as StoredPlayerStats | null;
      if (data && typeof data === "object") {
        wins.value = Number(data.wins ?? 0);
        losses.value = Number(data.losses ?? 0);
        totalWon.value = Number(data.totalWon ?? 0);
      }
    } catch (e) {
      console.warn("[useCoinFlip] loadStats failed:", e instanceof Error ? e.message : String(e));
    }
  };

  /**
   * Load game history from StorageProxy.
   * The edge function reads BetResolved events and returns normalized
   * history entries filtered to the current user.
   */
  const loadHistory = async () => {
    try {
      const entriesMap = await storageService.list("history:", 20);
      if (entriesMap && typeof entriesMap === "object") {
        const items: GameHistoryItem[] = [];
        for (const [, value] of Object.entries(entriesMap)) {
          const entry = value as StoredHistoryEntry;
          items.push({
            betId: entry.betId ?? "",
            amount: Number(entry.amount ?? 0),
            choice: entry.choice ?? "heads",
            outcome: entry.outcome ?? "heads",
            won: Boolean(entry.won),
            payout: Number(entry.payout ?? 0),
            time: entry.time ?? "",
          });
        }
        gameHistory.value = items;
      }
    } catch (e) {
      console.warn("[useCoinFlip] loadHistory failed:", e instanceof Error ? e.message : String(e));
    }
  };

  /**
   * Load all data (player stats, game history).
   * Called by defineMiniApp on mount and when the wallet connects.
   */
  const loadAll = async () => {
    await Promise.all([loadStats(), loadHistory()]);
  };

  // -- Actions (via OS services + Oracle) -------------------------------------

  /**
   * Reset the game UI to its initial state.
   */
  const resetGame = () => {
    isFlipping.value = false;
    result.value = null;
    displayOutcome.value = null;
    showWinOverlay.value = false;
  };

  /**
   * Place a coin-flip bet.
   *
   * Flow:
   * 1. Validate the bet amount
   * 2. Deposit GAS via PaymentProxy (prepay wager)
   * 3. Place bet via GameProxy (registers bet on contract)
   * 4. Request VRF randomness from OracleService
   * 5. Poll for settlement via GameProxy (oracle callback settles the bet)
   * 6. Parse the result and update the UI
   * 7. Emit success/failure events (triggers fireworks via platform on win)
   * 8. Hint badge service about first-flip achievement
   * 9. Reload all data
   */
  const placeBet = async () => {
    // -- Validate ---
    const validation = validateBetAmount(betAmount.value);
    if (validation) {
      validationError.value = validation;
      throw new Error(validation);
    }
    validationError.value = null;

    if (isFlipping.value || !canBet.value) return;

    isFlipping.value = true;
    result.value = null;
    displayOutcome.value = null;
    showWinOverlay.value = false;

    const isFirstFlip = totalGames.value === 0;

    try {
      const amountBase = toFixed8(betAmount.value);
      if (amountBase === "0") throw new Error(t("invalidBetAmount"));

      // -- Step 1: Deposit GAS via PaymentProxy ---
      await paymentService.deposit(amountBase, `${APP_ID}:bet`);

      // -- Step 2: Place bet via GameProxy ---
      // The edge function handles wallet verification, contract invocation,
      // and waiting for the BetPlaced event. Returns the betId.
      const betPoolState = await gameService.placeBet(
        "current",
        JSON.stringify({
          amount: amountBase,
          choice: choice.value === "heads",
        }),
      );
      const betId = String((betPoolState as unknown as { betId?: string })?.betId ?? "");
      if (!betId) throw new Error(t("betMissing"));

      // -- Step 3: Request oracle VRF randomness ---
      // This triggers the Morpheus Oracle to generate verifiable random bytes.
      // The oracle callback will invoke the contract's resolve function,
      // which emits a BetResolved event with the outcome.
      await oracle.requestRandom(`${APP_ID}:${betId}`);

      // -- Step 4: Poll for oracle callback (BetResolved) via GameProxy ---
      // The edge function translates getPoolState("resolve:<betId>") into
      // a BetResolved event lookup for the specific betId.
      const deadline = Date.now() + 60000;
      let resolvedState: ResolvedBetState | null = null;

      while (Date.now() < deadline) {
        try {
          const state = await gameService.getPoolState(`resolve:${betId}`) as ResolvedBetState;
          if (state && state.status === "settled") {
            resolvedState = state;
            break;
          }
        } catch {
          // Not resolved yet, keep polling
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      if (!resolvedState) throw new Error(t("betPending"));

      // -- Step 5: Parse result ---
      const won = Boolean(resolvedState.won);
      const payoutValue = Number(resolvedState.payout ?? 0);
      const outcome = won ? choice.value : choice.value === "heads" ? "tails" : "heads";

      // -- Step 6: Update UI ---
      displayOutcome.value = outcome;
      isFlipping.value = false;
      result.value = { won, outcome: outcome.toUpperCase() };

      if (won) {
        wins.value += 1;
        totalWon.value += payoutValue;
        winAmount.value = payoutValue.toFixed(2);
        showWinOverlay.value = true;
        eventBus.emit("coinflip:win", { action: t("youWon"), payout: payoutValue });
      } else {
        losses.value += 1;
        eventBus.emit("coinflip:loss", { action: t("youLost") });
      }

      // -- Step 7: Hint badge service about first-flip achievement ---
      if (isFirstFlip) {
        badgeService.award("first-flip", "").catch(() => {});
      }

      // -- Step 8: Reload data ---
      await loadAll();
    } catch (e) {
      eventBus.emit("coinflip:error", {
        message: e instanceof Error ? e.message : t("flipFailed"),
      });
      isFlipping.value = false;
      throw e;
    }
  };

  /**
   * Dismiss the win overlay.
   */
  const dismissOverlay = () => {
    showWinOverlay.value = false;
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

    // -- Computed --------------------------------------------------------------
    totalGames,
    canBet,
    formattedTotalWon,

    // -- Constants ------------------------------------------------------------
    MIN_BET,
    MAX_BET,
    BET_PRESETS,

    // -- Actions --------------------------------------------------------------
    placeBet,
    resetGame,
    dismissOverlay,
    loadAll,
    formatNum,
  };
}

/** Return type of useCoinFlip for use in inject/provide typing */
export type UseCoinFlipReturn = ReturnType<typeof useCoinFlip>;
