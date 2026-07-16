import {
  createObservable,
  createReadCell,
  type Observable,
  type ReadCell,
} from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { formatGas } from "@shared/utils/format";
import { eventValue } from "@shared/utils/chain-events";
import {
  dailyCheckinAccountMatches,
  dailyCheckinNotificationValue,
  findDailyCheckinNotification,
  isPendingDailyCheckinOperation,
  normalizeDailyCheckinAccount,
  requireCanonicalDailyCheckinContext,
  unsignedDailyCheckinInteger,
  waitForDailyCheckinTransactionOutcome,
  type DailyCheckinContext,
  type DailyCheckinNotification,
  type DailyCheckinTransactionOutcome,
  type PendingDailyCheckinOperation,
} from "../daily-checkin-safety";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const FIXED8 = 100_000_000;
export const CHECKIN_MEMO = "miniapp-dailycheckin:checkin";
export const MILESTONES = [
  { day: 7, reward: 0.01, cumulative: 0.01 },
  { day: 14, reward: 0.02, cumulative: 0.03 },
] as const;

const HISTORY_EVENT_LIMIT = 100;
const HISTORY_DISPLAY_LIMIT = 10;

export type DailyCheckinDataSource = "idle" | "loading" | "chain" | "partial" | "failed";
export type DailyCheckinActionResult =
  | { status: "confirmed"; txid: string }
  | { status: "pending"; txid: string }
  | { status: "fault"; txid: string };

export interface CheckinHistoryItem {
  streak: number;
  time: string;
  rewardRaw: string;
  action: "checkin" | "claim";
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

export interface DailyCheckinPlatformSnapshot {
  totalGlobalCheckins: number;
  totalGlobalUsers: number;
  totalGlobalRewardedRaw: string;
  checkInFeeRaw: string;
  currentDay: number;
  nextMidnight: number;
  weekRewardRaw: string;
  twoWeekRewardRaw: string;
  rewardPoolRaw: string;
  totalUnclaimedRaw: string;
  paused: boolean;
}

export interface DailyCheckinUserSnapshot {
  currentStreak: number;
  highestStreak: number;
  lastCheckinDay: number;
  unclaimedRaw: string;
  totalClaimedRaw: string;
  totalUserCheckins: number;
  canCheckin: boolean;
  streakWillReset: boolean;
  nextRewardDay: number;
}

export interface DailyCheckinSnapshot {
  platform: DailyCheckinPlatformSnapshot;
  user: DailyCheckinUserSnapshot;
}

/**
 * One settled user read on the user lane's read-cell: the snapshot plus the
 * actor it was read FOR. The actor rides along because `loadedActorHash`
 * (the identity-diff guard consumed by `onAccountChanged`) must clear and
 * publish in lockstep with the user snapshot itself.
 */
interface DailyCheckinUserLane {
  user: DailyCheckinUserSnapshot;
  actorHash: string;
}

export interface UseCheckinOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
}

interface LoadOptions {
  prompt?: boolean;
  record?: boolean;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} read is unavailable.`);
  }
  return value as Record<string, unknown>;
}

function unsigned(value: unknown, label: string): string {
  const parsed = unsignedDailyCheckinInteger(value);
  if (!parsed) throw new Error(`${label} is malformed.`);
  return parsed;
}

function safeNumber(value: unknown, label: string): number {
  const parsed = BigInt(unsigned(value, label));
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} is too large.`);
  return Number(parsed);
}

function strictBoolean(value: unknown, label: string): boolean {
  if (typeof value === "boolean") return value;
  const normalized = clean(value).toLowerCase();
  if (normalized === "1" || normalized === "true") return true;
  if (normalized === "0" || normalized === "false") return false;
  throw new Error(`${label} is malformed.`);
}

function positive(value: unknown, label: string): string {
  const parsed = unsigned(value, label);
  if (BigInt(parsed) <= 0n) throw new Error(`${label} must be positive.`);
  return parsed;
}

function txidFrom(value: unknown): string {
  const txid = clean((value as { txid?: unknown } | null)?.txid);
  if (!/^0x[0-9a-fA-F]{64}$/.test(txid)) {
    throw new Error("Wallet did not return a valid transaction ID.");
  }
  return txid;
}

function nowIso(): string {
  return new Date().toISOString();
}

function validEventTime(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const raw = clean(value);
  const numeric = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  const date = Number.isFinite(numeric)
    ? new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000)
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function derived<T>(get: () => T, dependencies: Observable<unknown>[]): Observable<T> {
  return {
    get,
    set: () => {},
    subscribe: (listener) => {
      const unsubs = dependencies.map((dependency) => dependency.subscribe(listener));
      return () => unsubs.forEach((unsubscribe) => unsubscribe());
    },
  };
}

function eventUnsigned(event: DailyCheckinNotification, index: number): string {
  return unsignedDailyCheckinInteger(dailyCheckinNotificationValue(event, index));
}

