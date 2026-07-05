import { describe, expect, it } from "vitest";

import {
  type Direction,
  type Point,
  type SnakeState,
  DIRECTION_VECTORS,
  GRID_SIZE,
  OPPOSITE_DIRECTION,
  hasReachedTarget,
  inBounds,
  overlapsBody,
  parseInitialState,
  snakeLength,
  stateToSolutionString,
  step,
} from "../../snake-bounty/src/logic/snake-engine";

/**
 * Snake Bounty engine tests.
 *
 * The engine provides deterministic snake game mechanics on a 20×20 grid:
 * wall/self collision, food eating (growth), and win-condition checking.
 */

function makeSnake(overrides: Partial<SnakeState> = {}): SnakeState {
  return {
    body: [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ],
    direction: 1 as Direction,
    food: { x: 5, y: 5 },
    foodQueue: [],
    dead: false,
    eaten: 0,
    ...overrides,
  };
}

describe("direction constants", () => {
  it("maps each direction to the correct vector", () => {
    expect(DIRECTION_VECTORS[0]).toEqual({ x: 0, y: -1 }); // up
    expect(DIRECTION_VECTORS[1]).toEqual({ x: 1, y: 0 }); // right
    expect(DIRECTION_VECTORS[2]).toEqual({ x: 0, y: 1 }); // down
    expect(DIRECTION_VECTORS[3]).toEqual({ x: -1, y: 0 }); // left
  });

  it("maps opposite directions bidirectionally", () => {
    // up <-> down
    expect(OPPOSITE_DIRECTION[0]).toBe(2);
    expect(OPPOSITE_DIRECTION[2]).toBe(0);
    // right <-> left
    expect(OPPOSITE_DIRECTION[1]).toBe(3);
    expect(OPPOSITE_DIRECTION[3]).toBe(1);
  });
});

describe("parseInitialState", () => {
  it("parses a valid TEE clues JSON into a SnakeState object", () => {
    const json = JSON.stringify({
      body: [
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ],
      direction: 1,
      food: { x: 3, y: 7 },
      foodQueue: [{ x: 12, y: 4 }],
    });
    const state = parseInitialState(json);
    expect(state.body).toHaveLength(2);
    expect(state.body[0]).toEqual({ x: 9, y: 10 });
    expect(state.direction).toBe(1);
    expect(state.food).toEqual({ x: 3, y: 7 });
    expect(state.foodQueue).toEqual([{ x: 12, y: 4 }]);
    expect(state.dead).toBe(false);
    expect(state.eaten).toBe(0);
  });

  it("defaults foodQueue to empty array when not present", () => {
    const json = JSON.stringify({
      body: [{ x: 9, y: 10 }],
      direction: 0,
      food: { x: 5, y: 5 },
    });
    const state = parseInitialState(json);
    expect(state.foodQueue).toEqual([]);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseInitialState("not-json")).toThrow();
  });
});

describe("inBounds", () => {
  it("returns true for positions inside the grid", () => {
    expect(inBounds({ x: 0, y: 0 })).toBe(true);
    expect(inBounds({ x: 10, y: 10 })).toBe(true);
    expect(inBounds({ x: GRID_SIZE - 1, y: GRID_SIZE - 1 })).toBe(true);
  });

  it("returns false for positions outside the grid", () => {
    expect(inBounds({ x: -1, y: 0 })).toBe(false);
    expect(inBounds({ x: 0, y: -1 })).toBe(false);
    expect(inBounds({ x: GRID_SIZE, y: 0 })).toBe(false);
    expect(inBounds({ x: 0, y: GRID_SIZE })).toBe(false);
    expect(inBounds({ x: GRID_SIZE, y: GRID_SIZE })).toBe(false);
  });
});

describe("overlapsBody", () => {
  const body: Point[] = [
    { x: 5, y: 5 }, // head
    { x: 4, y: 5 },
    { x: 3, y: 5 }, // tail
  ];

  it("returns true when a point overlaps any body segment including head", () => {
    expect(overlapsBody({ x: 5, y: 5 }, body, false)).toBe(true); // head
    expect(overlapsBody({ x: 4, y: 5 }, body, false)).toBe(true); // mid
    expect(overlapsBody({ x: 3, y: 5 }, body, false)).toBe(true); // tail
  });

  it("excludes the head segment when excludeHead is true", () => {
    expect(overlapsBody({ x: 5, y: 5 }, body, true)).toBe(false); // head excluded
    expect(overlapsBody({ x: 4, y: 5 }, body, true)).toBe(true); // mid still matches
    expect(overlapsBody({ x: 3, y: 5 }, body, true)).toBe(true); // tail still matches
  });

  it("returns false when a point does not overlap any segment", () => {
    expect(overlapsBody({ x: 0, y: 0 }, body, false)).toBe(false);
    expect(overlapsBody({ x: 5, y: 4 }, body, false)).toBe(false);
  });
});

