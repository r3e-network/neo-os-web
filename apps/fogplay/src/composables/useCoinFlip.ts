/**
 * useCoinFlip -- Simplified domain logic for the FogPlay (coin flip) miniapp
 *
 * This composable encapsulates all coin-flip business logic and provides
 * reactive state for the platform to bind to manifest-driven UI sections.
 *
 * Compared with the legacy useFogPlayGame.ts:
 *
 *   BEFORE (legacy):
 *     - Manually wires useContractInteraction + useStatusMessage + useErrorHandler
 *     - Takes a raw WalletSDK, builds sidebar items, formats errors
 *     - Contains ~230 lines of mixed infrastructure + business logic
 *
 *   AFTER (this file):
 *     - Receives ChainService + OracleService + EventBus from PlatformServices
 *     - Contains ONLY coin-flip domain logic (place bet, oracle RNG, settle)
 *     - Sidebar, stats, status messages are all driven by manifest + platform
 *     - Clean separation: business logic only, no infrastructure plumbing
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
import type { ChainService, EventBus, OracleService } from "@shared/services";
import { formatNum, toFixed8 } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";

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
  /** ChainService instance from PlatformServices */
  chain: ChainService;
  /** OracleService instance from PlatformServices (VRF randomness) */
  oracle: OracleService;
  /** EventBus instance from PlatformServices */
  eventBus: EventBus;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useCoinFlip({ chain, oracle, eventBus, t }: UseCoinFlipOptions) {
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

  // -- Data Loading -----------------------------------------------------------

  const loadStats = async () => {
    if (!chain.address.value) return;
    try {
      const data = await chain.read("GetPlayerStats", [
        { type: "Hash160", value: chain.address.value },
      ]);
      if (Array.isArray(data)) {
        wins.value = Number(data[0] ?? 0);
        losses.value = Number(data[1] ?? 0);
        totalWon.value = Number(data[2] ?? 0) / 1e8;
      }
    } catch (e) {
      console.warn("[useCoinFlip] loadStats failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadHistory = async () => {
    if (!chain.address.value) return;
    try {
      const rawEvents = await chain.listEvents("BetResolved", { limit: 20 });
      const currentAddress = chain.address.value;

      gameHistory.value = rawEvents
        .filter((evt: unknown) => {
          const evtRecord = evt as Record<string, unknown>;
          const values = Array.isArray(evtRecord?.state)
            ? (evtRecord.state as unknown[]).map(parseStackItem)
            : [];
          return String(values[0] ?? "") === currentAddress;
        })
        .map((evt: unknown) => {
          const evtRecord = evt as Record<string, unknown>;
          const values = Array.isArray(evtRecord?.state)
            ? (evtRecord.state as unknown[]).map(parseStackItem)
            : [];
          const payout = Number(values[1] ?? 0) / 1e8;
          const won = Boolean(values[2]);
          const betChoice = Boolean(values[4]) ? "heads" : "tails";
          const outcome = won ? betChoice : betChoice === "heads" ? "tails" : "heads";
          return {
            betId: String(values[3] ?? ""),
            amount: Number(values[5] ?? 0) / 1e8,
            choice: betChoice as "heads" | "tails",
            outcome: outcome as "heads" | "tails",
            won,
            payout,
            time: new Intl.DateTimeFormat(undefined).format(
              new Date((evtRecord.created_at as string | number | Date) || Date.now()),
            ),
          };
        });
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

  // -- Actions ----------------------------------------------------------------

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
   * 2. Ensure wallet is connected
   * 3. Prepay GAS to the contract with memo "miniapp-fogplay:bet"
   * 4. Call placeBet on the contract
   * 5. Wait for the BetPlaced event to confirm bet registration
   * 6. Request VRF randomness from the Oracle
   * 7. Poll for the BetResolved event (oracle callback settles the bet)
   * 8. Parse the result and update the UI
   * 9. Emit success/failure events (triggers fireworks via platform on win)
   * 10. Reload all data
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

    try {
      // -- Step 1: Ensure wallet ---
      await chain.ensureWallet();

      const amountBase = toFixed8(betAmount.value);
      if (amountBase === "0") throw new Error(t("invalidBetAmount"));

      // -- Step 2: Prepay GAS + invoke placeBet ---
      // The contract requires a direct GAS transfer first, then the bet call.
      const betResult = await chain.invokeWithPayment(
        amountBase,
        `${APP_ID}:bet`,
        "placeBet",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Integer", value: amountBase },
          { type: "Boolean", value: choice.value === "heads" },
        ],
        { waitForEvent: "BetPlaced" },
      );

      if (!betResult.success) throw new Error(t("betPending"));

      // -- Step 3: Extract betId from BetPlaced event ---
      const betEvent = betResult.event as Record<string, unknown> | undefined;
      const placedValues = Array.isArray(betEvent?.state)
        ? (betEvent.state as unknown[]).map(parseStackItem)
        : [];
      const betId = String(placedValues[3] ?? "");
      if (!betId) throw new Error(t("betMissing"));

      // -- Step 4: Request oracle VRF randomness ---
      // This triggers the Morpheus Oracle to generate verifiable random bytes.
      // The oracle callback will invoke the contract's resolve function,
      // which emits a BetResolved event with the outcome.
      await oracle.requestRandom(`${APP_ID}:${betId}`);

      // -- Step 5: Wait for oracle callback (BetResolved) ---
      // The oracle processes the VRF request and calls back the contract,
      // which settles the bet and emits BetResolved with the result.
      const deadline = Date.now() + 60000;
      let resolvedEvent: Record<string, unknown> | null = null;

      while (Date.now() < deadline) {
        const resultEvents = await chain.listEvents("BetResolved", { limit: 20 });
        const match = resultEvents.find((evt: unknown) => {
          const evtRecord = evt as Record<string, unknown>;
          const values = Array.isArray(evtRecord?.state)
            ? (evtRecord.state as unknown[]).map(parseStackItem)
            : [];
          return String(values[3] ?? "") === betId;
        });

        if (match) {
          resolvedEvent = match as Record<string, unknown>;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      if (!resolvedEvent) throw new Error(t("betPending"));

      // -- Step 6: Parse result ---
      const values = Array.isArray(resolvedEvent.state)
        ? (resolvedEvent.state as unknown[]).map(parseStackItem)
        : [];
      const payoutRaw = values[1];
      const won = Boolean(values[2]);
      const payoutValue = Number(payoutRaw || 0) / 1e8;
      const outcome = won ? choice.value : choice.value === "heads" ? "tails" : "heads";

      // -- Step 7: Update UI ---
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
