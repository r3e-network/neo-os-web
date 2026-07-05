/**
 * Client-side board state for a dealt puzzle.
 *
 * Challenge rules (mirrored by the contract's economics): a placed digit is
 * FINAL — the only rescue is the on-chain undo, which reverts the latest
 * placement and burns 30% of the base reward (three max). Pencil notes are
 * free and local. The whole board persists to localStorage per game id so a
 * refresh or wallet round-trip never loses progress.
 */
import { conflictsAt } from "./sudoku-engine";

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

export function emptyCells(board: BoardState): number {
  return board.entries.filter((v) => v === 0).length;
}

const STORAGE_PREFIX = "miniapp-sudoku:board:";

export function persistBoard(gameId: string, board: BoardState): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + gameId, JSON.stringify(board));
  } catch {
    /* storage full or unavailable — gameplay continues in memory */
  }
}

export function restoreBoard(gameId: string, puzzle: string): BoardState {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + gameId);
    if (!raw) return createBoard(puzzle);
    const parsed = JSON.parse(raw) as BoardState;
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
    // The stored board must belong to THIS puzzle — givens are the fingerprint.
    for (let i = 0; i < 81; i += 1) {
      const clue = puzzle.charCodeAt(i) - 48;
      const isGiven = clue >= 1 && clue <= 9;
      if (parsed.given[i] !== isGiven || (isGiven && parsed.entries[i] !== clue)) {
        return createBoard(puzzle);
      }
    }
    return parsed;
  } catch {
    return createBoard(puzzle);
  }
}

export function forgetBoard(gameId: string): void {
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + gameId);
  } catch {
    /* nothing to clean */
  }
}
