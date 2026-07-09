/**
 * Guest (free / local) engine for Sudoku Arena.
 *
 * Guest mode is a purely LOCAL Sudoku: the puzzle is derived from a Web-Crypto
 * 32-byte seed (the local analog of the enclave beacon seed) through the SAME
 * deterministic `dealPuzzle` rules the enclave twins in gamefi mode, then
 * played, validated, and scored entirely client-side and (optionally) submitted
 * to the OFF-CHAIN guest leaderboard. The engine drives the SAME observables +
 * dispatch actions the Phaser scene reads
 * (gameStatus / clues / undosUsed / deadline / dealtAt / lastStatus / …), so the
 * frozen scene contract is reused verbatim. It NEVER makes a chain, oracle, or
 * reward call — the framework guest guard therefore never fires.
 *
 * Because a guest puzzle has a verified UNIQUE solution (the same offline
 * uniqueness proof that backs every derived board), a complete, conflict-free
 * board is necessarily the derived solution — so the local `submitSolution`
 * check is exact.
 */
import type { GameSessionObservables, LeaderEntry } from "@framework/game";
import { MAX_UNDOS, rewardPctAfterUndos, ruleOf } from "./game-rules";
import { dealPuzzle, type Difficulty } from "./sudoku-engine";

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
  clues: Obs<string>;
  walletConnected: Obs<boolean>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startGame(form: unknown): void;
  selectDifficulty(form: unknown): void;
  recordMove(form: unknown): void;
  useUndo(): void;
  submitSolution(form: unknown): Promise<void>;
  expireGame(): void;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";
// A guest never reads the reward pool — surface a value that always clears the
// scene's local pool gate so every difficulty is immediately playable.
const GUEST_POOL = 9999;

function clampDifficulty(value: number): Difficulty {
  const n = Number.isFinite(value) ? Math.round(value) : 0;
  return Math.max(0, Math.min(2, n)) as Difficulty;
}

