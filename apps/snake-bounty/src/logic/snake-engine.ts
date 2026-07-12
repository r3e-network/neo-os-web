/**
 * Snake game engine — deterministic 20×20 grid.
 *
 * The grid dimensions, initial snake state, and food placements are derived from
 * a 32-byte seed that only exists inside the Morpheus TEE. The client receives
 * the initial state through `clues` (a JSON string) and simulates moves locally
 * for responsive gameplay. The enclave re-runs the same simulation at settlement
 * to verify the outcome.
 *
 * The contract uses a "target length" win condition: the player must grow the
 * snake to at least `targetLength` segments before the deadline.
 */

export const GRID_SIZE = 20;

export interface Point {
  x: number;
  y: number;
}

export type Direction = 0 | 1 | 2 | 3; // 0=up, 1=right, 2=down, 3=left

export const DIRECTION_VECTORS: Record<Direction, Point> = {
  0: { x: 0, y: -1 }, // up
  1: { x: 1, y: 0 },  // right
  2: { x: 0, y: 1 },  // down
  3: { x: -1, y: 0 }, // left
};

export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  0: 2, // up <-> down
  1: 3, // right <-> left
  2: 0,
  3: 1,
};

export interface SnakeState {
  /** Snake body segments from head to tail */
  body: Point[];
  /** Current movement direction */
  direction: Direction;
  /** Current food position */
  food: Point;
  /** Next food positions queued in sequence (for future spawns after eating) */
  foodQueue: Point[];
  /** Whether the game is over (wall or self collision) */
  dead: boolean;
  /** Number of food items eaten so far (current length - initial length) */
  eaten: number;
}

function pointOf(value: unknown, label: string): Point {
  if (!value || typeof value !== "object") throw new Error(`${label} must be a point`);
  const raw = value as { x?: unknown; y?: unknown };
  const point = { x: Number(raw.x), y: Number(raw.y) };
  if (!Number.isInteger(point.x) || !Number.isInteger(point.y) || !inBounds(point)) {
    throw new Error(`${label} is outside the snake grid`);
  }
  return point;
}

/**
 * Parse the initial game state from the TEE clues JSON.
 * Expected format:
 * ```
 * {
 *   "body": [{"x":9,"y":10},{"x":8,"y":10},...],
 *   "direction": 1,
 *   "food": {"x":5,"y":5},
 *   "foodQueue": [{"x":3,"y":7}, ...]
 * }
 * ```
 */
export function parseInitialState(cluesJson: string): SnakeState {
  const data = JSON.parse(cluesJson) as Record<string, unknown>;
  if (!Array.isArray(data.body) || data.body.length === 0) throw new Error("snake body is missing");
  if (data.body.length > GRID_SIZE * GRID_SIZE) throw new Error("snake body is too long");
  const body = data.body.map((point, index) => pointOf(point, `body[${index}]`));
  const occupied = new Set<string>();
  for (let index = 0; index < body.length; index += 1) {
    const point = body[index]!;
    const key = `${point.x},${point.y}`;
    if (occupied.has(key)) throw new Error("snake body contains overlapping segments");
    occupied.add(key);
    const previous = body[index - 1];
    if (previous && Math.abs(previous.x - point.x) + Math.abs(previous.y - point.y) !== 1) {
      throw new Error("snake body contains disconnected segments");
    }
  }
  const direction = Number(data.direction);
  if (!Number.isInteger(direction) || direction < 0 || direction > 3) {
    throw new Error("snake direction must be 0..3");
  }
  const foodQueue = data.foodQueue === undefined
    ? []
    : Array.isArray(data.foodQueue)
      ? data.foodQueue.map((point, index) => pointOf(point, `foodQueue[${index}]`))
      : (() => { throw new Error("foodQueue must be an array"); })();
  if (foodQueue.length > GRID_SIZE * GRID_SIZE) throw new Error("foodQueue is too long");
  const eaten = data.eaten === undefined ? 0 : Number(data.eaten);
  if (!Number.isInteger(eaten) || eaten < 0 || eaten > GRID_SIZE * GRID_SIZE) {
    throw new Error("snake eaten count is invalid");
  }
  if (data.dead !== undefined && typeof data.dead !== "boolean") {
    throw new Error("snake dead flag is invalid");
  }
  return {
    body,
    direction: direction as Direction,
    food: pointOf(data.food, "food"),
    foodQueue,
    dead: data.dead === true,
    eaten,
  };
}