describe("step (movement and collision)", () => {
  it("moves the snake right when direction is 1", () => {
    const s = makeSnake({ direction: 1 as Direction });
    const next = step(s, 1);
    expect(next.dead).toBe(false);
    // Head moved right by 1
    expect(next.body[0]).toEqual({ x: 11, y: 10 });
    // Tail removed
    expect(next.body).toHaveLength(3);
  });

  it("moves the snake in each cardinal direction", () => {
    const s = makeSnake({
      body: [{ x: 10, y: 10 }, { x: 10, y: 9 }],
      direction: 2 as Direction, // down
    });
    // Move down
    const down = step(s, 2);
    expect(down.body[0]).toEqual({ x: 10, y: 11 });

    // Move up
    const up = step(s, 0);
    expect(up.body[0]).toEqual({ x: 10, y: 9 });

    // Move left
    const left = step(
      makeSnake({
        body: [{ x: 10, y: 10 }, { x: 10, y: 9 }],
        direction: 3 as Direction,
      }),
      3,
    );
    expect(left.body[0]).toEqual({ x: 9, y: 10 });
  });

  it("does not change direction when given the opposite direction (180° reversal is allowed in this engine)", () => {
    // The engine does NOT prevent 180° reversal — if the player queues an opposite
    // direction the snake simply moves that way (which likely causes a self-collision
    // on the next frame). This test verifies that opposite-direction moves do
    // execute (the snake head moves in the given direction).
    const s = makeSnake({ direction: 1 as Direction }); // moving right
    const next = step(s, 3); // try to go left (opposite)
    expect(next.body[0].x).toBeLessThan(s.body[0].x); // head moved left
  });

  it("detects wall collision and sets dead=true", () => {
    // Snake at right edge, moving right
    const s = makeSnake({
      body: [
        { x: GRID_SIZE - 1, y: 10 },
        { x: GRID_SIZE - 2, y: 10 },
      ],
      direction: 1 as Direction,
    });
    const next = step(s, 1);
    expect(next.dead).toBe(true);
    // Body unchanged (snapshot before death)
    expect(next.body).toEqual(s.body);
  });

  it("detects wall collision at top edge moving up", () => {
    const s = makeSnake({
      body: [
        { x: 10, y: 0 },
        { x: 10, y: 1 },
      ],
      direction: 0 as Direction,
    });
    const next = step(s, 0);
    expect(next.dead).toBe(true);
  });

  it("detects wall collision at bottom edge moving down", () => {
    const s = makeSnake({
      body: [
        { x: 10, y: GRID_SIZE - 1 },
        { x: 10, y: GRID_SIZE - 2 },
      ],
      direction: 2 as Direction,
    });
    const next = step(s, 2);
    expect(next.dead).toBe(true);
  });

  it("detects self-collision and sets dead=true", () => {
    // Place food elsewhere so the snake does not eat (eating would keep the tail
    // and change the collision check).
    const s = makeSnake({
      body: [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 9, y: 11 },
        { x: 10, y: 11 }, // This segment will be the tail after removing it...
      ],
      direction: 2 as Direction, // moving down
      food: { x: 0, y: 0 }, // far away, will not eat
    });
    // Head is at (10,10). Moving down → (10,11). After tail removal the body
    // without tail is: (10,10), (9,10), (9,11). (10,11) is removed as tail.
    // (10,11) is NOT in bodyWithoutTail, so no self-collision.
    // Let's construct a proper self-collision scenario:
    const s2 = makeSnake({
      body: [
        { x: 10, y: 10 },
        { x: 11, y: 10 },
        { x: 11, y: 11 },
        { x: 10, y: 11 },
        { x: 9, y: 11 },
      ],
      direction: 3 as Direction, // moving left
      food: { x: 0, y: 0 }, // will not eat
    });
    // Head (10,10). Move left → (9,10). bodyWithoutTail (exclude last):
    // (10,10), (11,10), (11,11), (10,11). (9,10) is NOT in bodyWithoutTail.
    // Let me construct a clearer one where the snake is long enough to loop back.
    // Snake heading right, body goes right then down then left so head catches up.
    const s3 = makeSnake({
      body: [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
        { x: 5, y: 6 },
        { x: 4, y: 6 },
      ],
      direction: 3 as Direction, // moving left from (5,5)
      food: { x: 0, y: 0 },
    });
    // Head (5,5), left → (4,5). bodyWithoutTail: (5,5), (6,5), (6,6), (5,6).
    // (4,5) not there. OK let me try a simpler approach.
    // Self-collision: head moves into a segment that remains after tail removal.
    // With a 3-segment snake: A-B-C, head at A, moving into B.
    const s4 = makeSnake({
      body: [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
      ],
      direction: 1 as Direction, // moving right from (5,5) → (6,5)
      food: { x: 0, y: 0 }, // not eating
    });
    // bodyWithoutTail: (5,5), (6,5). Moving right → (6,5) which IS in bodyWithoutTail.
    const next4 = step(s4, 1);
    expect(next4.dead).toBe(true);
  });

  it("returns a new object without mutating the original state", () => {
    const s = makeSnake({ direction: 1 as Direction });
    const next = step(s, 1);
    expect(next).not.toBe(s);
    // Original unchanged
    expect(s.body[0]).toEqual({ x: 10, y: 10 });
  });

  it("returns a copy of state when snake is already dead", () => {
    const s = makeSnake({ dead: true });
    const next = step(s, 1);
    expect(next).not.toBe(s);
    expect(next.dead).toBe(true);
    expect(next.body).toEqual(s.body);
  });
});

