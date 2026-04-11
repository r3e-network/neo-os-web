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

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { GameProxy } from "@shared/services/os/GameProxy";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { LeaderboardProxy } from "@shared/services/os/LeaderboardProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import { formatNumber, formatAddress } from "@shared/utils/format";
// HistoryEvent type (extracted from HistoryList component)
export interface HistoryEvent {
  id: string | number;
  title: string;
  details: string;
  date: string;
}

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
  const roundId = createObservable(0);
  const totalPot = createObservable(0);
  const isRoundActive = createObservable(false);
  const lastBuyer = createObservable<string | null>(null);
  const userKeys = createObservable(0);
  const keyCount = createObservable("1");
  const keyValidationError = createObservable<string | null>(null);
  const history = createObservable<HistoryEvent[]>([]);
  const isBuyingKeys = createObservable(false);
  const isClaiming = createObservable(false);
  const isLoading = createObservable(false);
  const totalKeysInRound = createObservable(0n);

  // ── Timer State ─────────────────────────────────────────────────────
  const endTime = createObservable(0);
  const now = createObservable(Date.now());
  const MAX_DURATION_SECONDS = 86400;

  const timeRemainingSeconds = createDerived(() => {
    if (!endTime.get()) return 0;
    return Math.max(0, Math.floor((endTime.get() - now.get()) / 1000));
  }, []);

  const countdown = createDerived(() => {
    const total = timeRemainingSeconds.get();
    const hours = String(Math.floor(total / 3600)).padStart(2, "0");
    const mins = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const secs = String(total % 60).padStart(2, "0");
    return `${hours}:${mins}:${secs}`;
  }, []);

  const dangerLevel = createDerived(() => {
    const seconds = timeRemainingSeconds.get();
    if (seconds > 7200) return "low";
    if (seconds > 3600) return "medium";
    if (seconds > 600) return "high";
    return "critical";
  }, []);

  const dangerLevelText = createDerived(() => {
    switch (dangerLevel.get()) {
      case "low": return t("dangerLow");
      case "medium": return t("dangerMedium");
      case "high": return t("dangerHigh");
      case "critical": return t("dangerCritical");
      default: return t("dangerLow");
    }
  }, []);

  const dangerProgress = createDerived(() => {
    if (!timeRemainingSeconds.get()) return 0;
    return Math.min(100, (timeRemainingSeconds.get() / MAX_DURATION_SECONDS) * 100);
  }, []);

  const shouldPulse = createDerived(() => timeRemainingSeconds.get() <= 600, []);

  const updateNow = () => { now.set(Date.now()); };

  // ── Formatted display values ──────────────────────────────────────
  const lastBuyerLabel = createDerived(() => lastBuyer.get() ? formatAddress(lastBuyer.get()) : t("notAvailable"), []);
  const formattedRound = createDerived(() => `#${roundId.get()}`, []);
  const totalPotDisplay = createDerived(() => `${formatNumber(totalPot.get(), 2)} ${t("tokenGas")}`, []);
  const roundStatusDisplay = createDerived(() => isRoundActive.get() ? t("activeRound") : t("inactiveRound"), []);

  const canClaim = createDerived(() => {
    return (
      !isRoundActive.get() &&
      !!lastBuyer.get() &&
      totalPot.get() > 0
    );
  }, []);

  // ── Key cost formula (pure frontend math) ─────────────────────────
  const calculateKeyCostFormula = (count: bigint, currentTotalKeys: bigint): bigint => {
    if (count <= 0n) return 0n;
    const commonDiff = (BASE_KEY_PRICE * KEY_PRICE_INCREMENT_BPS) / 10000n;
    const firstKeyPrice = BASE_KEY_PRICE + currentTotalKeys * commonDiff;
    const baseCost = count * firstKeyPrice;
    const incrementCost = ((count * (count - 1n)) / 2n) * commonDiff;
    return baseCost + incrementCost;
  };

  const estimatedCostRaw = createDerived(() => {
    const count = BigInt(Math.max(0, Math.floor(Number(keyCount.get()) || 0)));
    return calculateKeyCostFormula(count, totalKeysInRound.get());
  }, []);

  const estimatedCost = createDerived(() => (Number(estimatedCostRaw.get()) / 1e8).toFixed(2), []);

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
        roundId.set(Number(state.roundId ?? 0));
        totalPot.set(Number(state.totalBets ?? state.pot ?? 0));
        isRoundActive.set(state.status === "active" || Boolean(state.active));
        lastBuyer.set(String(state.lastBuyer ?? ""));
        totalKeysInRound.set(BigInt(Number(state.totalKeys) || 0));
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
    if (!roundId.get()) {
      userKeys.set(0);
      return;
    }
    try {
      const keys = await storageService.get(`playerKeys:${roundId.get()}`);
      userKeys.set(Number(keys || 0));
    } catch (e) {
      console.warn("[useLastSurvivor] loadUserKeys failed:", e instanceof Error ? e.message : String(e));
      userKeys.set(0);
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

      history.set(items.sort((a, b) => Number(b.id) - Number(a.id)));
    } catch (e) {
      console.warn("[useLastSurvivor] loadHistory failed:", e instanceof Error ? e.message : String(e));
      history.set([]);
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
    isLoading.set(true);
    try {
      const remainingSeconds = await loadRoundData();
      const endTimeMs = remainingSeconds > 0 ? Date.now() + remainingSeconds * 1000 : 0;
      endTime.set(endTimeMs);
      await loadUserKeys();
      await loadHistory();
    } finally {
      isLoading.set(false);
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
    if (isBuyingKeys.get()) return;
    const validation = validateKeyCount(count);
    if (validation) {
      keyValidationError.set(validation);
      throw new Error(validation);
    }
    keyValidationError.set(null);
    const numKeys = Math.max(0, Math.floor(Number(count) || 0));
    if (numKeys <= 0) throw new Error(t("invalidKeyCount"));

    isBuyingKeys.set(true);
    try {
      const costRaw = calculateKeyCostFormula(BigInt(numKeys), totalKeysInRound.get());
      const costGas = (Number(costRaw) / 1e8).toFixed(8);

      // Step 1: Deposit GAS via PaymentProxy
      await paymentService.deposit(costGas, `buy:${roundId.get()}:${numKeys}`);

      // Step 2: Place bet (buy keys) via GameProxy
      await gameService.placeBet("current", String(numKeys));

      // Step 3: Hint badge service about first-key achievement (fire-and-forget)
      if (userKeys.get() === 0) {
        badgeService.award("first-key", "").catch(() => {});
      }

      await loadAll();
      return numKeys;
    } catch (e) {
      throw e;
    } finally {
      isBuyingKeys.set(false);
    }
  };

  /**
   * Claim prize via GameProxy (settle round) + PaymentProxy (withdraw).
   *
   * The OS game service calls checkAndEndRound on the contract.
   * The payment is automatically settled to the winner by the edge function.
   */
  const claimPrize = async () => {
    if (isClaiming.get()) return;
    isClaiming.set(true);
    try {
      // Settle the round — the edge function handles prize distribution
      await gameService.settle("current", { claim: true });

      // Submit the winning score to the leaderboard
      await leaderboardService.submitScore(String(totalPot.get()));

      // Hint badge service about winner achievement (fire-and-forget)
      badgeService.award("survivor-winner", "").catch(() => {});

      await loadAll();
    } catch (e) {
      throw e;
    } finally {
      isClaiming.set(false);
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