export function useCheckin({ app, t }: UseCheckinOptions) {
  const network = createObservable("");
  const contractHash = createObservable("");
  const dataSource = createObservable<DailyCheckinDataSource>("idle");

  /**
   * The two chain read lanes on the platform read-cell (read-cell pilot).
   *
   * `value === undefined` IS the old `hasLoadedPlatform`/`hasLoadedStatus`
   * "no data yet" state, so the per-field observables below become deriveds
   * of one snapshot each instead of a hand-fanned write per field. Cell throw
   * semantics reproduce the old flags exactly: a failed platform re-read
   * keeps the last good snapshot renderable (`hasLoadedPlatform` never
   * flipped back on a failed refresh), while a failed user read is followed
   * by `clearUserState()` — now `userLane.reset()` — which wipes value and
   * flag together, and joins the cell epoch so an in-flight read for a
   * previous actor can no longer publish over the wipe.
   *
   * Loader parameters travel through a request slot that the loader consumes
   * synchronously — `createReadCell` invokes the loader inline within
   * `load()`, before any interleaving code can replace the slot.
   */
  let platformLaneRequest: DailyCheckinContext | null = null;
  const platformLane: ReadCell<DailyCheckinPlatformSnapshot> = createReadCell(() => {
    const current = platformLaneRequest;
    if (!current) throw new Error("Platform read requested before context resolution.");
    return readPlatformSnapshot(current);
  });
  const loadPlatformLane = (current: DailyCheckinContext) => {
    platformLaneRequest = current;
    return platformLane.load();
  };

  let userLaneRequest: {
    current: DailyCheckinContext;
    actorHash: string;
    platform: DailyCheckinPlatformSnapshot;
  } | null = null;
  const userLane: ReadCell<DailyCheckinUserLane> = createReadCell(async () => {
    const request = userLaneRequest;
    if (!request) throw new Error("User read requested before context resolution.");
    const user = await readUserSnapshot(request.current, request.actorHash, request.platform);
    return { user, actorHash: request.actorHash };
  });
  const loadUserLane = (
    current: DailyCheckinContext,
    actorHash: string,
    platform: DailyCheckinPlatformSnapshot,
  ) => {
    userLaneRequest = { current, actorHash, platform };
    return userLane.load();
  };

  const currentStreak = derived(() => userLane.value.get()?.user.currentStreak ?? 0, [userLane.value]);
  const highestStreak = derived(() => userLane.value.get()?.user.highestStreak ?? 0, [userLane.value]);
  const lastCheckInDay = derived(() => userLane.value.get()?.user.lastCheckinDay ?? 0, [userLane.value]);
  const totalUserCheckins = derived(() => userLane.value.get()?.user.totalUserCheckins ?? 0, [userLane.value]);
  const unclaimedRewards = derived(() => userLane.value.get()?.user.unclaimedRaw ?? "", [userLane.value]);
  const totalClaimed = derived(() => userLane.value.get()?.user.totalClaimedRaw ?? "", [userLane.value]);
  const checkInFeeRaw = derived(() => platformLane.value.get()?.checkInFeeRaw ?? "", [platformLane.value]);
  const totalGlobalCheckins = derived(() => platformLane.value.get()?.totalGlobalCheckins ?? 0, [platformLane.value]);
  const totalGlobalUsers = derived(() => platformLane.value.get()?.totalGlobalUsers ?? 0, [platformLane.value]);
  const totalGlobalRewarded = derived(() => platformLane.value.get()?.totalGlobalRewardedRaw ?? "", [platformLane.value]);
  const rewardPoolBalance = derived(() => platformLane.value.get()?.rewardPoolRaw ?? "", [platformLane.value]);
  const totalUnclaimed = derived(() => platformLane.value.get()?.totalUnclaimedRaw ?? "", [platformLane.value]);
  const weekReward = derived(() => platformLane.value.get()?.weekRewardRaw ?? "", [platformLane.value]);
  const twoWeekReward = derived(() => platformLane.value.get()?.twoWeekRewardRaw ?? "", [platformLane.value]);
  const isPaused = derived(() => platformLane.value.get()?.paused ?? false, [platformLane.value]);
  const chainCurrentDay = derived(() => platformLane.value.get()?.currentDay ?? 0, [platformLane.value]);
  const nextEligibleTs = derived(() => platformLane.value.get()?.nextMidnight ?? 0, [platformLane.value]);
  const chainCanCheckin = derived(() => userLane.value.get()?.user.canCheckin ?? false, [userLane.value]);
  const streakWillReset = derived(() => userLane.value.get()?.user.streakWillReset ?? false, [userLane.value]);
  const nextRewardDay = derived(() => userLane.value.get()?.user.nextRewardDay ?? 7, [userLane.value]);
  const hasLoadedPlatform = derived(() => platformLane.value.get() !== undefined, [platformLane.value]);
  const hasLoadedStatus = derived(() => userLane.value.get() !== undefined, [userLane.value]);
  /**
   * True once a canonical-context resolution has completed, success or failure.
   *
   * `network`/`contractHash` are "" until `requireCanonicalDailyCheckinContext`
   * resolves, and emptiness alone cannot tell "we are still resolving" from
   * "resolution failed and there is no network" — so the header rendered both
   * as `Neo N3 —`. `hasLoadedPlatform` cannot stand in for this: it never flips
   * when the context read itself throws, which is precisely the case that must
   * settle rather than shimmer forever.
   */
  const hasLoadedContext = createObservable(false);
  const loadedActorHash = derived(() => userLane.value.get()?.actorHash ?? "", [userLane.value]);
  const isLoading = createObservable(false);
  const isSubmitting = createObservable(false);
  const isRecovering = createObservable(false);
  const isWalletConnecting = createObservable(false);
  const activeAction = createObservable("");
  const workflowStatus = createObservable(t("workflowReady"));
  const lastError = createObservable("");
  const lastSuccess = createObservable("");
  const transactionNotice = createObservable("");
  const lastConfirmedKind = createObservable("");
  const latestRequest = createObservable<WorkflowEvidence | null>(null);
  const latestResult = createObservable<WorkflowEvidence | null>(null);
  const checkinHistory = createObservable<CheckinHistoryItem[]>([]);
  const now = createObservable(Date.now());
  const pendingOperation = app.state.persisted<PendingDailyCheckinOperation | null>(
    "pendingOperation",
    null,
  );
  if (pendingOperation.get() && !isPendingDailyCheckinOperation(pendingOperation.get())) {
    pendingOperation.set(null);
  }

  let tickerInterval: ReturnType<typeof setInterval> | null = null;
  let loadPromise: Promise<void> | null = null;

  const walletAddress: Observable<string> = {
    get: () => app.chain.address.get() || "",
    set: () => {},
    subscribe: (listener) => app.chain.address.subscribe(listener),
  };

  const canCheckIn = derived(
    () => hasLoadedStatus.get() && chainCanCheckin.get() && !isPaused.get() && !pendingOperation.get(),
    [hasLoadedStatus, chainCanCheckin, isPaused, pendingOperation],
  );
  const hasClaimableRewards = derived(
    () => hasLoadedStatus.get() && Boolean(unclaimedRewards.get()) && BigInt(unclaimedRewards.get()) > 0n,
    [hasLoadedStatus, unclaimedRewards],
  );
  const rewardsUnderfunded = derived(
    () => hasLoadedPlatform.get() && BigInt(weekReward.get() || "0") > 0n &&
      BigInt(rewardPoolBalance.get() || "0") < BigInt(weekReward.get()),
    [hasLoadedPlatform, weekReward, rewardPoolBalance],
  );
  const claimableButUnfunded = derived(
    () => hasClaimableRewards.get() && hasLoadedPlatform.get() &&
      BigInt(rewardPoolBalance.get() || "0") < BigInt(unclaimedRewards.get()),
    [hasClaimableRewards, hasLoadedPlatform, rewardPoolBalance, unclaimedRewards],
  );

  const currentUtcDay: Observable<number> = {
    get: () => chainCurrentDay.get(),
    set: () => {},
    subscribe: (listener) => chainCurrentDay.subscribe(listener),
  };
  const nextUtcMidnight: Observable<number> = {
    get: () => nextEligibleTs.get(),
    set: () => {},
    subscribe: (listener) => {
      const a = nextEligibleTs.subscribe(listener);
      const b = now.subscribe(listener);
      return () => { a(); b(); };
    },
  };
  const utcTimeDisplay: Observable<string> = {
    get: () => new Date(now.get()).toISOString().slice(11, 19),
    set: () => {},
    subscribe: (listener) => now.subscribe(listener),
  };

  /*
   * Formatted read-outs: a value the visitor cannot see yet is EMPTY here, not
   * an em-dash.
   *
   * Each of these used to resolve to "—" until its load flag flipped, which made
   * the composable — not the view — decide what an unresolved value looks like,
   * and left a first-time visitor facing a grid of six dashes on the entry
   * surface before touching anything. The dash also collapsed two different
   * honest states into one glyph: "the read is still in flight" and "this needs
   * a wallet we do not have" are not the same thing.
   *
   * Emitting "" hands that decision to the view, which pairs it with the load
   * flag below (see PlayArea's DataPhase helpers) to render a skeleton while a
   * read is genuinely in flight and localized zero-state copy once it has
   * settled empty. `hasLoadedStatus` gates the wallet-scoped values; the
   * chain-scoped ones further down gate on `hasLoadedPlatform`.
   */
  const formattedCurrentStreak = derived(
    () => hasLoadedStatus.get() ? `${currentStreak.get()} ${t("days")}` : "",
    [hasLoadedStatus, currentStreak],
  );
  const formattedHighestStreak = derived(
    () => hasLoadedStatus.get() ? `${highestStreak.get()} ${t("days")}` : "",
    [hasLoadedStatus, highestStreak],
  );
  const formattedUnclaimed = derived(
    () => hasLoadedStatus.get() ? `${formatGas(unclaimedRewards.get())} ${t("tokenGas")}` : "",
    [hasLoadedStatus, unclaimedRewards],
  );
  const formattedTotalClaimed = derived(
    () => hasLoadedStatus.get() ? `${formatGas(totalClaimed.get())} ${t("tokenGas")}` : "",
    [hasLoadedStatus, totalClaimed],
  );
  const formattedTotalRewarded = derived(
    () => hasLoadedPlatform.get() ? `${formatGas(totalGlobalRewarded.get())} ${t("tokenGas")}` : "",
    [hasLoadedPlatform, totalGlobalRewarded],
  );
  const formattedRewardPool = derived(
    () => hasLoadedPlatform.get() ? `${formatGas(rewardPoolBalance.get())} ${t("tokenGas")}` : "",
    [hasLoadedPlatform, rewardPoolBalance],
  );
  const formattedWeekReward = derived(
    () => hasLoadedPlatform.get() ? `${formatGas(weekReward.get())} ${t("tokenGas")}` : "",
    [hasLoadedPlatform, weekReward],
  );
  const formattedTwoWeekReward = derived(
    () => hasLoadedPlatform.get() ? `${formatGas(twoWeekReward.get())} ${t("tokenGas")}` : "",
    [hasLoadedPlatform, twoWeekReward],
  );
  const formattedCheckInFee = derived(
    () => hasLoadedPlatform.get() ? `${formatGas(checkInFeeRaw.get())} ${t("tokenGas")}` : "",
    [hasLoadedPlatform, checkInFeeRaw],
  );

  const setRequest = (action: string, summary: string, payload?: Record<string, unknown>) => {
    lastError.set("");
    lastSuccess.set("");
    if (!pendingOperation.get()) transactionNotice.set("");
    workflowStatus.set(summary);
    latestRequest.set({ action, status: "pending", summary, at: nowIso(), payload });
  };
  const setFailure = (action: string, error: unknown) => {
    // app.errors.messageOf maps chain/RPC failures onto the localized family
    // copy notify.error shows, so raw English wallet/VM strings never land in
    // the user-facing lastError strip.
    const summary = app.errors.messageOf(error, t("workflowFailed"));
    lastSuccess.set("");
    if (!pendingOperation.get()) transactionNotice.set("");
    lastError.set(summary);
    workflowStatus.set(t("workflowFailed"));
    latestResult.set({ action, status: "error", summary, at: nowIso(), result: summary });
  };
  const setPending = (key = "transactionPending") => {
    lastError.set("");
    lastSuccess.set("");
    transactionNotice.set(t(key));
  };
  const setSuccess = (
    kind: PendingDailyCheckinOperation["kind"],
    txid: string,
    result: Record<string, unknown>,
  ) => {
    const summary = t(kind === "checkin" ? "checkinRecorded" : "rewardClaimed");
    lastError.set("");
    transactionNotice.set("");
    lastSuccess.set(summary);
    lastConfirmedKind.set(kind);
    workflowStatus.set(summary);
    latestResult.set({
      action: kind === "checkin" ? "doCheckIn" : "claimRewards",
      status: "success",
      summary,
      at: nowIso(),
      result,
      txid,
    });
  };

  const setContext = (context: DailyCheckinContext) => {
    network.set(context.network);
    contractHash.set(context.contractHash);
  };
  const context = async () => {
    try {
      const current = await requireCanonicalDailyCheckinContext(app);
      setContext(current);
      return current;
    } finally {
      // Flip on every exit, including the throw: a failed resolution is a
      // settled answer ("no network"), and the surface pairs it with the
      // dataSource/lastError notice. Only an unsettled read may shimmer.
      hasLoadedContext.set(true);
    }
  };

  const clearUserState = () => {
    // reset() IS the old twelve-field wipe: value -> undefined puts every
    // user derived back on its cleared fallback (streaks 0, raw amounts "",
    // nextRewardDay 7, hasLoadedStatus false) and joins the cell epoch, so a
    // user read still in flight for a previous actor cannot publish over the
    // wipe.
    userLane.reset();
    checkinHistory.set([]);
  };

  const readPlatformSnapshot = async (
    current: DailyCheckinContext,
  ): Promise<DailyCheckinPlatformSnapshot> => {
    const options = { scriptHash: current.contractHash };
    const [platformValue, pausedValue, poolValue, obligationValue] = await Promise.all([
      app.chain.readRaw("getPlatformStats", [], options),
      app.chain.readRaw("isPaused", [], options),
      app.chain.readRaw("rewardPool", [], options),
      app.chain.readRaw("totalUnclaimed", [], options),
    ]);
    const platform = record(platformValue, "Platform state");
    const snapshot: DailyCheckinPlatformSnapshot = {
      totalGlobalCheckins: safeNumber(platform.totalCheckins, "Total check-ins"),
      totalGlobalUsers: safeNumber(platform.totalUsers, "Total users"),
      totalGlobalRewardedRaw: unsigned(platform.totalRewarded, "Total rewarded"),
      checkInFeeRaw: unsigned(platform.checkInFee, "Check-in fee"),
      currentDay: safeNumber(platform.currentUtcDay, "Current UTC day"),
      nextMidnight: safeNumber(platform.nextMidnight, "Next UTC midnight"),
      weekRewardRaw: unsigned(platform.weekReward, "Week reward"),
      twoWeekRewardRaw: unsigned(platform.twoWeekReward, "Two-week reward"),
      rewardPoolRaw: unsigned(poolValue, "Reward pool"),
      totalUnclaimedRaw: unsigned(obligationValue, "Total unclaimed"),
      paused: strictBoolean(pausedValue, "Pause state"),
    };
    if (snapshot.nextMidnight <= 0 || snapshot.currentDay <= 0) {
      throw new Error("Contract time is unavailable.");
    }
    return snapshot;
  };

  const readUserSnapshot = async (
    current: DailyCheckinContext,
    actorHash: string,
    platform: DailyCheckinPlatformSnapshot,
  ): Promise<DailyCheckinUserSnapshot> => {
    const userArg = app.chain.arg.hash160(actorHash);
    const options = { scriptHash: current.contractHash };
    const [frontendValue, statusValue, detailsValue] = await Promise.all([
      app.chain.readRaw("getCheckInStateForFrontend", [userArg], options),
      app.chain.readRaw("getCheckinStatus", [userArg], options),
      app.chain.readRaw("getUserStatsDetails", [userArg], options),
    ]);
    const frontend = record(frontendValue, "Check-in state");
    const status = record(statusValue, "Eligibility state");
    const details = record(detailsValue, "Reward state");
    const snapshot: DailyCheckinUserSnapshot = {
      currentStreak: safeNumber(frontend.currentStreak, "Current streak"),
      highestStreak: safeNumber(frontend.highestStreak, "Highest streak"),
      lastCheckinDay: safeNumber(frontend.lastCheckinDay, "Last check-in day"),
      unclaimedRaw: unsigned(frontend.unclaimed, "Unclaimed rewards"),
      totalClaimedRaw: unsigned(details.claimed, "Total claimed"),
      totalUserCheckins: safeNumber(frontend.totalCheckins, "User check-ins"),
      canCheckin: strictBoolean(status.canCheckin, "Check-in eligibility"),
      streakWillReset: strictBoolean(status.streakWillReset, "Streak reset state"),
      nextRewardDay: safeNumber(status.nextRewardDay, "Next reward day"),
    };
    const duplicates = {
      streak: safeNumber(details.streak, "Detailed streak"),
      highest: safeNumber(details.highestStreak, "Detailed highest streak"),
      last: safeNumber(details.lastCheckinDay, "Detailed check-in day"),
      unclaimed: unsigned(details.unclaimed, "Detailed unclaimed rewards"),
      count: safeNumber(details.totalCheckins, "Detailed user check-ins"),
      statusStreak: safeNumber(status.currentStreak, "Eligibility streak"),
      statusDay: safeNumber(status.currentUtcDay, "Eligibility UTC day"),
      frontendDay: safeNumber(frontend.currentDay, "Frontend UTC day"),
    };
    if (
      snapshot.currentStreak !== duplicates.streak ||
      snapshot.currentStreak !== duplicates.statusStreak ||
      snapshot.highestStreak !== duplicates.highest ||
      snapshot.lastCheckinDay !== duplicates.last ||
      snapshot.unclaimedRaw !== duplicates.unclaimed ||
      snapshot.totalUserCheckins !== duplicates.count ||
      platform.currentDay !== duplicates.statusDay ||
      platform.currentDay !== duplicates.frontendDay
    ) throw new Error("Daily check-in reads are temporarily inconsistent.");
    return snapshot;
  };

  const readSnapshot = async (
    current: DailyCheckinContext,
    actorHash: string,
  ): Promise<DailyCheckinSnapshot> => {
    const platform = await readPlatformSnapshot(current);
    const user = await readUserSnapshot(current, actorHash, platform);
    return { platform, user };
  };

  /**
   * Blessed publications onto the read lanes (read-cell pilot): every caller
   * — settlePending's confirmed readback and freshWalletSnapshot's pre-write
   * baseline — just round-tripped the snapshot from chain reads, so it owns
   * the truth as much as a load does and publishes straight onto the cell's
   * value, exactly like timestamp-proof's verified persist path.
   */
  const applyPlatform = (platform: DailyCheckinPlatformSnapshot) => {
    platformLane.value.set(platform);
  };

  const applyUser = (user: DailyCheckinUserSnapshot, actorHash: string) => {
    userLane.value.set({ user, actorHash });
  };

  const addHistory = (entry: CheckinHistoryItem) => {
    const existing = checkinHistory.get().filter((item) => !entry.txid || item.txid !== entry.txid);
    checkinHistory.set([entry, ...existing].slice(0, HISTORY_DISPLAY_LIMIT));
  };

  const hydrateHistory = async (address: string) => {
    if (!address) return;
    try {
      const [checkins, claims] = await Promise.all([
        app.chain.events("CheckedIn", { limit: HISTORY_EVENT_LIMIT }),
        app.chain.events("RewardsClaimed", { limit: HISTORY_EVENT_LIMIT }),
      ]);
      const hydrated: CheckinHistoryItem[] = [];
      for (const event of checkins) {
        if (!dailyCheckinAccountMatches(eventValue(event, 0), address)) continue;
        const time = validEventTime((event as { block_time?: unknown }).block_time);
        const streak = unsignedDailyCheckinInteger(eventValue(event, 1));
        const reward = unsignedDailyCheckinInteger(eventValue(event, 2));
        if (!time || !streak || !reward || BigInt(streak) > BigInt(Number.MAX_SAFE_INTEGER)) continue;
        hydrated.push({
          action: "checkin",
          streak: Number(streak),
          rewardRaw: reward,
          time,
          txid: clean((event as { txid?: unknown }).txid),
        });
      }
      for (const event of claims) {
        if (!dailyCheckinAccountMatches(eventValue(event, 0), address)) continue;
        const time = validEventTime((event as { block_time?: unknown }).block_time);
        const amount = unsignedDailyCheckinInteger(eventValue(event, 1));
        if (!time || !amount) continue;
        hydrated.push({
          action: "claim",
          streak: 0,
          rewardRaw: amount,
          time,
          txid: clean((event as { txid?: unknown }).txid),
        });
      }
      const merged = [...hydrated, ...checkinHistory.get()];
      const byKey = new Map<string, CheckinHistoryItem>();
      merged.forEach((entry, index) => {
        const key = entry.txid || `${entry.action}:${entry.time}:${index}`;
        if (!byKey.has(key)) byKey.set(key, entry);
      });
      checkinHistory.set([...byKey.values()]
        .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
        .slice(0, HISTORY_DISPLAY_LIMIT));
    } catch {
      // History is secondary. A failed event index never mutates authoritative
      // streak, eligibility, or reward state.
    }
  };

  const resolveActor = async (prompt: boolean): Promise<{ address: string; actorHash: string }> => {
    let address = walletAddress.get();
    if (!address && prompt) address = await app.chain.ensureWallet();
    const actorHash = normalizeDailyCheckinAccount(address);
    return { address, actorHash };
  };

  const executeLoad = async (options: LoadOptions) => {
    const shouldRecord = options.record === true;
    if (shouldRecord) setRequest("refreshStatus", t("workflowRefreshing"));
    dataSource.set("loading");
    isLoading.set(true);
    try {
      const current = await context();
      const platform = await loadPlatformLane(current);
      const actor = await resolveActor(options.prompt === true);
      if (!actor.actorHash) {
        clearUserState();
        lastError.set("");
        dataSource.set("chain");
        if (shouldRecord) throw new Error(t("walletRequired"));
        return;
      }
      try {
        await loadUserLane(current, actor.actorHash, platform);
        lastError.set("");
        dataSource.set("chain");
        await hydrateHistory(actor.address);
      } catch (error) {
        clearUserState();
        dataSource.set("partial");
        throw error;
      }
      if (shouldRecord) {
        workflowStatus.set(t("statusLoaded"));
        latestResult.set({
          action: "refreshStatus",
          status: "success",
          summary: t("statusLoaded"),
          at: nowIso(),
          result: { currentStreak: currentStreak.get(), canCheckIn: canCheckIn.get() },
        });
      }
    } catch (error) {
      if (dataSource.get() !== "partial") dataSource.set("failed");
      if (shouldRecord) setFailure("refreshStatus", error);
      throw error;
    } finally {
      isLoading.set(false);
    }
  };

  const loadAll = async (options: LoadOptions = {}) => {
    if (loadPromise) {
      await loadPromise.catch(() => undefined);
      if (options.prompt || options.record) return loadAll(options);
      return;
    }
    loadPromise = executeLoad(options);
    try {
      await loadPromise;
    } catch (error) {
      if (options.prompt || options.record) throw error;
      // Background hydration failures stay visible through dataSource/lastError
      // without producing an unhandled rejection. messageOf keeps chain/RPC
      // failures on the localized family copy instead of raw English text.
      lastError.set(app.errors.messageOf(error, t("statusRefreshFailed")));
    } finally {
      loadPromise = null;
    }
  };

  const connectWallet = async () => {
    isWalletConnecting.set(true);
    try {
      const address = await app.chain.ensureWallet();
      if (!normalizeDailyCheckinAccount(address)) throw new Error(t("walletRequired"));
      await loadAll({ prompt: true, record: true });
      return address;
    } catch (error) {
      setFailure("connectWallet", error);
      throw error;
    } finally {
      isWalletConnecting.set(false);
    }
  };

  const refreshStatus = () => loadAll({ prompt: true, record: true });

  const baselineDraft = (
    kind: PendingDailyCheckinOperation["kind"],
    current: DailyCheckinContext,
    actorHash: string,
    snapshot: DailyCheckinSnapshot,
  ): Omit<PendingDailyCheckinOperation, "txid"> => ({
    version: 1,
    kind,
    network: current.network,
    contractHash: current.contractHash,
    gasHash: current.gasHash,
    actorHash,
    createdAt: Date.now(),
    beforeStreak: String(snapshot.user.currentStreak),
    beforeLastCheckinDay: String(snapshot.user.lastCheckinDay),
    beforeUserCheckins: String(snapshot.user.totalUserCheckins),
    beforeUnclaimedRaw: snapshot.user.unclaimedRaw,
    beforeClaimedRaw: snapshot.user.totalClaimedRaw,
    beforeGlobalCheckins: String(snapshot.platform.totalGlobalCheckins),
    beforeGlobalRewardedRaw: snapshot.platform.totalGlobalRewardedRaw,
  });

  const persistPending = (
    draft: Omit<PendingDailyCheckinOperation, "txid">,
    transactionId: string,
  ): PendingDailyCheckinOperation | null => {
    const candidate = { ...draft, txid: clean(transactionId) };
    if (!isPendingDailyCheckinOperation(candidate)) return null;
    pendingOperation.set(candidate);
    setPending();
    return candidate;
  };

  const pendingContextMatches = async (pending: PendingDailyCheckinOperation) => {
    const current = await context();
    const actorHash = normalizeDailyCheckinAccount(walletAddress.get());
    return Boolean(
      actorHash &&
      pending.network === current.network &&
      dailyCheckinAccountMatches(pending.contractHash, current.contractHash) &&
      dailyCheckinAccountMatches(pending.gasHash, current.gasHash) &&
      dailyCheckinAccountMatches(pending.actorHash, actorHash),
    );
  };

  const transferMatches = (
    outcome: DailyCheckinTransactionOutcome,
    pending: PendingDailyCheckinOperation,
    from: string,
    to: string,
    amount: string,
  ) => Boolean(findDailyCheckinNotification(outcome, pending.gasHash, "Transfer", (event) =>
    dailyCheckinAccountMatches(dailyCheckinNotificationValue(event, 0), from) &&
    dailyCheckinAccountMatches(dailyCheckinNotificationValue(event, 1), to) &&
    eventUnsigned(event, 2) === amount));

  const confirmReadback = async (
    pending: PendingDailyCheckinOperation,
    outcome: DailyCheckinTransactionOutcome,
  ): Promise<{ confirmed: boolean; snapshot?: DailyCheckinSnapshot; eventAmount?: string; eventStreak?: number }> => {
    if (outcome.state !== "halt") return { confirmed: false };
    const current = {
      network: pending.network,
      contractHash: pending.contractHash,
      gasHash: pending.gasHash,
    } as DailyCheckinContext;
    const snapshot = await readSnapshot(current, pending.actorHash);
    if (pending.kind === "checkin") {
      const event = findDailyCheckinNotification(outcome, pending.contractHash, "CheckedIn", (candidate) =>
        dailyCheckinAccountMatches(dailyCheckinNotificationValue(candidate, 0), pending.actorHash));
      if (!event) return { confirmed: false };
      const eventStreakRaw = eventUnsigned(event, 1);
      const eventReward = eventUnsigned(event, 2);
      if (!eventStreakRaw || !eventReward || BigInt(eventStreakRaw) > BigInt(Number.MAX_SAFE_INTEGER)) {
        return { confirmed: false };
      }
      const eventStreak = Number(eventStreakRaw);
      const beforeRewardTotal = BigInt(pending.beforeUnclaimedRaw) + BigInt(pending.beforeClaimedRaw);
      const afterRewardTotal = BigInt(snapshot.user.unclaimedRaw) + BigInt(snapshot.user.totalClaimedRaw);
      const confirmed = transferMatches(
        outcome,
        pending,
        pending.actorHash,
        pending.contractHash,
        pending.feeRaw!,
      ) &&
        snapshot.user.totalUserCheckins >= Number(BigInt(pending.beforeUserCheckins) + 1n) &&
        snapshot.user.lastCheckinDay > Number(BigInt(pending.beforeLastCheckinDay)) &&
        snapshot.user.currentStreak === eventStreak &&
        snapshot.user.highestStreak >= eventStreak &&
        snapshot.platform.totalGlobalCheckins >= Number(BigInt(pending.beforeGlobalCheckins) + 1n) &&
        afterRewardTotal >= beforeRewardTotal + BigInt(eventReward);
      return { confirmed, snapshot, eventAmount: eventReward, eventStreak };
    }

    const event = findDailyCheckinNotification(outcome, pending.contractHash, "RewardsClaimed", (candidate) =>
      dailyCheckinAccountMatches(dailyCheckinNotificationValue(candidate, 0), pending.actorHash) &&
      eventUnsigned(candidate, 1) === pending.claimAmountRaw);
    const amount = pending.claimAmountRaw!;
    const confirmed = Boolean(event) &&
      transferMatches(outcome, pending, pending.contractHash, pending.actorHash, amount) &&
      BigInt(snapshot.user.unclaimedRaw) === BigInt(pending.beforeUnclaimedRaw) - BigInt(amount) &&
      BigInt(snapshot.user.totalClaimedRaw) >= BigInt(pending.beforeClaimedRaw) + BigInt(amount) &&
      BigInt(snapshot.platform.totalGlobalRewardedRaw) >= BigInt(pending.beforeGlobalRewardedRaw) + BigInt(amount);
    return { confirmed, snapshot, eventAmount: amount };
  };

  const settlePending = async (
    pending: PendingDailyCheckinOperation,
    suppliedOutcome?: DailyCheckinTransactionOutcome,
  ): Promise<DailyCheckinActionResult> => {
    if (!(await pendingContextMatches(pending))) {
      setPending("pendingContextMismatch");
      return { status: "pending", txid: pending.txid };
    }
    const outcome = suppliedOutcome ?? await waitForDailyCheckinTransactionOutcome(pending);
    if (outcome.state === "fault") {
      pendingOperation.set(null);
      transactionNotice.set("");
      const error = new Error(t("transactionFaulted"));
      setFailure(pending.kind, error);
      return { status: "fault", txid: pending.txid };
    }
    if (outcome.state !== "halt") {
      setPending();
      return { status: "pending", txid: pending.txid };
    }
    try {
      const confirmation = await confirmReadback(pending, outcome);
      if (!confirmation.confirmed || !confirmation.snapshot) {
        setPending("confirmationStillPending");
        return { status: "pending", txid: pending.txid };
      }
      applyPlatform(confirmation.snapshot.platform);
      applyUser(confirmation.snapshot.user, pending.actorHash);
      pendingOperation.set(null);
      if (pending.kind === "checkin") {
        addHistory({
          action: "checkin",
          streak: confirmation.eventStreak ?? confirmation.snapshot.user.currentStreak,
          rewardRaw: confirmation.eventAmount ?? "0",
          time: nowIso(),
          txid: pending.txid,
        });
      } else {
        addHistory({
          action: "claim",
          streak: confirmation.snapshot.user.currentStreak,
          rewardRaw: confirmation.eventAmount ?? pending.claimAmountRaw!,
          time: nowIso(),
          txid: pending.txid,
        });
      }
      setSuccess(pending.kind, pending.txid, {
        amount: formatGas(confirmation.eventAmount ?? "0"),
        streak: confirmation.eventStreak ?? confirmation.snapshot.user.currentStreak,
      });
      return { status: "confirmed", txid: pending.txid };
    } catch {
      setPending("confirmationStillPending");
      return { status: "pending", txid: pending.txid };
    }
  };

  const runWrite = async (
    action: "checkin" | "claim",
    draft: Omit<PendingDailyCheckinOperation, "txid">,
    invoke: (onTransactionSent: (txid: string) => void) => Promise<unknown>,
  ): Promise<DailyCheckinActionResult> => {
    isSubmitting.set(true);
    activeAction.set(action);
    setRequest(action === "checkin" ? "doCheckIn" : "claimRewards", t(
      action === "checkin" ? "workflowCheckingIn" : "workflowClaiming",
    ));
    let persisted: PendingDailyCheckinOperation | null = null;
    const onTransactionSent = (transactionId: string) => {
      persisted = persistPending(draft, transactionId);
    };
    try {
      const result = await invoke(onTransactionSent);
      if (!persisted) persisted = persistPending(draft, txidFrom(result));
      if (!persisted) throw new Error(t("transactionNotTracked"));
      return await settlePending(persisted);
    } catch (error) {
      const pending = pendingOperation.get();
      if (pending && isPendingDailyCheckinOperation(pending)) {
        setPending();
        return { status: "pending", txid: pending.txid };
      }
      setFailure(action, error);
      throw error;
    } finally {
      activeAction.set("");
      isSubmitting.set(false);
    }
  };

  const freshWalletSnapshot = async () => {
    const current = await context();
    const address = await app.chain.ensureWallet();
    const actorHash = normalizeDailyCheckinAccount(address);
    if (!actorHash) throw new Error(t("walletRequired"));
    const snapshot = await readSnapshot(current, actorHash);
    applyPlatform(snapshot.platform);
    applyUser(snapshot.user, actorHash);
    return { current, address, actorHash, snapshot };
  };

  const doCheckIn = async () => {
    if (pendingOperation.get()) throw new Error(t("pendingBlocksWrites"));
    const { current, actorHash, snapshot } = await freshWalletSnapshot();
    if (snapshot.platform.paused) throw new Error(t("contractPausedStatus"));
    if (!snapshot.user.canCheckin) throw new Error(t("checkinUnavailable"));
    if (BigInt(snapshot.platform.checkInFeeRaw) <= 0n) {
      throw new Error(t("checkinFeeUnavailable"));
    }
    const feeRaw = snapshot.platform.checkInFeeRaw;
    const draft = {
      ...baselineDraft("checkin", current, actorHash, snapshot),
      feeRaw: positive(feeRaw, "Check-in transfer"),
    };
    return runWrite("checkin", draft, (onTransactionSent) => app.chain.invoke(
      "transfer",
      [
        app.chain.arg.hash160(actorHash),
        app.chain.arg.hash160(current.contractHash),
        app.chain.arg.integer(feeRaw),
        app.chain.arg.string(CHECKIN_MEMO),
      ],
      {
        scriptHash: current.gasHash,
        notify: "silent",
        onTransactionSent,
      },
    ));
  };

  const claimRewards = async () => {
    if (pendingOperation.get()) throw new Error(t("pendingBlocksWrites"));
    const { current, actorHash, snapshot } = await freshWalletSnapshot();
    if (snapshot.platform.paused) throw new Error(t("contractPausedStatus"));
    const amount = BigInt(snapshot.user.unclaimedRaw);
    if (amount <= 0n) throw new Error(t("rewardsUnavailable"));
    if (BigInt(snapshot.platform.rewardPoolRaw) < amount) throw new Error(t("rewardPoolEmpty"));
    const claimAmountRaw = amount.toString();
    const draft = {
      ...baselineDraft("claim", current, actorHash, snapshot),
      claimAmountRaw,
    };
    return runWrite("claim", draft, (onTransactionSent) => app.chain.invoke(
      "claimRewards",
      [app.chain.arg.hash160(actorHash)],
      {
        scriptHash: current.contractHash,
        notify: "silent",
        onTransactionSent,
      },
    ));
  };

  const recoverPendingOperation = async (outcome?: DailyCheckinTransactionOutcome) => {
    const pending = pendingOperation.get();
    if (!pending || isRecovering.get()) return null;
    isRecovering.set(true);
    activeAction.set("recover");
    try {
      return await settlePending(pending, outcome);
    } finally {
      activeAction.set("");
      isRecovering.set(false);
    }
  };

  const startTimer = () => {
    if (tickerInterval) clearInterval(tickerInterval);
    tickerInterval = setInterval(() => now.set(Date.now()), 1000);
  };
  const stopTimer = () => {
    if (tickerInterval) clearInterval(tickerInterval);
    tickerInterval = null;
  };

  // RFC P0-5: identity-diff account hook (fires only on real identity changes;
  // handler errors are isolated by the framework).
  const walletUnsubscribe = app.wallet.onAccountChanged(() => {
    const actorHash = normalizeDailyCheckinAccount(walletAddress.get());
    if (!dailyCheckinAccountMatches(actorHash, loadedActorHash.get())) clearUserState();
    if (pendingOperation.get()) setPending("pendingWalletCheck");
  });

  const cleanup = () => {
    stopTimer();
    walletUnsubscribe();
  };

  return {
    network,
    contractHash,
    hasLoadedContext,
    dataSource,
    walletAddress,
    currentStreak,
    highestStreak,
    lastCheckInDay,
    totalUserCheckins,
    unclaimedRewards,
    totalClaimed,
    checkInFeeRaw,
    totalGlobalCheckins,
    totalGlobalUsers,
    totalGlobalRewarded,
    rewardPoolBalance,
    totalUnclaimed,
    weekReward,
    twoWeekReward,
    isPaused,
    streakWillReset,
    nextRewardDay,
    hasLoadedPlatform,
    hasLoadedStatus,
    isLoading,
    isSubmitting,
    isRecovering,
    isWalletConnecting,
    activeAction,
    workflowStatus,
    lastError,
    lastSuccess,
    transactionNotice,
    lastConfirmedKind,
    latestRequest,
    latestResult,
    checkinHistory,
    pendingOperation,
    canCheckIn,
    hasClaimableRewards,
    rewardsUnderfunded,
    claimableButUnfunded,
    utcTimeDisplay,
    nextUtcMidnight,
    currentUtcDay,
    formattedCurrentStreak,
    formattedHighestStreak,
    formattedUnclaimed,
    formattedTotalClaimed,
    formattedTotalRewarded,
    formattedRewardPool,
    formattedWeekReward,
    formattedTwoWeekReward,
    formattedCheckInFee,
    milestones: MILESTONES,
    connectWallet,
    doCheckIn,
    claimRewards,
    refreshStatus,
    recoverPendingOperation,
    loadAll,
    startTimer,
    stopTimer,
    cleanup,
  };
}

export type UseCheckinReturn = ReturnType<typeof useCheckin>;
