/**
 * Guest (free / local) engine for 2048 Rush.
 *
 * Guest mode is a purely LOCAL 2048: the initial board and every tile spawn are
 * generated with the Web-Crypto RNG (the local analog of the enclave spawn
 * stream), the board is played and scored entirely client-side, and (optionally)
 * the best tile is submitted to the OFF-CHAIN guest leaderboard. The engine
 * drives the SAME observables + dispatch actions the Phaser scene reads
 * (gameStatus / runBoard / runMoveCount / runMaxExp / isMoving / lastStatus / …),
 * so the frozen scene contract is reused verbatim. It NEVER makes a chain,
 * oracle, or reward call — the framework guest guard therefore never fires.
 *
 * The slide/merge/fold rules are the shared pure modules (engine-2048 +
 * run-store) — the very same rules the enclave twins in gamefi mode — so a
 * guest run is mechanically identical to a reward run minus the chain.
 */
import type { GameSessionObservables } from "@framework/game";
import type { SolveRow } from "@framework/game";
import {
  MOVE_ANIMATION_MS,
  applyMove,
  hasAnyMove,
  tileValue,
} from "./engine-2048";
import type { MoveTransition } from "./engine-2048";
import { MAX_MOVES, MAX_UNDOS, ruleOf } from "./game-rules";
import { clampDifficulty } from "@framework/game-rules";
import { applyStepWithTransition, buildRun, trimLastMove } from "./run-store";
import type { LiveRun, TeeSpawn } from "./run-store";
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";

interface LocalStore {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export interface GuestEngineDeps {
  obs: GameSessionObservables;
  runBoard: Obs<number[]>;
  runMoveCount: Obs<number>;
  runMaxExp: Obs<number>;
  moveTransition: Obs<MoveTransition | null>;
  isMoving: Obs<boolean>;
  balancesReady: Obs<boolean>;
  guestLeaderboard: GuestLeaderboardApi;
  storage: LocalStore;
  /** Deterministic test seam; production omits it and uses secure local RNG. */
  initialBoardFactory?: () => number[];
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startGame(form: unknown): void;
  playMove(form: unknown): void;
  useUndo(): void;
  submitRun(): Promise<void>;
  expireGame(): Promise<void>;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";
const GUEST_PROFILE_KEY = "guest:2048:profile:v1";
const GUEST_RUN_KEY = "guest:2048:active-run:v1";
/**
 * Local move latency. A valid move flips `isMoving` true, then commits the fold
 * one macrotask later — mirroring the gamefi enclave round-trip so the scene
 * observes the true→false transition and plays its slide/merge animation
 * exactly as it does for a reward run (a synchronous commit would coalesce into
 * one snapshot and skip the animation).
 */
const MOVE_LATENCY_MS = 110;
/** Chance (out of this many) that a spawned tile is a "4" (exp 2) instead of "2". */
const FOUR_SPAWN_IN = 10;

interface PersistedGuestProfile {
  bestTile?: unknown;
  runsPlayed?: unknown;
  history?: unknown;
}

interface PersistedGuestRun {
  difficulty?: unknown;
  dealtAt?: unknown;
  deadline?: unknown;
  undosUsed?: unknown;
  initBoard?: unknown;
  moves?: unknown;
  spawns?: unknown;
}

function nonNegativeInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function validGuestHistory(value: unknown): SolveRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Record<string, unknown>;
    const gameId = typeof row.gameId === "string" ? row.gameId : "";
    if (!gameId.startsWith("guest-")) return [];
    return [{
      gameId,
      difficulty: clampDifficulty(Number(row.difficulty)),
      payout: "0 GAS",
      solveMs: nonNegativeInt(row.solveMs),
      undos: Math.min(MAX_UNDOS, nonNegativeInt(row.undos)),
      bestTile: nonNegativeInt(row.bestTile),
      moves: Math.min(MAX_MOVES, nonNegativeInt(row.moves)),
      won: row.won === true,
    } satisfies SolveRow];
  }).slice(0, 20);
}

/** Uniform integer in [0, maxExclusive). Local fairness fails closed without Web Crypto. */
function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.getRandomValues) throw new Error("secureRandomUnavailable");
  const buffer = new Uint32Array(1);
  const ceiling = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  do {
    webCrypto.getRandomValues(buffer);
  } while ((buffer[0] ?? 0) >= ceiling);
  return (buffer[0] ?? 0) % maxExclusive;
}