describe("step (eating mechanics)", () => {
  it("grows the snake and increments eaten when head reaches food", () => {
    const s = makeSnake({
      body: [
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      direction: 1 as Direction, // moving right
      food: { x: 5, y: 5 },
      foodQueue: [{ x: 10, y: 10 }],
      eaten: 0,
    });
    const next = step(s, 1);
    // Should eat — head moves to (5,5) which is food
    expect(next.dead).toBe(false);
    expect(next.eaten).toBe(1);
    // Body grew: old body kept + new head prepended
    expect(next.body).toHaveLength(3);
    expect(next.body[0]).toEqual({ x: 5, y: 5 });
    expect(next.body[1]).toEqual({ x: 4, y: 5 });
    // Food should be replaced from queue
    expect(next.food).toEqual({ x: 10, y: 10 });
    expect(next.foodQueue).toEqual([]);
  });

  it("keeps current food when foodQueue is exhausted after eating", () => {
    const s = makeSnake({
      body: [
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      direction: 1 as Direction,
      food: { x: 5, y: 5 },
      foodQueue: [],
    });
    const next = step(s, 1);
    expect(next.eaten).toBe(1);
    // When queue is empty, food stays at the same position (new food doesn't spawn)
    expect(next.food).toEqual({ x: 5, y: 5 });
  });

  it("detects self-collision when eating (checks against full body)", () => {
    // When eating, the tail stays, so collision is checked against the entire body.
    // Snake in a position where eating would cause its head to overlap existing body.
    const s = makeSnake({
      body: [
        { x: 5, y: 5 }, // head
        { x: 6, y: 5 },
        { x: 6, y: 6 },
      ],
      direction: 1 as Direction, // moving right
      food: { x: 6, y: 5 }, // food is right at the next body segment
    });
    // Head (5,5) → (6,5) which is food. Since eating, checks against ALL body:
    // (5,5), (6,5), (6,6). (6,5) overlaps! → dead.
    const next = step(s, 1);
    expect(next.dead).toBe(true);
  });
});

describe("snakeLength and hasReachedTarget", () => {
  it("snakeLength returns body.length", () => {
    const s = makeSnake({ body: [{ x: 0, y: 0 }, { x: 1, y: 0 }] });
    expect(snakeLength(s)).toBe(2);
  });

  it("hasReachedTarget returns true when length >= target", () => {
    const s = makeSnake({ body: Array(10).fill(null).map((_, i) => ({ x: i, y: 0 })) });
    expect(hasReachedTarget(s, 10)).toBe(true);
    expect(hasReachedTarget(s, 9)).toBe(true);
    expect(hasReachedTarget(s, 5)).toBe(true);
  });

  it("hasReachedTarget returns false when length < target", () => {
    const s = makeSnake({ body: Array(5).fill(null).map((_, i) => ({ x: i, y: 0 })) });
    expect(hasReachedTarget(s, 10)).toBe(false);
    expect(hasReachedTarget(s, 6)).toBe(false);
  });
});

describe("stateToSolutionString", () => {
  it("serializes the state to a JSON string with body, direction, and eaten", () => {
    const s = makeSnake({
      body: [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
      ],
      direction: 1 as Direction,
      eaten: 2,
    });
    const json = stateToSolutionString(s);
    const parsed = JSON.parse(json);
    expect(parsed.body).toEqual(s.body);
    expect(parsed.direction).toBe(1);
    expect(parsed.eaten).toBe(2);
    // Should not include internal fields like dead, food, foodQueue
    expect(parsed.dead).toBeUndefined();
    expect(parsed.food).toBeUndefined();
  });
});
