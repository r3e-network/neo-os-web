export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 600;
export const GROUND_HEIGHT = 80;
export const BIRD_WIDTH = 34;
export const BIRD_HEIGHT = 24;
export const BIRD_X = 80;
export const PIPE_WIDTH = 52;
export const FRAME_MS = 1000 / 60;

const GRAVITY = 0.45;
const FLAP_VELOCITY = -7.2;
const MAX_FALL_VELOCITY = 10;
const BIRD_START_Y = CANVAS_HEIGHT / 2 - BIRD_HEIGHT / 2;
const PIPE_GAP = 140;
const PIPE_SPEED = 2.5;
const PIPE_SPAWN_INTERVAL = 100;
const MIN_PIPE_TOP = 60;
const MAX_PIPE_BOTTOM = CANVAS_HEIGHT - GROUND_HEIGHT - PIPE_GAP - 60;
const FIRST_SPAWN_FRAME = 60;

function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(index)) | 0;
  }
  return hash >>> 0;
}

export class SeededRandom {
  private state: number;

  constructor(seed: string) {
    this.state = hashSeed(seed);
  }

  next(): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >> 17;
    this.state ^= this.state << 5;
    return ((this.state >>> 0) % 1000000) / 1000000;
  }

  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

export function seedString(problemSecret: Uint8Array): string {
  if (!(problemSecret instanceof Uint8Array) || problemSecret.length !== 32) {
    throw new Error("problemSecret must be 32 bytes");
  }
  return Array.from(problemSecret, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface BirdState {
  y: number;
  vy: number;
  rotation: number;
}

interface PipeState {
  x: number;
  gapY: number;
  scored: boolean;
}

interface GameState {
  bird: BirdState;
  pipes: PipeState[];
  phase: "ready" | "playing" | "crashed";
  score: number;
  frame: number;
  rng: SeededRandom;
  nextSpawnFrame: number;
}

function isPlaying(state: GameState): boolean {
  return state.phase === "playing";
}

function isCrashed(state: GameState): boolean {
  return state.phase === "crashed";
}

function createState(seed: string): GameState {
  return {
    bird: { y: BIRD_START_Y, vy: 0, rotation: 0 },
    pipes: [],
    phase: "ready",
    score: 0,
    frame: 0,
    rng: new SeededRandom(seed),
    nextSpawnFrame: FIRST_SPAWN_FRAME,
  };
}

function spawnPipe(state: GameState): PipeState {
  const gapY = state.rng.nextInt(MIN_PIPE_TOP, MAX_PIPE_BOTTOM);
  return { x: CANVAS_WIDTH, gapY, scored: false };
}

function rectOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function stepFrame(state: GameState): void {
  if (state.phase !== "playing") return;
  state.frame += 1;

  const bird = state.bird;
  bird.vy += GRAVITY;
  if (bird.vy > MAX_FALL_VELOCITY) bird.vy = MAX_FALL_VELOCITY;
  bird.y += bird.vy;
  bird.rotation = Math.max(-25, Math.min(90, bird.vy * 3));

  if (bird.y + BIRD_HEIGHT >= CANVAS_HEIGHT - GROUND_HEIGHT) {
    bird.y = CANVAS_HEIGHT - GROUND_HEIGHT - BIRD_HEIGHT;
    state.phase = "crashed";
    return;
  }
  if (bird.y <= 0) {
    bird.y = 0;
    bird.vy = 0;
  }

  if (state.frame >= state.nextSpawnFrame) {
    state.pipes.push(spawnPipe(state));
    state.nextSpawnFrame = state.frame + PIPE_SPAWN_INTERVAL;
  }

  const pipes = state.pipes;
  for (let index = pipes.length - 1; index >= 0; index -= 1) {
    const pipe = pipes[index]!;
    pipe.x -= PIPE_SPEED;
    if (!pipe.scored && pipe.x + PIPE_WIDTH < BIRD_X) {
      pipe.scored = true;
      state.score += 1;
    }
    if (pipe.x + PIPE_WIDTH < 0) pipes.splice(index, 1);
  }

  for (const pipe of pipes) {
    if (rectOverlap(BIRD_X, bird.y, BIRD_WIDTH, BIRD_HEIGHT, pipe.x, 0, PIPE_WIDTH, pipe.gapY)) {
      state.phase = "crashed";
      return;
    }
    const bottomPipeY = pipe.gapY + PIPE_GAP;
    if (rectOverlap(
      BIRD_X,
      bird.y,
      BIRD_WIDTH,
      BIRD_HEIGHT,
      pipe.x,
      bottomPipeY,
      PIPE_WIDTH,
      CANVAS_HEIGHT - GROUND_HEIGHT - bottomPipeY,
    )) {
      state.phase = "crashed";
      return;
    }
  }
}

export function replayFlappy(
  seed: string,
  flapFrames: number[],
  maxFrame: number,
): { pipesPassed: number; crashed: boolean; framesRun: number } {
  const state = createState(seed);
  state.phase = "playing";
  const frames = [...flapFrames].sort((left, right) => left - right);
  let flapCursor = 0;
  const cap = Math.max(0, Math.trunc(maxFrame));

  for (let frame = 1; frame <= cap; frame += 1) {
    while (flapCursor < frames.length && frames[flapCursor]! < frame) flapCursor += 1;
    while (flapCursor < frames.length && frames[flapCursor] === frame) {
      if (isPlaying(state)) state.bird.vy = FLAP_VELOCITY;
      flapCursor += 1;
    }
    stepFrame(state);
    if (isCrashed(state)) break;
  }

  return {
    pipesPassed: state.score,
    crashed: isCrashed(state),
    framesRun: state.frame,
  };
}

export function flappyAnswer(pipesPassed: number, flapFrames: number[]): string {
  return `flappy:${pipesPassed}:${[...flapFrames].sort((left, right) => left - right).join(",")}`;
}
