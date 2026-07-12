/**
 * Flappy Dash game engine.
 *
 * The pipe layout is generated deterministically from a seed provided by the
 * TEE. The bird's trajectory (flap timestamps) is streamed to the enclave for
 * verification. At settlement the TEE cross-checks the local state hash against
 * the replay and signs the result.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Canvas logical width / height (CSS pixels). */
export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 600;

/** Ground strip height. */
export const GROUND_HEIGHT = 80;

/** Bird geometry (logical px). */
export const BIRD_WIDTH = 34;
export const BIRD_HEIGHT = 24;
export const BIRD_X = 80; // fixed horizontal position; pipes scroll toward it

const BIRD_START_Y = CANVAS_HEIGHT / 2 - BIRD_HEIGHT / 2;

/** Pipe geometry. */
export const PIPE_WIDTH = 52;

/**
 * Per-route flight tuning. Difficulty changes the actual play rhythm instead
 * of merely changing the target score: easy has a roomy gap and slower scroll,
 * while hard tightens the gap and shortens the time between gates.
 *
 * Values are expressed per fixed 60 fps engine step so seeded runs stay fully
 * deterministic across displays and refresh rates.
 */
export interface FlightTuning {
  gravity: number;
  flapVelocity: number;
  maxFallVelocity: number;
  pipeGap: number;
  pipeSpeed: number;
  pipeSpawnInterval: number;
  firstPipeFrame: number;
  pipeMargin: number;
  hitboxInsetX: number;
  hitboxInsetY: number;
}

const FLIGHT_TUNINGS: readonly FlightTuning[] = [
  {
    gravity: 0.42,
    flapVelocity: -7,
    maxFallVelocity: 9.2,
    pipeGap: 164,
    pipeSpeed: 2.3,
    pipeSpawnInterval: 105,
    firstPipeFrame: 74,
    pipeMargin: 56,
    hitboxInsetX: 4,
    hitboxInsetY: 3,
  },
  {
    gravity: 0.45,
    flapVelocity: -7.2,
    maxFallVelocity: 10,
    pipeGap: 148,
    pipeSpeed: 2.55,
    pipeSpawnInterval: 96,
    firstPipeFrame: 68,
    pipeMargin: 58,
    hitboxInsetX: 4,
    hitboxInsetY: 3,
  },
  {
    gravity: 0.48,
    flapVelocity: -7.35,
    maxFallVelocity: 10.8,
    pipeGap: 132,
    pipeSpeed: 2.8,
    pipeSpawnInterval: 88,
    firstPipeFrame: 64,
    pipeMargin: 62,
    hitboxInsetX: 3,
    hitboxInsetY: 2,
  },
] as const;

export function flightTuningOf(difficulty: number): FlightTuning {
  const index = Math.max(0, Math.min(2, Number.isFinite(difficulty) ? Math.round(difficulty) : 0));
  return FLIGHT_TUNINGS[index] ?? FLIGHT_TUNINGS[0]!;
}

/** Easy-route gap retained as a compatibility export for layout consumers. */
export const PIPE_GAP = FLIGHT_TUNINGS[0]!.pipeGap;

