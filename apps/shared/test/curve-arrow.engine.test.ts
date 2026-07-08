import { describe, expect, it } from "vitest";

import {
  type LevelSpec,
  ARROW_BUDGETS,
  BOW,
  FIELD_H,
  FIELD_W,
  LEVEL_TARGETS,
  MAX_HOLD_PAIRS,
  TARGET_RINGS,
  TICKS_MAX,
  applyShot,
  createRun,
  isHeld,
  normalizeHolds,
  parseInitialState,
  runToSolutionString,
  simulateShot,
} from "../../curve-arrow/src/logic/arrow-engine";

/**
 * Curve Arrow engine tests.
 *
 * The engine provides the deterministic fixed-point arrow flight the TEE
 * engine replays: integer Q8 positions/velocities, a Q12 rotation applied on
 * every held tick, axis-aligned obstacle collision, and ring-scored target
 * hits. The client and the enclave MUST agree tick-for-tick, so everything
 * here is integer math with arithmetic shifts — no floats.
 */

function openLevel(overrides: Partial<LevelSpec> = {}): LevelSpec {
  return {
    target: { x: 1300, y: BOW.y },
    obstacles: [],
    ...overrides,
  };
}

function walledLevel(): LevelSpec {
  // A wall directly between bow and target, spanning the flight line.
  return {
    target: { x: 1300, y: BOW.y },
    obstacles: [{ x: 700, y: 150, w: 36, h: 600 }],
  };
}

describe("curve-arrow engine: holds validation", () => {
  it("accepts an empty holds list (straight shot)", () => {
    expect(normalizeHolds([])).toEqual([]);
  });

  it("accepts ascending press/release pairs", () => {
    expect(normalizeHolds([3, 10, 40, 55])).toEqual([3, 10, 40, 55]);
  });

  it("rejects odd-length, descending, negative, or out-of-range holds", () => {
    expect(normalizeHolds([3])).toBeNull();
    expect(normalizeHolds([10, 3])).toBeNull();
    expect(normalizeHolds([-1, 4])).toBeNull();
    expect(normalizeHolds([0, TICKS_MAX])).toBeNull();
    expect(normalizeHolds([4, 4])).toBeNull();
    expect(normalizeHolds([1.5, 4])).toBeNull();
  });

  it("caps the number of hold pairs", () => {
    const tooMany: number[] = [];
    for (let i = 0; i < (MAX_HOLD_PAIRS + 1) * 2; i += 1) tooMany.push(i * 2);
    expect(normalizeHolds(tooMany)).toBeNull();
  });

  it("isHeld reports press-inclusive, release-exclusive intervals", () => {
    const holds = [5, 8];
    expect(isHeld(holds, 4)).toBe(false);
    expect(isHeld(holds, 5)).toBe(true);
    expect(isHeld(holds, 7)).toBe(true);
    expect(isHeld(holds, 8)).toBe(false);
  });
});

describe("curve-arrow engine: flight simulation", () => {
  it("flies straight into the bullseye when unobstructed and level with the target", () => {
    const outcome = simulateShot(openLevel(), []);
    expect(outcome.hit).toBe(true);
    expect(outcome.ring).toBe(0);
  });

  it("misses when a wall blocks the straight path", () => {
    const outcome = simulateShot(walledLevel(), []);
    expect(outcome.hit).toBe(false);
    expect(outcome.ring).toBe(-1);
    // The arrow must have stopped at the wall, not the field edge.
    expect(outcome.end.x).toBeGreaterThanOrEqual(700);
    expect(outcome.end.x).toBeLessThanOrEqual(736 + 14);
  });

  it("curves upward while held", () => {
    const straight = simulateShot(openLevel({ target: { x: 1595, y: 2 } }), []);
    expect(straight.hit).toBe(false);

    const curved = simulateShot(openLevel(), [0, 20], { collectPath: true });
    const path = curved.path;
    expect(path.length).toBeGreaterThan(10);
    // While turning up (screen y decreases), later points sit above the bow.
    expect(path[Math.min(30, path.length - 1)].y).toBeLessThan(BOW.y);
  });

  it("can loop over a full-height-gap wall and still reach the target side", () => {
    // Hold long enough to arc over the wall's top gap, then release.
    const level: LevelSpec = {
      target: { x: 1300, y: 300 },
      obstacles: [{ x: 700, y: 360, w: 36, h: 540 }],
    };
    // Search a small space of single-pair holds for a clearing shot — proves
    // the mechanic makes walled layouts solvable rather than pinning one
    // hand-tuned trajectory.
    let cleared = false;
    for (let press = 0; press < 40 && !cleared; press += 2) {
      for (let len = 2; len <= 40 && !cleared; len += 2) {
        const outcome = simulateShot(level, [press, press + len]);
        if (outcome.hit) cleared = true;
      }
    }
    expect(cleared).toBe(true);
  });

  it("is deterministic: identical inputs produce identical paths", () => {
    const a = simulateShot(walledLevel(), [4, 18, 60, 66], { collectPath: true });
    const b = simulateShot(walledLevel(), [4, 18, 60, 66], { collectPath: true });
    expect(a).toEqual(b);
  });

  it("ends the flight when leaving the field", () => {
    // Loop forever: a permanent hold spirals; must terminate within bounds
    // checks or tick cap, never hang.
    const outcome = simulateShot(openLevel(), [0, TICKS_MAX - 1]);
    expect(outcome.ticks).toBeLessThanOrEqual(TICKS_MAX);
    expect(outcome.end.x).toBeGreaterThanOrEqual(0);
    expect(outcome.end.x).toBeLessThanOrEqual(FIELD_W);
    expect(outcome.end.y).toBeGreaterThanOrEqual(0);
    expect(outcome.end.y).toBeLessThanOrEqual(FIELD_H);
  });

  it("scores rings from the squared distance at impact", () => {
    expect(TARGET_RINGS).toEqual([18, 40, 70]);
    const bull = simulateShot(openLevel(), []);
    expect(bull.ring).toBe(0);
    const outer = simulateShot(openLevel({ target: { x: 1300, y: BOW.y - 55 } }), []);
    expect(outer.hit).toBe(true);
    expect(outer.ring).toBe(2);
  });
});

