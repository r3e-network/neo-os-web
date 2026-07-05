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

/** Physics (per-frame at 60 fps). */
const GRAVITY = 0.45; // px per frame²
const FLAP_VELOCITY = -7.2; // px per frame (upward)
const MAX_FALL_VELOCITY = 10;
const BIRD_START_Y = CANVAS_HEIGHT / 2 - BIRD_HEIGHT / 2;

/** Pipe geometry. */
export const PIPE_WIDTH = 52;
const PIPE_GAP = 140; // vertical gap between top and bottom pipe
const PIPE_SPEED = 2.5; // px per frame (scrolls left)
const PIPE_SPAWN_INTERVAL = 100; // frames between pipes
const MIN_PIPE_TOP = 60; // min top-edge of the gap from canvas top
const MAX_PIPE_BOTTOM = CANVAS_HEIGHT - GROUND_HEIGHT - PIPE_GAP - 60;

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
  rng: SeededRandom;
  nextSpawnFrame: number;
  /** Flap timestamps (frame numbers) sent to TEE. */
  flaps: number[];
}

// ─── Initialisation ─────────────────────────────────────────────────────────

export function createGameState(seed: string): GameState {
  const rng = new SeededRandom(seed);
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
    rng,
    nextSpawnFrame: 60, // first pipe after 1 second
    flaps: [],
  };
}

// ─── Pipe generation ────────────────────────────────────────────────────────

function spawnPipe(state: GameState): Pipe {
  const gapY = state.rng.nextInt(MIN_PIPE_TOP, MAX_PIPE_BOTTOM);
  return {
    x: CANVAS_WIDTH,
    gapY,
    scored: false,
  };
}

// ─── Physics update ─────────────────────────────────────────────────────────

export function flap(state: GameState): void {
  if (state.phase !== "playing") return;
  state.bird.vy = FLAP_VELOCITY;
  state.flaps.push(state.frame);
}

export function updateFrame(state: GameState): void {
  if (state.phase !== "playing") return;

  state.frame++;

  // ── Bird physics ──
  const b = state.bird;
  b.vy += GRAVITY;
  if (b.vy > MAX_FALL_VELOCITY) b.vy = MAX_FALL_VELOCITY;
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
    state.nextSpawnFrame = state.frame + PIPE_SPAWN_INTERVAL;
  }

  // ── Move pipes ──
  const pipes = state.pipes;
  for (let i = pipes.length - 1; i >= 0; i--) {
    const p = pipes[i] as Pipe; // i is always valid in this loop
    p.x -= PIPE_SPEED;

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
  const bx = BIRD_X;
  const by = b.y;
  for (const p of pipes) {
    if (rectOverlap(bx, by, BIRD_WIDTH, BIRD_HEIGHT, p.x, 0, PIPE_WIDTH, p.gapY)) {
      state.phase = "crashed";
      return;
    }
    const bottomPipeY = p.gapY + PIPE_GAP;
    if (rectOverlap(
      bx, by, BIRD_WIDTH, BIRD_HEIGHT,
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

// ─── State hash (lightweight digest for settlement) ─────────────────────────

/**
 * Produces a deterministic hex string that summarises the run outcome.
 * The TEE signs this so the contract can verify the result was not forged.
 * We hash: score + last flap frame + total flaps + pipe count at end.
 */
export function computeStateHash(state: GameState): string {
  const lastFlap = state.flaps.length > 0 ? state.flaps[state.flaps.length - 1] : 0;
  const raw = `${state.score}:${lastFlap}:${state.flaps.length}:${state.pipes.length}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  }
  // Return a 64-char hex string (simulating SHA‑256 length; in prod the TEE
  // signs a real hash — this is a placeholder that matches the contract's
  // expectation of a 64-char hex string for the stateHash field).
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return hex.repeat(8); // pad to 64 chars
}