// ─── Seeded RNG (simple xoshiro‑style for determinism) ─────────────────────

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export class SeededRandom {
  private state: number;

  constructor(seed: string) {
    this.state = hashSeed(seed);
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >> 17;
    this.state ^= this.state << 5;
    // Convert to unsigned and normalise
    return ((this.state >>> 0) % 1000000) / 1000000;
  }

  /** Returns an integer in [min, max]. */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

// ─── Pipe data ──────────────────────────────────────────────────────────────

export interface Pipe {
  /** x position of the left edge. */
  x: number;
  /** y position of the top edge of the bottom pipe (i.e. start of the gap). */
  gapY: number;
  /** Whether the pipe has been scored (bird passed it). */
  scored: boolean;
}

// ─── Bird state ─────────────────────────────────────────────────────────────

export interface BirdState {
  y: number; // top-left y
  vy: number; // velocity
  rotation: number; // degrees
}

// ─── Game state ─────────────────────────────────────────────────────────────

export type GamePhase = "ready" | "playing" | "crashed" | "won" | "expired";

export interface GameState {
  bird: BirdState;
  pipes: Pipe[];
  phase: GamePhase;
  score: number; // pipes passed
  frame: number;
  seed: string;
  difficulty: number;
  tuning: FlightTuning;
  rng: SeededRandom;
  nextSpawnFrame: number;
  /** Local frame markers used for deterministic replay/debugging. */
  flaps: number[];
}

// ─── Initialisation ─────────────────────────────────────────────────────────

export function createGameState(seed: string, difficulty = 0): GameState {
  const rng = new SeededRandom(seed);
  const normalizedDifficulty = Math.max(
    0,
    Math.min(2, Number.isFinite(difficulty) ? Math.round(difficulty) : 0),
  );
  const tuning = flightTuningOf(normalizedDifficulty);
  return {
    bird: {
      y: BIRD_START_Y,
      vy: 0,
      rotation: 0,
    },
    pipes: [],
    phase: "ready",
    score: 0,
    frame: 0,
    seed,
    difficulty: normalizedDifficulty,
    tuning,
    rng,
    nextSpawnFrame: tuning.firstPipeFrame,
    flaps: [],
  };
}

// ─── Pipe generation ────────────────────────────────────────────────────────

function spawnPipe(state: GameState): Pipe {
  const { pipeGap, pipeMargin } = state.tuning;
  const maxGapY = CANVAS_HEIGHT - GROUND_HEIGHT - pipeGap - pipeMargin;
  const gapY = state.rng.nextInt(pipeMargin, maxGapY);
  return {
    x: CANVAS_WIDTH,
    gapY,
    scored: false,
  };
}

// ─── Physics update ─────────────────────────────────────────────────────────

export function flap(state: GameState): void {
  if (state.phase !== "playing") return;
  state.bird.vy = state.tuning.flapVelocity;
  state.flaps.push(state.frame);
}

export function updateFrame(state: GameState): void {
  if (state.phase !== "playing") return;

  state.frame++;

  // ── Bird physics ──
  const b = state.bird;
  b.vy += state.tuning.gravity;
  if (b.vy > state.tuning.maxFallVelocity) b.vy = state.tuning.maxFallVelocity;
  b.y += b.vy;

  // Rotation follows velocity
  b.rotation = Math.max(-25, Math.min(90, b.vy * 3));

  // ── Ground / ceiling collision ──
  if (b.y + BIRD_HEIGHT >= CANVAS_HEIGHT - GROUND_HEIGHT) {
    b.y = CANVAS_HEIGHT - GROUND_HEIGHT - BIRD_HEIGHT;
    state.phase = "crashed";
    return;
  }
  if (b.y <= 0) {
    b.y = 0;
    b.vy = 0; // bonk ceiling
  }

  // ── Spawn pipes ──
  if (state.frame >= state.nextSpawnFrame) {
    state.pipes.push(spawnPipe(state));
    state.nextSpawnFrame = state.frame + state.tuning.pipeSpawnInterval;
  }

  // ── Move pipes ──
  const pipes = state.pipes;
  for (let i = pipes.length - 1; i >= 0; i--) {
    const p = pipes[i] as Pipe; // i is always valid in this loop
    p.x -= state.tuning.pipeSpeed;

    // Score when bird passes the right edge of a pipe
    if (!p.scored && p.x + PIPE_WIDTH < BIRD_X) {
      p.scored = true;
      state.score++;
    }

    // Remove off-screen pipes
    if (p.x + PIPE_WIDTH < 0) {
      pipes.splice(i, 1);
    }
  }

  // ── Pipe collision ──
  // Transparent pixels around the bird artwork are not part of the collision
  // body. A small inset makes near-misses read fairly without making the bird
  // visually clip through a pipe.
  const bx = BIRD_X + state.tuning.hitboxInsetX;
  const by = b.y + state.tuning.hitboxInsetY;
  const bw = BIRD_WIDTH - state.tuning.hitboxInsetX * 2;
  const bh = BIRD_HEIGHT - state.tuning.hitboxInsetY * 2;
  for (const p of pipes) {
    if (rectOverlap(bx, by, bw, bh, p.x, 0, PIPE_WIDTH, p.gapY)) {
      state.phase = "crashed";
      return;
    }
    const bottomPipeY = p.gapY + state.tuning.pipeGap;
    if (rectOverlap(
      bx, by, bw, bh,
      p.x, bottomPipeY, PIPE_WIDTH, CANVAS_HEIGHT - GROUND_HEIGHT - bottomPipeY,
    )) {
      state.phase = "crashed";
      return;
    }
  }
}

function rectOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
