import type { Direction, Point } from "./snake-engine";

export type SnakeSegmentRole = "head" | "body" | "tail";

export type SnakeSegmentPose = {
  role: SnakeSegmentRole;
  /** Rotation for head, tail, and straight body artwork. */
  angle: number;
  /** A turn is rendered from two short, real body-art branches. */
  turnAngles: readonly [number, number] | null;
};

export const DIRECTION_DEGREES: Record<Direction, number> = {
  0: -90,
  1: 0,
  2: 90,
  3: 180,
};

function normalizeAngle(angle: number): number {
  let normalized = angle;
  while (normalized <= -180) normalized += 360;
  while (normalized > 180) normalized -= 360;
  return normalized;
}

/** Return the cardinal direction from one adjacent grid cell to another. */
export function directionBetween(from: Point, to: Point): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return 1;
  if (dx === -1 && dy === 0) return 3;
  if (dx === 0 && dy === 1) return 2;
  if (dx === 0 && dy === -1) return 0;
  return null;
}

/**
 * Describe the artwork pose for one head-to-tail body index.
 *
 * The head artwork faces right at 0°. The tail artwork's thick join faces left
 * at 0°, so it rotates 180° relative to the direction from tail to its neighbour.
 * At a corner, two short instances of the real straight-body texture form the
 * elbow instead of replacing the snake with a Graphics square.
 */
export function snakeSegmentPose(
  body: readonly Point[],
  index: number,
  headDirection: Direction,
): SnakeSegmentPose {
  if (index === 0) {
    return { role: "head", angle: DIRECTION_DEGREES[headDirection], turnAngles: null };
  }

  const current = body[index];
  const towardHead = current && body[index - 1]
    ? directionBetween(current, body[index - 1]!)
    : null;

  if (index === body.length - 1) {
    const joinAngle = towardHead === null ? 0 : DIRECTION_DEGREES[towardHead];
    return { role: "tail", angle: normalizeAngle(joinAngle - 180), turnAngles: null };
  }

  const towardTail = current && body[index + 1]
    ? directionBetween(current, body[index + 1]!)
    : null;

  if (towardHead !== null && towardTail !== null) {
    const headAngle = DIRECTION_DEGREES[towardHead];
    const tailAngle = DIRECTION_DEGREES[towardTail];
    const vertical = towardHead % 2 === 0;
    const tailVertical = towardTail % 2 === 0;
    if (vertical === tailVertical) {
      return { role: "body", angle: vertical ? 90 : 0, turnAngles: null };
    }
    return { role: "body", angle: 0, turnAngles: [headAngle, tailAngle] };
  }

  const availableDirection = towardHead ?? towardTail;
  return {
    role: "body",
    angle: availableDirection === null ? 0 : DIRECTION_DEGREES[availableDirection],
    turnAngles: null,
  };
}

/**
 * Preserve segment identity across a tick. New growth tails originate from the
 * previous tail, while every existing index starts from its prior grid cell.
 */
export function interpolationSource(
  previousBody: readonly Point[],
  index: number,
): Point | null {
  if (previousBody.length === 0) return null;
  return previousBody[Math.min(index, previousBody.length - 1)] ?? null;
}
