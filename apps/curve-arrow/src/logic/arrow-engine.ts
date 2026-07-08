/**
 * Curve Arrow — deterministic fixed-point flight engine (client twin).
 *
 * The arrow launches from the bow heading right; every tick the player HOLDS,
 * the velocity vector rotates upward by a fixed Q12 rotation (the arrow can
 * loop). Releasing lets it fly straight. Levels are vertical-wall layouts the
 * enclave deals from the problem secret; the client only ever sees the dealt
 * `clues` JSON (never the secret) and simulates locally with the SAME integer
 * math the enclave replays authoritatively at finalize.
 *
 * Determinism contract (must stay byte-identical to the oracle engine port in
 * neo-morpheus-oracle/workers/nitro-worker/src/game/engines/arrow.js):
 * - positions and velocities are Q8 integers; world coords = value >> 8
 * - a held tick turns UP:   vx' = (vx*TURN_COS + vy*TURN_SIN) >> 12,
 *                           vy' = (-vx*TURN_SIN + vy*TURN_COS) >> 12
 * - a released tick self-stabilizes: while the arrow still points up
 *   (vy < 0), it turns DOWN by the inverse rotation; once it would cross
 *   level while flying forward (vy >= 0 && vx > 0) it snaps to level flight
 *   (SPEED_Q8, 0), which also renormalizes Q12 drift
 * - all shifts are arithmetic (floor), so behaviour is engine-independent
 * - the target is a vertical board at x = target.x: the arrow lands when a
 *   tick crosses that plane with |y - target.y| <= TARGET_RINGS[2]; the ring
 *   comes from the vertical offset at the crossing tick
 * - hold intervals are press-inclusive, release-exclusive tick pairs
 */

export type Vec = { x: number; y: number };
export type ObstacleSpec = { x: number; y: number; w: number; h: number };
export type LevelSpec = { target: Vec; obstacles: ObstacleSpec[] };

export type ShotOutcome = {
  /** True when the arrow landed on the target board. */
  hit: boolean;
  /** 0 = bullseye, 1 = inner, 2 = outer, -1 = miss. */
  ring: number;
  /** Ticks the flight lasted. */
  ticks: number;
  /** World coordinates where the flight ended. */
  end: Vec;
  /** Per-tick world positions (only when collectPath is requested). */
  path: Vec[];
};

export type RunState = {
  levelIndex: number;
  cleared: number;
  arrowsUsed: number;
  budget: number;
  done: boolean;
  won: boolean;
};

// ── Field & flight constants (shared with the TEE engine) ────────────────────

export const FIELD_W = 1600;
export const FIELD_H = 900;
export const BOW: Vec = { x: 140, y: 450 };

/** Arrow speed, Q8 (14 px/tick). */
export const SPEED_Q8 = 3584;
/** Held-tick rotation, Q12 (~4.0°/tick up; turn radius ≈ 200 px). */
export const TURN_SIN = 286;
export const TURN_COS = 4086;
/** Flight cap per shot. */
export const TICKS_MAX = 480;
/** Target ring radii: bullseye, inner, outer. */
export const TARGET_RINGS = [18, 40, 70] as const;
/** Max press/release pairs per shot. */
export const MAX_HOLD_PAIRS = 6;

/** Levels to clear per difficulty (score target). */
export const LEVEL_TARGETS = [3, 5, 7] as const;
/** Total arrows per difficulty. */
export const ARROW_BUDGETS = [9, 14, 19] as const;

// ── Holds ─────────────────────────────────────────────────────────────────────

/**
 * Validate a holds list: even length, ≤ MAX_HOLD_PAIRS pairs, strictly
 * ascending integers in [0, TICKS_MAX). Returns the list or null.
 */
