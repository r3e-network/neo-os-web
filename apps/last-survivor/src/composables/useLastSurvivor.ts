/**
 * useLastSurvivor — Domain logic for the Last Survivor (doomsday clock) miniapp
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (GameProxy, PaymentProxy, LeaderboardProxy, BadgeProxy,
 * StorageProxy) via edge functions, so this file contains zero contract
 * hashes, parameter encoding, or event parsing logic.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.read("getGameStatus")
 *     chain.read("getPlayerKeys", [{ type: "Hash160", value: addr }])
 *     chain.invoke("transfer", [...], { scriptHash: GAS_HASH })
 *     chain.invoke("buyKeysWithCost", [...])
 *     chain.invoke("checkAndEndRound", [...])
 *     chain.listEvents("KeysPurchased", { limit: 20 })
 *
 *   AFTER (OS proxy):
 *     ctx.os.game.getPoolState("current")
 *     ctx.os.storage.get(`playerKeys:${roundId}`)
 *     ctx.os.payment.deposit(amount, memo)
 *     ctx.os.game.placeBet("current", keyCount)
 *     ctx.os.game.settle("current", { claim: true })
 *     ctx.os.storage.list("events:")
 *     ctx.os.leaderboard.get(10)
 *
 * The composable still owns:
 *   - Reactive state (refs + computed) for manifest bindings
 *   - Countdown timer logic (danger level, pulse, etc.)
 *   - Key cost formula (pure frontend math)
 *   - Loading/buying/claiming UI flags
 *   - Formatted display values
 */

import { ref, computed } from "vue";
import type { GameProxy } from "@shared/services/os/GameProxy";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { LeaderboardProxy } from "@shared/services/os/LeaderboardProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import { formatNumber, formatAddress } from "@shared/utils/format";
import type { HistoryEvent } from "../pages/index/components/HistoryList.vue";

// ============================================================================
// Constants
// ============================================================================

const BASE_KEY_PRICE = 10000000n;
const KEY_PRICE_INCREMENT_BPS = 10n;

// ============================================================================
// Types
// ============================================================================

