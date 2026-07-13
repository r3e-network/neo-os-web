/**
 * Guest (free / local) engine for FogPlay.
 *
 * Guest mode is a purely LOCAL coin-flip streak game. Every flip is resolved
 * client-side with the Web-Crypto RNG (`crypto.getRandomValues` — the local
 * analog of the on-chain beacon), scored as a win streak, and (optionally)
 * submitted to the OFF-CHAIN guest leaderboard. The engine drives the SAME
 * observables + dispatch actions the Phaser scene reads
 * (choice / betAmount / isFlipping / revealing / result / displayOutcome /
 * winAmount / wins / losses / gameHistory / ...), so the frozen scene contract
 * is reused verbatim. It NEVER makes a chain, oracle, or reward call — the
 * framework guest guard therefore never fires.
 *
 * SIM game: there is no shared deterministic rules module (the GameFi flow is a
 * commit/reveal on-chain contract), so the "rules" here are a faithful local
 * single-player simulation of the coin flip with a local streak score.
 */
import type { GameResult, GameHistoryItem } from "../composables/useCoinFlip";
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";

export interface GuestEngineDeps {
  betAmount: Obs<string>;
  choice: Obs<"heads" | "tails">;
  isFlipping: Obs<boolean>;
  revealing: Obs<boolean>;
  result: Obs<GameResult | null>;
  displayOutcome: Obs<"heads" | "tails" | null>;
  showWinOverlay: Obs<boolean>;
  winAmount: Obs<string>;
  validationError: Obs<string | null>;
  wins: Obs<number>;
  losses: Obs<number>;
  totalWon: Obs<number>;
  gameHistory: Obs<GameHistoryItem[]>;
  /** Local streak score (current consecutive wins) surfaced to the play area. */
  streak: Obs<number>;
  /** On-chain-only surfaces zeroed on enter so a prior GameFi read never bleeds in. */
  bankrollBase: Obs<bigint>;
  freeBankrollBase: Obs<bigint>;
  creditBase: Obs<bigint>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export interface GuestEngine {
  /** Resolve one local flip; returns the outcome so main.tsx can toast it. */
  placeBet(): Promise<GameResult>;
  /** Reset to a clean local lobby + zero the on-chain-only surfaces. */
  enter(): Promise<void>;
  /** Cancel a pending local reveal when the mode or app is torn down. */
  dispose(): void;
}

/** How long the local flip animates before the outcome lands (ms). */
const FLIP_DURATION_MS = 780;
const REDUCED_MOTION_FLIP_MS = 120;

/** Most-recent local flips kept in the drawer history. */
const HISTORY_LIMIT = 12;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Web-Crypto fair coin side. Never silently downgrade to a weaker RNG. */
function randomSide(): "heads" | "tails" {
  const bytes = new Uint8Array(1);
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.getRandomValues) {
    throw new Error("secure-random-unavailable");
  }
  webCrypto.getRandomValues(bytes);
  return (bytes[0]! & 1) === 0 ? "heads" : "tails";
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
    betAmount,
    choice,
    isFlipping,
    revealing,
    result,
    displayOutcome,
    showWinOverlay,
    winAmount,
    validationError,
    wins,
    losses,
    totalWon,
    gameHistory,
    streak,
    bankrollBase,
    freeBankrollBase,
    creditBase,
    guestLeaderboard,
    t,
  } = deps;

  let bestStreak = 0;
  let flipCount = 0;
  let generation = 0;
  let disposed = false;

  const submitScore = async (score: number): Promise<void> => {
    if (score <= 0) return;
    try {
      await guestLeaderboard.submit(score);
    } catch {
      /* off-chain board unreachable / no wallet — guest scores are best-effort */
    }
  };

  const pushHistory = (row: GameHistoryItem): void => {
    gameHistory.set([row, ...gameHistory.get()].slice(0, HISTORY_LIMIT));
  };

  return {
    async placeBet(): Promise<GameResult> {
      // Reentrancy guard: ignore a flip request while one is already resolving.
      if (isFlipping.get() || revealing.get()) {
        return result.get() ?? { won: false, outcome: "" };
      }
      const side: "heads" | "tails" = choice.get() === "tails" ? "tails" : "heads";
      const wager = Number(betAmount.get()) || 0;
      const flipGeneration = ++generation;

      // Reset transient result surfaces and start the local flip animation.
      validationError.set(null);
      result.set(null);
      displayOutcome.set(null);
      showWinOverlay.set(false);
      winAmount.set("0");
      isFlipping.set(true);
      revealing.set(false);

      // Brief spin so the scene shows the flip animation before the outcome.
      // Reduced-motion users still receive a clear state transition without
      // waiting through an animation they asked the system to suppress.
      const reduceMotion = globalThis.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches ?? false;
      await delay(reduceMotion ? REDUCED_MOTION_FLIP_MS : FLIP_DURATION_MS);

      // A mode switch, reset, or unmount may happen while the timer is in
      // flight. Never let that stale callback overwrite the next surface.
      if (disposed || flipGeneration !== generation) {
        return result.get() ?? { won: false, outcome: "" };
      }

      let outcome: "heads" | "tails";
      try {
        outcome = randomSide();
      } catch {
        // A fair local round requires Web Crypto. Leave the table ready for a
        // retry and fail visibly instead of pretending Math.random is fair.
        isFlipping.set(false);
        revealing.set(false);
        const message = t("secureRandomUnavailable");
        validationError.set(message);
        throw new Error(message);
      }
      const won = outcome === side;

      isFlipping.set(false);
      revealing.set(false);
      displayOutcome.set(outcome);
      const gameResult: GameResult = { won, outcome: outcome.toUpperCase() };
      result.set(gameResult);

      if (won) {
        wins.set(wins.get() + 1);
        const nextStreak = streak.get() + 1;
        streak.set(nextStreak);
        if (nextStreak > bestStreak) bestStreak = nextStreak;
        winAmount.set(t("guestStreakBadge", { n: nextStreak }));
        showWinOverlay.set(true);
      } else {
        losses.set(losses.get() + 1);
        streak.set(0);
      }

      flipCount += 1;
      pushHistory({
        betId: `local-${flipCount}`,
        amount: wager,
        choice: side,
        outcome,
        won,
        payout: 0,
        time: new Date().toISOString(),
      });

      // Best-effort off-chain record of the best streak (wallet optional).
      void submitScore(bestStreak);
      return gameResult;
    },

    async enter(): Promise<void> {
      disposed = false;
      generation += 1;
      isFlipping.set(false);
      revealing.set(false);
      result.set(null);
      displayOutcome.set(null);
      showWinOverlay.set(false);
      winAmount.set("0");
      validationError.set(null);
      wins.set(0);
      losses.set(0);
      totalWon.set(0);
      streak.set(0);
      bestStreak = 0;
      flipCount = 0;
      gameHistory.set([]);
      // Guest never reads chain — zero the on-chain-only surfaces so a prior
      // GameFi mount read (credit / bankroll) never bleeds into guest play.
      bankrollBase.set(0n);
      freeBankrollBase.set(0n);
      creditBase.set(0n);
    },

    dispose(): void {
      disposed = true;
      generation += 1;
      isFlipping.set(false);
      revealing.set(false);
    },
  };
}
