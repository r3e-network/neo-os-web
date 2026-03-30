/**
 * useCheckin — Domain logic for the Daily Check-in miniapp (OS Services)
 *
 * This composable uses OS service proxies instead of direct chain calls.
 * All contract interaction is delegated to CheckinProxy via edge functions,
 * so this file contains zero contract hashes, parameter encoding, or
 * event parsing logic.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.read("GetUserStats", [{ type: "Hash160", value: addr }])
 *     chain.invokeWithPayment(fee, memo, "checkIn", [...])
 *     chain.invoke("claimRewards", [...])
 *     chain.listEvents("CheckedIn", { limit: 10 })
 *
 *   AFTER (OS proxy):
 *     ctx.os.checkin.getStreak()
 *     ctx.os.checkin.checkIn()
 *     ctx.os.checkin.claimRewards()
 *
 * The composable still owns:
 *   - Reactive state (refs + computed) for manifest bindings
 *   - UTC countdown timer logic
 *   - Loading/claiming UI flags
 *   - Formatted display values
 */

import { ref, computed } from "vue";
import type { CheckinProxy, CheckinData } from "@shared/services/os/CheckinProxy";
import { formatGas } from "@shared/utils/format";
import { useTicker } from "@shared/composables/useTicker";

// ============================================================================
// Constants
// ============================================================================

/** Milliseconds in one UTC day */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Reward milestones: day thresholds and their GAS payouts */
export const MILESTONES = [
  { day: 7, reward: 1, cumulative: 1 },
  { day: 14, reward: 2, cumulative: 3 },
] as const;

// ============================================================================
// Types
// ============================================================================

export interface CheckinHistoryItem {
  streak: number;
  time: string;
  reward: number;
}

export interface UseCheckinOptions {
  /** OS CheckinProxy instance from ctx.os.checkin */
  checkinService: CheckinProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useCheckin({ checkinService, t }: UseCheckinOptions) {
  // ── User State ──────────────────────────────────────────────────────
  const currentStreak = ref(0);
  const highestStreak = ref(0);
  const lastCheckInDay = ref(0);
  const unclaimedRewards = ref(0);
  const totalClaimed = ref(0);
  const totalUserCheckins = ref(0);
  const isLoading = ref(false);
  const isClaiming = ref(false);

  // ── Global Stats ────────────────────────────────────────────────────
  // These remain as refs for manifest bindings. The OS proxy returns
  // user-level data; global stats may be added to the proxy later.
  // For now they default to 0 (the manifest still renders them).
  const totalGlobalCheckins = ref(0);
  const totalGlobalUsers = ref(0);
  const totalGlobalRewarded = ref(0);

  // ── History ─────────────────────────────────────────────────────────
  const checkinHistory = ref<CheckinHistoryItem[]>([]);

  // ── Countdown Timer ─────────────────────────────────────────────────
  const now = ref(Date.now());
  const countdownTicker = useTicker(() => {
    now.value = Date.now();
  }, 1000);

  const currentUtcDay = computed(() => Math.floor(now.value / MS_PER_DAY));
  const nextUtcMidnight = computed(() => (currentUtcDay.value + 1) * MS_PER_DAY);

  const canCheckIn = computed(() => {
    if (lastCheckInDay.value === 0) return true;
    return currentUtcDay.value > lastCheckInDay.value;
  });

  const utcTimeDisplay = computed(() => {
    const utcDate = new Date(now.value);
    const h = String(utcDate.getUTCHours()).padStart(2, "0");
    const m = String(utcDate.getUTCMinutes()).padStart(2, "0");
    const s = String(utcDate.getUTCSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  });

  // ── Formatted display values ────────────────────────────────────────
  const formattedCurrentStreak = computed(() => `${currentStreak.value} ${t("days")}`);
  const formattedHighestStreak = computed(() => `${highestStreak.value} ${t("days")}`);
  const formattedUnclaimed = computed(() => `${formatGas(unclaimedRewards.value)} ${t("tokenGas")}`);
  const formattedTotalClaimed = computed(() => `${formatGas(totalClaimed.value)} ${t("tokenGas")}`);
  const formattedTotalRewarded = computed(() => `${formatGas(totalGlobalRewarded.value)} ${t("tokenGas")}`);

  // ── Data Loading ────────────────────────────────────────────────────

  /**
   * Apply CheckinData from the OS proxy to local reactive state.
   */
  const applyCheckinData = (data: CheckinData) => {
    currentStreak.value = data.currentStreak;
    highestStreak.value = data.highestStreak;
    totalUserCheckins.value = data.totalCheckins;
    lastCheckInDay.value = data.lastCheckinTime
      ? Math.floor(data.lastCheckinTime / (MS_PER_DAY / 1000))
      : 0;
    unclaimedRewards.value = Number(data.unclaimedRewards ?? 0);
    totalClaimed.value = Number(data.totalClaimed ?? 0);
  };

  /**
   * Load all data via the OS checkin proxy.
   * Called by defineMiniApp on mount and when the wallet connects.
   */
  const loadAll = async () => {
    isLoading.value = true;
    try {
      const data = await checkinService.getStreak();
      applyCheckinData(data);
    } catch (e) {
      console.warn("[useCheckin] loadAll failed:", e instanceof Error ? e.message : String(e));
    } finally {
      isLoading.value = false;
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────

  /**
   * Perform a daily check-in via the OS proxy.
   * The proxy handles wallet connection, payment, and event waiting.
   */
  const doCheckIn = async () => {
    if (!canCheckIn.value || isLoading.value) return;

    isLoading.value = true;
    try {
      await checkinService.checkIn();
      await loadAll();
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Claim accumulated GAS rewards via the OS proxy.
   */
  const claimRewards = async () => {
    if (unclaimedRewards.value <= 0 || isClaiming.value) return;

    isClaiming.value = true;
    try {
      await checkinService.claimRewards();
      await loadAll();
    } finally {
      isClaiming.value = false;
    }
  };

  /**
   * Start the countdown timer. Called from setup after composable creation.
   * The ticker stops automatically via Vue's onUnmounted hook.
   */
  const startTimer = () => {
    countdownTicker.start();
  };

  return {
    // ── Raw State ───────────────────────────────────────────────────
    currentStreak,
    highestStreak,
    lastCheckInDay,
    unclaimedRewards,
    totalClaimed,
    totalUserCheckins,
    totalGlobalCheckins,
    totalGlobalUsers,
    totalGlobalRewarded,
    checkinHistory,
    isLoading,
    isClaiming,

    // ── Computed ─────────────────────────────────────────────────────
    canCheckIn,
    utcTimeDisplay,
    nextUtcMidnight,

    // ── Formatted values (for manifest stat/sidebar bindings) ────────
    formattedCurrentStreak,
    formattedHighestStreak,
    formattedUnclaimed,
    formattedTotalClaimed,
    formattedTotalRewarded,

    // ── Constants ───────────────────────────────────────────────────
    milestones: MILESTONES,
    MS_PER_DAY,

    // ── Actions ─────────────────────────────────────────────────────
    doCheckIn,
    claimRewards,
    loadAll,
    startTimer,
  };
}

/** Return type of useCheckin for use in inject/provide typing */
export type UseCheckinReturn = ReturnType<typeof useCheckin>;
