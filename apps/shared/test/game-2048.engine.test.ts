import { describe, expect, it } from "vitest";

import {
  MOVE_DOWN,
  MOVE_LEFT,
  MOVE_UP,
  applyMove,
  boardHex,
  hasAnyMove,
  movesToString,
  tileValue,
} from "../../game-2048/src/logic/engine-2048";
import {
  applyStep,
  buildRun,
  persistRun,
  restoreRun,
  startRun,
  trimLastMove,
} from "../../game-2048/src/logic/run-store";
import type { LiveRun } from "../../game-2048/src/logic/run-store";

/**
 * The spawn stream lives in the Morpheus enclave (see the worker suite in
 * neo-morpheus-oracle for the stream's own golden vectors). The client half
 * tested here is the DETERMINISTIC part: slide/merge mechanics plus the
 * fold that rebuilds a board from TEE-confirmed (move, spawn) pairs — that
 * fold is what makes a reload land on exactly the board the enclave holds.
 */

const EMPTY = () => new Array<number>(16).fill(0);

describe("2048 slide/merge mechanics", () => {
  it("merges adjacent equal pairs once per move, in movement order", () => {
    // [2,2,4,4] sliding left -> [4,8,0,0] (exponents [1,1,2,2] -> [2,3,0,0])
    const board = EMPTY();
    board.splice(0, 4, 1, 1, 2, 2);
    expect(applyMove(board, MOVE_LEFT)).toBe(true);
    expect(board.slice(0, 4)).toEqual([2, 3, 0, 0]);
    // [4,2,2,0] sliding left merges the adjacent pair -> [4,4,0,0]
    const row = EMPTY();
    row.splice(0, 4, 2, 1, 1, 0);
    expect(applyMove(row, MOVE_LEFT)).toBe(true);
    expect(row.slice(0, 4)).toEqual([2, 2, 0, 0]);
    // a freshly merged tile does not merge again: [2,2,2,2] -> [4,4,0,0]
    const quad = EMPTY();
    quad.splice(0, 4, 1, 1, 1, 1);
    expect(applyMove(quad, MOVE_LEFT)).toBe(true);
    expect(quad.slice(0, 4)).toEqual([2, 2, 0, 0]);
  });

  it("processes columns for vertical moves", () => {
    const board = EMPTY();
    board[0] = 1; // r0c0
    board[12] = 1; // r3c0
    expect(applyMove(board, MOVE_DOWN)).toBe(true);
    expect(board[12]).toBe(2);
    expect(board[0]).toBe(0);
    const up = EMPTY();
    up[4] = 3; // r1c0
    expect(applyMove(up, MOVE_UP)).toBe(true);
    expect(up[0]).toBe(3);
  });

  it("rejects no-change moves and out-of-range directions", () => {
    const board = EMPTY();
    board[0] = 1;
    expect(applyMove([...board], MOVE_LEFT)).toBe(false); // already at the wall
    expect(applyMove([...board], MOVE_UP)).toBe(false);
    expect(applyMove([...board], 7)).toBe(false);
  });

  it("detects dead boards", () => {
    const alternating = [1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1];
    expect(hasAnyMove(alternating)).toBe(false);
    const mergeable = [...alternating];
    mergeable[0] = 2;
    expect(hasAnyMove(mergeable)).toBe(true);
  });

  it("formats helpers for the TEE round-trip", () => {
    expect(movesToString([0, 1, 2, 3])).toBe("0123");
    expect(tileValue(9)).toBe(512);
    expect(boardHex([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0])).toBe(
      "1000000000200000",
    );
  });
});

describe("2048 run store (TEE-confirmed fold)", () => {
  const INIT = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];

  function play(run: LiveRun, dir: number, pos: number, exp: number): LiveRun {
    const next = applyStep(run, dir, { pos, exp });
    expect(next).not.toBeNull();
    return next as LiveRun;
  }

  it("folds (move, spawn) pairs into the exact board", () => {
    let run = startRun(INIT) as LiveRun;
    expect(run).not.toBeNull();
    // slide left: tiles land at r0c0 (exp1) and r2c0 (exp1); spawn exp1 at 15.
    run = play(run, MOVE_LEFT, 15, 1);
    expect(run.board[0]).toBe(1);
    expect(run.board[8]).toBe(1);
    expect(run.board[15]).toBe(1);
    // slide down: column 0 pair merges to exp2 at r3c0; 15 slides to bottom
    // already there; spawn exp2 at cell 3.
    run = play(run, MOVE_DOWN, 3, 2);
    expect(run.board[12]).toBe(2);
    expect(run.board[3]).toBe(2);
    expect(run.maxExp).toBe(2);
    expect(run.moves).toEqual([MOVE_LEFT, MOVE_DOWN]);
  });

  it("rejects a spawn that lands on an occupied cell", () => {
    const run = startRun(INIT) as LiveRun;
    const bad = applyStep(run, MOVE_LEFT, { pos: 0, exp: 1 }); // 0 is occupied after the slide
    expect(bad).toBeNull();
  });

  it("rejects folding a no-change move", () => {
    const run = startRun(INIT) as LiveRun;
    const stuck = applyStep(
      { ...run, board: [1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1] },
      MOVE_LEFT,
      { pos: 0, exp: 1 },
    );
    expect(stuck).toBeNull();
  });

  it("trims exactly the latest pair on a paid undo", () => {
    let run = startRun(INIT) as LiveRun;
    run = play(run, MOVE_LEFT, 15, 1);
    run = play(run, MOVE_DOWN, 3, 2);
    const trimmed = trimLastMove(run);
    expect(trimmed.moves).toEqual([MOVE_LEFT]);
    expect(trimmed.spawns).toEqual([{ pos: 15, exp: 1 }]);
    const reference = buildRun(INIT, [MOVE_LEFT], [{ pos: 15, exp: 1 }]);
    expect(boardHex(trimmed.board)).toBe(boardHex((reference as LiveRun).board));
  });

  it("restores a persisted run only when the history folds cleanly", () => {
    let run = startRun(INIT) as LiveRun;
    run = play(run, MOVE_LEFT, 15, 1);
    persistRun("9", run);
    const restored = restoreRun("9", INIT) as LiveRun;
    expect(restored.moves).toEqual([MOVE_LEFT]);
    expect(boardHex(restored.board)).toBe(boardHex(run.board));
    // A different initial board (different game) discards the stored history.
    const other = restoreRun("9", [2, ...INIT.slice(1)]) as LiveRun;
    expect(other.moves).toEqual([]);
    // Corrupted spawn history falls back to a fresh run.
    window.localStorage.setItem(
      "miniapp-game-2048:run:9",
      JSON.stringify({ initBoard: INIT, moves: [3], spawns: [{ pos: 0, exp: 1 }] }),
    );
    expect((restoreRun("9", INIT) as LiveRun).moves).toEqual([]);
    window.localStorage.removeItem("miniapp-game-2048:run:9");
  });
});
