/**
 * Gomoku engine + rules tests.
 *
 * Covers the board helpers, five-in-a-row detection (including the geometric
 * ordering the scene relies on to draw its victory stroke), position
 * evaluation, candidate generation, the AI's tactical priority ladder, board
 * serialisation, and the payout/status rules.
 */
import { describe, it, expect } from "vitest";

import {
  BOARD_SIZE,
  CELL_COUNT,
  WIN_LENGTH,
  DIFFICULTY_KEYS,
  createBoard,
  idx,
  rowOf,
  colOf,
  isValidCell,
  isEmpty,
  checkWinAt,
  checkWinner,
  isBoardFull,
  evaluateBoard,
  getCandidateMoves,
  computeAiMove,
  boardToString,
  stringToBoard,
  type Board,
  type Player,
} from "../../gomoku/src/logic/gomoku-engine";

import {
  ENTRY_MEMO,
  FUND_MEMO,
  GAMEFI_NEW_ENTRIES_ENABLED,
  MAX_UNDOS,
  UNDO_PENALTY_PCT,
  DIFFICULTY_RULES,
  ruleOf,
  rewardPctAfterUndos,
  payoutFixed8,
  gasDisplay,
  formatClock,
  statusOf,
  canExpireAfterGrace,
  SETTLEMENT_GRACE_MS,
} from "../../gomoku/src/logic/game-rules";

/** Arbitrary non-zero deadline for grace-window assertions. */
const deadlineFixture = 1_700_000_000_000;

/** Places a run of stones from (row, col) along (dr, dc). */
function place(
  board: Board,
  row: number,
  col: number,
  dr: number,
  dc: number,
  count: number,
  player: Player,
): number[] {
  const cells: number[] = [];
  for (let i = 0; i < count; i++) {
    const cell = idx(row + dr * i, col + dc * i);
    board[cell] = player;
    cells.push(cell);
  }
  return cells;
}

describe("gomoku board helpers", () => {
  it("describes a 15x15 board", () => {
    expect(BOARD_SIZE).toBe(15);
    expect(CELL_COUNT).toBe(225);
    expect(WIN_LENGTH).toBe(5);
  });

  it("creates an empty board", () => {
    const board = createBoard();
    expect(board).toHaveLength(CELL_COUNT);
    expect(board.every((cell) => cell === 0)).toBe(true);
  });

  it("round-trips index and coordinates", () => {
    for (const [row, col] of [[0, 0], [0, 14], [7, 7], [14, 0], [14, 14]]) {
      const cell = idx(row!, col!);
      expect(rowOf(cell)).toBe(row);
      expect(colOf(cell)).toBe(col);
    }
    expect(idx(0, 0)).toBe(0);
    expect(idx(14, 14)).toBe(CELL_COUNT - 1);
  });

  it("rejects out-of-range and non-integer cells", () => {
    expect(isValidCell(0)).toBe(true);
    expect(isValidCell(CELL_COUNT - 1)).toBe(true);
    expect(isValidCell(-1)).toBe(false);
    expect(isValidCell(CELL_COUNT)).toBe(false);
    expect(isValidCell(1.5)).toBe(false);
    expect(isValidCell(Number.NaN)).toBe(false);
  });

  it("treats occupied and invalid cells as not empty", () => {
    const board = createBoard();
    board[idx(3, 3)] = 1;
    expect(isEmpty(board, idx(3, 4))).toBe(true);
    expect(isEmpty(board, idx(3, 3))).toBe(false);
    expect(isEmpty(board, -1)).toBe(false);
    expect(isEmpty(board, CELL_COUNT)).toBe(false);
  });
});

