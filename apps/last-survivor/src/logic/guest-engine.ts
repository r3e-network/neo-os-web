/**
 * Guest (free / local) engine for Last Survivor.
 *
 * Guest mode is a purely LOCAL doomsday-clock game — a compact bot-rival analogue
 * of the on-chain last-buyer mechanic. You load keys to take the lead and extend
 * the clock; local rivals periodically steal the final seat. When the clock hits
 * zero, the current leader wins. Successful runs bank a pressure score to the
 * OFF-CHAIN guest leaderboard.
 *
 * The engine drives the SAME observables the Phaser scene reads (roundId /
 * totalPot / isRoundActive / lastBuyer / userKeys / totalKeysInRound / endTime /
 * history / ...), so the frozen scene contract — the `buyKeys` / `settleRound` /
 * `refreshRound` / `withdrawCredit` dispatch actions and every bridge key — is
 * reused verbatim, just backed by local logic. It makes ZERO chain, oracle, or
 * reward calls, so the framework guest guard never fires. Any randomness uses
 * the Web-Crypto RNG (the local analogue of the enclave seed).
 */
import { formatAddress } from "@shared/utils/format";
import type { HistoryEvent } from "../composables/useLastSurvivor";
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";

export interface GuestEngineDeps {
  roundId: Obs<number>;
  totalPot: Obs<number>;
  isRoundActive: Obs<boolean>;
  lastBuyer: Obs<string | null>;
  userKeys: Obs<number>;
  totalKeysInRound: Obs<bigint>;
  endTime: Obs<number>;
  timeRemainingSeconds: Obs<number>;
  history: Obs<HistoryEvent[]>;
  roundDataAvailable: Obs<boolean>;
  serviceNotice: Obs<string>;
  keyValidationError: Obs<string | null>;
  isBuyingKeys: Obs<boolean>;
  isSettling: Obs<boolean>;
  prepaidCredit: Obs<number>;
  address: Obs<string | null>;
  guestScore: Obs<number>;
  guestLeaderLabel: Obs<string>;
  guestOutcome: Obs<GuestOutcome>;
  guestRivalCue: Obs<string>;
  guestMoveReady: Obs<boolean>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
  runtime?: Partial<GuestRuntime>;
}

export type GuestOutcome = "ready" | "running" | "won" | "lost";

export interface GuestRuntime {
  now(): number;
  schedule(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  cancel(timer: ReturnType<typeof setTimeout>): void;
  randomInt(maxExclusive: number): number;
}

export interface GuestSettlement {
  outcome: "won" | "lost";
  score: number;
}

export interface GuestEngine {
  /** Reset to a clean local arena + load the off-chain guest board. */
  enter(): Promise<void>;
  /** Stop local timers before switching to GameFi without destroying the engine. */
  leave(): void;
  /** Load `count` keys locally — grows the streak and extends the clock. */
  buyKeys(count: string | number): boolean;
  /** Claim the ended run: submit the streak off-chain, then open a fresh round. */
  settleRound(): Promise<GuestSettlement | null>;
  /** Reload the off-chain board (keeps any in-progress local run). */
  refresh(): Promise<void>;
  /** Guest has no prepaid on-chain credit — surface a friendly notice. */
  withdraw(): void;
  /** Release the countdown subscription when the miniapp unmounts. */
  cleanup(): void;
}

/** Local doomsday-clock scale (compressed so a run resolves in a play session). */
const BASE_MS = 11_000;
const PER_KEY_MS = 1_800;
const MAX_REMAINING_MS = 26_000;
const RIVAL_EXTEND_MS = 2_800;
const RIVAL_DELAY_MIN_MS = 4_200;
const RIVAL_DELAY_SPREAD_MS = 3_800;
const MAX_RIVAL_RAIDS = 6;
const INPUT_COOLDOWN_MS = 180;
const MAX_KEYS_PER_BUY = 1000;
const MAX_BOARD_ROWS = 12;

/** A non-empty local marker so `needsLifecycleSync` (last-buyer + pot) can flip. */
const LOCAL_LEADER = "guest-local";
const RIVAL_IDS = ["ember", "jade", "sun", "cloud"] as const;

function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) return 0;
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) return 0;
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  const sample = new Uint32Array(1);
  let value = 0;
  do {
    cryptoApi.getRandomValues(sample);
    value = sample[0] ?? 0;
  } while (value >= limit);
  return value % maxExclusive;
}

const DEFAULT_RUNTIME: GuestRuntime = {
  now: () => Date.now(),
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (timer) => clearTimeout(timer),
  randomInt: secureRandomInt,
};

function clampCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_KEYS_PER_BUY, Math.floor(value)));
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
    roundId,
    totalPot,
    isRoundActive,
    lastBuyer,
    userKeys,
    totalKeysInRound,
    endTime,
    timeRemainingSeconds,
    history,
    roundDataAvailable,
    serviceNotice,
    keyValidationError,
    isBuyingKeys,
    isSettling,
    prepaidCredit,
    address,
    guestScore,
    guestLeaderLabel,
    guestOutcome,
    guestRivalCue,
    guestMoveReady,
    guestLeaderboard,
    t,
    setStatus,
  } = deps;
  const runtime: GuestRuntime = { ...DEFAULT_RUNTIME, ...deps.runtime };

  // A guest round whose local clock is counting down. While true the ticker-
  // driven countdown is watched; when it crosses zero the round ends (you are
  // the last buyer) and the claim affordance appears.
  let clockRunning = false;
  let rivalRaids = 0;
  let rivalTimer: ReturnType<typeof setTimeout> | null = null;
  let cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  let sessionVersion = 0;

  const cancelRival = (): void => {
    if (rivalTimer !== null) runtime.cancel(rivalTimer);
    rivalTimer = null;
  };

  const cancelCooldown = (): void => {
    if (cooldownTimer !== null) runtime.cancel(cooldownTimer);
    cooldownTimer = null;
  };

  const localLeaderId = (): string => address.get() || LOCAL_LEADER;
  const isLocalLeader = (value: string | null): boolean =>
    value === LOCAL_LEADER || (!!address.get() && value === address.get());

  const rivalLabel = (id: (typeof RIVAL_IDS)[number]): string =>
    t(`guestRival${id.charAt(0).toUpperCase()}${id.slice(1)}`);

  const finishRun = (): void => {
    if (!clockRunning) return;
    clockRunning = false;
    cancelRival();
    isRoundActive.set(false);
    const won = isLocalLeader(lastBuyer.get());
    guestOutcome.set(won ? "won" : "lost");
    guestMoveReady.set(false);
    guestRivalCue.set(won ? t("guestWonCue") : t("guestLostCue", {
      rival: guestLeaderLabel.get(),
    }));
  };

  const scheduleRival = (): void => {
    cancelRival();
    if (!clockRunning || rivalRaids >= MAX_RIVAL_RAIDS) return;
    const delay = RIVAL_DELAY_MIN_MS + runtime.randomInt(RIVAL_DELAY_SPREAD_MS + 1);
    rivalTimer = runtime.schedule(() => {
      rivalTimer = null;
      if (!clockRunning || !isRoundActive.get()) return;
      if (endTime.get() <= runtime.now()) {
        finishRun();
        return;
      }
      const rivalId = RIVAL_IDS[runtime.randomInt(RIVAL_IDS.length)] ?? RIVAL_IDS[0];
      const label = rivalLabel(rivalId);
      rivalRaids += 1;
      lastBuyer.set(`guest-rival:${rivalId}`);
      guestLeaderLabel.set(label);
      guestRivalCue.set(t("guestRivalStrike", { rival: label }));
      guestMoveReady.set(true);
      totalKeysInRound.set(totalKeysInRound.get() + 1n);
      const nowMs = runtime.now();
      const remaining = Math.max(0, endTime.get() - nowMs);
      endTime.set(nowMs + Math.min(remaining + RIVAL_EXTEND_MS, MAX_REMAINING_MS));
      scheduleRival();
    }, delay);
  };

  const resetRound = (nextRoundId: number): void => {
    cancelRival();
    cancelCooldown();
    clockRunning = false;
    rivalRaids = 0;
    roundId.set(nextRoundId);
    totalPot.set(0);
    totalKeysInRound.set(0n);
    userKeys.set(0);
    lastBuyer.set("");
    endTime.set(0);
    isRoundActive.set(true);
    roundDataAvailable.set(true);
    serviceNotice.set("");
    keyValidationError.set(null);
    isBuyingKeys.set(false);
    isSettling.set(false);
    prepaidCredit.set(0);
    guestScore.set(0);
    guestLeaderLabel.set(t("guestNoBuyerYet"));
    guestOutcome.set("ready");
    guestRivalCue.set(t("guestOpeningCue"));
    guestMoveReady.set(true);
  };

  const submitScore = async (score: number): Promise<void> => {
    if (score <= 0) return;
    try {
      await guestLeaderboard.submit(score);
    } catch {
      /* wallet is optional in guest — off-chain scores are best-effort */
    }
  };

  const loadBoard = async (expectedSession = sessionVersion): Promise<void> => {
    try {
      const rows = await guestLeaderboard.get(50);
      const items: HistoryEvent[] = rows
        .map((row) => ({ user: row.user, score: Number(row.score) || 0 }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_BOARD_ROWS)
        .map((row, index) => ({
          id: `guest-${index}-${row.user}`,
          title: t("guestBoardEntry"),
          details: `#${index + 1} · ${formatAddress(row.user)} · ${t("guestScoreValue", { count: row.score })}`,
          date: "",
          sortKey: row.score,
        }));
      if (expectedSession === sessionVersion) history.set(items);
    } catch {
      if (expectedSession === sessionVersion) history.set([]);
    }
  };

  // End the local round when the doomsday clock hits zero. You are the last
  // buyer, so the round flips to "claim" (isRoundActive false + a recorded
  // buyer + a non-zero pot → needsLifecycleSync). Guarded by `clockRunning` so
  // it is inert in gamefi mode and before the first key is loaded.
  const stopClockSync = timeRemainingSeconds.subscribe(() => {
    if (!clockRunning) return;
    if (timeRemainingSeconds.get() > 0) return;
    finishRun();
  });

  return {
    async enter(): Promise<void> {
      sessionVersion += 1;
      const currentSession = sessionVersion;
      resetRound(1);
      await loadBoard(currentSession);
    },

    leave(): void {
      sessionVersion += 1;
      clockRunning = false;
      cancelRival();
      cancelCooldown();
      isBuyingKeys.set(false);
      guestMoveReady.set(false);
    },

    buyKeys(count: string | number): boolean {
      // Only loadable while the round is live (the scene disables the button
      // once the clock has run out and the run must be claimed).
      if (!isRoundActive.get() || isBuyingKeys.get() || !guestMoveReady.get()) return false;
      const n = clampCount(Number(count));
      if (n <= 0) {
        keyValidationError.set(t("invalidKeyCount"));
        return false;
      }
      keyValidationError.set(null);
      isBuyingKeys.set(true);
      cancelCooldown();
      cooldownTimer = runtime.schedule(() => {
        cooldownTimer = null;
        isBuyingKeys.set(false);
      }, INPUT_COOLDOWN_MS);

      // Extend the local clock with diminishing pack returns. Large packs buy a
      // safer window, while late, smaller reclaims score more clutch points.
      const nowMs = runtime.now();
      const currentRemaining = Math.max(0, endTime.get() - nowMs);
      const seed = totalKeysInRound.get() === 0n ? BASE_MS : 0;
      const extension = Math.round(Math.sqrt(n) * PER_KEY_MS);
      const nextRemaining = Math.min(
        currentRemaining + seed + extension,
        MAX_REMAINING_MS,
      );
      endTime.set(nowMs + nextRemaining);

      const nextKeys = totalKeysInRound.get() + BigInt(n);
      totalKeysInRound.set(nextKeys);
      userKeys.set(userKeys.get() + n);
      const reclaimed = !isLocalLeader(lastBuyer.get()) && Boolean(lastBuyer.get());
      const secondsBeforePress = currentRemaining / 1000;
      const pressureBonus = Math.max(0, Math.round((7 - secondsBeforePress) * 3));
      // Small packs are the high-score line; larger packs buy safety. This makes
      // the four Phaser presets a real risk/reward choice instead of "10 always".
      const precisionBonus = Math.max(1, 12 - Math.min(10, n));
      const gained = precisionBonus + pressureBonus + (reclaimed ? 24 : 0);
      const nextScore = guestScore.get() + gained;
      guestScore.set(nextScore);
      // Keep totalPot positive so the shared end-of-round lifecycle affordance
      // appears, but never render this local value as GAS.
      totalPot.set(nextScore);
      lastBuyer.set(localLeaderId());
      guestLeaderLabel.set(t("guestYouLeader"));
      guestOutcome.set("running");
      guestRivalCue.set(
        reclaimed
          ? t("guestLeadReclaimed", { score: gained })
          : t("guestLeadHeld", { score: gained }),
      );
      guestMoveReady.set(false);
      clockRunning = true;
      scheduleRival();
      return true;
    },

    async settleRound(): Promise<GuestSettlement | null> {
      if (isSettling.get()) return null;
      // Claimable only once the local clock has run out (you are last standing).
      if (isRoundActive.get()) return null;
      const outcome = guestOutcome.get();
      if (outcome !== "won" && outcome !== "lost") return null;
      const score = guestScore.get();
      if (score <= 0) {
        resetRound(roundId.get() + 1);
        await loadBoard();
        return { outcome, score: 0 };
      }

      // Toggle isSettling so the scene plays its claim → win beat, then bank the
      // streak off-chain and reload the board with the new entry.
      isSettling.set(true);
      try {
        if (outcome === "won") await submitScore(score);
      } finally {
        isSettling.set(false);
      }
      resetRound(roundId.get() + 1);
      await loadBoard();
      return { outcome, score };
    },

    async refresh(): Promise<void> {
      // Keep an in-progress or unclaimed local run; only re-seed a truly empty
      // arena. Then reload the off-chain board.
      if (!isRoundActive.get() && totalKeysInRound.get() === 0n) {
        resetRound(roundId.get() || 1);
      } else {
        roundDataAvailable.set(true);
        serviceNotice.set("");
      }
      await loadBoard();
    },

    withdraw(): void {
      setStatus(t("noCredit"), "info");
    },

    cleanup(): void {
      this.leave();
      stopClockSync();
    },
  };
}
