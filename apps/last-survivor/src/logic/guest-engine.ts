/**
 * Guest (free / local) engine for Last Survivor.
 *
 * Guest mode is a purely LOCAL doomsday-clock game — a single-player analogue of
 * the on-chain last-buyer mechanic. You load keys to keep your own survival clock
 * alive; because nobody else can buy, you are always the last one standing. When
 * the clock finally runs out you CLAIM the run and your streak (the number of
 * keys you loaded) becomes the score, best-effort recorded to the OFF-CHAIN guest
 * leaderboard.
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

/** Structural (method-syntax, so bivariant) observable handle. */
interface Obs<T> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

/** Off-chain guest leaderboard surface (app.mode.guestLeaderboard). */
interface GuestLeaderboardApi {
  submit(score: number | string): Promise<void>;
  get(limit?: number): Promise<Array<{ user: string; score: string }>>;
}

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
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  /** Reset to a clean local arena + load the off-chain guest board. */
  enter(): Promise<void>;
  /** Load `count` keys locally — grows the streak and extends the clock. */
  buyKeys(count: string | number): void;
  /** Claim the ended run: submit the streak off-chain, then open a fresh round. */
  settleRound(): Promise<void>;
  /** Reload the off-chain board (keeps any in-progress local run). */
  refresh(): Promise<void>;
  /** Guest has no prepaid on-chain credit — surface a friendly notice. */
  withdraw(): void;
}

/** Local doomsday-clock scale (compressed so a run resolves in a play session). */
const BASE_MS = 10_000;
const PER_KEY_MS = 5_000;
const MAX_MS = 60_000;
const MAX_KEYS_PER_BUY = 1000;
const MAX_BOARD_ROWS = 12;

/** A non-empty local marker so `needsLifecycleSync` (last-buyer + pot) can flip. */
const LOCAL_LEADER = "guest-local";

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
    guestLeaderboard,
    t,
    setStatus,
  } = deps;

  // A guest round whose local clock is counting down. While true the ticker-
  // driven countdown is watched; when it crosses zero the round ends (you are
  // the last buyer) and the claim affordance appears.
  let clockRunning = false;

  const resetRound = (nextRoundId: number): void => {
    clockRunning = false;
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
  };

  const submitScore = async (score: number): Promise<void> => {
    if (score <= 0) return;
    try {
      await guestLeaderboard.submit(score);
    } catch {
      /* wallet is optional in guest — off-chain scores are best-effort */
    }
  };

  const loadBoard = async (): Promise<void> => {
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
          details: `#${index + 1} · ${formatAddress(row.user)} · ${t("guestStreakValue", { count: row.score })}`,
          date: "",
          sortKey: row.score,
        }));
      history.set(items);
    } catch {
      history.set([]);
    }
  };

  // End the local round when the doomsday clock hits zero. You are the last
  // buyer, so the round flips to "claim" (isRoundActive false + a recorded
  // buyer + a non-zero pot → needsLifecycleSync). Guarded by `clockRunning` so
  // it is inert in gamefi mode and before the first key is loaded.
  timeRemainingSeconds.subscribe(() => {
    if (!clockRunning) return;
    if (timeRemainingSeconds.get() > 0) return;
    clockRunning = false;
    isRoundActive.set(false);
  });

  return {
    async enter(): Promise<void> {
      resetRound(1);
      await loadBoard();
    },

    buyKeys(count: string | number): void {
      // Only loadable while the round is live (the scene disables the button
      // once the clock has run out and the run must be claimed).
      if (!isRoundActive.get()) return;
      const n = clampCount(Number(count));
      if (n <= 0) {
        keyValidationError.set(t("invalidKeyCount"));
        return;
      }
      keyValidationError.set(null);

      // Extend the local clock: seed it on the first key, then add per-key time,
      // capped. Uses the same wall clock the countdown derives from.
      const nowMs = Date.now();
      const currentRemaining = Math.max(0, endTime.get() - nowMs);
      const seed = totalKeysInRound.get() === 0n ? BASE_MS : 0;
      const nextRemaining = Math.min(currentRemaining + seed + n * PER_KEY_MS, MAX_MS);
      endTime.set(nowMs + nextRemaining);

      const nextKeys = totalKeysInRound.get() + BigInt(n);
      totalKeysInRound.set(nextKeys);
      userKeys.set(userKeys.get() + n);
      // Local "pot" tracks the streak (keys loaded); the PlayArea renders it as a
      // key count in guest, never as GAS.
      totalPot.set(Number(nextKeys));
      lastBuyer.set(address.get() || LOCAL_LEADER);
      clockRunning = true;
    },

    async settleRound(): Promise<void> {
      if (isSettling.get()) return;
      // Claimable only once the local clock has run out (you are last standing).
      if (isRoundActive.get()) return;
      const score = Number(totalKeysInRound.get());
      if (score <= 0) {
        resetRound(roundId.get() + 1);
        await loadBoard();
        return;
      }

      // Toggle isSettling so the scene plays its claim → win beat, then bank the
      // streak off-chain and reload the board with the new entry.
      isSettling.set(true);
      try {
        await submitScore(score);
      } finally {
        isSettling.set(false);
      }
      await loadBoard();
      resetRound(roundId.get() + 1);
      await loadBoard();
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
  };
}