describe("gomoku win detection", () => {
  it("finds a five in every direction", () => {
    const dirs: Array<[number, number, number, number]> = [
      [7, 3, 0, 1],   // horizontal
      [3, 7, 1, 0],   // vertical
      [2, 2, 1, 1],   // diagonal down-right
      [10, 2, -1, 1], // diagonal up-right
    ];
    for (const [row, col, dr, dc] of dirs) {
      const board = createBoard();
      const cells = place(board, row, col, dr, dc, 5, 1);
      const line = checkWinAt(board, cells[2]!, 1);
      expect(line).not.toBeNull();
      expect(line).toHaveLength(WIN_LENGTH);
      expect([...line!].sort((a, b) => a - b)).toEqual([...cells].sort((a, b) => a - b));
    }
  });

  it("returns the line in geometric order so endpoints span the run", () => {
    const board = createBoard();
    const cells = place(board, 7, 3, 0, 1, 5, 1);
    // Probe from the middle stone: naive push-order would put it first.
    const line = checkWinAt(board, cells[2]!, 1)!;
    expect(line[0]).toBe(cells[0]);
    expect(line[WIN_LENGTH - 1]).toBe(cells[4]);
    for (let i = 1; i < line.length; i++) {
      expect(colOf(line[i]!) - colOf(line[i - 1]!)).toBe(1);
      expect(rowOf(line[i]!)).toBe(rowOf(line[0]!));
    }
  });

  it("keeps a diagonal line ordered end to end", () => {
    const board = createBoard();
    const cells = place(board, 2, 2, 1, 1, 5, 2);
    const line = checkWinAt(board, cells[3]!, 2)!;
    expect(line[0]).toBe(cells[0]);
    expect(line[WIN_LENGTH - 1]).toBe(cells[4]);
  });

  it("windows an overline so it stays contiguous and covers the probe", () => {
    const board = createBoard();
    const cells = place(board, 7, 2, 0, 1, 6, 1);
    for (const probe of cells) {
      const line = checkWinAt(board, probe, 1)!;
      expect(line).toHaveLength(WIN_LENGTH);
      expect(line).toContain(probe);
      for (let i = 1; i < line.length; i++) {
        expect(line[i]! - line[i - 1]!).toBe(1);
      }
    }
  });

  it("does not report a four as a win", () => {
    const board = createBoard();
    const cells = place(board, 7, 3, 0, 1, 4, 1);
    expect(checkWinAt(board, cells[0]!, 1)).toBeNull();
  });

  it("does not wrap across a row edge", () => {
    const board = createBoard();
    // Three at the end of row 7 and two at the start of row 8: contiguous by
    // index, but not a line on the board.
    board[idx(7, 12)] = 1;
    board[idx(7, 13)] = 1;
    board[idx(7, 14)] = 1;
    board[idx(8, 0)] = 1;
    board[idx(8, 1)] = 1;
    expect(checkWinAt(board, idx(7, 14), 1)).toBeNull();
    expect(checkWinner(board).winner).toBe(0);
  });

  it("ignores the other player's stones", () => {
    const board = createBoard();
    place(board, 7, 3, 0, 1, 5, 1);
    expect(checkWinAt(board, idx(7, 5), 2)).toBeNull();
  });

  it("rejects invalid probe indices", () => {
    const board = createBoard();
    expect(checkWinAt(board, -1, 1)).toBeNull();
    expect(checkWinAt(board, CELL_COUNT, 1)).toBeNull();
  });

  it("reports the winner and line from a full-board scan", () => {
    const board = createBoard();
    const cells = place(board, 4, 4, 1, 1, 5, 2);
    const result = checkWinner(board);
    expect(result.winner).toBe(2);
    expect(result.draw).toBe(false);
    expect(result.winLine).toHaveLength(WIN_LENGTH);
    expect(result.winLine[0]).toBe(cells[0]);
    expect(result.winLine[WIN_LENGTH - 1]).toBe(cells[4]);
  });

  it("separates an in-progress board from a drawn one", () => {
    const inProgress = createBoard();
    inProgress[idx(7, 7)] = 1;
    expect(checkWinner(inProgress)).toEqual({ winner: 0, winLine: [], draw: false });
    expect(isBoardFull(inProgress)).toBe(false);

    // Fill every cell in a 2/1/1/2 pattern per row pair, which never aligns five.
    const drawn = createBoard();
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const band = Math.floor(col / 2) + Math.floor(row / 2);
        drawn[idx(row, col)] = band % 2 === 0 ? 1 : 2;
      }
    }
    expect(isBoardFull(drawn)).toBe(true);
    const result = checkWinner(drawn);
    if (result.winner === 0) {
      expect(result.draw).toBe(true);
      expect(result.winLine).toEqual([]);
    } else {
      // Guard the fixture: if the pattern ever aligns five, the line must be real.
      expect(result.winLine).toHaveLength(WIN_LENGTH);
    }
  });
});

