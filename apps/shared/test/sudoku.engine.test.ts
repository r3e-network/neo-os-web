import { describe, expect, it } from "vitest";

import {
  boardToSolutionString,
  conflictsAt,
  dealPuzzle,
  deriveSolution,
  hexToBytes,
  isBoardComplete,
} from "../../sudoku/src/logic/sudoku-engine";
import { BASE_GRID, MASKS } from "../../sudoku/src/logic/sudoku-data";
import {
  applyUndo,
  configureBoardStorage,
  createBoard,
  eraseLocalCell,
  placeDigit,
  replayBoardOps,
  restoreBoard,
  setLocalDigit,
  toggleNote,
} from "../../sudoku/src/logic/board-store";
import type { BoardOp, BoardState, BoardStorage } from "../../sudoku/src/logic/board-store";
import {
  GAMEFI_NEW_ENTRIES_ENABLED,
  canExpireAfterGrace,
} from "../../sudoku/src/logic/game-rules";

// board-store persists through the framework's app.storage.local surface. The
// app pins storagePrefix to "miniapp-sudoku:", so a "board:<gameId>" key
// resolves to the legacy "miniapp-sudoku:board:<gameId>" localStorage key —
// mirror that binding here so restore reads the exact key the test writes.
const boardStorage: BoardStorage = {
  get<T>(key: string, fallback: T | null = null): T | null {
    const raw = window.localStorage.getItem(`miniapp-sudoku:${key}`);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    window.localStorage.setItem(`miniapp-sudoku:${key}`, JSON.stringify(value));
  },
  delete(key: string): void {
    window.localStorage.removeItem(`miniapp-sudoku:${key}`);
  },
};
configureBoardStorage(boardStorage);

/**
 * GOLDEN VECTORS — shared with contracts/__tests__/MiniAppSudokuTests.cs.
 *
 * They pin the seed->solution derivation to one byte stream on both sides of
 * the trust boundary: the contract verifies submissions against ITS
 * DeriveSolution while this client renders the puzzle from the SAME seed, so
 * any drift between the two implementations is a fund-affecting bug. Never
 * regenerate these without regenerating both test suites.
 */
const GOLDEN_VECTORS = [
  {
    seedHex: "c5bc633d764c1b0e9e5d4ec75598810d199316b596ac5d092126f49bb3b65112",
    solution: "674251839531897426928643157716439285253786941489512673345168792192374568867925314",
  },
  {
    seedHex: "8bd3b0ef4b5a738e6b4ffd46ca55357aeca24236f7f832e380e5f3588c5d6b27",
    solution: "397485162246317589518962734682541397935728416174639258853294671721856943469173825",
  },
  {
    seedHex: "bd7df71f76613b270d52dd4ac2b34a99c1df729a30b766e0639e0a93764667fa",
    solution: "628731459394856127517429683481563792763982514259174836976318245132645978845297361",
  },
  {
    seedHex: "ca11ed69c0b6fada5818df40ef469340749e5e6d0d53dfe9c8a368c0387e7d0b",
    solution: "142839657378564192956172438635417829427398516819625374283941765591786243764253981",
  },
  {
    seedHex: "f3f5a9528b90ef8b2c3af9aafa61013987ec814c667e285439c8eba7e350df91",
    solution: "875291364394678251612534879187459623453726918269183745531967482926845137748312596",
  },
  {
    seedHex: "0292ea30b271464bf4485540c3789e0c9561768ed6101bf3eaf88cd42d4e82f8",
    solution: "752189346631475298489326751814763925963852417275914863128597634397641582546238179",
  },
  {
    seedHex: "d2392a79aac38568ba04c577e61d5025f65981c41f1eee3724051f2a0525c60a",
    solution: "569318247431627985782945163295176438678493512143852679354281796926734851817569324",
  },
  {
    seedHex: "6e8d11eecedfb1c8c4a2ec9d2708fed30889bbbdc97df4e641adf75945517309",
    solution: "391582674842967351567431298435296817186374529279815463723649185958123746614758932",
  },
  {
    seedHex: "e92c693b7f4146da37146e2d40c996b1f3ff534df205664e4b00ce8d1f044576",
    solution: "768934512541862397239715684327648951485129736196573248652491873813257469974386125",
  },
  {
    seedHex: "219e717ba34bb6308a16fa6656402f2ec6eb86349572a01cdbcb713a997ea66c",
    solution: "617392584952418376438657912146839725729561843583724691374286159295173468861945237",
  },
  {
    seedHex: "00a797c8ec4d791eb779b40bdb581bcf1b391bc66d479203746d93c9552918d0",
    solution: "516938472423716985879254136165842793238179564947563821352497618784621359691385247",
  },
  {
    seedHex: "b892846029241d2a512b2110cbe12620914eeaab0964fbc3bfbafcb8a0edbcfd",
    solution: "256891347873452691194673852361249785729518463485367129642735918938124576517986234",
  },
];

