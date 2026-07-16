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
import { ruleOf } from "./game-rules";
import { clampDifficulty as clampDifficulty02 } from "@framework/game-rules";
import { forgetBoard, type BoardStorage } from "./board-store";
import { dealPuzzle, hexToBytes, type Difficulty } from "./sudoku-engine";
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";

export interface GuestEngineDeps {
  obs: GameSessionObservables;
  clues: Obs<string>;
  walletConnected: Obs<boolean>;
  isPaused: Obs<boolean>;
  hintsUsed: Obs<number>;
  hintCell: Obs<number>;
  hintDigit: Obs<number>;
  hintNonce: Obs<number>;
  storage: BoardStorage;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startGame(form: unknown): void;
  selectDifficulty(form: unknown): void;
  recordMove(form: unknown): void;
  useUndo(): void;
  requestHint(form: unknown): void;
  togglePause(): void;
  restartGame(form?: unknown): void;
  submitSolution(form: unknown): Promise<void>;
  expireGame(): void;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";
const GUEST_SESSION_KEY = "guest-session:v1";
const GUEST_PROFILE_KEY = "guest-profile:v1";
export const MAX_GUEST_HINTS = 3;
// A guest never reads the reward pool — surface a value that always clears the
// scene's local pool gate so every difficulty is immediately playable.
const GUEST_POOL = 9999;

interface GuestSessionRecord {
  version: 1;
  seedHex: string;
  difficulty: Difficulty;
  dealtAt: number;
  deadline: number;
  undosUsed: number;
  hintsUsed: number;
  isPaused: boolean;
  pausedAt: number;
}

interface GuestProfileRecord {
  version: 1;
  bestScore: number;
  solves: number;
}

function clampDifficulty(value: number): Difficulty {
  return clampDifficulty02(value) as Difficulty;
}

/** Web-Crypto 32-byte seed — the local beacon analog. */
function randomSeed(): Uint8Array {
  const bytes = new Uint8Array(32);
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.getRandomValues) {
    throw new Error("Secure local randomness is unavailable");
  }
  webCrypto.getRandomValues(bytes);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function readSession(storage: BoardStorage): GuestSessionRecord | null {
  try {
    const value = storage.get<GuestSessionRecord>(GUEST_SESSION_KEY, null);
    if (
      !value || value.version !== 1 ||
      !/^[0-9a-f]{64}$/i.test(value.seedHex) ||
      !Number.isInteger(value.difficulty) || value.difficulty < 0 || value.difficulty > 2 ||
      !Number.isFinite(value.dealtAt) || value.dealtAt <= 0 ||
      !Number.isFinite(value.deadline) || value.deadline <= value.dealtAt ||
      !Number.isInteger(value.undosUsed) || value.undosUsed < 0 || value.undosUsed > 10_000 ||
      !Number.isInteger(value.hintsUsed) || value.hintsUsed < 0 || value.hintsUsed > MAX_GUEST_HINTS ||
      typeof value.isPaused !== "boolean" ||
      !Number.isFinite(value.pausedAt) || value.pausedAt < 0 ||
      (value.isPaused && value.pausedAt <= 0)
    ) return null;
    return value;
  } catch {
    return null;
  }
}

function readProfile(storage: BoardStorage): GuestProfileRecord {
  try {
    const value = storage.get<GuestProfileRecord>(GUEST_PROFILE_KEY, null);
    if (
      value?.version === 1 &&
      Number.isFinite(value.bestScore) && value.bestScore >= 0 &&
      Number.isInteger(value.solves) && value.solves >= 0
    ) return value;
  } catch {
    // Fall through to a clean local profile.
  }
  return { version: 1, bestScore: 0, solves: 0 };
}

/**
 * Local run score: rewards speed (remaining seconds) with a difficulty base,
 * with a bounded hint penalty. Corrections and undo are normal Sudoku tools;
 * their time cost is already reflected by the remaining-clock component.
 */
function computeScore(
  difficulty: Difficulty,
  elapsedMs: number,
  hints: number,
): number {
  const rule = ruleOf(difficulty);
  const remainingSec = Math.max(0, Math.round((rule.limitMs - elapsedMs) / 1000));
  const base = (difficulty + 1) * 500 + remainingSec;
  const hintPct = Math.max(55, 100 - Math.max(0, hints) * 15);
  return Math.max(1, Math.round((base * hintPct) / 100));
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
    obs,
    clues,
    walletConnected,
    isPaused,
    hintsUsed,
    hintCell,
    hintDigit,
    hintNonce,
    storage,
    guestLeaderboard,
    t,
    setStatus,
  } = deps;

