/**
 * Client-side board state for a dealt puzzle.
 *
 * Paid challenge rules keep a placed digit final until its sealed undo. Local
 * practice uses the explicit correction/erase helpers below so it behaves like
 * a familiar Sudoku game. Pencil notes are always local. The whole board
 * persists through the framework store per game id so refresh never loses the
 * visible puzzle state.
 */
import { conflictsAt } from "./sudoku-engine";
import { MAX_UNDOS } from "./game-rules";

export interface BoardState {
  /** 81 cells, 0 = empty, 1..9 = digit (givens included). */
  entries: number[];
  /** 81 flags — true for dealt clues (never editable). */
  given: boolean[];
  /** 81 bitmasks — bit v set = pencil note v (1..9). */
  notes: number[];
  /** Indices of player placements, oldest first (undo pops the tail). */
  placedOrder: number[];
}

export type BoardOp =
  | { type: "place"; cell: number; digit: number }
  | { type: "undo" };

export function createBoard(puzzle: string): BoardState {
  const entries: number[] = [];
  const given: boolean[] = [];
  for (let i = 0; i < 81; i += 1) {
    const v = puzzle.charCodeAt(i) - 48;
    entries.push(v >= 1 && v <= 9 ? v : 0);
    given.push(v >= 1 && v <= 9);
  }
  return { entries, given, notes: new Array(81).fill(0), placedOrder: [] };
}

export function canPlace(board: BoardState, index: number): boolean {
  return index >= 0 && index < 81 && !board.given[index] && board.entries[index] === 0;
}

/** Commit a digit. Returns the peer conflicts it creates (may be non-empty — a
 * wrong committed digit is exactly what the paid undo exists for). */
export function placeDigit(board: BoardState, index: number, value: number): {
  board: BoardState;
  conflicts: number[];
} {
  if (!canPlace(board, index) || value < 1 || value > 9) {
    return { board, conflicts: [] };
  }
  const entries = [...board.entries];
  entries[index] = value;
  const notes = [...board.notes];
  notes[index] = 0;
  // A committed digit erases that candidate from every peer's pencil notes.
  const row = Math.floor(index / 9);
  const col = index % 9;
  for (let k = 0; k < 9; k += 1) {
    const peers = [
      row * 9 + k,
      k * 9 + col,
      (Math.floor(row / 3) * 3 + Math.floor(k / 3)) * 9 + Math.floor(col / 3) * 3 + (k % 3),
    ];
    for (const peer of peers) {
      if (peer !== index) notes[peer] = (notes[peer] ?? 0) & ~(1 << value);
    }
  }
  return {
    board: { entries, given: board.given, notes, placedOrder: [...board.placedOrder, index] },
    conflicts: conflictsAt(entries, index, value),
  };
}

/**
 * Local-practice placement. Unlike the paid sealed-op rules, a normal Sudoku
 * player may correct a non-given cell without spending an undo. The current
 * cell remains unique in `placedOrder`, so refresh recovery stays compact and
 * deterministic even after several corrections.
 */
export function setLocalDigit(board: BoardState, index: number, value: number): {
  board: BoardState;
  conflicts: number[];
} {
  if (
    index < 0 || index >= 81 ||
    board.given[index] ||
    value < 1 || value > 9 ||
    !Number.isInteger(value)
  ) {
    return { board, conflicts: [] };
  }
  if (board.entries[index] === value) {
    return { board, conflicts: conflictsAt(board.entries, index, value) };
  }

  const cleared = eraseLocalCell(board, index);
  return placeDigit(cleared, index, value);
}

/** Erase a player digit in local practice; fixed clues remain immutable. */
export function eraseLocalCell(board: BoardState, index: number): BoardState {
  if (
    index < 0 || index >= 81 ||
    board.given[index] ||
    (board.entries[index] ?? 0) === 0
  ) return board;

  const entries = [...board.entries];
  entries[index] = 0;
  return {
    ...board,
    entries,
    placedOrder: board.placedOrder.filter((cell) => cell !== index),
  };
}

export function toggleNote(board: BoardState, index: number, value: number): BoardState {
  if (!canPlace(board, index) || value < 1 || value > 9) return board;
  const notes = [...board.notes];
  notes[index] = (notes[index] ?? 0) ^ (1 << value);
  return { ...board, notes };
}

export function clearNotes(board: BoardState, index: number): BoardState {
  if (index < 0 || index >= 81 || board.notes[index] === 0) return board;
  const notes = [...board.notes];
  notes[index] = 0;
  return { ...board, notes };
}

