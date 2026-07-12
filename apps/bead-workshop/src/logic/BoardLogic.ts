import { BOARD_COLS, BOARD_ROWS } from "./config";
import type { BeadCell, Position } from "./types";

const DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

function positionKey(row: number, col: number): string {
  return `${row},${col}`;
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
}

export class BoardLogic {
  /** Actual reference rule: region equality is bean colour AND target colour. */
  static connectedMovableRegion(
    board: BeadCell[][],
    row: number,
    col: number,
  ): Position[] {
    const start = board[row]?.[col];
    if (
      !start?.valid ||
      start.beadColor === null ||
      start.beadColor === start.targetColor
    ) {
      return [];
    }
    const beanColor = start.beadColor;
    const targetColor = start.targetColor;
    return this.flood(
      board,
      row,
      col,
      (cell) =>
        cell.valid &&
        cell.beadColor === beanColor &&
        cell.targetColor === targetColor,
    );
  }

  static connectedEmptyTargets(
    board: BeadCell[][],
    row: number,
    col: number,
    color: number,
  ): Position[] {
    const start = board[row]?.[col];
    if (
      !start?.valid ||
      start.targetColor !== color ||
      start.beadColor !== null
    )
      return [];
    return this.flood(
      board,
      row,
      col,
      (cell) =>
        cell.valid && cell.targetColor === color && cell.beadColor === null,
    );
  }

  static movableRegions(board: BeadCell[][]): Position[][] {
    const visited = new Set<string>();
    const regions: Position[][] = [];
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const key = positionKey(row, col);
        if (visited.has(key)) continue;
        const region = this.connectedMovableRegion(board, row, col);
        for (const cell of region) visited.add(positionKey(cell.row, cell.col));
        if (region.length > 0) regions.push(region);
      }
    }
    return regions;
  }

  static emptyTargetRegions(board: BeadCell[][], color?: number): Position[][] {
    const visited = new Set<string>();
    const regions: Position[][] = [];
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const cell = board[row]?.[col];
        if (!cell?.valid || cell.beadColor !== null) continue;
        if (color !== undefined && cell.targetColor !== color) continue;
        const key = positionKey(row, col);
        if (visited.has(key)) continue;
        const region = this.connectedEmptyTargets(
          board,
          row,
          col,
          cell.targetColor,
        );
        for (const pos of region) visited.add(positionKey(pos.row, pos.col));
        if (region.length > 0) regions.push(region);
      }
    }
    return regions;
  }

  private static flood(
    board: BeadCell[][],
    startRow: number,
    startCol: number,
    accepts: (cell: BeadCell) => boolean,
  ): Position[] {
    const queue: Position[] = [{ row: startRow, col: startCol }];
    const seen = new Set<string>();
    const region: Position[] = [];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (!current) continue;
      const key = positionKey(current.row, current.col);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!inBounds(current.row, current.col)) continue;
      const cell = board[current.row]?.[current.col];
      if (!cell || !accepts(cell)) continue;
      region.push(current);
      for (const [dr, dc] of DIRECTIONS) {
        queue.push({ row: current.row + dr, col: current.col + dc });
      }
    }
    return region;
  }
}
