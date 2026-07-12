import { describe, expect, it } from "vitest";

import {
  MOVE_DOWN,
  MOVE_LEFT,
  MOVE_RIGHT,
  MOVE_UP,
  applyMove,
  boardHex,
  createMoveTransition,
  hasAnyMove,
  isValidBoard,
  isValidSpawn,
  movesToString,
  requireBoard,
  tileValue,
} from "../../game-2048/src/logic/engine-2048";
import {
  applyStep,
  applyStepWithTransition,
  buildRun,
  forgetRun,
  persistRun,
  restoreRun,
  startRun,
  trimLastMove,
} from "../../game-2048/src/logic/run-store";
import type { LiveRun, RunStorage } from "../../game-2048/src/logic/run-store";

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

  it("emits stable source-to-destination identities for slides, merges, and spawn", () => {
    const board = EMPTY();
    board.splice(0, 4, 1, 0, 1, 1);
    const transition = createMoveTransition(
      board,
      MOVE_LEFT,
      { pos: 15, exp: 2 },
      7,
    );

    expect(transition).toEqual({
      sequence: 7,
      direction: MOVE_LEFT,
      before: [1, 0, 1, 1, ...new Array(12).fill(0)],
      afterSlide: [2, 1, 0, 0, ...new Array(12).fill(0)],
      after: [2, 1, 0, 0, ...new Array(11).fill(0), 2],
      motions: [
        { source: 0, destination: 0, exponent: 1, merge: 0 },
        { source: 2, destination: 0, exponent: 1, merge: 0 },
        { source: 3, destination: 1, exponent: 1, merge: null },
      ],
      merges: [
        {
          sources: [0, 2],
          destination: 0,
          sourceExponent: 1,
          resultExponent: 2,
        },
      ],
      spawn: { destination: 15, exponent: 2 },
    });
  });

  it("keeps merge ordering deterministic in the requested movement direction", () => {
    const board = EMPTY();
    board.splice(0, 4, 1, 1, 1, 1);
    const transition = createMoveTransition(board, MOVE_RIGHT, { pos: 4, exp: 1 }, 1);

    expect(transition?.motions).toEqual([
      { source: 3, destination: 3, exponent: 1, merge: 0 },
      { source: 2, destination: 3, exponent: 1, merge: 0 },
      { source: 1, destination: 2, exponent: 1, merge: 1 },
      { source: 0, destination: 2, exponent: 1, merge: 1 },
    ]);
    expect(transition?.merges.map((merge) => merge.sources)).toEqual([[3, 2], [1, 0]]);
    expect(transition?.after.slice(0, 8)).toEqual([0, 0, 2, 2, 1, 0, 0, 0]);
  });

  it("conserves every source identity across horizontal and vertical traces", () => {
    const boards = [
      [1, 0, 1, 2, 0, 2, 2, 0, 3, 0, 3, 3, 1, 1, 0, 1],
      [1, 2, 1, 2, 0, 2, 0, 2, 3, 3, 3, 0, 1, 0, 1, 1],
    ];

    for (const board of boards) {
      for (const dir of [MOVE_UP, MOVE_RIGHT, MOVE_DOWN, MOVE_LEFT]) {
        const afterSlide = [...board];
        if (!applyMove(afterSlide, dir)) continue;
        const spawnPos = afterSlide.findIndex((exp) => exp === 0);
        expect(spawnPos).toBeGreaterThanOrEqual(0);
        const transition = createMoveTransition(board, dir, { pos: spawnPos, exp: 1 }, dir + 1);
        expect(transition?.afterSlide).toEqual(afterSlide);

        const sources = transition?.motions.map((motion) => motion.source).sort((a, b) => a - b);
        const occupied = board.flatMap((exp, index) => (exp > 0 ? [index] : []));
        expect(sources).toEqual(occupied);
        expect(new Set(sources).size).toBe(occupied.length);

        for (const merge of transition?.merges ?? []) {
          const participants = transition?.motions.filter((motion) => motion.merge !== null &&
            transition.merges[motion.merge]?.destination === merge.destination);
          expect(participants?.map((motion) => motion.source)).toEqual(merge.sources);
          expect(participants?.every((motion) => motion.destination === merge.destination)).toBe(true);
        }
      }
    }
  });

  it("rejects no-op traces and authoritative spawns on occupied cells", () => {
    const stuck = EMPTY();
    stuck[0] = 1;
    expect(createMoveTransition(stuck, MOVE_LEFT, { pos: 1, exp: 1 }, 1)).toBeNull();

    const movable = EMPTY();
    movable[3] = 1;
    expect(createMoveTransition(movable, MOVE_LEFT, { pos: 0, exp: 1 }, 1)).toBeNull();
    expect(createMoveTransition(movable, MOVE_LEFT, { pos: 3, exp: 1 }, 1)?.spawn).toEqual({
      destination: 3,
      exponent: 1,
    });
  });

  it("rejects no-change moves and out-of-range directions", () => {
    const board = EMPTY();
    board[0] = 1;
    expect(applyMove([...board], MOVE_LEFT)).toBe(false); // already at the wall
    expect(applyMove([...board], MOVE_UP)).toBe(false);
    expect(applyMove([...board], 7)).toBe(false);
  });

  it("rejects malformed TEE boards and non-canonical spawns without coercion", () => {
    expect(isValidBoard(new Array(16).fill(0))).toBe(true);
    expect(isValidBoard(new Array(15).fill(0))).toBe(false);
    expect(isValidBoard(["1", ...new Array(15).fill(0)])).toBe(false);
    expect(isValidBoard([-1, ...new Array(15).fill(0)])).toBe(false);
    expect(() => requireBoard(new Array(17).fill(0))).toThrow("invalid 2048 board payload");
    expect(isValidSpawn({ pos: 15, exp: 2 })).toBe(true);
    expect(isValidSpawn({ pos: 16, exp: 1 })).toBe(false);
    expect(isValidSpawn({ pos: 4, exp: 3 })).toBe(false);

    const movable = EMPTY();
    movable[3] = 1;
    expect(createMoveTransition(movable, MOVE_LEFT, { pos: 3, exp: 3 }, 1)).toBeNull();
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

  it("returns the same confirmed board and animation trace from one fold", () => {
    const run = startRun([1, 1, ...new Array(14).fill(0)]) as LiveRun;
    const applied = applyStepWithTransition(run, MOVE_LEFT, { pos: 15, exp: 1 }, 42);

    expect(applied).not.toBeNull();
    expect(applied?.transition.sequence).toBe(42);
    expect(applied?.transition.merges).toEqual([
      {
        sources: [0, 1],
        destination: 0,
        sourceExponent: 1,
        resultExponent: 2,
      },
    ]);
    expect(applied?.transition.after).toEqual(applied?.run.board);
    expect(applied?.run.board[0]).toBe(2);
    expect(applied?.run.board[15]).toBe(1);
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

  // Mirrors the framework's app.storage.local contract (JSON round-trip KV),
  // which is what main.tsx injects in production.
  function memoryRunStorage(): RunStorage & { keys(): string[] } {
    const map = new Map<string, unknown>();
    return {
      get<T>(key: string, fallback: T | null = null): T | null {
        return map.has(key) ? (JSON.parse(String(map.get(key))) as T) : fallback;
      },
      set(key: string, value: unknown): void {
        map.set(key, JSON.stringify(value));
      },
      delete(key: string): void {
        map.delete(key);
      },
      keys(): string[] {
        return [...map.keys()];
      },
    };
  }

  it("restores a persisted run only when the history folds cleanly", () => {
    const storage = memoryRunStorage();
    let run = startRun(INIT) as LiveRun;
    run = play(run, MOVE_LEFT, 15, 1);
    persistRun(storage, "9", run);
    expect(storage.keys()).toEqual(["run:9"]);
    const restored = restoreRun(storage, "9", INIT) as LiveRun;
    expect(restored.moves).toEqual([MOVE_LEFT]);
    expect(boardHex(restored.board)).toBe(boardHex(run.board));
    // A different initial board (different game) discards the stored history.
    const other = restoreRun(storage, "9", [2, ...INIT.slice(1)]) as LiveRun;
    expect(other.moves).toEqual([]);
    // Corrupted spawn history falls back to a fresh run.
    storage.set("run:9", { initBoard: INIT, moves: [3], spawns: [{ pos: 0, exp: 1 }] });
    expect((restoreRun(storage, "9", INIT) as LiveRun).moves).toEqual([]);
    // Settling or expiring a game clears its persisted log.
    forgetRun(storage, "9");
    expect(storage.keys()).toEqual([]);
  });
});