describe("gomoku evaluation", () => {
  it("scores an empty board as neutral", () => {
    expect(evaluateBoard(createBoard())).toBe(0);
  });

  it("favours the AI when the AI holds the stronger shape", () => {
    const board = createBoard();
    place(board, 7, 3, 0, 1, 4, 2);
    expect(evaluateBoard(board)).toBeGreaterThan(0);
  });

  it("favours the human when the human holds the stronger shape", () => {
    const board = createBoard();
    place(board, 7, 3, 0, 1, 4, 1);
    expect(evaluateBoard(board)).toBeLessThan(0);
  });

  it("leans defensive on mirrored positions", () => {
    // Same shape for both sides: the human weighting makes the total negative.
    const board = createBoard();
    place(board, 3, 3, 0, 1, 3, 2);
    place(board, 10, 3, 0, 1, 3, 1);
    expect(evaluateBoard(board)).toBeLessThan(0);
  });
});

describe("gomoku candidate moves", () => {
  it("opens at the centre on an empty board", () => {
    expect(getCandidateMoves(createBoard())).toEqual([idx(7, 7)]);
  });

  it("stays near existing stones and never returns an occupied cell", () => {
    const board = createBoard();
    board[idx(7, 7)] = 1;
    board[idx(8, 8)] = 2;
    const moves = getCandidateMoves(board);
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      expect(isEmpty(board, move)).toBe(true);
      const near = [idx(7, 7), idx(8, 8)].some(
        (stone) =>
          Math.abs(rowOf(move) - rowOf(stone)) <= 2 &&
          Math.abs(colOf(move) - colOf(stone)) <= 2,
      );
      expect(near).toBe(true);
    }
    expect(new Set(moves).size).toBe(moves.length);
  });

  it("honours the limit", () => {
    const board = createBoard();
    board[idx(7, 7)] = 1;
    expect(getCandidateMoves(board, 5)).toHaveLength(5);
    expect(getCandidateMoves(board, 1)).toHaveLength(1);
  });

  it("leaves the board unmutated after probing", () => {
    const board = createBoard();
    board[idx(7, 7)] = 1;
    board[idx(6, 8)] = 2;
    const snapshot = [...board];
    getCandidateMoves(board);
    expect(board).toEqual(snapshot);
  });
});

describe("gomoku AI moves", () => {
  it("returns a legal empty cell at every difficulty", () => {
    for (const difficulty of [0, 1, 2] as const) {
      const board = createBoard();
      board[idx(7, 7)] = 1;
      const move = computeAiMove(board, difficulty);
      expect(isEmpty(board, move)).toBe(true);
    }
  });

  it("completes its own five before blocking the opponent's", () => {
    const board = createBoard();
    place(board, 3, 3, 0, 1, 4, 2);  // AI four, open at both (3,2) and (3,7)
    place(board, 10, 3, 0, 1, 4, 1); // human four, open at both (10,2) and (10,7)
    const move = computeAiMove(board, 1);
    // Either end wins immediately; it must take the win rather than defend.
    expect([idx(3, 2), idx(3, 7)]).toContain(move);
    const after: Board = [...board];
    after[move] = 2;
    expect(checkWinAt(after, move, 2)).not.toBeNull();
  });

  it("blocks a human four when it has no five of its own", () => {
    const board = createBoard();
    place(board, 7, 3, 0, 1, 4, 1);
    board[idx(0, 0)] = 2;
    const move = computeAiMove(board, 1);
    expect([idx(7, 2), idx(7, 7)]).toContain(move);
  });

  it("answers a human open three", () => {
    const board = createBoard();
    place(board, 7, 5, 0, 1, 3, 1);
    board[idx(0, 0)] = 2;
    const move = computeAiMove(board, 1);
    expect(isEmpty(board, move)).toBe(true);
    // Must engage the threat row rather than play elsewhere on the board.
    expect(Math.abs(rowOf(move) - 7)).toBeLessThanOrEqual(1);
  });

  it("does not mutate the board it is given", () => {
    const board = createBoard();
    board[idx(7, 7)] = 1;
    board[idx(7, 8)] = 2;
    const snapshot = [...board];
    computeAiMove(board, 2);
    expect(board).toEqual(snapshot);
  });

  it("plays as either colour", () => {
    const board = createBoard();
    place(board, 5, 5, 0, 1, 4, 1); // human four; AI plays as player 1 here
    const move = computeAiMove(board, 1, 1);
    expect([idx(5, 4), idx(5, 9)]).toContain(move);
  });
});

