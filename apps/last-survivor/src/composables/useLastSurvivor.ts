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
 *     chain.listEvents("KeysPurchased", { limit: 20 })
 *
 *   AFTER (OS proxy):
 *     ctx.os.game.getPoolState("current")
 *     ctx.os.storage.get(`playerKeys:${roundId}`)
 *     ctx.os.payment.deposit(amount, memo)
 *     ctx.os.game.placeBet("current", keyCount)
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
  /**
   * Numeric, newest-first ordering key assigned at construction time.
   * Derived from a real temporal source (parsed date or numeric id) and,
   * for entries without one (e.g. leaderboard winners), from a monotonic
   * insertion index so ordering is deterministic instead of collapsing
   * heterogeneous ids through `Number(id)` (which yields NaN for string
   * ids like `winner-0`).
   */
  sortKey: number;
}

// ============================================================================
// Constants
// ============================================================================

const BASE_KEY_PRICE = 10000000n;
const KEY_PRICE_INCREMENT_BPS = 10n;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

function isOsBoundaryError(error: unknown) {
  return /OS service error|os-game-|os-payment-|os-storage-|os-leaderboard-|Not Found/i.test(
    errorMessage(error),
  );
}

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
  const isLoading = createObservable(false);
  const totalKeysInRound = createObservable(0n);
  const roundDataAvailable = createObservable(false);
  const serviceNotice = createObservable("");

  // ── Timer State ─────────────────────────────────────────────────────
  const endTime = createObservable(0);
  const now = createObservable(Date.now());
  const MAX_DURATION_SECONDS = 86400;

  const timeRemainingSeconds = createDerived(() => {
    if (!endTime.get()) return 0;
    return Math.max(0, Math.floor((endTime.get() - now.get()) / 1000));
  }, [now, endTime]);

  const countdown = createDerived(() => {
    const total = timeRemainingSeconds.get();
    const hours = String(Math.floor(total / 3600)).padStart(2, "0");
    const mins = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const secs = String(total % 60).padStart(2, "0");
    return `${hours}:${mins}:${secs}`;
  }, [timeRemainingSeconds]);

  const dangerLevel = createDerived(() => {
    const seconds = timeRemainingSeconds.get();
    if (seconds > 7200) return "low";
    if (seconds > 3600) return "medium";
    if (seconds > 600) return "high";
    return "critical";
  }, [timeRemainingSeconds]);

  const dangerLevelText = createDerived(() => {
    switch (dangerLevel.get()) {
      case "low": return t("dangerLow");
      case "medium": return t("dangerMedium");
      case "high": return t("dangerHigh");
      case "critical": return t("dangerCritical");
      default: return t("dangerLow");
    }
  }, [dangerLevel]);

  const dangerProgress = createDerived(() => {
    if (!timeRemainingSeconds.get()) return 0;
    return Math.min(100, (timeRemainingSeconds.get() / MAX_DURATION_SECONDS) * 100);
  }, [timeRemainingSeconds]);

  const shouldPulse = createDerived(() => timeRemainingSeconds.get() <= 600, [timeRemainingSeconds]);

  const updateNow = () => { now.set(Date.now()); };

  // ── Formatted display values ──────────────────────────────────────
  const lastBuyerLabel = createDerived(() => lastBuyer.get() ? formatAddress(lastBuyer.get()) : t("notAvailable"), []);
  const formattedRound = createDerived(() => `#${roundId.get()}`, []);
  const totalPotDisplay = createDerived(() => `${formatNumber(totalPot.get(), 2)} ${t("tokenGas")}`, []);
  const roundStatusDisplay = createDerived(() => isRoundActive.get() ? t("activeRound") : t("inactiveRound"), []);

  const needsLifecycleSync = createDerived(() => {
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
  }, [keyCount, totalKeysInRound]);

  const estimatedCost = createDerived(() => (Number(estimatedCostRaw.get()) / 1e8).toFixed(2), [estimatedCostRaw]);

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
        isRoundActive.set(
          state.status === "open" ||
            state.status === "active" ||
            Boolean(state.active),
        );
        lastBuyer.set(String(state.lastBuyer ?? ""));
        totalKeysInRound.set(BigInt(Number(state.totalKeys) || 0));
        roundDataAvailable.set(true);
        serviceNotice.set("");
        return Number(state.remainingTime ?? 0);
      }
      roundDataAvailable.set(false);
      serviceNotice.set(t("roundStateUnavailable"));
      return 0;
    } catch (e) {
      roundDataAvailable.set(false);
      if (isOsBoundaryError(e)) {
        serviceNotice.set(t("roundStateUnavailable"));
        return 0;
      }
      console.warn("[useLastSurvivor] loadRoundData failed:", errorMessage(e));
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
      if (!isOsBoundaryError(e)) {
        console.warn("[useLastSurvivor] loadUserKeys failed:", errorMessage(e));
      }
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

      // Resolve a real temporal ordering key for a stored entry: prefer the
      // parsed `date`, fall back to a numeric `id` (often a timestamp), and
      // finally to NaN so the caller can substitute a stable insertion index.
      const temporalKey = (entry: StoredHistoryEntry): number => {
        if (entry.date) {
          const parsed = Date.parse(entry.date);
          if (Number.isFinite(parsed)) return parsed;
        }
        const idNum = Number(entry.id);
        return Number.isFinite(idNum) ? idNum : NaN;
      };

      // Parse stored events (key purchases, round starts)
      if (eventsMap && typeof eventsMap === "object") {
        for (const [, value] of Object.entries(eventsMap)) {
          const entry = value as StoredHistoryEntry;
          const key = temporalKey(entry);
          if (entry.type === "keysPurchased") {
            items.push({
              id: entry.id,
              title: t("keysPurchased"),
              details: `${formatAddress(entry.player ?? "")} \u2022 ${entry.keys ?? 0} keys \u2022 +${(entry.potContribution ?? 0).toFixed(2)} ${t("tokenGas")}`,
              date: entry.date ?? "",
              sortKey: key,
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
              sortKey: key,
            });
          }
        }
      }

      // Parse leaderboard winners into history entries. Winners arrive
      // pre-ranked (index 0 = most recent/top) and carry no timestamp, so
      // they get NaN here and inherit a stable insertion index below,
      // preserving their leaderboard order instead of collapsing to a
      // single sentinel value.
      if (Array.isArray(winners)) {
        winners.forEach((w, idx) => {
          items.push({
            id: `winner-${idx}`,
            title: t("winnerDeclared"),
            details: `${formatAddress(w.user)} \u2022 ${w.score} ${t("tokenGas")}`,
            date: "",
            sortKey: NaN,
          });
        });
      }

      // Backfill a deterministic ordering key for entries without a real
      // temporal source. Walking the (insertion-ordered) list in reverse and
      // handing out descending indices keeps such entries newest-first while
      // preserving their original relative order, so the final sort is fully
      // stable and never depends on NaN comparisons.
      let fallbackIndex = 0;
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (item && !Number.isFinite(item.sortKey)) {
          item.sortKey = fallbackIndex++;
        }
      }

      // Sort newest-first on the resolved numeric sortKey. All keys are now
      // finite, so comparisons are well-defined and ordering is deterministic.
      history.set(items.sort((a, b) => b.sortKey - a.sortKey));
    } catch (e) {
      if (!isOsBoundaryError(e)) {
        console.warn("[useLastSurvivor] loadHistory failed:", errorMessage(e));
      }
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

      // Step 2: Place bet (buy keys) via GameProxy.
      // The deposit in Step 1 has already transferred GAS on-chain. If
      // placeBet fails (round rolled over, edge/network error, validation)
      // the GAS would be stranded with no keys registered, so we compensate
      // by withdrawing the deposit before re-throwing. If the withdraw also
      // fails, surface a distinct manual-recovery error instead of the raw
      // placeBet error.
      try {
        await gameService.placeBet("current", String(numKeys));
      } catch (placeBetErr) {
        try {
          await paymentService.withdraw(costGas);
        } catch (refundErr) {
          console.error(
            "[useLastSurvivor] buyKeys: GAS withdraw failed after placeBet error",
            errorMessage(refundErr),
          );
          throw new Error(t("keyPurchaseRecoveryNeeded"));
        }
        throw new Error(t("keyPurchaseRefunded"));
      }

      // Step 3: Hint badge service about first-key achievement (fire-and-forget)
      if (userKeys.get() === 0) {
        badgeService.award("first-key", "").catch(() => {});
      }

      await loadAll();
      return numKeys;
    } catch (e) {
      if (isOsBoundaryError(e)) {
        throw new Error(t("keyPurchaseUnavailable"));
      }
      throw e;
    } finally {
      isBuyingKeys.set(false);
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
    isLoading,
    roundDataAvailable,
    serviceNotice,

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
    needsLifecycleSync,
    estimatedCost,
    estimatedCostRaw,

    // ── Actions ─────────────────────────────────────────────────────
    buyKeys,
    loadAll,
    loadUserKeys,
  };
}

export type UseLastSurvivorReturn = ReturnType<typeof useLastSurvivor>;
