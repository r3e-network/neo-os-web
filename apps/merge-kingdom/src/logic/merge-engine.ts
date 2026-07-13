/**
 * Client/guest rule twin for the Morpheus Merge Kingdom engine.
 *
 * The reward path remains authoritative: every accepted GameFi move and spawn
 * comes back from the enclave. These pure helpers keep preflight validation,
 * Guest play, animations, and tests aligned with that engine:
 *
 * - only orthogonally adjacent cells can interact;
 * - an occupied tile may reposition into an empty neighbour without a spawn;
 * - equal neighbours merge and only that merge reveals/spawns one 2 or 4;
 * - a board can still progress when it has an immediate merge, or when empty
 *   space lets the player bring any duplicate-valued buildings together.
 */
import { BOARD_SIZE } from "./game-rules";

const MAX_RENDERED_TILE = 4096;

export interface Cell {
  row: number;
  col: number;
}

export type MoveKind = "reposition" | "merge";

export interface SpawnChoice {
  cell: Cell;
  value: 2 | 4;
}

export type SpawnPicker = (empty: readonly Cell[]) => SpawnChoice;

export interface MergeMoveResult {
  board: number[][];
  kind: MoveKind;
  mergedValue: number | null;
  spawn: SpawnChoice | null;
  highestTile: number;
  canContinue: boolean;
}

export function cloneBoard(board: readonly (readonly number[])[]): number[][] {
  return Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, col) => Number(board[row]?.[col] ?? 0)),
  );
}

export function boardFromSessionView(view: unknown): number[][] | null {
  if (!view || typeof view !== "object") return null;
  const record = view as Record<string, unknown>;
  const nested = record.view && typeof record.view === "object"
    ? record.view as Record<string, unknown>
    : null;
  let candidate = (nested?.board ?? record.board) as unknown;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate) as unknown;
    } catch {
      return null;
    }
  }
  if (Array.isArray(candidate) && candidate.length === BOARD_SIZE * BOARD_SIZE) {
    const flat = candidate;
    candidate = Array.from({ length: BOARD_SIZE }, (_, row) =>
      flat.slice(row * BOARD_SIZE, (row + 1) * BOARD_SIZE),
    );
  }
  if (!isValidBoard(candidate)) return null;
  return cloneBoard(candidate);
}

export function isValidBoard(value: unknown): value is number[][] {
  if (!Array.isArray(value) || value.length !== BOARD_SIZE) return false;
  return value.every((row) => (
    Array.isArray(row)
    && row.length === BOARD_SIZE
    && row.every((raw) => {
      if (typeof raw !== "number") return false;
      const tile = raw;
      return Number.isInteger(tile)
        && tile >= 0
        && tile <= MAX_RENDERED_TILE
        && (tile === 0 || (tile & (tile - 1)) === 0);
    })
  ));
}

export function highestTile(board: readonly (readonly number[])[]): number {
  let best = 0;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      best = Math.max(best, Number(board[row]?.[col] ?? 0));
    }
  }
  return best;
}

export function emptyCells(board: readonly (readonly number[])[]): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (Number(board[row]?.[col] ?? 0) === 0) cells.push({ row, col });
    }
  }
  return cells;
}

export function isCellInRange(cell: Cell): boolean {
  return Number.isInteger(cell.row)
    && Number.isInteger(cell.col)
    && cell.row >= 0
    && cell.row < BOARD_SIZE
    && cell.col >= 0
    && cell.col < BOARD_SIZE;
}

export function isOrthogonalAdjacent(from: Cell, to: Cell): boolean {
  if (!isCellInRange(from) || !isCellInRange(to)) return false;
  return Math.abs(from.row - to.row) + Math.abs(from.col - to.col) === 1;
}

export function classifyMove(
  board: readonly (readonly number[])[],
  from: Cell,
  to: Cell,
): MoveKind | null {
  if (!isOrthogonalAdjacent(from, to)) return null;
  const source = Number(board[from.row]?.[from.col] ?? 0);
  const destination = Number(board[to.row]?.[to.col] ?? 0);
  if (source <= 0) return null;
  if (destination === 0) return "reposition";
  return destination === source ? "merge" : null;
}

/**
 * True when the position can still produce a future merge.
 *
 * Empty space alone is not enough: a board of unique buildings can be shuffled
 * forever but can never grow. With empty space, any duplicate pair can be
 * repositioned together; on a full board, an equal pair must already touch.
 */
export function hasMergePotential(board: readonly (readonly number[])[]): boolean {
  const counts = new Map<number, number>();
  let hasEmpty = false;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const value = Number(board[row]?.[col] ?? 0);
      if (value <= 0) {
        hasEmpty = true;
        continue;
      }
      counts.set(value, (counts.get(value) ?? 0) + 1);
      if (col + 1 < BOARD_SIZE && Number(board[row]?.[col + 1] ?? 0) === value) return true;
      if (row + 1 < BOARD_SIZE && Number(board[row + 1]?.[col] ?? 0) === value) return true;
    }
  }

  return hasEmpty && [...counts.values()].some((count) => count >= 2);
}

export function applyMergeMove(
  sourceBoard: readonly (readonly number[])[],
  from: Cell,
  to: Cell,
  pickSpawn?: SpawnPicker,
): MergeMoveResult | null {
  const kind = classifyMove(sourceBoard, from, to);
  if (!kind) return null;

  const board = cloneBoard(sourceBoard);
  const source = board[from.row]?.[from.col] ?? 0;
  board[from.row]![from.col] = 0;
  board[to.row]![to.col] = kind === "merge" ? source * 2 : source;

  let spawn: SpawnChoice | null = null;
  if (kind === "merge" && pickSpawn) {
    const free = emptyCells(board);
    if (free.length > 0) {
      const picked = pickSpawn(free);
      const cell = free.find((candidate) =>
        candidate.row === picked.cell.row && candidate.col === picked.cell.col,
      ) ?? free[0]!;
      const value: 2 | 4 = picked.value === 4 ? 4 : 2;
      board[cell.row]![cell.col] = value;
      spawn = { cell, value };
    }
  }

  return {
    board,
    kind,
    mergedValue: kind === "merge" ? source * 2 : null,
    spawn,
    highestTile: highestTile(board),
    canContinue: hasMergePotential(board),
  };
}