/** Web-Crypto (Math.random fallback) 32-byte seed — the local beacon analog. */
function randomSeed(): Uint8Array {
  const bytes = new Uint8Array(32);
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/**
 * Local run score: rewards speed (remaining seconds) with a difficulty base,
 * scaled down by the undo penalty (the same curve gamefi applies to the
 * reward), so faster, undo-free solves rank higher on the off-chain board.
 */
function computeScore(difficulty: Difficulty, elapsedMs: number, undos: number): number {
  const rule = ruleOf(difficulty);
  const remainingSec = Math.max(0, Math.round((rule.limitMs - elapsedMs) / 1000));
  const base = (difficulty + 1) * 500 + remainingSec;
  const pct = rewardPctAfterUndos(undos);
  return Math.max(1, Math.round((base * pct) / 100));
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const { obs, clues, walletConnected, guestLeaderboard, t, setStatus } = deps;

  // The derived solution for the live guest puzzle — the exact byte string a
  // completed board must match. Never leaves this closure.
  let solution = "";

  const resetToLobby = (): void => {
    obs.gameStatus.set("idle");
    obs.activeGameId.set("0");
    obs.lastStatus.set("");
    obs.commitment.set("");
    obs.dealtAt.set(0);
    obs.deadline.set(0);
    obs.undosUsed.set(0);
    obs.lastPayout.set("");
    obs.lastElapsedMs.set(0);
    clues.set("");
    solution = "";
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
    startGame(form: unknown): void {
      if (obs.isStarting.get() || obs.isDealing.get()) return;
      const difficulty = clampDifficulty(
        Number((form as { difficulty?: unknown })?.difficulty ?? obs.gameDifficulty.get()),
      );
      const rule = ruleOf(difficulty);
      obs.isStarting.set(true);
      try {
        const dealt = dealPuzzle(randomSeed(), difficulty);
        solution = dealt.solution;
        obs.gameDifficulty.set(difficulty);
        obs.activeGameId.set(GUEST_GAME_ID);
        obs.commitment.set("");
        obs.undosUsed.set(0);
        obs.lastPayout.set("");
        obs.lastElapsedMs.set(0);
        clues.set(dealt.puzzle);
        const now = Date.now();
        obs.dealtAt.set(now);
        obs.deadline.set(now + rule.limitMs);
        obs.gameStatus.set("dealt");
        obs.lastStatus.set("");
      } finally {
        obs.isStarting.set(false);
      }
    },

    selectDifficulty(form: unknown): void {
      const difficulty = clampDifficulty(
        Number((form as { difficulty?: unknown })?.difficulty ?? 0),
      );
      obs.gameDifficulty.set(difficulty);
    },

    recordMove(_form: unknown): void {
      /* Local placements live in the scene; nothing to record off-scene, and
       * the completed board is validated wholesale in submitSolution. No chain. */
    },

    useUndo(): void {
      if (obs.gameStatus.get() !== "dealt" || obs.isUndoing.get()) return;
      const undos = obs.undosUsed.get();
      if (undos >= MAX_UNDOS) return;
      // Mirror the gamefi 3-undo cap so the scene's "N/3" counter stays truthful;
      // each undo trims the local score via the shared reward-penalty curve.
      obs.undosUsed.set(undos + 1);
      setStatus(t("guestUndoUsed"), "info");
    },

    async submitSolution(form: unknown): Promise<void> {
      if (obs.gameStatus.get() !== "dealt" || obs.isSubmitting.get()) return;
      const submitted = String((form as { solution?: unknown })?.solution ?? "");
      if (!/^[1-9]{81}$/.test(submitted)) {
        setStatus(t("statusBoardIncomplete"), "error");
        return;
      }
      obs.isSubmitting.set(true);
      try {
        if (submitted !== solution) {
          setStatus(t("guestNotSolved"), "error");
          return;
        }
        const difficulty = clampDifficulty(obs.gameDifficulty.get());
        const undos = obs.undosUsed.get();
        const elapsedMs = Math.max(0, Date.now() - obs.dealtAt.get());
        const score = computeScore(difficulty, elapsedMs, undos);
        obs.lastElapsedMs.set(elapsedMs);
        obs.lastPayout.set(String(score));
        obs.gameStatus.set("solved");
        obs.lastStatus.set("");
        obs.activeGameId.set("0");
        obs.myTotalWon.set(Math.max(obs.myTotalWon.get(), score));
        obs.mySolves.set(obs.mySolves.get() + 1);
        solution = "";
        await submitScore(score);
        await refreshLeaderboard();
        setStatus(t("guestRunComplete", { score }), "success");
      } finally {
        obs.isSubmitting.set(false);
      }
    },

    expireGame(): void {
      if (obs.gameStatus.get() !== "dealt") {
        resetToLobby();
        return;
      }
      obs.gameStatus.set("expired");
      obs.activeGameId.set("0");
      obs.lastStatus.set("");
      obs.deadline.set(0);
      solution = "";
      setStatus(t("guestExpired"), "info");
    },

    retryDeal(): void {
      /* Guest deals instantly — there is nothing to re-request. */
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      resetToLobby();
      // Guest never reads chain — zero the on-chain-only counters so a prior
      // gamefi read (from the mount-time loadData) never bleeds into the guest
      // surface, and open every local gate the scene checks.
      obs.credit.set(0);
      obs.poolFree.set(GUEST_POOL);
      obs.myRank.set(0);
      obs.myTotalWon.set(0);
      obs.mySolves.set(0);
      obs.myHistory.set([]);
      // Local play gates: wallet optional, progression open, pool always ready.
      walletConnected.set(true);
      obs.progressionReady.set(true);
      obs.progressionRequiredDifficulty.set(0);
      obs.progressionMaxDifficulty.set(2);
      obs.progressionHardChallengeLevel.set(0);
      obs.progressionEffectiveLimitMs.set(0);
      await refreshLeaderboard();
    },
  };
}