/** Pick a random empty cell + exponent for the next spawn, or null if full. */
function pickSpawn(board: number[]): TeeSpawn | null {
  const empties: number[] = [];
  for (let i = 0; i < board.length; i += 1) {
    if ((board[i] ?? 0) === 0) empties.push(i);
  }
  if (empties.length === 0) return null;
  const pos = empties[randomInt(empties.length)] ?? empties[0]!;
  const exp = randomInt(FOUR_SPAWN_IN) === 0 ? 2 : 1;
  return { pos, exp };
}

/** Fresh 16-cell board seeded with two starting tiles. */
function initialBoard(): number[] {
  const board: number[] = new Array(16).fill(0);
  for (let k = 0; k < 2; k += 1) {
    const spawn = pickSpawn(board);
    if (spawn) board[spawn.pos] = spawn.exp;
  }
  return board;
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
    obs,
    runBoard,
    runMoveCount,
    runMaxExp,
    moveTransition,
    isMoving,
    balancesReady,
    guestLeaderboard,
    storage,
    initialBoardFactory,
    t,
    setStatus,
  } = deps;

  const loadProfile = (): { bestTile: number; runsPlayed: number; history: SolveRow[] } => {
    try {
      const raw = storage.get<PersistedGuestProfile>(GUEST_PROFILE_KEY, {}) ?? {};
      return {
        bestTile: nonNegativeInt(raw.bestTile),
        runsPlayed: nonNegativeInt(raw.runsPlayed),
        history: validGuestHistory(raw.history),
      };
    } catch {
      return { bestTile: 0, runsPlayed: 0, history: [] };
    }
  };

  const saveProfile = (): void => {
    try {
      storage.set(GUEST_PROFILE_KEY, {
        bestTile: guestBestTile,
        runsPlayed,
        history: guestHistory,
      });
    } catch {
      // Private browsing or a full quota must not make an active board fail.
    }
  };

  const initialProfile = loadProfile();

  // Internal run + locally persisted guest stats (never touch the chain).
  let run: LiveRun | null = null;
  let guestBestTile = initialProfile.bestTile;
  let runsPlayed = initialProfile.runsPlayed;
  let guestHistory: SolveRow[] = initialProfile.history;
  let moveSequence = 0;
  let moveCommitTimer: ReturnType<typeof setTimeout> | null = null;
  let moveUnlockTimer: ReturnType<typeof setTimeout> | null = null;

  const clearMoveTimers = (): void => {
    if (moveCommitTimer !== null) clearTimeout(moveCommitTimer);
    if (moveUnlockTimer !== null) clearTimeout(moveUnlockTimer);
    moveCommitTimer = null;
    moveUnlockTimer = null;
  };

  const publishRun = (): void => {
    runBoard.set(run ? [...run.board] : []);
    runMoveCount.set(run ? run.moves.length : 0);
    runMaxExp.set(run ? run.maxExp : 0);
  };

  const saveActiveRun = (): void => {
    if (!run || obs.gameStatus.get() !== "dealt") return;
    try {
      storage.set(GUEST_RUN_KEY, {
        difficulty: obs.gameDifficulty.get(),
        dealtAt: obs.dealtAt.get(),
        deadline: obs.deadline.get(),
        undosUsed: obs.undosUsed.get(),
        initBoard: run.initBoard,
        moves: run.moves,
        spawns: run.spawns,
      });
    } catch {
      // Continue in memory when local persistence is unavailable.
    }
  };

  const clearActiveRun = (): void => {
    try {
      storage.delete(GUEST_RUN_KEY);
    } catch {
      // Nothing else is required for an already terminal local run.
    }
  };

  const restoreActiveRun = (): boolean => {
    try {
      const raw = storage.get<PersistedGuestRun>(GUEST_RUN_KEY, null);
      if (!raw) return false;
      const dealtAt = nonNegativeInt(raw.dealtAt);
      const deadline = nonNegativeInt(raw.deadline);
      const difficulty = clampDifficulty(Number(raw.difficulty));
      if (
        deadline <= Date.now()
        || !Array.isArray(raw.initBoard)
        || !Array.isArray(raw.moves)
        || !Array.isArray(raw.spawns)
      ) {
        clearActiveRun();
        return false;
      }
      const restored = buildRun(
        raw.initBoard as number[],
        raw.moves as number[],
        raw.spawns as TeeSpawn[],
      );
      if (!restored || restored.moves.length > MAX_MOVES) {
        clearActiveRun();
        return false;
      }
      run = restored;
      moveSequence = restored.moves.length;
      obs.gameDifficulty.set(difficulty);
      obs.activeGameId.set(GUEST_GAME_ID);
      obs.commitment.set("");
      obs.dealtAt.set(dealtAt);
      obs.deadline.set(deadline);
      obs.undosUsed.set(Math.min(MAX_UNDOS, nonNegativeInt(raw.undosUsed)));
      publishRun();
      obs.gameStatus.set("dealt");
      obs.lastStatus.set(t("guestRunRecovered"));
      return true;
    } catch {
      clearActiveRun();
      return false;
    }
  };

  const resetToLobby = (): void => {
    clearMoveTimers();
    run = null;
    moveSequence = 0;
    moveTransition.set(null);
    isMoving.set(false);
    obs.gameStatus.set("idle");
    obs.activeGameId.set("0");
    obs.commitment.set("");
    obs.deadline.set(0);
    obs.dealtAt.set(0);
    obs.undosUsed.set(0);
    obs.lastPayout.set("");
    publishRun();
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
      const ranked = rows
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

  /** Settle the current run (win or dead board), record + submit the best tile. */
  const finishRun = async (won: boolean): Promise<void> => {
    const score = run ? tileValue(run.maxExp) : 0;
    const difficulty = obs.gameDifficulty.get();
    const moves = run?.moves.length ?? 0;
    const elapsedMs = Math.max(0, Date.now() - obs.dealtAt.get());
    const undos = obs.undosUsed.get();
    clearMoveTimers();
    moveTransition.set(null);
    isMoving.set(false);
    obs.lastElapsedMs.set(elapsedMs);
    run = null;
    obs.activeGameId.set("0");
    clearActiveRun();
    publishRun();

    if (score > 0) {
      guestBestTile = Math.max(guestBestTile, score);
      runsPlayed += 1;
      obs.myTotalWon.set(guestBestTile);
      obs.mySolves.set(runsPlayed);
      guestHistory = [{
        gameId: `guest-${runsPlayed}`,
        difficulty,
        payout: "0 GAS",
        solveMs: elapsedMs,
        undos,
        bestTile: score,
        moves,
        won,
      }, ...guestHistory].slice(0, 20);
      obs.myHistory.set([...guestHistory]);
      saveProfile();
    }

    obs.gameStatus.set(won ? "solved" : "expired");
    if (won) {
      obs.lastStatus.set(t("guestRunComplete", { tile: score }));
      setStatus(t("guestRunComplete", { tile: score }), "success");
    } else {
      obs.lastStatus.set(t("guestGameOver", { tile: score }));
      setStatus(t("guestGameOver", { tile: score }), "info");
    }

    await submitScore(score);
    await refreshLeaderboard();
  };

  const commitMove = (dir: number): void => {
    moveCommitTimer = null;
    // Guard against a reset/stop landing during the move latency window.
    if (!run || obs.gameStatus.get() !== "dealt") {
      isMoving.set(false);
      return;
    }
    const post = [...run.board];
    if (!applyMove(post, dir)) {
      isMoving.set(false);
      return;
    }
    const spawn = pickSpawn(post);
    const applied = spawn
      ? applyStepWithTransition(run, dir, spawn, moveSequence + 1)
      : null;
    if (!applied) {
      isMoving.set(false);
      return;
    }
    moveSequence += 1;
    // Publish the identity map before the final board so the Scene can begin
    // from its current visuals even when observable notifications are unbatched.
    moveTransition.set(applied.transition);
    run = applied.run;
    publishRun();
    saveActiveRun();
    moveUnlockTimer = setTimeout(() => {
      moveUnlockTimer = null;
      isMoving.set(false);
      if (!run) return;
      const rule = ruleOf(obs.gameDifficulty.get());
      if (
        run.maxExp < rule.targetExp
        && (!hasAnyMove(run.board) || run.moves.length >= MAX_MOVES)
      ) {
        // Let the confirmed slide/merge/spawn finish before replacing the board
        // with the game-over surface.
        void finishRun(false);
      }
    }, MOVE_ANIMATION_MS);
  };

  return {
    startGame(form: unknown): void {
      if (obs.isStarting.get() || obs.gameStatus.get() === "dealt") return;
      const difficulty = clampDifficulty(Number((form as { difficulty?: unknown })?.difficulty ?? 0));
      const rule = ruleOf(difficulty);
      obs.isStarting.set(true);
      try {
        clearMoveTimers();
        moveSequence = 0;
        moveTransition.set(null);
        isMoving.set(false);
        run = buildRun((initialBoardFactory ?? initialBoard)(), [], []);
        if (!run) throw new Error(t("invalidBoardPayload"));
        const now = Date.now();
        obs.gameDifficulty.set(difficulty);
        obs.activeGameId.set(GUEST_GAME_ID);
        obs.commitment.set("");
        obs.undosUsed.set(0);
        obs.dealtAt.set(now);
        obs.deadline.set(now + rule.limitMs);
        obs.lastPayout.set("");
        publishRun();
        obs.gameStatus.set("dealt");
        obs.lastStatus.set(t("guestDealt"));
        saveActiveRun();
      } catch (error) {
        clearActiveRun();
        resetToLobby();
        const message = error instanceof Error && error.message === "secureRandomUnavailable"
          ? t("secureRandomUnavailable")
          : error instanceof Error
            ? error.message
            : t("statusFailed");
        obs.lastStatus.set(message);
        setStatus(message, "error");
        throw error;
      } finally {
        obs.isStarting.set(false);
      }
    },

    playMove(form: unknown): void {
      if (!run || obs.gameStatus.get() !== "dealt" || isMoving.get()) return;
      if (run.moves.length >= MAX_MOVES) return;
      const dir = Number((form as { dir?: unknown })?.dir);
      if (!Number.isInteger(dir) || dir < 0 || dir > 3) return;
      const deadline = obs.deadline.get();
      if (deadline > 0 && Date.now() >= deadline) return;
      if (!applyMove([...run.board], dir)) return; // no-op move
      isMoving.set(true);
      moveCommitTimer = setTimeout(() => commitMove(dir), MOVE_LATENCY_MS);
    },

    useUndo(): void {
      if (!run || run.moves.length === 0) return;
      if (obs.gameStatus.get() !== "dealt" || obs.isUndoing.get() || isMoving.get()) return;
      if (obs.deadline.get() > 0 && Date.now() >= obs.deadline.get()) return;
      if (obs.undosUsed.get() >= MAX_UNDOS) return;
      obs.isUndoing.set(true);
      run = trimLastMove(run);
      moveTransition.set(null);
      publishRun();
      obs.undosUsed.set(obs.undosUsed.get() + 1);
      saveActiveRun();
      obs.lastStatus.set(t("guestUndo"));
      obs.isUndoing.set(false);
    },

    async submitRun(): Promise<void> {
      if (!run || obs.gameStatus.get() !== "dealt" || obs.isSubmitting.get()) return;
      const rule = ruleOf(obs.gameDifficulty.get());
      const expired = obs.deadline.get() > 0 && Date.now() >= obs.deadline.get();
      const won = !expired && run.maxExp >= rule.targetExp;
      const ended = expired || won || !hasAnyMove(run.board) || run.moves.length >= MAX_MOVES;
      if (!ended) {
        obs.lastStatus.set(t("guestTargetPending", { tile: rule.targetTile }));
        return;
      }
      obs.isSubmitting.set(true);
      try {
        await finishRun(won);
      } finally {
        obs.isSubmitting.set(false);
      }
    },

    async expireGame(): Promise<void> {
      if (!run) {
        resetToLobby();
        return;
      }
      await finishRun(false);
    },

    retryDeal(): void {
      /* guest deals instantly — nothing to re-request. */
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      resetToLobby();
      // Guest never reads the chain — zero the on-chain-only counters so a prior
      // gamefi read (from the mount-time loadData) never bleeds into the guest
      // surface, then load the off-chain guest board.
      obs.credit.set(0);
      obs.poolFree.set(0);
      obs.myRank.set(0);
      const profile = loadProfile();
      guestBestTile = profile.bestTile;
      runsPlayed = profile.runsPlayed;
      guestHistory = profile.history;
      obs.myTotalWon.set(guestBestTile);
      obs.mySolves.set(runsPlayed);
      obs.myHistory.set([...guestHistory]);
      balancesReady.set(true);
      if (!restoreActiveRun()) obs.lastStatus.set(t("statusReady"));
      await refreshLeaderboard();
    },
  };
}
