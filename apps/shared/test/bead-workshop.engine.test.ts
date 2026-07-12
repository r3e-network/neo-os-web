import { describe, expect, it } from "vitest";
import {
  BeadEngine,
  isValidBeadSnapshot,
} from "../../bead-workshop/src/logic/BeadEngine";
import { BoardLogic } from "../../bead-workshop/src/logic/BoardLogic";
import {
  ColorDistributor,
  verifySolutionCertificate,
} from "../../bead-workshop/src/logic/ColorDistributor";
import {
  BEAD_COLORS,
  BOARD_COLS,
  BOARD_ROWS,
  HOLDING_CAPACITY,
  ROUND_TIME_MS,
  validCellCount,
} from "../../bead-workshop/src/logic/config";
import type {
  BeadCell,
  BeadSnapshot,
  GeneratedCycle,
  Position,
} from "../../bead-workshop/src/logic/types";

const NOW = 10_000;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function first(cycle: GeneratedCycle, chunk: number): Position {
  const position = cycle.chunks[chunk]?.cells[0];
  if (!position) throw new Error("certificate chunk must have a first cell");
  return position;
}

function solveCycle(engine: BeadEngine, cycle: GeneratedCycle): void {
  const start = first(cycle, 0);
  expect(engine.tapBoard(start.row, start.col, NOW).ok).toBe(true);
  expect(engine.moveSelectionToHolding(NOW).ok).toBe(true);
  for (let index = cycle.chunks.length - 1; index >= 1; index -= 1) {
    const source = first(cycle, index);
    const destination = first(cycle, (index + 1) % cycle.chunks.length);
    expect(engine.tapBoard(source.row, source.col, NOW).ok).toBe(true);
    expect(engine.tapBoard(destination.row, destination.col, NOW).ok).toBe(
      true,
    );
  }
  const finalTarget = first(cycle, 1);
  expect(engine.tapHolding(0, NOW).ok).toBe(true);
  expect(engine.tapBoard(finalTarget.row, finalTarget.col, NOW).ok).toBe(true);
}

function countColors(board: BeadCell[][]): {
  target: number[];
  bead: number[];
} {
  const target = Array(BEAD_COLORS.length).fill(0) as number[];
  const bead = Array(BEAD_COLORS.length).fill(0) as number[];
  board.flat().forEach((cell) => {
    if (!cell.valid) return;
    target[cell.targetColor] += 1;
    if (cell.beadColor !== null) bead[cell.beadColor] += 1;
  });
  return { target, bead };
}

