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
import {
  applyMove,
  createMoveTransition,
  isValidBoard,
  isValidSpawn,
} from "./engine-2048";
import type { MoveTransition } from "./engine-2048";

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

export interface AppliedRunStep {
  run: LiveRun;
  transition: MoveTransition;
}

function foldBoard(initBoard: number[], moves: number[], spawns: TeeSpawn[]): number[] | null {
  if (
    !isValidBoard(initBoard)
    || moves.length !== spawns.length
    || !moves.every((move) => Number.isInteger(move) && move >= 0 && move <= 3)
    || !spawns.every(isValidSpawn)
  ) return null;
  const board = [...initBoard];
  for (let i = 0; i < moves.length; i += 1) {
    const dir = moves[i] ?? -1;
    const spawn = spawns[i];
    if (!spawn || !applyMove(board, dir)) return null;
    if (board[spawn.pos] !== 0) return null;
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
  return applyStepWithTransition(run, dir, spawn, run.moves.length + 1)?.run ?? null;
}

/** Fold a confirmed step and return the exact visual identity map with it. */
export function applyStepWithTransition(
  run: LiveRun,
  dir: number,
  spawn: TeeSpawn,
  sequence: number,
): AppliedRunStep | null {
  const transition = createMoveTransition(run.board, dir, spawn, sequence);
  if (!transition) return null;
  const next: LiveRun = {
    initBoard: run.initBoard,
    moves: [...run.moves, dir],
    spawns: [...run.spawns, { ...spawn }],
    board: [...transition.after],
    maxExp: Math.max(run.maxExp, ...transition.after),
  };
  return { run: next, transition };
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
    if (!isValidBoard(parsed.initBoard) || parsed.initBoard.some((v, i) => v !== initBoard[i])) {
      return startRun(initBoard);
    }
    const moves = parsed.moves as number[];
    const spawns = parsed.spawns as TeeSpawn[];
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
