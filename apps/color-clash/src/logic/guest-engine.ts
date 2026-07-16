/**
 * Guest (free / local) engine for Color Clash.
 *
 * Guest mode runs a classic progressive Simon loop locally. It never receives
 * chain/oracle/reward services: only session observables and the off-chain
 * guest leaderboard are available to this module.
 */
import type { GameSessionObservables, LeaderEntry, SolveRow } from "@framework/game";
import {
  applyColorPress,
  createColorRun,
  hasColorDeadlinePassed,
  markColorSequenceShown,
  type ColorRunState,
  type ColorUiPhase,
} from "./color-engine";
import { ruleOf } from "./game-rules";
import { clampDifficulty } from "@framework/game-rules";
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";

export interface GuestEngineDeps {
  obs: GameSessionObservables;
  sequence: Obs<string>;
  playerSequence: Obs<string>;
  seqAchieved: Obs<number>;
  roundNumber: Obs<number>;
  roundPhase: Obs<ColorUiPhase>;
  lastPayoutFixed8: Obs<bigint>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startGame(difficulty: number): void;
  sequencePlaybackComplete(): void;
  recordPress(color: number): void;
  submitSolution(): Promise<void>;
  expireGame(): void;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";

/** Web-Crypto sequence of color indices 0..3. Guest copy promises this source. */
function randomColorSequence(length: number): string {
  const bytes = new Uint8Array(length);
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.getRandomValues) throw new Error("secure-random-unavailable");
  webCrypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => String(byte % 4)).join("");
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
    obs,
    sequence,
    playerSequence,
    seqAchieved,
    roundNumber,
    roundPhase,
    lastPayoutFixed8,
    guestLeaderboard,
    t,
    setStatus,
  } = deps;
  let run: ColorRunState | null = null;
  let guestHistory: SolveRow[] = [];

  const publishRun = (): void => {
    sequence.set(run?.visibleSequence ?? "");
    playerSequence.set(run?.playerSequence ?? "");
    seqAchieved.set(run?.achieved ?? 0);
    roundNumber.set(run?.round ?? 0);
    roundPhase.set(run?.phase ?? "lobby");
  };

  const resetSession = (status: "idle" | "expired" = "idle"): void => {
    run = null;
    obs.gameStatus.set(status);
    obs.activeGameId.set("0");
    obs.lastStatus.set(status === "expired" ? "expired" : "");
    obs.deadline.set(0);
    obs.dealtAt.set(0);
    obs.undosUsed.set(0);
    obs.commitment.set("");
    lastPayoutFixed8.set(0n);
    publishRun();
    if (status === "expired") roundPhase.set("expired");
  };

  const submitScore = async (score: number): Promise<void> => {
    if (score <= 0) return;
    try {
      await guestLeaderboard.submit(score);
    } catch {
      /* The local game remains playable when the optional board is unavailable. */
    }
  };

  const refreshLeaderboard = async (): Promise<void> => {
    try {
      const rows = await guestLeaderboard.get(50);
      const ranked: LeaderEntry[] = rows
        .map((row) => ({ address: row.user, score: Number(row.score) || 0 }))
        .sort((a, b) => b.score - a.score)
        .map((row, index) => ({
          rank: index + 1,
          address: row.address,
          totalWon: row.score,
          solves: 1,
          isUser: false,
        }));
      obs.leaderboard.set(ranked);
    } catch {
      obs.leaderboard.set([]);
    }
  };

  return {
    startGame(difficulty: number): void {
      if (
        obs.isStarting.get()
        || obs.isSubmitting.get()
        || (obs.gameStatus.get() === "dealt" && run?.phase !== "wrong")
        || obs.gameStatus.get() === "committed"
      ) return;
      const diff = clampDifficulty(difficulty);
      const rule = ruleOf(diff);
      obs.isStarting.set(true);
      try {
        try {
          run = createColorRun(randomColorSequence(rule.targetSeq), rule.targetSeq);
        } catch (error) {
          if (error instanceof Error && error.message === "secure-random-unavailable") {
            throw new Error(t("secureRandomUnavailable"));
          }
          throw error;
        }
        obs.gameDifficulty.set(diff);
        obs.activeGameId.set(GUEST_GAME_ID);
        obs.commitment.set("");
        obs.undosUsed.set(0);
        lastPayoutFixed8.set(0n);
        const now = Date.now();
        obs.dealtAt.set(now);
        obs.deadline.set(now + rule.limitMs);
        publishRun();
        obs.gameStatus.set("dealt");
        obs.lastStatus.set("watching");
      } finally {
        obs.isStarting.set(false);
      }
    },

    sequencePlaybackComplete(): void {
      if (!run || obs.gameStatus.get() !== "dealt" || run.phase !== "watching") return;
      if (hasColorDeadlinePassed(obs.deadline.get())) {
        this.expireGame();
        return;
      }
      run = markColorSequenceShown(run);
      publishRun();
      obs.lastStatus.set("repeat");
    },

    recordPress(color: number): void {
      if (!run || obs.gameStatus.get() !== "dealt") return;
      if (hasColorDeadlinePassed(obs.deadline.get())) {
        this.expireGame();
        return;
      }
      const result = applyColorPress(run, color);
      if (result.outcome === "ignored") return;
      run = result.state;
      publishRun();

      if (result.outcome === "wrong") {
        obs.lastStatus.set("wrong");
        obs.myTotalWon.set(Math.max(obs.myTotalWon.get(), run.achieved));
        setStatus(t("wrongPress"), "error");
        void submitScore(run.achieved);
      } else if (result.outcome === "round-complete") {
        obs.lastStatus.set("watching");
      } else if (result.outcome === "complete") {
        obs.lastStatus.set("all-correct");
      } else {
        obs.lastStatus.set("repeat");
      }
    },

    async submitSolution(): Promise<void> {
      if (!run || obs.gameStatus.get() !== "dealt" || run.phase !== "complete") return;
      if (obs.isSubmitting.get()) return;
      if (hasColorDeadlinePassed(obs.deadline.get())) {
        this.expireGame();
        return;
      }
      obs.isSubmitting.set(true);
      try {
        const achieved = run.achieved;
        const elapsedMs = Math.max(0, Date.now() - obs.dealtAt.get());
        obs.lastElapsedMs.set(elapsedMs);
        lastPayoutFixed8.set(0n);
        obs.myTotalWon.set(Math.max(obs.myTotalWon.get(), achieved));
        obs.mySolves.set(obs.mySolves.get() + 1);
        guestHistory = [
          {
            gameId: `guest-${Date.now()}`,
            difficulty: obs.gameDifficulty.get(),
            payout: "0 GAS",
            solveMs: elapsedMs,
            undos: 0,
            seqAchieved: achieved,
          },
          ...guestHistory,
        ].slice(0, 8);
        obs.myHistory.set(guestHistory);
        obs.gameStatus.set("solved");
        obs.lastStatus.set("solved");
        obs.activeGameId.set("0");
        await submitScore(achieved);
        await refreshLeaderboard();
        setStatus(t("guestRunComplete", { count: achieved }), "success");
      } finally {
        obs.isSubmitting.set(false);
      }
    },

    expireGame(): void {
      if (obs.gameStatus.get() !== "dealt" && obs.gameStatus.get() !== "committed") return;
      const achieved = run?.achieved ?? 0;
      obs.myTotalWon.set(Math.max(obs.myTotalWon.get(), achieved));
      void submitScore(achieved);
      resetSession("expired");
      setStatus(t("guestExpiredTitle"), "info");
    },

    retryDeal(): void {
      /* Guest deals immediately; there is no remote session to retry. */
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      resetSession("idle");
      obs.credit.set(0);
      obs.poolFree.set(0);
      obs.myRank.set(0);
      obs.myTotalWon.set(0);
      obs.mySolves.set(0);
      obs.myHistory.set(guestHistory);
      await refreshLeaderboard();
    },
  };
}