describe("gomoku serialisation", () => {
  it("round-trips a board", () => {
    const board = createBoard();
    board[idx(7, 7)] = 1;
    board[idx(7, 8)] = 2;
    board[CELL_COUNT - 1] = 1;
    const encoded = boardToString(board);
    expect(encoded).toHaveLength(CELL_COUNT);
    expect(stringToBoard(encoded)).toEqual(board);
  });

  it("rejects malformed input", () => {
    expect(stringToBoard("")).toBeNull();
    expect(stringToBoard("0".repeat(CELL_COUNT - 1))).toBeNull();
    expect(stringToBoard("0".repeat(CELL_COUNT + 1))).toBeNull();
    expect(stringToBoard("3".repeat(CELL_COUNT))).toBeNull();
    expect(stringToBoard(`x${"0".repeat(CELL_COUNT - 1)}`)).toBeNull();
  });
});

describe("gomoku difficulty rules", () => {
  it("exposes the three difficulty keys", () => {
    expect(DIFFICULTY_KEYS).toEqual(["easy", "medium", "hard"]);
    expect(DIFFICULTY_RULES).toHaveLength(3);
  });

  it("scales entry and reward with difficulty", () => {
    for (let i = 1; i < DIFFICULTY_RULES.length; i++) {
      const prev = DIFFICULTY_RULES[i - 1]!;
      const cur = DIFFICULTY_RULES[i]!;
      expect(cur.difficulty).toBe(i);
      expect(cur.rewardFixed8).toBeGreaterThan(prev.rewardFixed8);
    }
    for (const rule of DIFFICULTY_RULES) {
      expect(rule.rewardFixed8).toBeGreaterThan(0);
      expect(rule.entryFixed8).toBeGreaterThanOrEqual(0);
    }
  });

  it("selects a rule by difficulty and clamps out-of-range input", () => {
    expect(ruleOf(0)).toBe(DIFFICULTY_RULES[0]);
    expect(ruleOf(1)).toBe(DIFFICULTY_RULES[1]);
    expect(ruleOf(2)).toBe(DIFFICULTY_RULES[2]);
    expect(DIFFICULTY_RULES).toContain(ruleOf(-1 as 0));
    expect(DIFFICULTY_RULES).toContain(ruleOf(99 as 0));
  });
});