/** Check if a point is within the grid bounds. */
export function inBounds(p: Point): boolean {
  return p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < GRID_SIZE;
}

/** Check if a point overlaps any segment of the snake body (optionally excluding head). */
export function overlapsBody(p: Point, body: Point[], excludeHead = false): boolean {
  const start = excludeHead ? 1 : 0;
  for (let i = start; i < body.length; i++) {
    const seg = body[i];
    if (seg && seg.x === p.x && seg.y === p.y) return true;
  }
  return false;
}

/**
 * Compute the next state after a single move in `direction`.
 * Returns a new SnakeState (immutable).
 *
 * - If the move would cause a wall or self collision, `dead` is set to true.
 * - If the snake eats food, it grows (tail does not shrink) and new food spawns
 *   from the queue (or remains uneaten if queue is exhausted).
 */
export function step(state: SnakeState, direction: Direction): SnakeState {
  if (state.dead) return { ...state };

  const vec = DIRECTION_VECTORS[direction];
  const head = state.body[0];
  if (!head) return { ...state };
  const newHead: Point = { x: head.x + vec.x, y: head.y + vec.y };

  // Match the authoritative Morpheus engine: a reversal into the neck is an
  // ignored input, not a fatal move and not an applied replay operation.
  const neck = state.body[1];
  if (neck && newHead.x === neck.x && newHead.y === neck.y) return { ...state };

  // Wall collision
  if (!inBounds(newHead)) {
    return { ...state, direction, dead: true };
  }

  // Self collision (check against all body segments except the tail, which will move)
  // We check the current body minus the last segment (tail) unless we're eating
  // (in which case the tail stays). We'll check against the full body first, then
  // adjust if we don't eat.
  const willEat = newHead.x === state.food.x && newHead.y === state.food.y;

  if (willEat) {
    // When eating, the snake grows: we prepend newHead and keep the tail. Check
    // collision against the entire current body (excluding newHead). The head is
    // still advanced into the collided cell so the render/replay sees the move.
    if (overlapsBody(newHead, state.body, false)) {
      return { ...state, direction, dead: true };
    }
    const newBody = [newHead, ...state.body.map((point) => ({ ...point }))];
    const nextFood = state.foodQueue.length > 0 ? state.foodQueue[0]! : state.food;
    const newFoodQueue = state.foodQueue.length > 0 ? state.foodQueue.slice(1) : [];
    return {
      ...state,
      body: newBody,
      direction,
      food: nextFood,
      foodQueue: newFoodQueue,
      eaten: state.eaten + 1,
    };
  } else {
    // Normal move: prepend newHead, remove tail. Check collision against the body
    // without the tail (since the tail will vacate). A 180° reversal into the neck
    // still advances the head — the run is dead, but the move executed.
    const bodyWithoutTail = state.body.slice(0, -1);
    if (overlapsBody(newHead, bodyWithoutTail, false)) {
      return { ...state, direction, dead: true };
    }
    const newBody = [newHead, ...bodyWithoutTail.map((point) => ({ ...point }))];
    return { ...state, body: newBody, direction };
  }
}

/** Replay accepted tick directions from a revealed opening state. */
export function replayDirections(initial: SnakeState, directions: readonly number[]): SnakeState {
  let current: SnakeState = {
    ...initial,
    body: initial.body.map((point) => ({ ...point })),
    food: { ...initial.food },
    foodQueue: initial.foodQueue.map((point) => ({ ...point })),
  };
  for (const rawDirection of directions) {
    if (current.dead) break;
    if (!Number.isInteger(rawDirection) || rawDirection < 0 || rawDirection > 3) continue;
    current = step(current, rawDirection as Direction);
  }
  return current;
}

/** Serialize a current board so a recovered Phaser scene resumes exact progress. */
export function stateToClues(state: SnakeState): string {
  return JSON.stringify({
    body: state.body,
    direction: state.direction,
    food: state.food,
    foodQueue: state.foodQueue,
    dead: state.dead,
    eaten: state.eaten,
  });
}

/**
 * Serialize the snake state to a "solution string" for the TEE finalize call.
 * Format: JSON of body array and direction.
 */
export function stateToSolutionString(state: SnakeState): string {
  return JSON.stringify({
    body: state.body,
    direction: state.direction,
    eaten: state.eaten,
  });
}

/** Current snake length. */
export function snakeLength(state: SnakeState): number {
  return state.body.length;
}

/** Check if the snake has reached the target length. */
export function hasReachedTarget(state: SnakeState, targetLength: number): boolean {
  return state.body.length >= targetLength;
}
