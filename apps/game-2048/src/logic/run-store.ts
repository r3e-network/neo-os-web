/**
 * Client-side run state for a live 2048 challenge (TEE mode).
 *
 * The enclave owns the spawn stream — the client only ever learns each spawn
 * AFTER committing a move, so the local state is a pure fold over
 * (initialBoard, [move, spawn] pairs) received from the TEE. That whole
 * history persists per game id, letting a reload rebuild the exact board
 * offline while the TEE session itself is rebuilt lazily by replaying the op
 * log. Moves are FINAL — the only rescue is the enclave-recorded undo (30% of
 * the base reward each, three max), which trims the latest pair.
 */
import { applyMove } from "./engine-2048";

/** A single enclave-revealed spawn (position 0..15, exponent) after a move. */
export interface TeeSpawn {
  pos: number;
  exp: number;
}

export interface LiveRun {
  initBoard: number[];
  moves: number[];
  spawns: TeeSpawn[];
  board: number[];
  maxExp: number;
}

function foldBoard(initBoard: number[], moves: number[], spawns: TeeSpawn[]): number[] | null {
  if (initBoard.length !== 16 || moves.length !== spawns.length) return null;
  const board = [...initBoard];
  for (let i = 0; i < moves.length; i += 1) {
    const dir = moves[i] ?? -1;
    const spawn = spawns[i];
    if (!spawn || !applyMove(board, dir)) return null;
    if (spawn.pos < 0 || spawn.pos > 15 || board[spawn.pos] !== 0) return null;
    board[spawn.pos] = spawn.exp;
  }
  return board;
}

export function buildRun(
  initBoard: number[],
  moves: number[],
  spawns: TeeSpawn[],
): LiveRun | null {
  const board = foldBoard(initBoard, moves, spawns);
  if (!board) return null;
  return {
    initBoard: [...initBoard],
    moves: [...moves],
    spawns: spawns.map((s) => ({ ...s })),
    board,
    maxExp: Math.max(...board, ...initBoard),
  };
}

export function startRun(initBoard: number[]): LiveRun | null {
  return buildRun(initBoard, [], []);
}

/** Fold one confirmed (move, spawn) pair from the TEE into the run. */
export function applyStep(run: LiveRun, dir: number, spawn: TeeSpawn): LiveRun | null {
  const board = [...run.board];
  if (!applyMove(board, dir)) return null;
  if (spawn.pos < 0 || spawn.pos > 15 || board[spawn.pos] !== 0) return null;
  board[spawn.pos] = spawn.exp;
  return {
    initBoard: run.initBoard,
    moves: [...run.moves, dir],
    spawns: [...run.spawns, { ...spawn }],
    board,
    maxExp: Math.max(run.maxExp, ...board),
  };
}

/** Trim the latest pair (call only after the TEE confirms the undo). */
export function trimLastMove(run: LiveRun): LiveRun {
  if (run.moves.length === 0) return run;
  return (
    buildRun(run.initBoard, run.moves.slice(0, -1), run.spawns.slice(0, -1)) ?? run
  );
}

/**
 * Persistence handle for the run log. Structurally matches the framework's
 * `app.storage.local` KV (JSON round-trip is owned by the store), so the
 * setup code injects that handle and this module stays pure and testable.
 */
export interface RunStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

const STORAGE_PREFIX = "run:";

interface PersistedRun {
  initBoard?: unknown;
  moves?: unknown;
  spawns?: unknown;
}

export function persistRun(storage: RunStorage, gameId: string, run: LiveRun): void {
  try {
    storage.set(STORAGE_PREFIX + gameId, {
      initBoard: run.initBoard,
      moves: run.moves,
      spawns: run.spawns,
    });
  } catch {
    /* storage full or unavailable — gameplay continues in memory */
  }
}

export function restoreRun(
  storage: RunStorage,
  gameId: string,
  initBoard: number[],
): LiveRun | null {
  try {
    const parsed = storage.get<PersistedRun>(STORAGE_PREFIX + gameId, null);
    if (!parsed) return startRun(initBoard);
    if (
      !Array.isArray(parsed.initBoard) ||
      !Array.isArray(parsed.moves) ||
      !Array.isArray(parsed.spawns)
    ) {
      return startRun(initBoard);
    }
    // The stored run must belong to THIS game's initial board.
    if (
      parsed.initBoard.length !== 16 ||
      parsed.initBoard.some((v, i) => Number(v) !== initBoard[i])
    ) {
      return startRun(initBoard);
    }
    const moves = (parsed.moves as unknown[]).map((m) => Number(m));
    const spawns = (parsed.spawns as unknown[]).map((s) => {
      const spawn = s as { pos?: unknown; exp?: unknown };
      return { pos: Number(spawn.pos), exp: Number(spawn.exp) };
    });
    return buildRun(initBoard, moves, spawns) ?? startRun(initBoard);
  } catch {
    return startRun(initBoard);
  }
}

export function forgetRun(storage: RunStorage, gameId: string): void {
  try {
    storage.delete(STORAGE_PREFIX + gameId);
  } catch {
    /* nothing to clean */
  }
}