export function normalizeHolds(holds: readonly number[]): number[] | null {
  if (!Array.isArray(holds)) return null;
  if (holds.length % 2 !== 0) return null;
  if (holds.length > MAX_HOLD_PAIRS * 2) return null;
  let prev = -1;
  for (const value of holds) {
    if (!Number.isInteger(value)) return null;
    if (value < 0 || value >= TICKS_MAX) return null;
    if (value <= prev) return null;
    prev = value;
  }
  return [...holds];
}

/** Press-inclusive, release-exclusive membership test. */
export function isHeld(holds: readonly number[], tick: number): boolean {
  for (let i = 0; i + 1 < holds.length; i += 2) {
    if (tick >= holds[i] && tick < holds[i + 1]) return true;
  }
  return false;
}

// ── Flight ────────────────────────────────────────────────────────────────────

function rectContains(rect: ObstacleSpec, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function ringOf(offset: number): number {
  const abs = offset < 0 ? -offset : offset;
  for (let ring = 0; ring < TARGET_RINGS.length; ring += 1) {
    if (abs <= TARGET_RINGS[ring]) return ring;
  }
  return -1;
}

/**
 * Simulate one arrow flight against a level. Pure integer math; identical in
 * the enclave replay.
 */
export function simulateShot(
  level: LevelSpec,
  holds: readonly number[],
  options: { collectPath?: boolean } = {},
): ShotOutcome {
  const normalized = normalizeHolds(holds) ?? [];
  const path: Vec[] = [];

  let posX = BOW.x << 8;
  let posY = BOW.y << 8;
  let vx = SPEED_Q8;
  let vy = 0;

  let ticks = 0;
  let worldX = BOW.x;
  let worldY = BOW.y;
  let prevWorldX = BOW.x;

  for (let tick = 0; tick < TICKS_MAX; tick += 1) {
    if (isHeld(normalized, tick)) {
      const nvx = (vx * TURN_COS + vy * TURN_SIN) >> 12;
      const nvy = (-vx * TURN_SIN + vy * TURN_COS) >> 12;
      vx = nvx;
      vy = nvy;
    } else if (vy < 0) {
      // Released while pointing up: arc back toward level flight.
      const nvx = (vx * TURN_COS - vy * TURN_SIN) >> 12;
      const nvy = (vx * TURN_SIN + vy * TURN_COS) >> 12;
      if (nvy >= 0 && nvx > 0) {
        vx = SPEED_Q8;
        vy = 0;
        posY = (posY >> 8) << 8;
      } else {
        vx = nvx;
        vy = nvy;
      }
    }
    posX += vx;
    posY += vy;
    prevWorldX = worldX;
    worldX = posX >> 8;
    worldY = posY >> 8;
    ticks = tick + 1;
    if (options.collectPath) path.push({ x: worldX, y: worldY });

    if (worldX < 0 || worldX > FIELD_W || worldY < 0 || worldY > FIELD_H) {
      worldX = Math.max(0, Math.min(FIELD_W, worldX));
      worldY = Math.max(0, Math.min(FIELD_H, worldY));
      return { hit: false, ring: -1, ticks, end: { x: worldX, y: worldY }, path };
    }

    for (const obstacle of level.obstacles) {
      if (rectContains(obstacle, worldX, worldY)) {
        return { hit: false, ring: -1, ticks, end: { x: worldX, y: worldY }, path };
      }
    }

    const crossedForward = prevWorldX < level.target.x && worldX >= level.target.x;
    const crossedBackward = prevWorldX > level.target.x && worldX <= level.target.x;
    if (crossedForward || crossedBackward) {
      const ring = ringOf(worldY - level.target.y);
      if (ring >= 0) {
        return { hit: true, ring, ticks, end: { x: worldX, y: worldY }, path };
      }
    }
  }

  return { hit: false, ring: -1, ticks, end: { x: worldX, y: worldY }, path };
}

// ── Run state ─────────────────────────────────────────────────────────────────

export function createRun(levels: readonly LevelSpec[], difficulty: number): RunState {
  const clamped = Math.max(0, Math.min(2, difficulty | 0));
  return {
    levelIndex: 0,
    cleared: 0,
    arrowsUsed: 0,
    budget: ARROW_BUDGETS[clamped],
    done: levels.length === 0,
    won: false,
  };
}

/**
 * Apply one shot to the run: consumes an arrow, advances the level on a hit,
 * finishes the run when every level is cleared or the budget is spent.
 */
export function applyShot(
  run: RunState,
  levels: readonly LevelSpec[],
  holds: readonly number[],
): { run: RunState; outcome: ShotOutcome } {
  if (run.done || run.levelIndex >= levels.length) {
    return {
      run,
      outcome: { hit: false, ring: -1, ticks: 0, end: { ...BOW }, path: [] },
    };
  }

  const outcome = simulateShot(levels[run.levelIndex], holds);
  const arrowsUsed = run.arrowsUsed + 1;
  const cleared = outcome.hit ? run.cleared + 1 : run.cleared;
  const levelIndex = outcome.hit ? run.levelIndex + 1 : run.levelIndex;
  const won = cleared >= levels.length;
  const done = won || arrowsUsed >= run.budget;

  return {
    run: { levelIndex, cleared, arrowsUsed, budget: run.budget, done, won },
    outcome,
  };
}

/** Canonical answer prefix the enclave hashes (mirrors the TEE engine). */
export function runToSolutionString(run: RunState): string {
  return `arrow:${run.cleared}:${run.arrowsUsed}`;
}

// ── Clues ─────────────────────────────────────────────────────────────────────

function isFiniteInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function parseVec(raw: unknown): Vec | null {
  const record = raw as { x?: unknown; y?: unknown } | null;
  if (!record || !isFiniteInt(record.x) || !isFiniteInt(record.y)) return null;
  if (record.x < 0 || record.x > FIELD_W || record.y < 0 || record.y > FIELD_H) return null;
  return { x: record.x, y: record.y };
}

function parseObstacle(raw: unknown): ObstacleSpec | null {
  const record = raw as { x?: unknown; y?: unknown; w?: unknown; h?: unknown } | null;
  if (!record) return null;
  if (
    !isFiniteInt(record.x) ||
    !isFiniteInt(record.y) ||
    !isFiniteInt(record.w) ||
    !isFiniteInt(record.h)
  ) {
    return null;
  }
  if (record.w <= 0 || record.h <= 0) return null;
  if (record.x < 0 || record.x + record.w > FIELD_W) return null;
  if (record.y < 0 || record.y + record.h > FIELD_H) return null;
  return { x: record.x, y: record.y, w: record.w, h: record.h };
}

/**
 * Parse the enclave `clues` JSON: `{ levels: [{ target, obstacles }] }`.
 * Returns null on any malformed payload — the caller shows a deal-pending
 * state rather than crashing the scene.
 */
export function parseInitialState(cluesJson: string): { levels: LevelSpec[] } | null {
  if (!cluesJson) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(cluesJson);
  } catch {
    return null;
  }
  const record = raw as { levels?: unknown } | null;
  if (!record || !Array.isArray(record.levels)) return null;
  if (record.levels.length < 1 || record.levels.length > 7) return null;

  const levels: LevelSpec[] = [];
  for (const rawLevel of record.levels) {
    const levelRecord = rawLevel as { target?: unknown; obstacles?: unknown } | null;
    if (!levelRecord) return null;
    const target = parseVec(levelRecord.target);
    if (!target) return null;
    const rawObstacles = Array.isArray(levelRecord.obstacles) ? levelRecord.obstacles : null;
    if (!rawObstacles) return null;
    const obstacles: ObstacleSpec[] = [];
    for (const rawObstacle of rawObstacles) {
      const obstacle = parseObstacle(rawObstacle);
      if (!obstacle) return null;
      obstacles.push(obstacle);
    }
    levels.push({ target, obstacles });
  }
  return { levels };
}