/** Revert the latest placement (call only after the on-chain undo confirms). */
export function applyUndo(board: BoardState): { board: BoardState; reverted: number | null } {
  if (board.placedOrder.length === 0) return { board, reverted: null };
  const placedOrder = [...board.placedOrder];
  const index = placedOrder.pop() as number;
  const entries = [...board.entries];
  entries[index] = 0;
  return { board: { ...board, entries, placedOrder }, reverted: index };
}

/** Rebuild the authoritative visible board from the persisted sealed-op log. */
export function replayBoardOps(puzzle: string, ops: readonly BoardOp[]): BoardState | null {
  let board = createBoard(puzzle);
  let undos = 0;
  for (const op of ops) {
    if (!op || typeof op !== "object") return null;
    if (op.type === "place") {
      if (
        !Number.isInteger(op.cell) || op.cell < 0 || op.cell >= 81 ||
        !Number.isInteger(op.digit) || op.digit < 1 || op.digit > 9
      ) return null;
      const placed = placeDigit(board, op.cell, op.digit);
      if (placed.board === board) return null;
      board = placed.board;
      continue;
    }
    if (op.type !== "undo") return null;
    undos += 1;
    if (undos > MAX_UNDOS) return null;
    const undone = applyUndo(board);
    if (undone.reverted === null) return null;
    board = undone.board;
  }
  return board;
}

export function emptyCells(board: BoardState): number {
  return board.entries.filter((v) => v === 0).length;
}

/**
 * Persistence handle for the board. Structurally matches the framework's
 * `app.storage.local` KV (JSON round-trip is owned by the store), so the setup
 * code injects that handle once (see main.tsx) and this module stays pure and
 * testable. The app pins `storagePrefix` to "miniapp-sudoku:" in defineMiniApp,
 * so the "board:<gameId>" key below resolves through app.storage.local to the
 * legacy "miniapp-sudoku:board:<gameId>" localStorage key byte-for-byte — an
 * in-progress puzzle stored before the framework migration still restores.
 */
export interface BoardStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

let backend: BoardStorage | null = null;

/** Wire the board store to the framework's local-storage surface (main.tsx). */
export function configureBoardStorage(storage: BoardStorage | null): void {
  backend = storage;
}

const STORAGE_PREFIX = "board:";

export function persistBoard(gameId: string, board: BoardState): void {
  try {
    backend?.set(STORAGE_PREFIX + gameId, board);
  } catch {
    /* storage full or unavailable — gameplay continues in memory */
  }
}

export function restoreBoard(gameId: string, puzzle: string): BoardState {
  try {
    const parsed = backend?.get<BoardState>(STORAGE_PREFIX + gameId, null) ?? null;
    if (!parsed) return createBoard(puzzle);
    if (
      !Array.isArray(parsed.entries) ||
      parsed.entries.length !== 81 ||
      !Array.isArray(parsed.given) ||
      parsed.given.length !== 81 ||
      !Array.isArray(parsed.notes) ||
      parsed.notes.length !== 81 ||
      !Array.isArray(parsed.placedOrder)
    ) {
      return createBoard(puzzle);
    }
    if (
      !parsed.entries.every((value) => Number.isInteger(value) && value >= 0 && value <= 9) ||
      !parsed.given.every((value) => typeof value === "boolean") ||
      !parsed.notes.every((value) => Number.isInteger(value) && value >= 0 && value <= 0x3fe) ||
      !parsed.placedOrder.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < 81) ||
      new Set(parsed.placedOrder).size !== parsed.placedOrder.length
    ) {
      return createBoard(puzzle);
    }
    // The stored board must belong to THIS puzzle — givens are the fingerprint.
    for (let i = 0; i < 81; i += 1) {
      const clue = puzzle.charCodeAt(i) - 48;
      const isGiven = clue >= 1 && clue <= 9;
      if (parsed.given[i] !== isGiven || (isGiven && parsed.entries[i] !== clue)) {
        return createBoard(puzzle);
      }
    }
    const placed = new Set(parsed.placedOrder);
    for (let i = 0; i < 81; i += 1) {
      const playerDigit = !parsed.given[i] && (parsed.entries[i] ?? 0) > 0;
      if (placed.has(i) !== playerDigit) return createBoard(puzzle);
      if ((parsed.entries[i] ?? 0) > 0 && parsed.notes[i] !== 0) return createBoard(puzzle);
    }
    return parsed;
  } catch {
    return createBoard(puzzle);
  }
}

export function forgetBoard(gameId: string): void {
  try {
    backend?.delete(STORAGE_PREFIX + gameId);
  } catch {
    /* nothing to clean */
  }
}
