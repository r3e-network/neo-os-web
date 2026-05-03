/**
 * useCheckin — Domain logic for the Daily Check-in miniapp (OS Services)
 *
 * React version: uses createObservable instead of Vue ref/computed.
 *
 * This composable uses OS service proxies instead of direct chain calls.
 * All contract interaction is delegated to CheckinProxy via edge functions,
 * so this file contains zero contract hashes, parameter encoding, or
 * event parsing logic.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { CheckinProxy, CheckinData } from "@shared/services/os/CheckinProxy";
import { formatGas } from "@shared/utils/format";

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
  const currentStreak = createObservable(0);
  const highestStreak = createObservable(0);
  const lastCheckInDay = createObservable(0);
  const unclaimedRewards = createObservable(0);
  const totalClaimed = createObservable(0);
  const totalUserCheckins = createObservable(0);
  const isLoading = createObservable(false);
  const isClaiming = createObservable(false);

  // ── Global Stats ────────────────────────────────────────────────────
  const totalGlobalCheckins = createObservable(0);
  const totalGlobalUsers = createObservable(0);
  const totalGlobalRewarded = createObservable(0);

  // ── History ─────────────────────────────────────────────────────────
  const checkinHistory = createObservable<CheckinHistoryItem[]>([]);

  // ── Countdown Timer ─────────────────────────────────────────────────
  const now = createObservable(Date.now());
  let tickerInterval: ReturnType<typeof setInterval> | null = null;

  // ── Derived observables (computed equivalents) ──────────────────────
  const currentUtcDay: Observable<number> = {
    get: () => Math.floor(now.get() / MS_PER_DAY),
    set: () => {},
    subscribe: (fn) => now.subscribe(fn),
  };

  const nextUtcMidnight: Observable<number> = {
    get: () => (currentUtcDay.get() + 1) * MS_PER_DAY,
    set: () => {},
    subscribe: (fn) => now.subscribe(fn),
  };

  const canCheckIn: Observable<boolean> = {
    get: () => {
      if (lastCheckInDay.get() === 0) return true;
      return currentUtcDay.get() > lastCheckInDay.get();
    },
    set: () => {},
    subscribe: (fn) => {
      const unsub1 = now.subscribe(fn);
      const unsub2 = lastCheckInDay.subscribe(fn);
      return () => { unsub1(); unsub2(); };
    },
  };

  const utcTimeDisplay: Observable<string> = {
    get: () => {
      const utcDate = new Date(now.get());
      const h = String(utcDate.getUTCHours()).padStart(2, "0");
      const m = String(utcDate.getUTCMinutes()).padStart(2, "0");
      const s = String(utcDate.getUTCSeconds()).padStart(2, "0");
      return `${h}:${m}:${s}`;
    },
    set: () => {},
    subscribe: (fn) => now.subscribe(fn),
  };

  // ── Formatted display values ────────────────────────────────────────
  const formattedCurrentStreak: Observable<string> = {
    get: () => `${currentStreak.get()} ${t("days")}`,
    set: () => {},
    subscribe: (fn) => currentStreak.subscribe(fn),
  };

  const formattedHighestStreak: Observable<string> = {
    get: () => `${highestStreak.get()} ${t("days")}`,
    set: () => {},
    subscribe: (fn) => highestStreak.subscribe(fn),
  };

  const formattedUnclaimed: Observable<string> = {
    get: () => `${formatGas(unclaimedRewards.get())} ${t("tokenGas")}`,
    set: () => {},
    subscribe: (fn) => unclaimedRewards.subscribe(fn),
  };

  const formattedTotalClaimed: Observable<string> = {
    get: () => `${formatGas(totalClaimed.get())} ${t("tokenGas")}`,
    set: () => {},
    subscribe: (fn) => totalClaimed.subscribe(fn),
  };

  const formattedTotalRewarded: Observable<string> = {
    get: () => `${formatGas(totalGlobalRewarded.get())} ${t("tokenGas")}`,
    set: () => {},
    subscribe: (fn) => totalGlobalRewarded.subscribe(fn),
  };

  // ── Data Loading ────────────────────────────────────────────────────

  const toFiniteNumber = (value: unknown, fallback = 0) => {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  };

  const applyCheckinData = (data: CheckinData & { longestStreak?: number; lastCheckin?: number | string | null }) => {
    const normalizedCurrent = toFiniteNumber(data.currentStreak);
    const normalizedHighest = toFiniteNumber(data.highestStreak, toFiniteNumber(data.longestStreak, normalizedCurrent));
    const lastCheckinTime = toFiniteNumber(data.lastCheckinTime, toFiniteNumber(data.lastCheckin));

    currentStreak.set(normalizedCurrent);
    highestStreak.set(normalizedHighest);
    totalUserCheckins.set(toFiniteNumber(data.totalCheckins));
    lastCheckInDay.set(
      lastCheckinTime
        ? Math.floor(lastCheckinTime / (MS_PER_DAY / 1000))
        : 0,
    );
    unclaimedRewards.set(toFiniteNumber(data.unclaimedRewards));
    totalClaimed.set(toFiniteNumber(data.totalClaimed));
  };

  const loadAll = async () => {
    isLoading.set(true);
    try {
      const data = await checkinService.getStreak();
      applyCheckinData(data);
    } catch (e) {
      console.warn("[useCheckin] loadAll failed:", e instanceof Error ? e.message : String(e));
    } finally {
      isLoading.set(false);
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────

  const doCheckIn = async () => {
    if (!canCheckIn.get() || isLoading.get()) return;

    isLoading.set(true);
    try {
      await checkinService.checkIn();
      await loadAll();
    } finally {
      isLoading.set(false);
    }
  };

  const claimRewards = async () => {
    if (unclaimedRewards.get() <= 0 || isClaiming.get()) return;

    isClaiming.set(true);
    try {
      await checkinService.claimRewards();
      await loadAll();
    } finally {
      isClaiming.set(false);
    }
  };

  const startTimer = () => {
    if (tickerInterval) clearInterval(tickerInterval);
    tickerInterval = setInterval(() => {
      now.set(Date.now());
    }, 1000);
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

/** Return type of useCheckin for use in typing */
export type UseCheckinReturn = ReturnType<typeof useCheckin>;