export interface UseLastSurvivorOptions {
  /** OS GameProxy instance from ctx.os.game */
  gameService: GameProxy;
  /** OS PaymentProxy instance from ctx.os.payment */
  paymentService: PaymentProxy;
  /** OS LeaderboardProxy instance from ctx.os.leaderboard */
  leaderboardService: LeaderboardProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * Shape of the pool state returned by GameProxy for LastSurvivor.
 * Extends the base PoolState with game-specific fields returned by
 * the edge function's getGameStatus translation.
 */
interface SurvivorPoolState {
  // Inherited from base PoolState
  poolId: string;
  appId: string;
  status: "open" | "active" | "settled" | "cancelled";
  playerCount: number;
  totalBets: string;
  // Game-specific extensions
  roundId?: number;
  pot?: string;
  active?: boolean;
  lastBuyer?: string;
  totalKeys?: number;
  remainingTime?: number;
}

/** Shape of a history entry stored via StorageProxy. */
interface StoredHistoryEntry {
  id: string | number;
  type: "keysPurchased" | "winnerDeclared" | "roundStarted";
  player?: string;
  keys?: number;
  potContribution?: number;
  winner?: string;
  prize?: number;
  round?: number;
  endTime?: number;
  date?: string;
}

// ============================================================================
// Composable
// ============================================================================

export function useLastSurvivor({
  gameService,
  paymentService,
  leaderboardService,
  badgeService,
  storageService,
  t,
}: UseLastSurvivorOptions) {
  // ── Game State ──────────────────────────────────────────────────────
  const roundId = ref(0);
  const totalPot = ref(0);
  const isRoundActive = ref(false);
  const lastBuyer = ref<string | null>(null);
  const userKeys = ref(0);
  const keyCount = ref("1");
  const keyValidationError = ref<string | null>(null);
  const history = ref<HistoryEvent[]>([]);
  const isBuyingKeys = ref(false);
  const isClaiming = ref(false);
  const isLoading = ref(false);
  const totalKeysInRound = ref(0n);

  // ── Timer State ─────────────────────────────────────────────────────
  const endTime = ref(0);
  const now = ref(Date.now());
  const MAX_DURATION_SECONDS = 86400;

  const timeRemainingSeconds = computed(() => {
    if (!endTime.value) return 0;
    return Math.max(0, Math.floor((endTime.value - now.value) / 1000));
  });

  const countdown = computed(() => {
    const total = timeRemainingSeconds.value;
    const hours = String(Math.floor(total / 3600)).padStart(2, "0");
    const mins = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const secs = String(total % 60).padStart(2, "0");
    return `${hours}:${mins}:${secs}`;
  });

  const dangerLevel = computed(() => {
    const seconds = timeRemainingSeconds.value;
    if (seconds > 7200) return "low";
    if (seconds > 3600) return "medium";
    if (seconds > 600) return "high";
    return "critical";
  });

  const dangerLevelText = computed(() => {
    switch (dangerLevel.value) {
      case "low": return t("dangerLow");
      case "medium": return t("dangerMedium");
      case "high": return t("dangerHigh");
      case "critical": return t("dangerCritical");
      default: return t("dangerLow");
    }
  });

  const dangerProgress = computed(() => {
    if (!timeRemainingSeconds.value) return 0;
    return Math.min(100, (timeRemainingSeconds.value / MAX_DURATION_SECONDS) * 100);
  });

  const shouldPulse = computed(() => timeRemainingSeconds.value <= 600);

  const updateNow = () => { now.value = Date.now(); };

  // ── Formatted display values ──────────────────────────────────────
  const lastBuyerLabel = computed(() => lastBuyer.value ? formatAddress(lastBuyer.value) : t("notAvailable"));
  const formattedRound = computed(() => `#${roundId.value}`);
  const totalPotDisplay = computed(() => `${formatNumber(totalPot.value, 2)} ${t("tokenGas")}`);
  const roundStatusDisplay = computed(() => isRoundActive.value ? t("activeRound") : t("inactiveRound"));

  const canClaim = computed(() => {
    return (
      !isRoundActive.value &&
      !!lastBuyer.value &&
      totalPot.value > 0
    );
  });

  // ── Key cost formula (pure frontend math) ─────────────────────────
  const calculateKeyCostFormula = (count: bigint, currentTotalKeys: bigint): bigint => {
    if (count <= 0n) return 0n;
    const commonDiff = (BASE_KEY_PRICE * KEY_PRICE_INCREMENT_BPS) / 10000n;
    const firstKeyPrice = BASE_KEY_PRICE + currentTotalKeys * commonDiff;
    const baseCost = count * firstKeyPrice;
    const incrementCost = ((count * (count - 1n)) / 2n) * commonDiff;
    return baseCost + incrementCost;
  };

  const estimatedCostRaw = computed(() => {
    const count = BigInt(Math.max(0, Math.floor(Number(keyCount.value) || 0)));
    return calculateKeyCostFormula(count, totalKeysInRound.value);
  });

  const estimatedCost = computed(() => (Number(estimatedCostRaw.value) / 1e8).toFixed(2));

  // ── Data Loading (via OS services) ─────────────────────────────────

  /**
   * Load round state via GameProxy.
   * The edge function translates getPoolState("current") into the
   * contract's getGameStatus call and returns normalized data.
   */
  const loadRoundData = async () => {
    try {
      const state = await gameService.getPoolState("current") as SurvivorPoolState;
      if (state && typeof state === "object") {
        roundId.value = Number(state.roundId ?? 0);
        totalPot.value = Number(state.totalBets ?? state.pot ?? 0);
        isRoundActive.value = state.status === "active" || Boolean(state.active);
        lastBuyer.value = String(state.lastBuyer ?? "");
        totalKeysInRound.value = BigInt(Number(state.totalKeys) || 0);
        return Number(state.remainingTime ?? 0);
      }
      return 0;
    } catch (e) {
      console.warn("[useLastSurvivor] loadRoundData failed:", e instanceof Error ? e.message : String(e));
      throw e;
    }
  };

  /**
   * Load user's key count for the current round via StorageProxy.
   * The edge function reads the per-player key count from contract storage.
   */
  const loadUserKeys = async () => {
    if (!roundId.value) {
      userKeys.value = 0;
      return;
    }
    try {
      const keys = await storageService.get(`playerKeys:${roundId.value}`);
      userKeys.value = Number(keys || 0);
    } catch (e) {
      console.warn("[useLastSurvivor] loadUserKeys failed:", e instanceof Error ? e.message : String(e));
      userKeys.value = 0;
    }
  };

  /**
   * Load game history from StorageProxy and leaderboard winners from
   * LeaderboardProxy, then merge into a unified history list.
   */
  const loadHistory = async () => {
    try {
      const [eventsMap, winners] = await Promise.all([
        storageService.list("events:", 40),
        leaderboardService.get(10),
      ]);

      const items: HistoryEvent[] = [];

      // Parse stored events (key purchases, round starts)
      if (eventsMap && typeof eventsMap === "object") {
        for (const [, value] of Object.entries(eventsMap)) {
          const entry = value as StoredHistoryEntry;
          if (entry.type === "keysPurchased") {
            items.push({
              id: entry.id,
              title: t("keysPurchased"),
              details: `${formatAddress(entry.player ?? "")} \u2022 ${entry.keys ?? 0} keys \u2022 +${(entry.potContribution ?? 0).toFixed(2)} ${t("tokenGas")}`,
              date: entry.date ?? "",
            });
          } else if (entry.type === "roundStarted") {
            const endText = entry.endTime
              ? new Intl.DateTimeFormat(undefined).format(new Date(entry.endTime))
              : t("notAvailable");
            items.push({
              id: entry.id,
              title: t("roundStarted"),
              details: `#${entry.round ?? 0} \u2022 ${endText}`,
              date: entry.date ?? "",
            });
          }
        }
      }

      // Parse leaderboard winners into history entries
      if (Array.isArray(winners)) {
        winners.forEach((w, idx) => {
          items.push({
            id: `winner-${idx}`,
            title: t("winnerDeclared"),
            details: `${formatAddress(w.user)} \u2022 ${w.score} ${t("tokenGas")}`,
            date: "",
          });
        });
      }

      history.value = items.sort((a, b) => Number(b.id) - Number(a.id));
    } catch (e) {
      console.warn("[useLastSurvivor] loadHistory failed:", e instanceof Error ? e.message : String(e));
      history.value = [];
    }
  };

  const validateKeyCount = (count: string): string | null => {
    const num = parseInt(count, 10);
    if (isNaN(num) || num <= 0) return t("invalidKeyCount");
    if (num > 1000) return t("maxKeyCountExceeded");
    return null;
  };

  /**
   * Load all data. Called by defineMiniApp on mount and wallet reconnect.
   */
  const loadAll = async () => {
    isLoading.value = true;
    try {
      const remainingSeconds = await loadRoundData();
      const endTimeMs = remainingSeconds > 0 ? Date.now() + remainingSeconds * 1000 : 0;
      endTime.value = endTimeMs;
      await loadUserKeys();
      await loadHistory();
    } finally {
      isLoading.value = false;
    }
  };

  // ── Actions (via OS services) ──────────────────────────────────────

  /**
   * Buy keys via PaymentProxy (deposit GAS) + GameProxy (place bet).
   *
   * The OS payment service handles wallet connection and GAS transfer.
   * The OS game service handles the buyKeysWithCost contract call.
   * Badge awarding (first key purchase) is handled server-side by the
   * edge function, so we just fire-and-forget a badge hint.
   */
  const buyKeys = async (count: string) => {
    if (isBuyingKeys.value) return;
    const validation = validateKeyCount(count);
    if (validation) {
      keyValidationError.value = validation;
      throw new Error(validation);
    }
    keyValidationError.value = null;
    const numKeys = Math.max(0, Math.floor(Number(count) || 0));
    if (numKeys <= 0) throw new Error(t("invalidKeyCount"));

    isBuyingKeys.value = true;
    try {
      const costRaw = calculateKeyCostFormula(BigInt(numKeys), totalKeysInRound.value);
      const costGas = (Number(costRaw) / 1e8).toFixed(8);

      // Step 1: Deposit GAS via PaymentProxy
      await paymentService.deposit(costGas, `buy:${roundId.value}:${numKeys}`);

      // Step 2: Place bet (buy keys) via GameProxy
      await gameService.placeBet("current", String(numKeys));

      // Step 3: Hint badge service about first-key achievement (fire-and-forget)
      if (userKeys.value === 0) {
        badgeService.award("first-key", "").catch(() => {});
      }

      await loadAll();
      return numKeys;
    } catch (e) {
      throw e;
    } finally {
      isBuyingKeys.value = false;
    }
  };

  /**
   * Claim prize via GameProxy (settle round) + PaymentProxy (withdraw).
   *
   * The OS game service calls checkAndEndRound on the contract.
   * The payment is automatically settled to the winner by the edge function.
   */
  const claimPrize = async () => {
    if (isClaiming.value) return;
    isClaiming.value = true;
    try {
      // Settle the round — the edge function handles prize distribution
      await gameService.settle("current", { claim: true });

      // Submit the winning score to the leaderboard
      await leaderboardService.submitScore(String(totalPot.value));

      // Hint badge service about winner achievement (fire-and-forget)
      badgeService.award("survivor-winner", "").catch(() => {});

      await loadAll();
    } catch (e) {
      throw e;
    } finally {
      isClaiming.value = false;
    }
  };

  return {
    // ── Raw State ───────────────────────────────────────────────────
    roundId,
    totalPot,
    isRoundActive,
    lastBuyer,
    userKeys,
    keyCount,
    keyValidationError,
    history,
    isBuyingKeys,
    isClaiming,
    isLoading,

    // ── Timer State ─────────────────────────────────────────────────
    countdown,
    dangerLevel,
    dangerLevelText,
    dangerProgress,
    shouldPulse,
    timeRemainingSeconds,
    updateNow,

    // ── Formatted values ────────────────────────────────────────────
    lastBuyerLabel,
    formattedRound,
    totalPotDisplay,
    roundStatusDisplay,
    canClaim,
    estimatedCost,
    estimatedCostRaw,

    // ── Actions ─────────────────────────────────────────────────────
    buyKeys,
    claimPrize,
    loadAll,
    loadUserKeys,
  };
}

export type UseLastSurvivorReturn = ReturnType<typeof useLastSurvivor>;