describe("curve-arrow engine: run state", () => {
  const levels: LevelSpec[] = [openLevel(), walledLevel(), openLevel()];

  it("creates a run sized to the difficulty budgets", () => {
    expect(LEVEL_TARGETS).toEqual([3, 5, 7]);
    expect(ARROW_BUDGETS).toEqual([9, 14, 19]);
    const run = createRun(levels, 0);
    expect(run.levelIndex).toBe(0);
    expect(run.cleared).toBe(0);
    expect(run.arrowsUsed).toBe(0);
    expect(run.budget).toBe(ARROW_BUDGETS[0]);
    expect(run.done).toBe(false);
  });

  it("advances a level on hit and finishes when all levels clear", () => {
    let run = createRun([openLevel(), openLevel()], 0);
    const first = applyShot(run, [openLevel(), openLevel()], []);
    run = first.run;
    expect(first.outcome.hit).toBe(true);
    expect(run.cleared).toBe(1);
    expect(run.levelIndex).toBe(1);
    expect(run.done).toBe(false);

    const second = applyShot(run, [openLevel(), openLevel()], []);
    run = second.run;
    expect(run.cleared).toBe(2);
    expect(run.done).toBe(true);
    expect(run.won).toBe(true);
  });

  it("consumes the arrow budget on misses and ends the run when spent", () => {
    let run = createRun([walledLevel()], 0);
    for (let i = 0; i < ARROW_BUDGETS[0]; i += 1) {
      expect(run.done).toBe(false);
      const applied = applyShot(run, [walledLevel()], []);
      run = applied.run;
      expect(applied.outcome.hit).toBe(false);
    }
    expect(run.arrowsUsed).toBe(ARROW_BUDGETS[0]);
    expect(run.done).toBe(true);
    expect(run.won).toBe(false);
  });

  it("serializes a canonical solution string", () => {
    const run = createRun(levels, 1);
    expect(runToSolutionString(run)).toBe("arrow:0:0");
  });
});

describe("curve-arrow engine: clues parsing", () => {
  it("parses a well-formed clues payload", () => {
    const clues = JSON.stringify({
      levels: [
        { target: { x: 1300, y: 400 }, obstacles: [{ x: 700, y: 100, w: 36, h: 400 }] },
      ],
    });
    const parsed = parseInitialState(clues);
    expect(parsed).not.toBeNull();
    expect(parsed?.levels).toHaveLength(1);
    expect(parsed?.levels[0].target).toEqual({ x: 1300, y: 400 });
  });

  it("rejects malformed payloads instead of throwing", () => {
    expect(parseInitialState("")).toBeNull();
    expect(parseInitialState("not json")).toBeNull();
    expect(parseInitialState("{}")).toBeNull();
    expect(parseInitialState(JSON.stringify({ levels: [{}] }))).toBeNull();
    expect(
      parseInitialState(
        JSON.stringify({ levels: [{ target: { x: Number.NaN, y: 1 }, obstacles: [] }] }),
      ),
    ).toBeNull();
  });

  it("rejects out-of-field geometry", () => {
    expect(
      parseInitialState(
        JSON.stringify({
          levels: [{ target: { x: FIELD_W + 10, y: 100 }, obstacles: [] }],
        }),
      ),
    ).toBeNull();
  });
});
