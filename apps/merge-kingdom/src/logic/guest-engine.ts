/**
 * Guest (free / local) engine for Merge Kingdom.
 *
 * Guest mode is a purely LOCAL merge puzzle: the starting board and every tile
 * spawn are generated with the Web-Crypto RNG (the local analog of the enclave
 * board stream), the board is played and scored entirely client-side, and
 * (optionally) the best tile is submitted to the OFF-CHAIN guest leaderboard.
 * The engine drives the SAME observables + dispatch actions the Phaser scene
 * reads (gameStatus / board / tileAchieved / moveCount / lastStatus / …), so the
 * frozen scene contract is reused verbatim. It NEVER makes a chain, oracle, or
 * reward call — the framework guest guard therefore never fires.
 *
 * The merge rules (adjacent move / same-value merge / spawn) are re-implemented
 * locally over the shared game-rules constants (BOARD_SIZE, targets, timers) —
 * the same board the enclave twins in gamefi mode — so a guest run is
 * mechanically identical to a reward run minus the chain.
 */
import type { GameSessionObservables, LeaderEntry, SolveRow } from "@framework/game";
import { emptyBoard, guestRuleOf } from "./game-rules";
import { clampDifficulty } from "@framework/game-rules";
import {
  applyMergeMove,
  emptyCells,
  hasMergePotential,
  highestTile,
  isValidBoard,
  type Cell,
} from "./merge-engine";
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";

/** Framework-owned, app-namespaced local persistence surface. */
export interface LocalStore {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export interface MergeGuestHistoryRow extends SolveRow {
  tileAchieved: number;
  won?: boolean;
}

export interface GuestEngineDeps {
  obs: GameSessionObservables<MergeGuestHistoryRow>;
  board: Obs<number[][]>;
  tileAchieved: Obs<number>;
  moveCount: Obs<number>;
  lastPayoutFixed8: Obs<bigint>;
  guestLeaderboard: GuestLeaderboardApi;
  storage: LocalStore;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
  /** Test seam; production defaults to Web Crypto. */
  randomInt?: (maxExclusive: number) => number;
}

export interface GuestEngine {
  startGame(difficulty: number): void;
  recordMove(fromRow: number, fromCol: number, toRow: number, toCol: number): void;
  submitSolution(): Promise<void>;
  expireGame(): Promise<void>;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";
const GUEST_PROFILE_KEY = "guest:merge-kingdom:profile:v1";
const GUEST_RUN_KEY = "guest:merge-kingdom:active-run:v1";
/** Number of tiles seeded onto a fresh local board. */
const START_TILES = 4;
/** Chance (out of this many) that a spawned tile is a "4" instead of a "2". */
const FOUR_SPAWN_IN = 8;
const MAX_GUEST_HISTORY = 12;

interface PersistedGuestProfile {
  bestTile?: unknown;
  clears?: unknown;
  history?: unknown;
}

interface PersistedGuestRun {
  board?: unknown;
  difficulty?: unknown;
  dealtAt?: unknown;
  deadline?: unknown;
  moveCount?: unknown;
}

type RestoreResult = "active" | "expired" | false;

function nonNegativeInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function validGuestHistory(value: unknown): MergeGuestHistoryRow[] {
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
      undos: 0,
      tileAchieved: nonNegativeInt(row.tileAchieved),
      won: row.won === true,
    } satisfies MergeGuestHistoryRow];
  }).slice(0, MAX_GUEST_HISTORY);
}

/**
 * Uniform integer in [0, maxExclusive) from Web Crypto.
 *
 * Rejection sampling removes modulo bias. Local fairness fails closed instead
 * of silently falling back to Math.random when a browser has no CSPRNG.
 */
export function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 0x1_0000_0000) {
    throw new RangeError("maxExclusive must be a positive uint32 range");
  }
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.getRandomValues) throw new Error("secureRandomUnavailable");
  const buffer = new Uint32Array(1);
  const ceiling = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  do {
    webCrypto.getRandomValues(buffer);
  } while ((buffer[0] ?? 0) >= ceiling);
  return (buffer[0] ?? 0) % maxExclusive;
}

/** Spawn one new tile (2, or occasionally 4) into a random empty cell. */
function spawnTile(board: number[][], randomInt: (maxExclusive: number) => number): boolean {
  const empties = emptyCells(board);
  if (empties.length === 0) return false;
  const cell = empties[randomInt(empties.length)] ?? empties[0]!;
  const value = randomInt(FOUR_SPAWN_IN) === 0 ? 4 : 2;
  const row = board[cell.row];
  if (row) row[cell.col] = value;
  return true;
}

