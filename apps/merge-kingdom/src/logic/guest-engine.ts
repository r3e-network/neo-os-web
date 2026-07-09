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
import type { GameSessionObservables, LeaderEntry } from "@framework/game";
import { BOARD_SIZE, emptyBoard, ruleOf } from "./game-rules";

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
  board: Obs<number[][]>;
  tileAchieved: Obs<number>;
  moveCount: Obs<number>;
  lastPayoutFixed8: Obs<bigint>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
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
/** Number of tiles seeded onto a fresh local board. */
const START_TILES = 3;
/** Chance (out of this many) that a spawned tile is a "4" instead of a "2". */
const FOUR_SPAWN_IN = 8;

function clampDifficulty(value: number): number {
  return Math.max(0, Math.min(2, Number.isFinite(value) ? Math.round(value) : 0));
}

/** Uniform integer in [0, maxExclusive) from Web-Crypto (Math.random fallback). */
function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    webCrypto.getRandomValues(buffer);
    return (buffer[0] ?? 0) % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

/** Highest tile value anywhere on the board. */
function highestTile(board: number[][]): number {
  let best = 0;
  for (const row of board) for (const cell of row) if (cell > best) best = cell;
  return best;
}

/** Coordinates of every empty cell. */
function emptyCells(board: number[][]): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if ((board[r]?.[c] ?? 0) === 0) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

/** Spawn one new tile (2, or occasionally 4) into a random empty cell. */
function spawnTile(board: number[][]): boolean {
  const empties = emptyCells(board);
  if (empties.length === 0) return false;
  const cell = empties[randomInt(empties.length)] ?? empties[0]!;
  const value = randomInt(FOUR_SPAWN_IN) === 0 ? 4 : 2;
  const row = board[cell.row];
  if (row) row[cell.col] = value;
  return true;
}

/** Fresh 4×4 board seeded with a few starting tiles. */
function initialBoard(): number[][] {
  const board = emptyBoard();
  for (let k = 0; k < START_TILES; k += 1) spawnTile(board);
  return board;
}

function isOrthogonalAdjacent(fr: number, fc: number, tr: number, tc: number): boolean {
  const dr = Math.abs(fr - tr);
  const dc = Math.abs(fc - tc);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

/** True when the player can still act: any empty cell, or any adjacent equal pair. */
function hasAnyMove(board: number[][]): boolean {
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const v = board[r]?.[c] ?? 0;
      if (v === 0) return true;
      if (c + 1 < BOARD_SIZE && (board[r]?.[c + 1] ?? 0) === v) return true;
      if (r + 1 < BOARD_SIZE && (board[r + 1]?.[c] ?? 0) === v) return true;
    }
  }
  return false;
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
    obs,
    board,
    tileAchieved,
    moveCount,
    lastPayoutFixed8,
    guestLeaderboard,
    t,
    setStatus,
  } = deps;

  // Session-scoped guest stats (never touch the chain).
  let guestBestTile = 0;
  let runsPlayed = 0;
  let settling = false;

  const publishBoard = (next: number[][]): void => {
    board.set(cloneBoard(next));
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
    lastPayoutFixed8.set(0n);
    board.set([]);
    tileAchieved.set(0);
    moveCount.set(0);
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
    const score = tileAchieved.get();
    obs.lastElapsedMs.set(Math.max(0, Date.now() - obs.dealtAt.get()));
    lastPayoutFixed8.set(0n);
    obs.activeGameId.set("0");

    if (score > 0) {
      guestBestTile = Math.max(guestBestTile, score);
      runsPlayed += 1;
      obs.myTotalWon.set(guestBestTile);
      obs.mySolves.set(runsPlayed);
    }

    obs.gameStatus.set(won ? "solved" : "expired");
    if (won) {
      obs.lastStatus.set("solved");
      setStatus(t("guestRunComplete", { tile: score }), "success");
    } else {
      obs.lastStatus.set("expired");
      setStatus(t("guestGameOver", { tile: score }), "info");
    }

    await submitScore(score);
    await refreshLeaderboard();
    settling = false;
  };

  return {
    startGame(difficulty: number): void {
      if (obs.isStarting.get() || obs.gameStatus.get() === "dealt") return;
      const diff = clampDifficulty(difficulty);
      const rule = ruleOf(diff);
      obs.isStarting.set(true);
      const start = initialBoard();
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
      obs.lastStatus.set("dealt");
      obs.isStarting.set(false);
    },

    recordMove(fromRow: number, fromCol: number, toRow: number, toCol: number): void {
      if (obs.gameStatus.get() !== "dealt") return;
      const coords = [fromRow, fromCol, toRow, toCol];
      const inRange = (v: number) => Number.isInteger(v) && v >= 0 && v < BOARD_SIZE;
      if (!coords.every(inRange)) return;
      if (!isOrthogonalAdjacent(fromRow, fromCol, toRow, toCol)) return;
      const deadline = obs.deadline.get();
      if (deadline > 0 && Date.now() >= deadline) return;

      const next = cloneBoard(board.get());
      const src = next[fromRow]?.[fromCol] ?? 0;
      const dst = next[toRow]?.[toCol] ?? 0;
      if (src <= 0) return; // must move an occupied tile
      if (dst !== 0 && dst !== src) return; // only move into empty or merge equal

      if (dst === 0) {
        next[toRow]![toCol] = src; // relocate
      } else {
        next[toRow]![toCol] = src * 2; // merge equal tiles
      }
      next[fromRow]![fromCol] = 0;

      // Inject fresh material (the local analog of the enclave spawn stream).
      spawnTile(next);
      publishBoard(next);
      moveCount.set(moveCount.get() + 1);

      // Local game over: target not reached and no moves remain — settle the run.
      const rule = ruleOf(obs.gameDifficulty.get());
      if (highestTile(next) < rule.targetTile && !hasAnyMove(next)) {
        void finishRun(false);
      }
    },

    async submitSolution(): Promise<void> {
      if (obs.gameStatus.get() !== "dealt" || obs.isSubmitting.get()) return;
      const rule = ruleOf(obs.gameDifficulty.get());
      if (tileAchieved.get() < rule.targetTile) return; // claim only once the target is raised
      obs.isSubmitting.set(true);
      await finishRun(true);
      obs.isSubmitting.set(false);
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
      obs.myTotalWon.set(guestBestTile);
      obs.mySolves.set(runsPlayed);
      obs.myHistory.set([]);
      await refreshLeaderboard();
    },
  };
}
