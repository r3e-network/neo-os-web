/**
 * Guest (free / local) engine for Color Clash.
 *
 * Guest mode is a purely LOCAL Simon game: the sequence is generated with the
 * Web-Crypto RNG, played and scored entirely client-side, and (optionally)
 * submitted to the OFF-CHAIN guest leaderboard. The engine drives the SAME
 * observables + dispatch actions the Phaser scene reads
 * (gameStatus / sequence / playerSequence / seqAchieved / lastStatus / ...),
 * so the frozen scene contract is reused verbatim. It NEVER makes a chain,
 * oracle, or reward call — the framework guest guard therefore never fires.
 *
 * Adapted from the legacy DOM practice engine in ../PlayArea.tsx.
 */
import type { GameSessionObservables, LeaderEntry } from "@framework/game";
import { ruleOf } from "./game-rules";

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
  obs: GameSessionObservables;
  sequence: Obs<string>;
  playerSequence: Obs<string>;
  seqAchieved: Obs<number>;
  lastPayoutFixed8: Obs<bigint>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startGame(difficulty: number): void;
  recordPress(color: number): void;
  submitSolution(): Promise<void>;
  expireGame(): void;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";

function clampDifficulty(value: number): number {
  return Math.max(0, Math.min(2, Number.isFinite(value) ? Math.round(value) : 0));
}

/** Web-Crypto (Math.random fallback) sequence of color indices 0..3 as a string. */
function randomColorSequence(length: number): string {
  const bytes = new Uint8Array(length);
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => String(byte % 4)).join("");
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
    obs,
    sequence,
    playerSequence,
    seqAchieved,
    lastPayoutFixed8,
    guestLeaderboard,
    t,
    setStatus,
  } = deps;

  const resetToLobby = (): void => {
    obs.gameStatus.set("idle");
    obs.activeGameId.set("0");
    obs.lastStatus.set("");
    obs.deadline.set(0);
    obs.dealtAt.set(0);
    obs.undosUsed.set(0);
    obs.commitment.set("");
    sequence.set("");
    playerSequence.set("");
    seqAchieved.set(0);
    lastPayoutFixed8.set(0n);
  };

  const submitScore = async (score: number): Promise<void> => {
    if (score <= 0) return;
    try {
      await guestLeaderboard.submit(score);
    } catch {
      /* off-chain board unreachable / no wallet — guest scores are best-effort */
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
      if (obs.isStarting.get()) return;
      const diff = clampDifficulty(difficulty);
      const rule = ruleOf(diff);
      obs.isStarting.set(true);
      obs.lastStatus.set("starting");
      const seq = randomColorSequence(rule.targetSeq);
      obs.gameDifficulty.set(diff);
      obs.activeGameId.set(GUEST_GAME_ID);
      obs.commitment.set("");
      obs.undosUsed.set(0);
      sequence.set(seq);
      playerSequence.set("");
      seqAchieved.set(0);
      const now = Date.now();
      obs.dealtAt.set(now);
      obs.deadline.set(now + rule.limitMs);
      obs.gameStatus.set("dealt");
      obs.lastStatus.set("dealt");
      obs.isStarting.set(false);
    },

    recordPress(color: number): void {
      if (!Number.isInteger(color) || color < 0 || color > 3) return;
      if (obs.gameStatus.get() !== "dealt") return;
      if (obs.lastStatus.get() === "wrong") return;
      const seq = sequence.get();
      const played = playerSequence.get();
      if (played.length >= seq.length) return;
      const expected = Number(seq[played.length]);
      if (color !== expected) {
        // Wrong press ends the run; record the partial reach off-chain.
        seqAchieved.set(played.length);
        obs.lastStatus.set("wrong");
        setStatus(t("wrongPress"), "error");
        void submitScore(played.length);
        return;
      }
      const next = played + String(color);
      playerSequence.set(next);
      if (next.length >= seq.length) {
        seqAchieved.set(seq.length);
        obs.lastStatus.set("all-correct");
      }
    },

    async submitSolution(): Promise<void> {
      if (obs.gameStatus.get() !== "dealt") return;
      if (obs.lastStatus.get() !== "all-correct") return;
      if (obs.isSubmitting.get()) return;
      obs.isSubmitting.set(true);
      const achieved = seqAchieved.get() || playerSequence.get().length;
      obs.lastElapsedMs.set(Math.max(0, Date.now() - obs.dealtAt.get()));
      lastPayoutFixed8.set(0n);
      obs.gameStatus.set("solved");
      obs.lastStatus.set("solved");
      obs.activeGameId.set("0");
      await submitScore(achieved);
      await refreshLeaderboard();
      setStatus(t("guestRunComplete", { count: achieved }), "success");
      obs.isSubmitting.set(false);
    },

    expireGame(): void {
      resetToLobby();
    },

    retryDeal(): void {
      /* guest deals instantly — nothing to re-request. */
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      resetToLobby();
      // Guest never reads chain — zero the on-chain-only counters so a prior
      // gamefi read (from the mount-time loadData) never bleeds into the guest
      // surface, then load the off-chain guest board.
      obs.credit.set(0);
      obs.poolFree.set(0);
      obs.myRank.set(0);
      obs.myTotalWon.set(0);
      obs.mySolves.set(0);
      obs.myHistory.set([]);
      await refreshLeaderboard();
    },
  };
}