/** Fresh 4×4 board seeded with a few starting tiles. */
function initialBoard(randomInt: (maxExclusive: number) => number): number[][] {
  const board = emptyBoard();
  for (let k = 0; k < START_TILES; k += 1) spawnTile(board, randomInt);
  return board;
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
    obs,
    board,
    tileAchieved,
    moveCount,
    lastPayoutFixed8,
    guestLeaderboard,
    storage,
    t,
    setStatus,
  } = deps;
  const randomInt = deps.randomInt ?? secureRandomInt;

  const loadProfile = (): {
    bestTile: number;
    clears: number;
    history: MergeGuestHistoryRow[];
  } => {
    try {
      const raw = storage.get<PersistedGuestProfile>(GUEST_PROFILE_KEY, {}) ?? {};
      return {
        bestTile: nonNegativeInt(raw.bestTile),
        clears: nonNegativeInt(raw.clears),
        history: validGuestHistory(raw.history),
      };
    } catch {
      return { bestTile: 0, clears: 0, history: [] };
    }
  };

  const initialProfile = loadProfile();

  // Device-local guest stats (never touch the chain).
  let guestBestTile = initialProfile.bestTile;
  let guestClears = initialProfile.clears;
  let guestHistory = initialProfile.history;
  let settling = false;

  const saveProfile = (): void => {
    try {
      storage.set(GUEST_PROFILE_KEY, {
        bestTile: guestBestTile,
        clears: guestClears,
        history: guestHistory,
      });
    } catch {
      // Storage policy/quota failures never invalidate the in-memory run.
    }
  };

  const clearActiveRun = (): void => {
    try {
      storage.delete(GUEST_RUN_KEY);
    } catch {
      // The terminal in-memory state remains authoritative for this session.
    }
  };

  const saveActiveRun = (): void => {
    if (obs.gameStatus.get() !== "dealt") return;
    const liveBoard = board.get();
    if (!isValidBoard(liveBoard)) return;
    try {
      storage.set(GUEST_RUN_KEY, {
        board: liveBoard.map((row) => [...row]),
        difficulty: obs.gameDifficulty.get(),
        dealtAt: obs.dealtAt.get(),
        deadline: obs.deadline.get(),
        moveCount: moveCount.get(),
      } satisfies PersistedGuestRun);
    } catch {
      // Private browsing or a full quota must not stop local play.
    }
  };

  const publishBoard = (next: number[][]): void => {
    board.set(next.map((row) => [...row]));
    tileAchieved.set(highestTile(next));
  };

  const resetToLobby = (): void => {
    obs.gameStatus.set("idle");
    obs.activeGameId.set("0");
    obs.commitment.set("");
    obs.deadline.set(0);
    obs.dealtAt.set(0);
    obs.undosUsed.set(0);
    obs.lastStatus.set("");
    obs.lastElapsedMs.set(0);
    obs.isStarting.set(false);
    obs.isDealing.set(false);
    obs.isSubmitting.set(false);
    obs.isUndoing.set(false);
    lastPayoutFixed8.set(0n);
    board.set([]);
    tileAchieved.set(0);
    moveCount.set(0);
  };

  const restoreActiveRun = (): RestoreResult => {
    try {
      const raw = storage.get<PersistedGuestRun>(GUEST_RUN_KEY, null);
      if (!raw) return false;
      if (!isValidBoard(raw.board)) {
        clearActiveRun();
        return false;
      }

      const dealtAt = nonNegativeInt(raw.dealtAt);
      const deadline = nonNegativeInt(raw.deadline);
      const difficulty = clampDifficulty(Number(raw.difficulty));
      const restoredMoves = nonNegativeInt(raw.moveCount);
      if (
        dealtAt <= 0
        || deadline <= dealtAt
        || highestTile(raw.board) <= 0
        || (!hasMergePotential(raw.board)
          && highestTile(raw.board) < guestRuleOf(difficulty).targetTile)
      ) {
        clearActiveRun();
        return false;
      }

      obs.gameDifficulty.set(difficulty);
      obs.activeGameId.set(GUEST_GAME_ID);
      obs.commitment.set("");
      obs.undosUsed.set(0);
      obs.dealtAt.set(dealtAt);
      obs.deadline.set(deadline);
      lastPayoutFixed8.set(0n);
      publishBoard(raw.board);
      moveCount.set(restoredMoves);
      obs.gameStatus.set("dealt");
      obs.lastStatus.set(t("guestRunRecovered"));
      return deadline <= Date.now() ? "expired" : "active";
    } catch {
      clearActiveRun();
      return false;
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
    if (settling) return;
    settling = true;
    try {
      const score = tileAchieved.get();
      const difficulty = obs.gameDifficulty.get();
      const elapsedMs = Math.max(0, Date.now() - obs.dealtAt.get());
      obs.lastElapsedMs.set(elapsedMs);
      lastPayoutFixed8.set(0n);
      obs.activeGameId.set("0");
      clearActiveRun();

      if (score > 0) {
        guestBestTile = Math.max(guestBestTile, score);
        if (won) guestClears += 1;
        guestHistory = [{
          gameId: `guest-${Date.now()}-${guestHistory.length + 1}`,
          difficulty,
          payout: "0 GAS",
          solveMs: elapsedMs,
          undos: 0,
          tileAchieved: score,
          won,
        }, ...guestHistory].slice(0, MAX_GUEST_HISTORY);
        obs.myTotalWon.set(guestBestTile);
        obs.mySolves.set(guestClears);
        obs.myHistory.set([...guestHistory]);
        saveProfile();
      }

      obs.gameStatus.set(won ? "solved" : "expired");
      if (won) {
        const message = t("guestRunComplete", { tile: score });
        obs.lastStatus.set(message);
        setStatus(message, "success");
      } else {
        const message = t("guestGameOver", { tile: score });
        obs.lastStatus.set(message);
        setStatus(message, "info");
      }

      await submitScore(score);
      await refreshLeaderboard();
    } finally {
      settling = false;
    }
  };

  return {
    startGame(difficulty: number): void {
      if (settling || obs.isStarting.get() || obs.isSubmitting.get() || obs.gameStatus.get() === "dealt") return;
      const diff = clampDifficulty(difficulty);
      const rule = guestRuleOf(diff);
      obs.isStarting.set(true);
      try {
        const start = initialBoard(randomInt);
        const now = Date.now();
        obs.gameDifficulty.set(diff);
        obs.activeGameId.set(GUEST_GAME_ID);
        obs.commitment.set("");
        obs.undosUsed.set(0);
        obs.dealtAt.set(now);
        obs.deadline.set(now + rule.limitMs);
        lastPayoutFixed8.set(0n);
        publishBoard(start);
        moveCount.set(0);
        obs.gameStatus.set("dealt");
        obs.lastStatus.set(t("guestRunStarted"));
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
      } finally {
        obs.isStarting.set(false);
      }
    },

    recordMove(fromRow: number, fromCol: number, toRow: number, toCol: number): void {
      if (obs.gameStatus.get() !== "dealt") return;
      const deadline = obs.deadline.get();
      if (deadline > 0 && Date.now() >= deadline) return;

      let result: ReturnType<typeof applyMergeMove>;
      try {
        result = applyMergeMove(
          board.get(),
          { row: fromRow, col: fromCol },
          { row: toRow, col: toCol },
          (free: readonly Cell[]) => ({
            cell: free[randomInt(free.length)] ?? free[0]!,
            value: randomInt(FOUR_SPAWN_IN) === 0 ? 4 : 2,
          }),
        );
      } catch (error) {
        const message = error instanceof Error && error.message === "secureRandomUnavailable"
          ? t("secureRandomUnavailable")
          : error instanceof Error
            ? error.message
            : t("statusFailed");
        obs.lastStatus.set(message);
        setStatus(message, "error");
        return;
      }
      if (!result) return;

      publishBoard(result.board);
      moveCount.set(moveCount.get() + 1);
      saveActiveRun();

      // Repositioning never consumes a spawn. A dead position is one that can
      // no longer produce a merge, not merely a board with no immediate pair.
      const rule = guestRuleOf(obs.gameDifficulty.get());
      if (result.highestTile < rule.targetTile && !result.canContinue) {
        void finishRun(false);
      }
    },

    async submitSolution(): Promise<void> {
      if (obs.gameStatus.get() !== "dealt" || obs.isSubmitting.get()) return;
      const rule = guestRuleOf(obs.gameDifficulty.get());
      if (tileAchieved.get() < rule.targetTile) return; // claim only once the target is raised
      obs.isSubmitting.set(true);
      try {
        await finishRun(true);
      } finally {
        obs.isSubmitting.set(false);
      }
    },

    async expireGame(): Promise<void> {
      if (obs.gameStatus.get() === "dealt") {
        await finishRun(false);
        return;
      }
      resetToLobby();
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
      guestClears = profile.clears;
      guestHistory = profile.history;
      obs.myTotalWon.set(guestBestTile);
      obs.mySolves.set(guestClears);
      obs.myHistory.set([...guestHistory]);
      const restored = restoreActiveRun();
      if (restored === "expired") await finishRun(false);
      await refreshLeaderboard();
    },
  };
}