  // The derived solution for the live guest puzzle — the exact byte string a
  // completed board must match. Never leaves this closure.
  let solution = "";
  let seedHex = "";
  let pausedAt = 0;

  const clearPersistedSession = (): void => {
    try {
      storage.delete(GUEST_SESSION_KEY);
    } catch {
      // Private browsing/storage pressure must not block local play.
    }
  };

  const persistLiveSession = (): void => {
    if (
      obs.gameStatus.get() !== "dealt" ||
      !/^[0-9a-f]{64}$/.test(seedHex) ||
      !solution
    ) return;
    const record: GuestSessionRecord = {
      version: 1,
      seedHex,
      difficulty: clampDifficulty(obs.gameDifficulty.get()),
      dealtAt: obs.dealtAt.get(),
      deadline: obs.deadline.get(),
      undosUsed: Math.max(0, Math.min(10_000, obs.undosUsed.get())),
      hintsUsed: Math.max(0, Math.min(MAX_GUEST_HINTS, hintsUsed.get())),
      isPaused: isPaused.get(),
      pausedAt,
    };
    try {
      storage.set(GUEST_SESSION_KEY, record);
    } catch {
      // The live scene still holds the game when persistence is unavailable.
    }
  };

  const resetToLobby = (clearProgress = true): void => {
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
    isPaused.set(false);
    hintsUsed.set(0);
    hintCell.set(-1);
    hintDigit.set(0);
    hintNonce.set(0);
    pausedAt = 0;
    solution = "";
    seedHex = "";
    if (clearProgress) {
      clearPersistedSession();
      forgetBoard(GUEST_GAME_ID);
    }
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
        .map((row) => {
          const score = Number(row.score);
          return {
            address: String(row.user ?? "").slice(0, 96),
            score: Number.isFinite(score) && score >= 0 ? score : 0,
          };
        })
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

  const startGame = (form: unknown): void => {
    if (obs.isStarting.get() || obs.isDealing.get()) return;
    const difficulty = clampDifficulty(
      Number((form as { difficulty?: unknown })?.difficulty ?? obs.gameDifficulty.get()),
    );
    const rule = ruleOf(difficulty);
    obs.isStarting.set(true);
    try {
      const seed = randomSeed();
      const dealt = dealPuzzle(seed, difficulty);
      forgetBoard(GUEST_GAME_ID);
      seedHex = bytesToHex(seed);
      solution = dealt.solution;
      obs.gameDifficulty.set(difficulty);
      obs.activeGameId.set(GUEST_GAME_ID);
      obs.commitment.set("");
      obs.undosUsed.set(0);
      obs.lastPayout.set("");
      obs.lastElapsedMs.set(0);
      isPaused.set(false);
      hintsUsed.set(0);
      hintCell.set(-1);
      hintDigit.set(0);
      hintNonce.set(0);
      pausedAt = 0;
      clues.set(dealt.puzzle);
      const now = Date.now();
      obs.dealtAt.set(now);
      obs.deadline.set(now + rule.limitMs);
      obs.gameStatus.set("dealt");
      obs.lastStatus.set("");
      persistLiveSession();
    } catch {
      setStatus(t("guestRandomUnavailable"), "error");
    } finally {
      obs.isStarting.set(false);
    }
  };

  return {
    startGame,

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
      if (obs.gameStatus.get() !== "dealt" || obs.isUndoing.get() || isPaused.get()) return;
      const undos = obs.undosUsed.get();
      obs.undosUsed.set(undos + 1);
      persistLiveSession();
      setStatus(t("guestUndoUsed"), "info");
    },

    requestHint(form: unknown): void {
      if (obs.gameStatus.get() !== "dealt" || isPaused.get() || !solution) return;
      const cell = Number((form as { cell?: unknown })?.cell);
      if (!Number.isInteger(cell) || cell < 0 || cell >= 81) {
        setStatus(t("guestHintSelectCell"), "info");
        return;
      }
      if (hintsUsed.get() >= MAX_GUEST_HINTS) {
        setStatus(t("guestHintNoneLeft"), "info");
        return;
      }
      const digit = Number(solution[cell]);
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) return;
      hintsUsed.set(hintsUsed.get() + 1);
      hintCell.set(cell);
      hintDigit.set(digit);
      hintNonce.set(hintNonce.get() + 1);
      persistLiveSession();
      setStatus(t("guestHintUsed", { left: MAX_GUEST_HINTS - hintsUsed.get() }), "info");
    },

