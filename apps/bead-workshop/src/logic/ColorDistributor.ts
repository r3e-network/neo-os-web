import { BEAD_COLORS, BOARD_COLS, BOARD_ROWS, LEVEL_MASK } from "./config";
import type {
  BeadCell,
  GeneratedChunk,
  GeneratedCycle,
  GeneratedLevel,
  Position,
} from "./types";

function normalizedSeed(seed: number): number {
  const value = Number.isFinite(seed) ? Math.floor(seed) >>> 0 : 1;
  return value || 1;
}

function seededRandom(seed: number): () => number {
  let state = normalizedSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [items[index], items[target]] = [items[target] as T, items[index] as T];
  }
  return items;
}

function cloneBoard(board: BeadCell[][]): BeadCell[][] {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function targetColorFor(row: number, col: number, seed: number): number {
  const macroRow = Math.floor(row / 2);
  const macroCol = Math.floor(col / 2);
  return (
    (macroRow * 3 + macroCol * 2 + (seed % BEAD_COLORS.length)) %
    BEAD_COLORS.length
  );
}

function makeSolvedBoard(seed: number): {
  board: BeadCell[][];
  chunks: GeneratedChunk[];
} {
  const chunksById = new Map<string, GeneratedChunk>();
  const board: BeadCell[][] = [];
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    const nextRow: BeadCell[] = [];
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const valid = LEVEL_MASK[row]?.[col] === 1;
      if (!valid) {
        nextRow.push({
          row,
          col,
          valid: false,
          targetColor: -1,
          beadColor: null,
          chunkId: "",
        });
        continue;
      }
      const chunkId = `${Math.floor(row / 2)}:${Math.floor(col / 2)}`;
      const targetColor = targetColorFor(row, col, seed);
      nextRow.push({
        row,
        col,
        valid: true,
        targetColor,
        beadColor: targetColor,
        chunkId,
      });
      const existing = chunksById.get(chunkId);
      if (existing) {
        existing.cells.push({ row, col });
      } else {
        chunksById.set(chunkId, {
          id: chunkId,
          targetColor,
          cells: [{ row, col }],
        });
      }
    }
    board.push(nextRow);
  }
  return { board, chunks: [...chunksById.values()] };
}

function chooseCycles(
  chunks: GeneratedChunk[],
  seed: number,
): GeneratedCycle[] {
  const random = seededRandom(seed ^ 0xa53c9e17);
  const cycles: GeneratedCycle[] = [];
  const sizes = [...new Set(chunks.map((chunk) => chunk.cells.length))].sort(
    (a, b) => b - a,
  );

  for (const size of sizes) {
    const remaining = shuffle(
      chunks
        .filter((chunk) => chunk.cells.length === size)
        .map((chunk) => ({ ...chunk, cells: [...chunk.cells] })),
      random,
    );
    while (remaining.length >= 3) {
      const selected: GeneratedChunk[] = [];
      const colors = new Set<number>();
      for (
        let index = 0;
        index < remaining.length && selected.length < 5;
        index += 1
      ) {
        const chunk = remaining[index];
        if (!chunk || colors.has(chunk.targetColor)) continue;
        selected.push(chunk);
        colors.add(chunk.targetColor);
      }
      if (selected.length < 3) break;
      for (const chunk of selected) {
        const index = remaining.findIndex(
          (candidate) => candidate.id === chunk.id,
        );
        if (index >= 0) remaining.splice(index, 1);
      }
      cycles.push({ chunks: selected });
    }
  }
  return cycles;
}

function scramble(board: BeadCell[][], cycles: GeneratedCycle[]): void {
  for (const cycle of cycles) {
    for (let index = 0; index < cycle.chunks.length; index += 1) {
      const chunk = cycle.chunks[index];
      const next = cycle.chunks[(index + 1) % cycle.chunks.length];
      if (!chunk || !next) continue;
      for (const position of chunk.cells) {
        const cell = board[position.row]?.[position.col];
        if (cell) cell.beadColor = next.targetColor;
      }
    }
  }
}

function positionSet(positions: Position[]): Set<string> {
  return new Set(
    positions.map((position) => `${position.row},${position.col}`),
  );
}

/** Replays the constructive cycle certificate without relying on a heuristic solver. */
export function verifySolutionCertificate(level: GeneratedLevel): boolean {
  const board = cloneBoard(level.board);
  const holding: number[] = [];

  for (const cycle of level.cycles) {
    const first = cycle.chunks[0];
    if (!first) return false;
    const firstCells = positionSet(first.cells);
    for (const position of first.cells) {
      const cell = board[position.row]?.[position.col];
      if (
        !cell ||
        cell.beadColor === null ||
        cell.beadColor === cell.targetColor
      )
        return false;
      holding.push(cell.beadColor);
      cell.beadColor = null;
    }
    if (holding.length > 14 || firstCells.size !== first.cells.length)
      return false;

    for (let index = cycle.chunks.length - 1; index >= 1; index -= 1) {
      const source = cycle.chunks[index];
      const destination = cycle.chunks[(index + 1) % cycle.chunks.length];
      if (
        !source ||
        !destination ||
        source.cells.length !== destination.cells.length
      )
        return false;
      for (let offset = 0; offset < source.cells.length; offset += 1) {
        const from = source.cells[offset];
        const to = destination.cells[offset];
        if (!from || !to) return false;
        const fromCell = board[from.row]?.[from.col];
        const toCell = board[to.row]?.[to.col];
        if (
          !fromCell ||
          !toCell ||
          fromCell.beadColor === null ||
          toCell.beadColor !== null
        )
          return false;
        if (fromCell.beadColor !== toCell.targetColor) return false;
        toCell.beadColor = fromCell.beadColor;
        fromCell.beadColor = null;
      }
    }

    const finalChunk = cycle.chunks[1];
    if (!finalChunk) return false;
    for (const position of finalChunk.cells) {
      const target = board[position.row]?.[position.col];
      const holdingIndex = holding.findIndex(
        (color) => color === target?.targetColor,
      );
      if (!target || target.beadColor !== null || holdingIndex < 0)
        return false;
      target.beadColor = holding.splice(holdingIndex, 1)[0] ?? null;
    }
  }

  if (holding.length !== 0) return false;
  return board.every((row) =>
    row.every((cell) => !cell.valid || cell.beadColor === cell.targetColor),
  );
}

export class ColorDistributor {
  static create(seed: number): GeneratedLevel {
    const safeSeed = normalizedSeed(seed);
    const { board, chunks } = makeSolvedBoard(safeSeed);
    const cycles = chooseCycles(chunks, safeSeed);
    scramble(board, cycles);
    const total = board.flat().filter((cell) => cell.valid).length;
    const level: GeneratedLevel = { seed: safeSeed, board, cycles, total };
    if (!verifySolutionCertificate(level)) {
      throw new Error(
        "Generated bead level failed its constructive solution certificate",
      );
    }
    return level;
  }
}