/** Count solutions of a puzzle (up to `limit`) — offline uniqueness auditor. */
function countSolutions(puzzle: string, limit = 2): number {
  const cells = Array.from(puzzle, (ch) => ch.charCodeAt(0) - 48).map((v) =>
    v >= 1 && v <= 9 ? v : 0,
  );
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i += 1) {
    const v = cells[i];
    if (v === 0) continue;
    const r = Math.floor(i / 9);
    const c = i % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    const bit = 1 << v;
    if (rows[r] & bit || cols[c] & bit || boxes[b] & bit) return 0;
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[b] |= bit;
  }
  let count = 0;
  const dfs = (): void => {
    if (count >= limit) return;
    let best = -1;
    let bestN = 10;
    for (let i = 0; i < 81; i += 1) {
      if (cells[i] !== 0) continue;
      const r = Math.floor(i / 9);
      const c = i % 9;
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const used = rows[r] | cols[c] | boxes[b];
      let n = 0;
      for (let v = 1; v <= 9; v += 1) if (!(used & (1 << v))) n += 1;
      if (n === 0) return;
      if (n < bestN) {
        bestN = n;
        best = i;
        if (n === 1) break;
      }
    }
    if (best === -1) {
      count += 1;
      return;
    }
    const r = Math.floor(best / 9);
    const c = best % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    for (let v = 1; v <= 9; v += 1) {
      const bit = 1 << v;
      if ((rows[r] | cols[c] | boxes[b]) & bit) continue;
      cells[best] = v;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      dfs();
      cells[best] = 0;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
      if (count >= limit) return;
    }
  };
  dfs();
  return count;
}

describe("sudoku deterministic engine", () => {
  it("keeps new paid starts fail-closed while historical expiry stays grace-safe", () => {
    expect(GAMEFI_NEW_ENTRIES_ENABLED).toBe(false);
    expect(canExpireAfterGrace(1_000, 601_000, 600_000)).toBe(false);
    expect(canExpireAfterGrace(1_000, 601_001, 600_000)).toBe(true);
  });

  it("reproduces every golden vector (contract parity)", () => {
    for (const vector of GOLDEN_VECTORS) {
      expect(deriveSolution(hexToBytes(vector.seedHex))).toBe(vector.solution);
    }
  });

  it("derives valid, complete grids", () => {
    for (const vector of GOLDEN_VECTORS) {
      const digits = Array.from(vector.solution, (ch) => ch.charCodeAt(0) - 48);
      expect(isBoardComplete(digits)).toBe(true);
    }
  });

  it("keeps the base grid and every mask well-formed", () => {
    expect(BASE_GRID).toMatch(/^[1-9]{81}$/);
    expect(isBoardComplete(Array.from(BASE_GRID, (ch) => ch.charCodeAt(0) - 48))).toBe(true);
    for (const key of ["easy", "medium", "hard"] as const) {
      expect(MASKS[key].length).toBeGreaterThanOrEqual(10);
      for (const mask of MASKS[key]) {
        expect(mask).toMatch(/^[01]{81}$/);
      }
    }
  });

  it("proves every shipped clue mask has exactly one solution", () => {
    const expectedClues = {
      easy: { min: 40, max: 40 },
      medium: { min: 32, max: 32 },
      hard: { min: 26, max: 28 },
    } as const;
    for (const key of ["easy", "medium", "hard"] as const) {
      for (const mask of MASKS[key]) {
        const puzzle = Array.from(mask, (visible, cell) =>
          visible === "1" ? BASE_GRID[cell] : "0",
        ).join("");
        const clues = Array.from(mask).filter((visible) => visible === "1").length;
        expect(clues).toBeGreaterThanOrEqual(expectedClues[key].min);
        expect(clues).toBeLessThanOrEqual(expectedClues[key].max);
        expect(countSolutions(puzzle), `${key} mask must stay unique`).toBe(1);
      }
    }
  });

  it("deals puzzles whose clues agree with the solution and stay uniquely solvable", () => {
    for (const vector of GOLDEN_VECTORS.slice(0, 3)) {
      for (const difficulty of [0, 1, 2] as const) {
        const dealt = dealPuzzle(hexToBytes(vector.seedHex), difficulty);
        expect(dealt.solution).toBe(vector.solution);
        let clues = 0;
        for (let i = 0; i < 81; i += 1) {
          const p = dealt.puzzle[i];
          if (p !== "0") {
            expect(p).toBe(dealt.solution[i]);
            clues += 1;
          }
        }
        expect(clues).toBe(dealt.clues);
        // The transform preserves the offline uniqueness proof of the mask.
        expect(countSolutions(dealt.puzzle)).toBe(1);
      }
    }
  });

  it("orders difficulties by clue count", () => {
    const seed = hexToBytes(GOLDEN_VECTORS[0].seedHex);
    const easy = dealPuzzle(seed, 0);
    const medium = dealPuzzle(seed, 1);
    const hard = dealPuzzle(seed, 2);
    expect(easy.clues).toBeGreaterThan(medium.clues);
    expect(medium.clues).toBeGreaterThan(hard.clues);
  });

  it("flags row, column, and box conflicts", () => {
    const entries = new Array(81).fill(0);
    entries[0] = 5; // r0c0
    expect(conflictsAt(entries, 8, 5)).toContain(0); // same row
    expect(conflictsAt(entries, 72, 5)).toContain(0); // same column
    expect(conflictsAt(entries, 10, 5)).toContain(0); // same box
    expect(conflictsAt(entries, 40, 5)).toEqual([]); // unrelated cell
  });
});