function connectedGroup(board: BeadCell[][], count: number): Position[] {
  const start = board.flat().find((cell) => cell.valid);
  if (!start) throw new Error("board has no valid cells");
  const queue: Position[] = [{ row: start.row, col: start.col }];
  const seen = new Set<string>();
  const result: Position[] = [];
  while (queue.length > 0 && result.length < count) {
    const position = queue.shift();
    if (!position) break;
    const key = `${position.row},${position.col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cell = board[position.row]?.[position.col];
    if (!cell?.valid) continue;
    result.push(position);
    queue.push(
      { row: position.row - 1, col: position.col },
      { row: position.row + 1, col: position.col },
      { row: position.row, col: position.col - 1 },
      { row: position.row, col: position.col + 1 },
    );
  }
  return result;
}

function deadlockedSnapshot(): BeadSnapshot {
  const snapshot = BeadEngine.fresh(41, 1, NOW).snapshot(NOW);
  const group = connectedGroup(snapshot.board, HOLDING_CAPACITY);
  const groupKeys = new Set(
    group.map((position) => `${position.row},${position.col}`),
  );
  const holes = snapshot.board
    .flat()
    .filter((cell) => cell.valid && !groupKeys.has(`${cell.row},${cell.col}`))
    .filter((cell) => (cell.row + cell.col) % 2 === 0)
    .slice(0, HOLDING_CAPACITY)
    .map(({ row, col }) => ({ row, col }));
  expect(group).toHaveLength(HOLDING_CAPACITY);
  expect(holes).toHaveLength(HOLDING_CAPACITY);
  const holeKeys = new Set(
    holes.map((position) => `${position.row},${position.col}`),
  );
  snapshot.board.flat().forEach((cell) => {
    if (!cell.valid) return;
    const key = `${cell.row},${cell.col}`;
    if (groupKeys.has(key)) {
      cell.targetColor = 1;
      cell.beadColor = 0;
    } else if (holeKeys.has(key)) {
      cell.targetColor = 0;
      cell.beadColor = null;
    } else {
      cell.targetColor = 2;
      cell.beadColor = 2;
    }
  });
  snapshot.holding = Array.from({ length: HOLDING_CAPACITY }, (_, index) => ({
    id: `deadlock:${index}`,
    color: 1,
    source: { ...holes[index]! },
  }));
  snapshot.selection = null;
  snapshot.phase = "paused";
  snapshot.history = [
    {
      board: clone(snapshot.board),
      holding: clone(snapshot.holding),
      steps: snapshot.steps,
    },
  ];
  snapshot.messageKey = "statusPaused";
  return snapshot;
}

describe("Bead Workshop certified engine", () => {
  it("keeps the audited 14x14, 140-cell board and 14-slot tray", () => {
    const level = ColorDistributor.create(1);
    expect(level.board).toHaveLength(BOARD_ROWS);
    expect(level.board.every((row) => row.length === BOARD_COLS)).toBe(true);
    expect(validCellCount()).toBe(140);
    expect(level.total).toBe(140);
    expect(HOLDING_CAPACITY).toBe(14);
  });

  it("generates deterministic, well-scrambled boards with balanced color counts", () => {
    const firstLevel = ColorDistributor.create(12345);
    const repeat = ColorDistributor.create(12345);
    const different = ColorDistributor.create(12346);
    expect(repeat.board).toEqual(firstLevel.board);
    expect(different.board).not.toEqual(firstLevel.board);
    const counts = countColors(firstLevel.board);
    expect(counts.bead).toEqual(counts.target);
    expect(
      firstLevel.board
        .flat()
        .filter((cell) => cell.valid && cell.beadColor !== cell.targetColor)
        .length,
    ).toBeGreaterThanOrEqual(100);
  });

  it("verifies the constructive solution certificate across 100 seeds", () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      expect(
        verifySolutionCertificate(ColorDistributor.create(seed)),
        `seed ${seed}`,
      ).toBe(true);
    }
  });

  it("replays certificates through the public engine to a real win", () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const level = ColorDistributor.create(seed);
      const engine = BeadEngine.fresh(seed, 1, NOW);
      level.cycles.forEach((cycle) => solveCycle(engine, cycle));
      const solved = engine.snapshot(NOW);
      expect(solved.phase, `seed ${seed}`).toBe("won");
      expect(solved.holding).toHaveLength(0);
      expect(solved.matched).toBe(solved.total);
    }
  });

  it("selects by bead and target color together and locks matched beads", () => {
    const board = clone(ColorDistributor.create(7).board);
    board.flat().forEach((cell) => {
      if (cell.valid) cell.beadColor = cell.targetColor;
    });
    const left = board[6]![6]!;
    const right = board[6]![7]!;
    left.targetColor = 0;
    left.beadColor = 2;
    right.targetColor = 1;
    right.beadColor = 2;
    expect(BoardLogic.connectedMovableRegion(board, 6, 6)).toEqual([
      { row: 6, col: 6 },
    ]);
    right.beadColor = right.targetColor;
    expect(BoardLogic.connectedMovableRegion(board, 6, 7)).toEqual([]);
  });

  it("fails closed when the whole selected patch cannot fit in the tray", () => {
    const level = ColorDistributor.create(1);
    const engine = BeadEngine.fresh(1, 1, NOW);
    level.cycles.slice(0, 3).forEach((cycle) => {
      const position = first(cycle, 0);
      expect(engine.tapBoard(position.row, position.col, NOW).ok).toBe(true);
      expect(engine.moveSelectionToHolding(NOW).ok).toBe(true);
    });
    const before = engine.snapshot(NOW);
    expect(before.holding).toHaveLength(12);
    const next = first(level.cycles[3]!, 0);
    expect(engine.tapBoard(next.row, next.col, NOW).ok).toBe(true);
    expect(engine.moveSelectionToHolding(NOW)).toMatchObject({
      ok: false,
      messageKey: "statusHoldingNeedsSpace",
    });
    expect(engine.snapshot(NOW).holding).toHaveLength(12);
  });

  it("uses color-filtered FIFO and clearly reports a partial tray placement", () => {
    const level = ColorDistributor.create(3);
    const engine = BeadEngine.fresh(3, 1, NOW);
    const firstCycle = level.cycles[1]!;
    const secondCycle = level.cycles[2]!;
    expect(firstCycle.chunks[1]!.targetColor).toBe(
      secondCycle.chunks[1]!.targetColor,
    );
    for (const cycle of [firstCycle, secondCycle]) {
      const start = first(cycle, 0);
      engine.tapBoard(start.row, start.col, NOW);
      engine.moveSelectionToHolding(NOW);
    }
    for (let index = firstCycle.chunks.length - 1; index >= 1; index -= 1) {
      const source = first(firstCycle, index);
      const destination = first(
        firstCycle,
        (index + 1) % firstCycle.chunks.length,
      );
      engine.tapBoard(source.row, source.col, NOW);
      engine.tapBoard(destination.row, destination.col, NOW);
    }
    const color = firstCycle.chunks[1]!.targetColor;
    const before = engine.snapshot(NOW);
    const fifoIds = before.holding
      .filter((bead) => bead.color === color)
      .map((bead) => bead.id);
    expect(fifoIds).toHaveLength(8);
    const selectedIndex = before.holding.findIndex(
      (bead) => bead.color === color,
    );
    expect(engine.tapHolding(selectedIndex, NOW).ok).toBe(true);
    const destination = first(firstCycle, 1);
    const result = engine.tapBoard(destination.row, destination.col, NOW);
    const after = engine.snapshot(NOW);
    expect(result).toMatchObject({ ok: true, moved: 4 });
    expect(after.messageKey).toBe("statusPlacedPartialBatch");
    expect(
      after.holding
        .filter((bead) => bead.color === color)
        .map((bead) => bead.id),
    ).toEqual(fifoIds.slice(4));
  });

  it("supports undo, explicit pause, timeout, and safe paused reload recovery", () => {
    const level = ColorDistributor.create(5);
    const engine = BeadEngine.fresh(5, 1, NOW);
    const position = first(level.cycles[0]!, 0);
    engine.tapBoard(position.row, position.col, NOW);
    engine.moveSelectionToHolding(NOW);
    expect(engine.snapshot(NOW).holding.length).toBeGreaterThan(0);
    expect(engine.undo(NOW).ok).toBe(true);
    expect(engine.snapshot(NOW).holding).toHaveLength(0);
    expect(engine.togglePause(NOW).action).toBe("pause");
    const paused = engine.snapshot(NOW);
    expect(paused.phase).toBe("paused");

    const active = BeadEngine.fresh(9, 1, NOW).snapshot(NOW);
    const restored = BeadEngine.restore(active, NOW + 30_000);
    expect(restored).not.toBeNull();
    expect(restored!.snapshot(NOW + 30_000)).toMatchObject({
      phase: "paused",
      remainingMs: ROUND_TIME_MS,
      messageKey: "statusRecoveredPaused",
    });

    const timed = BeadEngine.fresh(11, 1, NOW);
    timed.tick(NOW + ROUND_TIME_MS + 1);
    expect(timed.snapshot(NOW + ROUND_TIME_MS + 1).phase).toBe("timeout");
  });

  it("detects a genuine no-move state after recovery", () => {
    const snapshot = deadlockedSnapshot();
    expect(isValidBeadSnapshot(snapshot)).toBe(true);
    const engine = BeadEngine.restore(snapshot, NOW);
    expect(engine).not.toBeNull();
    expect(engine!.togglePause(NOW).ok).toBe(true);
    expect(engine!.snapshot(NOW).phase).toBe("stuck");
  });

  it("fails closed on duplicate tray ids and malformed restored selections", () => {
    const level = ColorDistributor.create(2);
    const holdingEngine = BeadEngine.fresh(2, 1, NOW);
    const movable = first(level.cycles[0]!, 0);
    holdingEngine.tapBoard(movable.row, movable.col, NOW);
    holdingEngine.moveSelectionToHolding(NOW);
    const duplicateIds = holdingEngine.snapshot(NOW);
    duplicateIds.holding[1]!.id = duplicateIds.holding[0]!.id;
    expect(isValidBeadSnapshot(duplicateIds)).toBe(false);
    expect(BeadEngine.restore(duplicateIds, NOW)).toBeNull();

    const selectionEngine = BeadEngine.fresh(2, 1, NOW);
    selectionEngine.tapBoard(movable.row, movable.col, NOW);
    const incomplete = selectionEngine.snapshot(NOW);
    if (incomplete.selection?.source !== "board")
      throw new Error("board selection expected");
    incomplete.selection.cells = incomplete.selection.cells.slice(0, -1);
    expect(isValidBeadSnapshot(incomplete)).toBe(false);
    expect(BeadEngine.restore(incomplete, NOW)).toBeNull();

    const duplicatedCell = selectionEngine.snapshot(NOW);
    if (duplicatedCell.selection?.source !== "board")
      throw new Error("board selection expected");
    duplicatedCell.selection.cells[1] = {
      ...duplicatedCell.selection.cells[0]!,
    };
    expect(isValidBeadSnapshot(duplicatedCell)).toBe(false);
    expect(BeadEngine.restore(duplicatedCell, NOW)).toBeNull();

    const forgedWin = BeadEngine.fresh(2, 1, NOW).snapshot(NOW);
    forgedWin.phase = "won";
    forgedWin.messageKey = "statusWon";
    expect(isValidBeadSnapshot(forgedWin)).toBe(false);
    expect(BeadEngine.restore(forgedWin, NOW)).toBeNull();

    const forgedTimeout = BeadEngine.fresh(2, 1, NOW).snapshot(NOW);
    forgedTimeout.phase = "timeout";
    forgedTimeout.messageKey = "statusTimeUp";
    expect(isValidBeadSnapshot(forgedTimeout)).toBe(false);
    expect(BeadEngine.restore(forgedTimeout, NOW)).toBeNull();
  });

  it("drops corrupt undo history without rejecting an otherwise safe snapshot", () => {
    const snapshot = BeadEngine.fresh(77, 1, NOW).snapshot(
      NOW,
    ) as BeadSnapshot & { history: unknown[] };
    snapshot.history = [{ board: "corrupt", holding: [], steps: -4 }];
    expect(isValidBeadSnapshot(snapshot)).toBe(true);
    const restored = BeadEngine.restore(snapshot, NOW);
    expect(restored).not.toBeNull();
    expect(restored!.snapshot(NOW).history).toHaveLength(0);
  });
});