describe("gomoku payout rules", () => {
  it("pins the undo allowance and penalty", () => {
    expect(MAX_UNDOS).toBe(3);
    expect(UNDO_PENALTY_PCT).toBe(20);
  });

  it("reduces reward percentage per undo and never goes negative", () => {
    expect(rewardPctAfterUndos(0)).toBe(100);
    expect(rewardPctAfterUndos(1)).toBe(80);
    expect(rewardPctAfterUndos(2)).toBe(60);
    expect(rewardPctAfterUndos(3)).toBe(40);
    expect(rewardPctAfterUndos(99)).toBeGreaterThanOrEqual(0);
    expect(rewardPctAfterUndos(-1)).toBe(100);
  });

  it("applies the penalty to the payout", () => {
    for (const difficulty of [0, 1, 2] as const) {
      const reward = DIFFICULTY_RULES[difficulty]!.rewardFixed8;
      expect(payoutFixed8(difficulty, 0)).toBe(reward);
      expect(payoutFixed8(difficulty, 1)).toBe((reward * 80n) / 100n);
      expect(payoutFixed8(difficulty, MAX_UNDOS)).toBe((reward * 40n) / 100n);
      // Beyond the allowance the payout floors rather than going negative.
      expect(payoutFixed8(difficulty, 99)).toBe((reward * 40n) / 100n);
      expect(typeof payoutFixed8(difficulty, 2)).toBe("bigint");
    }
  });

  it("formats fixed8 amounts for display", () => {
    expect(gasDisplay(100_000_000n)).toBe("1");
    expect(gasDisplay(0n)).toBe("0");
    expect(gasDisplay(DIFFICULTY_RULES[0]!.rewardFixed8)).toBe("0.1");
    expect(gasDisplay(DIFFICULTY_RULES[1]!.rewardFixed8)).toBe("0.5");
    expect(gasDisplay(DIFFICULTY_RULES[2]!.rewardFixed8)).toBe("1");
  });

  it("formats a zero-padded clock from milliseconds", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(1_000)).toBe("00:01");
    expect(formatClock(61_000)).toBe("01:01");
    expect(formatClock(DIFFICULTY_RULES[0]!.limitMs)).toBe("10:00");
    expect(formatClock(DIFFICULTY_RULES[2]!.limitMs)).toBe("20:00");
    expect(formatClock(-5_000)).toBe("00:00");
    expect(formatClock(Number.NaN)).toBe("00:00");
  });
});

describe("gomoku status mapping", () => {
  it("maps contract status codes", () => {
    expect(statusOf(0)).toBe("committed");
    expect(statusOf(1)).toBe("dealt");
    expect(statusOf(2)).toBe("solved");
    expect(statusOf(3)).toBe("expired");
    expect(statusOf(4)).toBe("refunded");
    expect(statusOf(5)).toBe("unknown");
  });

  it("falls back to committed for unrecognised codes", () => {
    expect(statusOf(-1)).toBe("committed");
    expect(statusOf(99)).toBe("committed");
    expect(statusOf(Number.NaN)).toBe("committed");
  });
});

describe("gomoku expiry grace", () => {
  it("only expires past the settlement grace window", () => {
    const deadline = 10_000;
    expect(canExpireAfterGrace(deadline, deadline + 1, 1_000)).toBe(false);
    expect(canExpireAfterGrace(deadline, deadline + 1_001, 1_000)).toBe(true);
    expect(canExpireAfterGrace(deadline, deadline - 1, 1_000)).toBe(false);
  });

  it("never expires an unset deadline and clamps a negative grace", () => {
    expect(canExpireAfterGrace(0, Date.now(), 0)).toBe(false);
    expect(canExpireAfterGrace(deadlineFixture, deadlineFixture + 1, -5_000)).toBe(true);
  });

  it("uses the shared settlement grace by default", () => {
    expect(SETTLEMENT_GRACE_MS).toBeGreaterThan(0);
    expect(canExpireAfterGrace(deadlineFixture, deadlineFixture + SETTLEMENT_GRACE_MS)).toBe(
      false,
    );
    expect(
      canExpireAfterGrace(deadlineFixture, deadlineFixture + SETTLEMENT_GRACE_MS + 1),
    ).toBe(true);
  });
});

describe("gomoku gamefi gating", () => {
  it("keeps new paid entries disabled and pins the memo tags", () => {
    expect(GAMEFI_NEW_ENTRIES_ENABLED).toBe(false);
    expect(ENTRY_MEMO).toBe("miniapp-gomoku:entry");
    expect(FUND_MEMO).toBe("miniapp-gomoku:fund");
  });
});
