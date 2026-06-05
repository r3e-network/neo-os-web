/**
 * useCheckin — Domain logic for the Daily Check-in miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract via
 * ctx.services.chain. The earlier path routed through the Morpheus OS check-in
 * proxy (ctx.os.checkin -> EdgeClient -> /api/edge -> Morpheus kernel), which is
 * non-operational, so the app was broken at runtime.
 *
 * Contract interaction model (verified against the deployed ABI on testnet
 * 0xaba84da240a55410d284a656fc8dae044e6ec1a5 and the live-validate harness
 * deploy/scripts/live_validate_flagship_user_flows.js → runDailyCheckin):
 *
 *   READS (chain.read, default app contract script hash):
 *     getCheckInStateForFrontend(user) -> Map{
 *       currentStreak, highestStreak, lastCheckinDay, unclaimed, totalCheckins,
 *       currentTime, currentDay, twentyFourHours, weekReward, twoWeekReward,
 *       resetAfterDays }
 *     getCheckinStatus(user)           -> Map{
 *       currentUtcDay, lastCheckinDay, canCheckin, timeUntilEligible,
 *       streakWillReset, currentStreak, nextRewardDay }
 *     getUserStatsDetails(user)        -> Map{ ..., claimed, ... }
 *     getPlatformStats()               -> Map{
 *       totalUsers, totalCheckins, totalRewarded, checkInFee, weekReward,
 *       twoWeekReward, resetAfterDays, currentUtcDay, nextMidnight }
 *
 *   CHECK-IN (deposit-then-act, single tx): the check-in is performed by the
 *     prepaid-GAS deposit itself — a GAS transfer of the check-in fee to the
 *     contract with the memo "miniapp-dailycheckin:checkin". The contract's
 *     OnNEP17Payment records the check-in and emits CheckedIn(user, streak,
 *     reward, nextEligibleTs). We read streak + reward straight from that event.
 *
 *   CLAIM (direct call, contract pays out from its own balance):
 *     claimRewards(user) -> emits RewardsClaimed(user, amount, totalClaimed).
 *     No deposit — the contract transfers the accrued GAS reward to the user in
 *     the same tx; the user's witness authorises it.
 *
 * UNIT / DAY CONVENTIONS:
 *   - All GAS amounts (fee, unclaimed, claimed, rewards) are in BASE UNITS
 *     (1e8 per GAS); the UI formats them via formatGas. The check-in fee read
 *     from getPlatformStats().checkInFee is already in base units.
 *   - The contract's "day" counter (currentDay / lastCheckinDay / currentUtcDay)
 *     is the contract's OWN unit (Runtime.Time / 86400) and is NOT commensurable
 *     with a JS Date day. Therefore canCheckIn, the current/last day, and the
 *     next-eligible countdown are driven by the CONTRACT's reported values
 *     (canCheckin boolean + nextMidnight ms timestamp), never by local clock
 *     math. nextMidnight is a real wall-clock ms timestamp, so the countdown
 *     ticks against Date.now().
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService } from "@shared/services/ChainService";
import { formatGas } from "@shared/utils/format";
import { addressToScriptHash } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const FIXED8 = 100_000_000;

export const MILESTONES = [
  { day: 7, reward: 1, cumulative: 1 },
  { day: 14, reward: 2, cumulative: 3 },
] as const;

/** Memo the contract's OnNEP17Payment requires to record a check-in. */
export const CHECKIN_MEMO = "miniapp-dailycheckin:checkin";

/** Default check-in fee in base units (0.001 GAS) until the contract reports one. */
const DEFAULT_CHECKIN_FEE = 100_000;

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
  /** Shared chain service from ctx.services.chain. */
  chain: ChainService;
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

/** Coerce a contract Integer (number | numeric string) to a finite Number. */
const intFromValue = (value: unknown, fallback = 0): number =>
  toFiniteNumber(parseBigInt(value).toString(), fallback);

const boolFromValue = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  return !(text === "" || text === "0" || text === "false");
};