describe("sudoku board store (challenge rules)", () => {
  const puzzle = dealPuzzle(hexToBytes(GOLDEN_VECTORS[0].seedHex), 0);

  function firstEmpty(p: string): number {
    return p.indexOf("0");
  }

  it("locks placed digits — a second placement on the cell is rejected", () => {
    const board = createBoard(puzzle.puzzle);
    const cell = firstEmpty(puzzle.puzzle);
    const placed = placeDigit(board, cell, 5);
    expect(placed.board.entries[cell]).toBe(5);
    const again = placeDigit(placed.board, cell, 7);
    expect(again.board.entries[cell]).toBe(5); // unchanged — placements are final
  });

  it("lets local practice correct and erase player digits without editing clues", () => {
    const board = createBoard(puzzle.puzzle);
    const cell = firstEmpty(puzzle.puzzle);
    const corrected = setLocalDigit(setLocalDigit(board, cell, 5).board, cell, 7).board;
    expect(corrected.entries[cell]).toBe(7);
    expect(corrected.placedOrder).toEqual([cell]);

    const erased = eraseLocalCell(corrected, cell);
    expect(erased.entries[cell]).toBe(0);
    expect(erased.placedOrder).toEqual([]);

    const givenIdx = puzzle.puzzle.split("").findIndex((ch) => ch !== "0");
    expect(eraseLocalCell(board, givenIdx)).toBe(board);
  });

  it("never edits given clues", () => {
    const board = createBoard(puzzle.puzzle);
    const givenIdx = puzzle.puzzle.split("").findIndex((ch) => ch !== "0");
    const placed = placeDigit(board, givenIdx, 9);
    expect(placed.board.entries[givenIdx]).toBe(puzzle.puzzle.charCodeAt(givenIdx) - 48);
  });

  it("supports free pencil notes and clears peers on placement", () => {
    let board = createBoard(puzzle.puzzle);
    const cell = firstEmpty(puzzle.puzzle);
    board = toggleNote(board, cell, 3);
    expect((board.notes[cell] >> 3) & 1).toBe(1);
    board = toggleNote(board, cell, 3);
    expect((board.notes[cell] >> 3) & 1).toBe(0);
    // note on a row peer disappears when the digit lands in the row
    const row = Math.floor(cell / 9);
    let peer = -1;
    for (let c = 0; c < 9; c += 1) {
      const idx = row * 9 + c;
      if (idx !== cell && puzzle.puzzle[idx] === "0") {
        peer = idx;
        break;
      }
    }
    expect(peer).toBeGreaterThanOrEqual(0);
    board = toggleNote(board, peer, 4);
    const placed = placeDigit(board, cell, 4);
    expect((placed.board.notes[peer] >> 4) & 1).toBe(0);
  });

  it("undo reverts exactly the latest placement", () => {
    let board = createBoard(puzzle.puzzle);
    const empties = puzzle.puzzle
      .split("")
      .map((ch, i) => (ch === "0" ? i : -1))
      .filter((i) => i >= 0)
      .slice(0, 2);
    board = placeDigit(board, empties[0], 1).board;
    board = placeDigit(board, empties[1], 2).board;
    const undone = applyUndo(board);
    expect(undone.reverted).toBe(empties[1]);
    expect(undone.board.entries[empties[1]]).toBe(0);
    expect(undone.board.entries[empties[0]]).toBe(1);
  });

  it("rebuilds the visible board from the sealed operation log", () => {
    const empties = puzzle.puzzle
      .split("")
      .map((digit, index) => (digit === "0" ? index : -1))
      .filter((index) => index >= 0)
      .slice(0, 2);
    const ops: BoardOp[] = [
      { type: "place", cell: empties[0], digit: 4 },
      { type: "place", cell: empties[1], digit: 7 },
      { type: "undo" },
    ];
    const rebuilt = replayBoardOps(puzzle.puzzle, ops);
    expect(rebuilt?.entries[empties[0]]).toBe(4);
    expect(rebuilt?.entries[empties[1]]).toBe(0);
    expect(rebuilt?.placedOrder).toEqual([empties[0]]);
  });

  it("rejects malformed or impossible sealed operation logs", () => {
    const cell = firstEmpty(puzzle.puzzle);
    expect(replayBoardOps(puzzle.puzzle, [{ type: "undo" }])).toBeNull();
    expect(replayBoardOps(puzzle.puzzle, [
      { type: "place", cell, digit: 5 },
      { type: "place", cell, digit: 6 },
    ])).toBeNull();
    expect(replayBoardOps(puzzle.puzzle, [
      { type: "place", cell: 81, digit: 5 },
    ])).toBeNull();
    expect(replayBoardOps(puzzle.puzzle, Array.from(
      { length: 4 },
      () => [{ type: "place", cell, digit: 5 }, { type: "undo" }] as BoardOp[],
    ).flat())).toBeNull();
  });

  it("restores a persisted board only when the puzzle fingerprint matches", () => {
    const other = dealPuzzle(hexToBytes(GOLDEN_VECTORS[1].seedHex), 0);
    window.localStorage.setItem(
      "miniapp-sudoku:board:7",
      JSON.stringify(placeDigit(createBoard(puzzle.puzzle), firstEmpty(puzzle.puzzle), 5).board),
    );
    const restored = restoreBoard("7", puzzle.puzzle);
    expect(restored.entries[firstEmpty(puzzle.puzzle)]).toBe(5);
    const mismatched = restoreBoard("7", other.puzzle);
    expect(mismatched.placedOrder).toEqual([]);
    window.localStorage.removeItem("miniapp-sudoku:board:7");
  });

  it("discards malformed persisted boards instead of restoring unsafe moves", () => {
    const cell = firstEmpty(puzzle.puzzle);
    const valid = placeDigit(createBoard(puzzle.puzzle), cell, 5).board;
    const cases: BoardState[] = [
      { ...valid, entries: valid.entries.map((value, index) => (index === cell ? 12 : value)) },
      { ...valid, notes: valid.notes.map((value, index) => (index === cell ? 1 << 11 : value)) },
      { ...valid, placedOrder: [] },
      { ...valid, placedOrder: [cell, cell] },
      { ...valid, notes: valid.notes.map((value, index) => (index === cell ? 1 << 5 : value)) },
    ];

    cases.forEach((candidate, index) => {
      const gameId = `malformed-${index}`;
      window.localStorage.setItem(
        `miniapp-sudoku:board:${gameId}`,
        JSON.stringify(candidate),
      );
      expect(restoreBoard(gameId, puzzle.puzzle)).toEqual(createBoard(puzzle.puzzle));
      window.localStorage.removeItem(`miniapp-sudoku:board:${gameId}`);
    });
  });

  it("serializes a complete board to the contract submission format", () => {
    const digits = Array.from(GOLDEN_VECTORS[0].solution, (ch) => ch.charCodeAt(0) - 48);
    expect(boardToSolutionString(digits)).toBe(GOLDEN_VECTORS[0].solution);
  });
});