    togglePause(): void {
      if (obs.gameStatus.get() !== "dealt") return;
      const now = Date.now();
      if (!isPaused.get()) {
        pausedAt = now;
        isPaused.set(true);
        persistLiveSession();
        setStatus(t("guestPaused"), "info");
        return;
      }
      const pausedFor = Math.max(0, now - pausedAt);
      obs.dealtAt.set(obs.dealtAt.get() + pausedFor);
      obs.deadline.set(obs.deadline.get() + pausedFor);
      pausedAt = 0;
      isPaused.set(false);
      persistLiveSession();
      setStatus(t("guestResumed"), "info");
    },

    restartGame(form?: unknown): void {
      const difficulty = Number(
        (form as { difficulty?: unknown } | undefined)?.difficulty ?? obs.gameDifficulty.get(),
      );
      startGame({ difficulty });
    },

    async submitSolution(form: unknown): Promise<void> {
      if (obs.gameStatus.get() !== "dealt" || obs.isSubmitting.get() || isPaused.get()) return;
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
        const elapsedMs = Math.max(0, Date.now() - obs.dealtAt.get());
        const score = computeScore(difficulty, elapsedMs, hintsUsed.get());
        obs.lastElapsedMs.set(elapsedMs);
        obs.lastPayout.set(String(score));
        obs.gameStatus.set("solved");
        obs.lastStatus.set("");
        obs.activeGameId.set("0");
        const profile: GuestProfileRecord = {
          version: 1,
          bestScore: Math.max(obs.myTotalWon.get(), score),
          solves: obs.mySolves.get() + 1,
        };
        obs.myTotalWon.set(profile.bestScore);
        obs.mySolves.set(profile.solves);
        try {
          storage.set(GUEST_PROFILE_KEY, profile);
        } catch {
          // A solved run still completes if the browser cannot persist stats.
        }
        clearPersistedSession();
        forgetBoard(GUEST_GAME_ID);
        solution = "";
        seedHex = "";
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
      isPaused.set(false);
      pausedAt = 0;
      solution = "";
      seedHex = "";
      clearPersistedSession();
      forgetBoard(GUEST_GAME_ID);
      setStatus(t("guestExpired"), "info");
    },

    retryDeal(): void {
      /* Guest deals instantly — there is nothing to re-request. */
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      resetToLobby(false);
      // Guest never reads chain — zero the on-chain-only counters so a prior
      // gamefi read (from the mount-time loadData) never bleeds into the guest
      // surface, and open every local gate the scene checks.
      obs.credit.set(0);
      obs.poolFree.set(GUEST_POOL);
      obs.myRank.set(0);
      const profile = readProfile(storage);
      obs.myTotalWon.set(profile.bestScore);
      obs.mySolves.set(profile.solves);
      obs.myHistory.set([]);
      // Local play gates: wallet optional, progression open, pool always ready.
      walletConnected.set(true);
      obs.progressionReady.set(true);
      obs.progressionRequiredDifficulty.set(0);
      obs.progressionMaxDifficulty.set(2);
      obs.progressionHardChallengeLevel.set(0);
      obs.progressionEffectiveLimitMs.set(0);

      const saved = readSession(storage);
      if (saved) {
        try {
          const dealt = dealPuzzle(hexToBytes(saved.seedHex), saved.difficulty);
          obs.gameDifficulty.set(saved.difficulty);
          if (!saved.isPaused && saved.deadline <= Date.now()) {
            clearPersistedSession();
            forgetBoard(GUEST_GAME_ID);
            obs.gameStatus.set("expired");
            obs.lastStatus.set(t("guestExpired"));
          } else {
            seedHex = saved.seedHex.toLowerCase();
            solution = dealt.solution;
            pausedAt = saved.isPaused ? saved.pausedAt : 0;
            obs.activeGameId.set(GUEST_GAME_ID);
            obs.commitment.set("");
            obs.undosUsed.set(saved.undosUsed);
            obs.lastPayout.set("");
            obs.lastElapsedMs.set(0);
            clues.set(dealt.puzzle);
            obs.dealtAt.set(saved.dealtAt);
            obs.deadline.set(saved.deadline);
            isPaused.set(saved.isPaused);
            hintsUsed.set(saved.hintsUsed);
            hintCell.set(-1);
            hintDigit.set(0);
            hintNonce.set(0);
            obs.gameStatus.set("dealt");
            obs.lastStatus.set(t("guestRestored"));
          }
        } catch {
          clearPersistedSession();
          forgetBoard(GUEST_GAME_ID);
          resetToLobby(false);
        }
      } else {
        // Invalid/corrupted session records are never allowed to keep stale
        // board digits alive under the stable guest game id.
        clearPersistedSession();
        forgetBoard(GUEST_GAME_ID);
      }
      await refreshLeaderboard();
    },
  };
}
