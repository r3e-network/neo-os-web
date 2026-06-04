/**
 * useCheckin - Domain logic for the Daily Check-in miniapp.
 *
 * The OS check-in proxy returns normalized streak data and wallet intents. This
 * composable keeps the user-facing workflow honest by recording requests,
 * results, optimistic local state after wallet submission, and history evidence.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { CheckinProxy, CheckinData } from "@shared/services/os/CheckinProxy";
import { formatGas, toFixedDecimals } from "@shared/utils/format";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const FIXED8 = 100_000_000;

export const MILESTONES = [
  { day: 7, reward: 1, cumulative: 1 },
  { day: 14, reward: 2, cumulative: 3 },
] as const;

export interface CheckinHistoryItem {
  streak: number;
  time: string;
  reward: number;
  action?: "checkin" | "claim";
  txid?: string;
}

export interface WorkflowEvidence {
  action: string;
  status: "pending" | "success" | "error";
  summary: string;
  at: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown> | string | null;
  txid?: string;
}

export interface UseCheckinOptions {
  checkinService: CheckinProxy;
  t: (key: string, params?: Record<string, string | number>) => string;
}

interface LoadOptions {
  record?: boolean;
}

const nowIso = () => new Date().toISOString();

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fixed8FromGasValue = (value: unknown): number => {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  if (/^\d{8,}$/.test(raw)) return toFiniteNumber(raw);
  const fixed = toFixedDecimals(raw, 8);
  return toFiniteNumber(fixed);
};

const fixed8GasReward = (gas: number): number => gas * FIXED8;

const milestoneRewardForStreak = (streak: number): number => {
  const milestone = MILESTONES.find((item) => item.day === streak);
  return milestone ? fixed8GasReward(milestone.reward) : 0;
};

const extractTxid = (value: unknown): string => {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const txid = String(record.txid || record.tx || record.hash || "").trim();
  if (txid) return txid;
  const invocation = record.invocation;
  if (invocation && typeof invocation === "object") {
    const nested = invocation as Record<string, unknown>;
    return String(nested.txid || nested.tx || "").trim();
  }
  return "";
};

const summarizeResult = (value: unknown): Record<string, unknown> | string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return String(value);
  const record = value as Record<string, unknown>;
  const invocation = record.invocation && typeof record.invocation === "object"
    ? record.invocation as Record<string, unknown>
    : null;
  return {
    intent: record.intent,
    txid: record.txid || record.tx || invocation?.txid || invocation?.tx,
    contract: record.contract || record.contractHash || invocation?.contract || invocation?.contract_hash,
    operation: record.operation || record.method || invocation?.operation || invocation?.method,
  };
};

type ExtendedCheckinData = CheckinData & {
  longestStreak?: number;
  lastCheckin?: number | string | null;
  totalGlobalCheckins?: number | string;
  totalGlobalUsers?: number | string;
  totalGlobalRewarded?: number | string;
  checkInFee?: number | string;
};

export function useCheckin({ checkinService, t }: UseCheckinOptions) {
  const currentStreak = createObservable(0);
  const highestStreak = createObservable(0);
  const lastCheckInDay = createObservable(0);
  const unclaimedRewards = createObservable(0);
  const totalClaimed = createObservable(0);
  const checkInFee = createObservable(100000);
  const totalUserCheckins = createObservable(0);
  const isLoading = createObservable(false);
  const isClaiming = createObservable(false);

  const totalGlobalCheckins = createObservable(0);
  const totalGlobalUsers = createObservable(0);
  const totalGlobalRewarded = createObservable(0);

  const checkinHistory = createObservable<CheckinHistoryItem[]>([]);
  const workflowStatus = createObservable(t("workflowReady"));
  const lastError = createObservable("");
  const latestRequest = createObservable<WorkflowEvidence | null>(null);
  const latestResult = createObservable<WorkflowEvidence | null>(null);

  const now = createObservable(Date.now());
  let tickerInterval: ReturnType<typeof setInterval> | null = null;
  // Coalesces overlapping status loads so a user-triggered refresh cannot run
  // concurrently with an action's internal reload and clobber its writes.
  let loadInFlight = false;

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
    get: () => lastCheckInDay.get() === 0 || currentUtcDay.get() > lastCheckInDay.get(),
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

  const recordRequest = (
    action: string,
    summary: string,
    payload?: Record<string, unknown>,
  ) => {
    lastError.set("");
    workflowStatus.set(summary);
    latestRequest.set({
      action,
      status: "pending",
      summary,
      at: nowIso(),
      payload,
    });
  };

  const recordSuccess = (
    action: string,
    summary: string,
    result?: Record<string, unknown> | string | null,
  ) => {
    workflowStatus.set(summary);
    latestResult.set({
      action,
      status: "success",
      summary,
      at: nowIso(),
      result,
      txid: result && typeof result === "object" ? String((result as Record<string, unknown>).txid || "") : "",
    });
  };

  const recordFailure = (action: string, error: unknown) => {
    const summary = error instanceof Error ? error.message : String(error);
    lastError.set(summary);
    workflowStatus.set(t("workflowFailed"));
    latestResult.set({
      action,
      status: "error",
      summary,
      at: nowIso(),
      result: summary,
    });
  };

  const applyCheckinData = (data: ExtendedCheckinData) => {
    const normalizedCurrent = toFiniteNumber(data.currentStreak);
    const normalizedHighest = toFiniteNumber(
      data.highestStreak,
      toFiniteNumber(data.longestStreak, normalizedCurrent),
    );
    const lastCheckinTime = toFiniteNumber(
      data.lastCheckinTime,
      toFiniteNumber(data.lastCheckin),
    );

    currentStreak.set(normalizedCurrent);
    highestStreak.set(normalizedHighest);
    totalUserCheckins.set(toFiniteNumber(data.totalCheckins));
    lastCheckInDay.set(lastCheckinTime ? Math.floor(lastCheckinTime / MS_PER_DAY) : 0);
    unclaimedRewards.set(fixed8FromGasValue(data.unclaimedRewards));
    totalClaimed.set(fixed8FromGasValue(data.totalClaimed));
    totalGlobalCheckins.set(toFiniteNumber(data.totalGlobalCheckins));
    totalGlobalUsers.set(toFiniteNumber(data.totalGlobalUsers));
    totalGlobalRewarded.set(fixed8FromGasValue(data.totalGlobalRewarded));
    const fee = fixed8FromGasValue(data.checkInFee);
    if (fee > 0) checkInFee.set(fee);
  };

  const addHistory = (entry: CheckinHistoryItem) => {
    checkinHistory.set([
      entry,
      ...checkinHistory.get().filter((item) => item.txid !== entry.txid || !entry.txid),
    ].slice(0, 10));
  };

  const applyOptimisticCheckin = (
    result: unknown,
    baseline: {
      currentStreak: number;
      highestStreak: number;
      totalUserCheckins: number;
      totalGlobalCheckins: number;
      totalGlobalUsers: number;
      unclaimedRewards: number;
      totalClaimed: number;
      totalGlobalRewarded: number;
    },
  ) => {
    const nextStreak = baseline.currentStreak + 1;
    const reward = milestoneRewardForStreak(nextStreak);
    const txid = extractTxid(result);

    currentStreak.set(nextStreak);
    highestStreak.set(Math.max(baseline.highestStreak, nextStreak));
    totalUserCheckins.set(baseline.totalUserCheckins + 1);
    totalGlobalCheckins.set(baseline.totalGlobalCheckins + 1);
    totalGlobalUsers.set(Math.max(baseline.totalGlobalUsers, 1));
    totalClaimed.set(Math.max(totalClaimed.get(), baseline.totalClaimed));
    totalGlobalRewarded.set(Math.max(totalGlobalRewarded.get(), baseline.totalGlobalRewarded));
    lastCheckInDay.set(currentUtcDay.get());
    unclaimedRewards.set(baseline.unclaimedRewards + reward);
    addHistory({
      action: "checkin",
      streak: nextStreak,
      time: nowIso(),
      reward,
      txid,
    });
  };

  const loadAll = async (options: LoadOptions = {}) => {
    const shouldRecord = options.record === true;
    // A load is already running — coalesce to avoid two concurrent getStreak
    // responses racing to write the same observables out of order.
    if (loadInFlight) return;
    loadInFlight = true;
    if (shouldRecord) {
      recordRequest("refreshStatus", t("workflowRefreshing"));
    }

    isLoading.set(true);
    try {
      const data = await checkinService.getStreak();
      applyCheckinData(data as ExtendedCheckinData);
      if (shouldRecord) {
        recordSuccess("refreshStatus", t("statusLoaded"), {
          currentStreak: currentStreak.get(),
          unclaimedRewards: formatGas(unclaimedRewards.get()),
        });
      }
    } catch (e) {
      if (shouldRecord) recordFailure("refreshStatus", e);
      if (!shouldRecord) {
        console.warn("[useCheckin] loadAll failed:", e instanceof Error ? e.message : String(e));
        return;
      }
      throw e;
    } finally {
      isLoading.set(false);
      loadInFlight = false;
    }
  };

  const refreshStatus = async () => {
    await loadAll({ record: true });
  };

  const doCheckIn = async () => {
    if (isLoading.get()) return;
    if (!canCheckIn.get()) {
      recordSuccess("doCheckIn", t("checkinUnavailable"), null);
      return;
    }

    recordRequest("doCheckIn", t("workflowCheckingIn"), {
      nextStreak: currentStreak.get() + 1,
      checkInFee: formatGas(checkInFee.get()),
    });

    isLoading.set(true);
    try {
      const baseline = {
        currentStreak: currentStreak.get(),
        highestStreak: highestStreak.get(),
        totalUserCheckins: totalUserCheckins.get(),
        totalGlobalCheckins: totalGlobalCheckins.get(),
        totalGlobalUsers: totalGlobalUsers.get(),
        unclaimedRewards: unclaimedRewards.get(),
        totalClaimed: totalClaimed.get(),
        totalGlobalRewarded: totalGlobalRewarded.get(),
      };
      const result = await checkinService.checkIn();
      await loadAll({ record: false }).catch(() => undefined);
      applyOptimisticCheckin(result, baseline);
      recordSuccess("doCheckIn", t("checkinRecorded"), {
        txid: extractTxid(result),
        result: summarizeResult(result),
        currentStreak: currentStreak.get(),
      });
    } catch (e) {
      recordFailure("doCheckIn", e);
      throw e;
    } finally {
      isLoading.set(false);
    }
  };

  const claimRewards = async () => {
    if (isClaiming.get()) return;
    const claimAmount = unclaimedRewards.get();
    if (claimAmount <= 0) {
      recordSuccess("claimRewards", t("rewardsUnavailable"), null);
      return;
    }

    recordRequest("claimRewards", t("workflowClaiming"), {
      amount: formatGas(claimAmount),
    });

    isClaiming.set(true);
    try {
      const baseline = {
        currentStreak: currentStreak.get(),
        highestStreak: highestStreak.get(),
        lastCheckInDay: lastCheckInDay.get(),
        totalUserCheckins: totalUserCheckins.get(),
        totalGlobalCheckins: totalGlobalCheckins.get(),
        totalGlobalUsers: totalGlobalUsers.get(),
        totalClaimed: totalClaimed.get(),
        totalGlobalRewarded: totalGlobalRewarded.get(),
      };
      const result = await checkinService.claimRewards();
      await loadAll({ record: false }).catch(() => undefined);
      currentStreak.set(Math.max(currentStreak.get(), baseline.currentStreak));
      highestStreak.set(Math.max(highestStreak.get(), baseline.highestStreak));
      lastCheckInDay.set(Math.max(lastCheckInDay.get(), baseline.lastCheckInDay));
      totalUserCheckins.set(Math.max(totalUserCheckins.get(), baseline.totalUserCheckins));
      totalGlobalCheckins.set(Math.max(totalGlobalCheckins.get(), baseline.totalGlobalCheckins));
      totalGlobalUsers.set(Math.max(totalGlobalUsers.get(), baseline.totalGlobalUsers));
      totalClaimed.set(Math.max(totalClaimed.get(), baseline.totalClaimed + claimAmount));
      totalGlobalRewarded.set(Math.max(totalGlobalRewarded.get(), baseline.totalGlobalRewarded + claimAmount));
      unclaimedRewards.set(0);
      addHistory({
        action: "claim",
        streak: currentStreak.get(),
        time: nowIso(),
        reward: claimAmount,
        txid: extractTxid(result),
      });
      recordSuccess("claimRewards", t("rewardClaimed"), {
        txid: extractTxid(result),
        amount: formatGas(claimAmount),
        result: summarizeResult(result),
      });
    } catch (e) {
      recordFailure("claimRewards", e);
      throw e;
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

  const stopTimer = () => {
    if (tickerInterval) clearInterval(tickerInterval);
    tickerInterval = null;
  };

  return {
    currentStreak,
    highestStreak,
    lastCheckInDay,
    unclaimedRewards,
    totalClaimed,
    checkInFee,
    totalUserCheckins,
    totalGlobalCheckins,
    totalGlobalUsers,
    totalGlobalRewarded,
    checkinHistory,
    isLoading,
    isClaiming,
    workflowStatus,
    lastError,
    latestRequest,
    latestResult,

    canCheckIn,
    utcTimeDisplay,
    nextUtcMidnight,

    formattedCurrentStreak,
    formattedHighestStreak,
    formattedUnclaimed,
    formattedTotalClaimed,
    formattedTotalRewarded,

    milestones: MILESTONES,
    MS_PER_DAY,

    doCheckIn,
    claimRewards,
    refreshStatus,
    loadAll,
    startTimer,
    stopTimer,
  };
}

export type UseCheckinReturn = ReturnType<typeof useCheckin>;
