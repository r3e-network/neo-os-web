/**
 * Aim Master — target physics engine.
 *
 * The TEE seeds a deterministic target pattern (oscillation velocity + reversal
 * timing). The client replays that same pattern so the player sees the exact
 * gauge movement the TEE generated. Each round the player taps to stop; the
 * distance from the centre (bullseye) determines the score.
 */

/** How many zones away from centre.  0 = bullseye, 5 = outer rim. */
export type Ring = 0 | 1 | 2 | 3 | 4 | 5;

export interface GaugeConfig {
  /** Width of the gauge in logical pixels (left = 0, right = width). */
  width: number;
  /** Centre position on the gauge (the bullseye). */
  centre: number;
  /** Radius of the bullseye zone in logical pixels. */
  bullseyeRadius: number;
  /** Width of each additional ring outward. */
  ringWidth: number;
  /** Maximum speed (pixels / tick) the target can move. */
  maxSpeed: number;
  /** Tick interval in ms (typically 16 ≈ 60 fps). */
  tickMs: number;
}

export interface HitResult {
  /** The ring hit: 0 (bullseye) … 5 (outer). */
  ring: Ring;
  /** Points awarded for this hit. */
  points: number;
  /** Signed distance from centre in pixels (negative = left, positive = right). */
  offset: number;
}

export interface TargetState {
  position: number;
  speed: number;
  direction: 1 | -1;
}

/** Points awarded per ring (index = ring 0..5). Fixed six-entry tuple so a
 *  `Ring`-typed index resolves to `number` under noUncheckedIndexedAccess. */
const RING_POINTS: readonly [number, number, number, number, number, number] = [
  10, 8, 6, 4, 2, 0,
];

const DEFAULT_CONFIG: GaugeConfig = {
  width: 300,
  centre: 150,
  bullseyeRadius: 6,
  ringWidth: 24,
  maxSpeed: 6,
  tickMs: 16,
};

/**
 * Generate a deterministic target pattern from a TEE seed.
 * Returns an array of target positions per tick (the full timeline).
 */
export function generateTargetPattern(
  seed: string,
  config: Partial<GaugeConfig> = {},
): number[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const positions: number[] = [];
  let pos = cfg.centre;
  let dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  let speed = 1;

  // Use a simple seeded pseudo-random from the seed string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  let rngState = Math.abs(hash);

  function pseudoRand(): number {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  }

  // Generate positions for ~5 seconds of motion (enough for a round)
  const ticks = Math.ceil(5000 / cfg.tickMs);
  let ticksUntilChange = 0;

  for (let t = 0; t < ticks; t++) {
    positions.push(pos);

    if (ticksUntilChange <= 0) {
      // Reversal / speed change at semi-random intervals
      dir = pseudoRand() < 0.5 ? (1 as const) : (-1 as const);
      speed = 1 + Math.floor(pseudoRand() * (cfg.maxSpeed - 1));
      ticksUntilChange = 10 + Math.floor(pseudoRand() * 40);
    }
    ticksUntilChange--;

    pos += dir * speed;

    // Bounce off edges
    if (pos < 0) {
      pos = 0;
      dir = 1;
    } else if (pos > cfg.width) {
      pos = cfg.width;
      dir = -1;
    }
  }

  return positions;
}

/**
 * Calculate the hit result given where the target was stopped.
 * Returns the ring (0 = bullseye) and points.
 */
export function calculateHitResult(
  stopPosition: number,
  config: Partial<GaugeConfig> = {},
): HitResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const offset = stopPosition - cfg.centre;
  const absDistance = Math.abs(offset);

  if (absDistance <= cfg.bullseyeRadius) {
    return { ring: 0, points: RING_POINTS[0], offset };
  }

  const ring = Math.min(
    5,
    Math.floor((absDistance - cfg.bullseyeRadius) / cfg.ringWidth) + 1,
  ) as Ring;

  return { ring, points: RING_POINTS[ring], offset };
}

/**
 * Determine whether the player has achieved enough good hits to win.
 * The player needs `targetAccuracy` hits within ring <= 2 (the "accuracy zone").
 */
export function isAccuracyHit(ring: Ring): boolean {
  return ring <= 2;
}

export function isWin(
  ringsHit: number[],
  targetAccuracy: number,
): boolean {
  const goodHits = ringsHit.filter((r) => r <= 2).length;
  return goodHits >= targetAccuracy;
}

export function totalPoints(ringsHit: number[]): number {
  return ringsHit.reduce((sum, r) => {
    const ring = Math.min(5, Math.max(0, r)) as Ring;
    return sum + RING_POINTS[ring];
  }, 0);
}

export { RING_POINTS, DEFAULT_CONFIG };