/** Pull a single state slot's primitive value out of a contract event payload. */
const eventSlot = (event: unknown, index: number): unknown => {
  if (!event || typeof event !== "object") return undefined;
  const state = (event as { state?: unknown }).state;
  if (Array.isArray(state)) {
    const item = state[index] as unknown;
    if (item && typeof item === "object" && "value" in item) {
      return (item as { value?: unknown }).value;
    }
    return item;
  }
  return undefined;
};

const milestoneRewardForStreak = (streak: number): number => {
  const milestone = MILESTONES.find((item) => item.day === streak);
  return milestone ? milestone.reward * FIXED8 : 0;
};

/** Shape of the merged on-chain state read for a user (base-unit GAS amounts). */
interface ChainCheckinState {
  currentStreak: number;
  highestStreak: number;
  lastCheckinDay: number;
  currentDay: number;
  unclaimed: number;
  totalClaimed: number;
  totalUserCheckins: number;
  canCheckin: boolean;
  nextMidnight: number;
  checkInFee: number;
  totalGlobalCheckins: number;
  totalGlobalUsers: number;
  totalGlobalRewarded: number;
}

export function useCheckin({ chain, t }: UseCheckinOptions) {
  const currentStreak = createObservable(0);
  const highestStreak = createObservable(0);
  const lastCheckInDay = createObservable(0);
  const unclaimedRewards = createObservable(0);
  const totalClaimed = createObservable(0);
  const checkInFee = createObservable(DEFAULT_CHECKIN_FEE);
  const totalUserCheckins = createObservable(0);
  const isLoading = createObservable(false);
  const isClaiming = createObservable(false);

  const totalGlobalCheckins = createObservable(0);
  const totalGlobalUsers = createObservable(0);
  const totalGlobalRewarded = createObservable(0);

  // The contract's own "current day" counter and its next-eligible wall-clock
  // timestamp (ms). These drive the eligibility window because the contract day
  // unit is not a JS calendar day.
  const chainCurrentDay = createObservable(0);
  const chainCanCheckin = createObservable(true);
  const nextEligibleTs = createObservable(0);

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

  // Mirrors the contract's day counter so the week grid / "current day" facts
  // stay on the contract's clock rather than a divergent JS day.
  const currentUtcDay: Observable<number> = {
    get: () => chainCurrentDay.get(),
    set: () => {},
    subscribe: (fn) => chainCurrentDay.subscribe(fn),
  };

  // Next eligible check-in as a wall-clock ms timestamp (from the contract). The
  // countdown component ticks this against Date.now via the `now` observable.
  const nextUtcMidnight: Observable<number> = {
    get: () => {
      const ts = nextEligibleTs.get();
      // Fall back to the next JS midnight only before the first load, so the
      // countdown has a sane non-zero target.
      if (ts > 0) return ts;
      return (Math.floor(now.get() / MS_PER_DAY) + 1) * MS_PER_DAY;
    },
    set: () => {},
    subscribe: (fn) => {
      const unsub1 = nextEligibleTs.subscribe(fn);
      const unsub2 = now.subscribe(fn);
      return () => { unsub1(); unsub2(); };
    },
  };

  // Eligibility comes from the contract's canCheckin flag. After a successful
  // check-in we optimistically set chainCanCheckin=false so the CTA locks
  // immediately; the next load reconciles with the chain.
  const canCheckIn: Observable<boolean> = {
    get: () => chainCanCheckin.get(),
    set: () => {},
    subscribe: (fn) => chainCanCheckin.subscribe(fn),
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

  /**
   * Resolve the connected wallet's script hash, prompting connection if needed.
   * Returns "" when no wallet is available so callers can surface a clean error.
   */
  const resolveUserHash = async (): Promise<string> => {
    let addr = chain.address.get();
    if (!addr) {
      try {
        addr = await chain.ensureWallet();
      } catch {
        addr = chain.address.get();
      }
    }
    return addr ? addressToScriptHash(addr) : "";
  };

  /** Read the full on-chain state for a user into a normalized snapshot. */
  const readChainState = async (userHash: string): Promise<ChainCheckinState> => {
    const [frontend, status, details, platform] = await Promise.all([
      chain.read("getCheckInStateForFrontend", [{ type: "Hash160", value: userHash }]),
      chain.read("getCheckinStatus", [{ type: "Hash160", value: userHash }]),
      chain.read("getUserStatsDetails", [{ type: "Hash160", value: userHash }]),
      chain.read("getPlatformStats", []),
    ]);

    const f = (frontend && typeof frontend === "object" ? frontend : {}) as Record<string, unknown>;
    const s = (status && typeof status === "object" ? status : {}) as Record<string, unknown>;
    const d = (details && typeof details === "object" ? details : {}) as Record<string, unknown>;
    const p = (platform && typeof platform === "object" ? platform : {}) as Record<string, unknown>;

    const fee = intFromValue(p.checkInFee, DEFAULT_CHECKIN_FEE);

    return {
      currentStreak: intFromValue(f.currentStreak),
      highestStreak: intFromValue(f.highestStreak, intFromValue(f.currentStreak)),
      lastCheckinDay: intFromValue(f.lastCheckinDay),
      currentDay: intFromValue(f.currentDay, intFromValue(p.currentUtcDay)),
      unclaimed: intFromValue(f.unclaimed),
      totalClaimed: intFromValue(d.claimed),
      totalUserCheckins: intFromValue(f.totalCheckins),
      canCheckin: boolFromValue(s.canCheckin),
      nextMidnight: intFromValue(p.nextMidnight),
      checkInFee: fee > 0 ? fee : DEFAULT_CHECKIN_FEE,
      totalGlobalCheckins: intFromValue(p.totalCheckins),
      totalGlobalUsers: intFromValue(p.totalUsers),
      totalGlobalRewarded: intFromValue(p.totalRewarded),
    };
  };

  const applyChainState = (data: ChainCheckinState) => {
    currentStreak.set(data.currentStreak);
    highestStreak.set(Math.max(data.highestStreak, data.currentStreak));
    totalUserCheckins.set(data.totalUserCheckins);
    lastCheckInDay.set(data.lastCheckinDay);
    chainCurrentDay.set(data.currentDay);
    unclaimedRewards.set(data.unclaimed);
    totalClaimed.set(data.totalClaimed);
    chainCanCheckin.set(data.canCheckin);
    nextEligibleTs.set(data.nextMidnight);
    totalGlobalCheckins.set(data.totalGlobalCheckins);
    totalGlobalUsers.set(data.totalGlobalUsers);
    totalGlobalRewarded.set(data.totalGlobalRewarded);
    if (data.checkInFee > 0) checkInFee.set(data.checkInFee);
  };

  const addHistory = (entry: CheckinHistoryItem) => {
    checkinHistory.set([
      entry,
      ...checkinHistory.get().filter((item) => item.txid !== entry.txid || !entry.txid),
    ].slice(0, 10));
  };

  const loadAll = async (options: LoadOptions = {}) => {
    const shouldRecord = options.record === true;
    // A load is already running — coalesce to avoid two concurrent reads racing
    // to write the same observables out of order.
    if (loadInFlight) return;
    loadInFlight = true;
    if (shouldRecord) {
      recordRequest("refreshStatus", t("workflowRefreshing"));
    }

    isLoading.set(true);
    try {
      const userHash = await resolveUserHash();
      if (!userHash) {
        // No wallet connected yet — leave the seed state and surface a clean
        // status only when the user explicitly asked to refresh.
        if (shouldRecord) {
          recordSuccess("refreshStatus", t("workflowReady"), null);
        }
        return;
      }
      const data = await readChainState(userHash);
      applyChainState(data);
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
      const userHash = await resolveUserHash();
      if (!userHash) throw new Error(t("walletRequired"));

      const contractHash = chain.contractAddress.get();
      if (!contractHash) throw new Error(t("contractNotReady"));

      const feeBase = Math.max(0, Math.trunc(checkInFee.get()) || DEFAULT_CHECKIN_FEE);

      // Deposit-then-act in ONE transfer: the GAS deposit carrying the
      // "miniapp-dailycheckin:checkin" memo IS the check-in. OnNEP17Payment
      // records it and emits CheckedIn(user, streak, reward, nextEligibleTs).
      const result = await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: userHash },
          { type: "Hash160", value: contractHash },
          { type: "Integer", value: String(feeBase) },
          { type: "String", value: CHECKIN_MEMO },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH, waitForEvent: "CheckedIn" },
      );

      // CheckedIn(user, streak, reward, nextEligibleTs): streak=slot1, reward=slot2.
      const eventStreak = intFromValue(eventSlot(result.event, 1));
      const eventReward = intFromValue(eventSlot(result.event, 2));
      const eventNext = intFromValue(eventSlot(result.event, 3));
      const txid = result.txid || "";

      // Refresh from chain to reconcile streak/rewards/global totals. If the
      // event settled but the read lags the node, fall back to the event values.
      await loadAll({ record: false }).catch(() => undefined);

      const resolvedStreak = eventStreak > 0 ? eventStreak : currentStreak.get();
      const resolvedReward = eventReward > 0 ? eventReward : milestoneRewardForStreak(resolvedStreak);

      // Lock the CTA for this cycle and surface the next eligible time from the
      // event when the platform read hasn't advanced yet.
      chainCanCheckin.set(false);
      if (eventNext > 0 && nextEligibleTs.get() <= 0) nextEligibleTs.set(eventNext);
      if (resolvedStreak > currentStreak.get()) currentStreak.set(resolvedStreak);
      if (resolvedStreak > highestStreak.get()) highestStreak.set(resolvedStreak);

      addHistory({
        action: "checkin",
        streak: resolvedStreak,
        time: nowIso(),
        reward: resolvedReward,
        txid,
      });

      recordSuccess("doCheckIn", t("checkinRecorded"), {
        txid,
        streak: resolvedStreak,
        reward: formatGas(resolvedReward),
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
      const userHash = await resolveUserHash();
      if (!userHash) throw new Error(t("walletRequired"));

      // Direct call — the contract pays the accrued reward to the user from its
      // own balance and emits RewardsClaimed(user, amount, totalClaimed).
      const result = await chain.invoke(
        "claimRewards",
        [{ type: "Hash160", value: userHash }],
        { waitForEvent: "RewardsClaimed" },
      );

      // RewardsClaimed(user, amount, totalClaimed): amount=slot1, total=slot2.
      const eventAmount = intFromValue(eventSlot(result.event, 1));
      const eventTotal = intFromValue(eventSlot(result.event, 2));
      const txid = result.txid || "";
      const claimedNow = eventAmount > 0 ? eventAmount : claimAmount;

      const baselineTotalClaimed = totalClaimed.get();
      const baselineTotalRewarded = totalGlobalRewarded.get();

      // Reconcile from chain; fall back to event/optimistic values on node lag.
      await loadAll({ record: false }).catch(() => undefined);

      if (eventTotal > 0) {
        totalClaimed.set(Math.max(totalClaimed.get(), eventTotal));
      } else {
        totalClaimed.set(Math.max(totalClaimed.get(), baselineTotalClaimed + claimedNow));
      }
      totalGlobalRewarded.set(Math.max(totalGlobalRewarded.get(), baselineTotalRewarded + claimedNow));
      // The reward was paid out — nothing remains unclaimed.
      unclaimedRewards.set(0);

      addHistory({
        action: "claim",
        streak: currentStreak.get(),
        time: nowIso(),
        reward: claimedNow,
        txid,
      });

      recordSuccess("claimRewards", t("rewardClaimed"), {
        txid,
        amount: formatGas(claimedNow),
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
    currentUtcDay,

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
