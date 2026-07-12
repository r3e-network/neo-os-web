import { describe, expect, it } from "vitest";

import {
  BIRD_HEIGHT,
  BIRD_X,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GROUND_HEIGHT,
  PIPE_WIDTH,
  SeededRandom,
  createGameState,
  flightTuningOf,
  flap,
  updateFrame,
} from "../../flappy-dash/src/logic/flappy-engine";

const BIRD_START_Y = CANVAS_HEIGHT / 2 - BIRD_HEIGHT / 2;

/**
 * Flappy Dash engine tests.
 *
 * The engine generates deterministic pipe layouts from TEE seeds, runs physics
 * (gravity, flap, collision), and tracks score for win/lose conditions.
 */

describe("flappy-dash seeded RNG", () => {
  it("produces deterministic sequences from the same seed", () => {
    const a = new SeededRandom("seed123");
    const b = new SeededRandom("seed123");
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("produces different sequences from different seeds", () => {
    const a = new SeededRandom("alpha");
    const b = new SeededRandom("beta");
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("nextInt returns values within the inclusive range", () => {
    const rng = new SeededRandom("range-test");
    for (let i = 0; i < 200; i++) {
      const val = rng.nextInt(5, 15);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(15);
    }
  });

  it("next returns values in [0, 1)", () => {
    const rng = new SeededRandom("unit-test");
    for (let i = 0; i < 200; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});

describe("flappy-dash game state and physics", () => {
  it("createGameState initialises bird at centre with zero velocity and ready phase", () => {
    const state = createGameState("test-seed");
    expect(state.phase).toBe("ready");
    expect(state.score).toBe(0);
    expect(state.frame).toBe(0);
    expect(state.bird.y).toBe(BIRD_START_Y);
    expect(state.bird.vy).toBe(0);
    expect(state.bird.rotation).toBe(0);
    expect(state.pipes).toEqual([]);
    expect(state.flaps).toEqual([]);
    expect(state.difficulty).toBe(0);
    expect(state.tuning).toEqual(flightTuningOf(0));
    expect(state.nextSpawnFrame).toBe(state.tuning.firstPipeFrame);
  });

  it("uses distinct, progressively tighter flight tuning for every route", () => {
    const easy = createGameState("route-tuning", 0);
    const medium = createGameState("route-tuning", 1);
    const hard = createGameState("route-tuning", 2);

    expect(easy.tuning.pipeGap).toBeGreaterThan(medium.tuning.pipeGap);
    expect(medium.tuning.pipeGap).toBeGreaterThan(hard.tuning.pipeGap);
    expect(easy.tuning.pipeSpeed).toBeLessThan(medium.tuning.pipeSpeed);
    expect(medium.tuning.pipeSpeed).toBeLessThan(hard.tuning.pipeSpeed);
    expect(easy.tuning.pipeSpawnInterval).toBeGreaterThan(medium.tuning.pipeSpawnInterval);
    expect(medium.tuning.pipeSpawnInterval).toBeGreaterThan(hard.tuning.pipeSpawnInterval);
  });

  it("flap sets upward velocity and records the frame when playing", () => {
    const state = createGameState("flap-test");
    state.phase = "playing";
    state.frame = 42;
    flap(state);
    expect(state.bird.vy).toBe(state.tuning.flapVelocity);
    expect(state.flaps).toEqual([42]);
  });

  it("flap has no effect when not in playing phase", () => {
    const state = createGameState("flap-idle");
    state.phase = "ready";
    state.frame = 10;
    flap(state);
    expect(state.flaps).toEqual([]);
    expect(state.bird.vy).toBe(0);
  });

  it("updateFrame applies gravity to the bird each frame", () => {
    const state = createGameState("gravity-test");
    state.phase = "playing";
    const startY = state.bird.y;
    updateFrame(state);
    // Bird should have fallen by gravity amount
    expect(state.bird.vy).toBe(state.tuning.gravity);
    expect(state.bird.y).toBeGreaterThan(startY);
  });

  it("updateFrame caps fall velocity at the route maximum", () => {
    const state = createGameState("max-fall-test");
    state.phase = "playing";
    // Simulate many frames of falling without flapping
    for (let i = 0; i < 50; i++) {
      updateFrame(state);
    }
    // Velocity should not exceed MAX_FALL_VELOCITY
    expect(state.bird.vy).toBeLessThanOrEqual(state.tuning.maxFallVelocity);
  });

  it("updateFrame detects ground collision and transitions to crashed", () => {
    const state = createGameState("ground-collision");
    state.phase = "playing";
    // Place the bird at the ground
    state.bird.y = CANVAS_HEIGHT - GROUND_HEIGHT - BIRD_HEIGHT + 1;
    state.bird.vy = 5;
    updateFrame(state);
    expect(state.phase).toBe("crashed");
    // Bird should be clamped to ground level
    expect(state.bird.y).toBe(CANVAS_HEIGHT - GROUND_HEIGHT - BIRD_HEIGHT);
  });

  it("updateFrame bonks ceiling and resets velocity to 0", () => {
    const state = createGameState("ceiling-bonk");
    state.phase = "playing";
    state.bird.y = -5;
    state.bird.vy = -10;
    updateFrame(state);
    expect(state.bird.y).toBe(0);
    expect(state.bird.vy).toBe(0);
  });

  it("pipes spawn at the configured first-gate frame", () => {
    const state = createGameState("pipe-spawn");
    state.phase = "playing";
    // Advance to just before first spawn — flap when the bird sinks so it does
    // not crash into the ground before the first pipe spawns at frame 60.
    while (state.frame < state.tuning.firstPipeFrame - 1) {
      if (state.bird.y > CANVAS_HEIGHT / 2) flap(state);
      updateFrame(state);
    }
    expect(state.pipes.length).toBe(0); // not yet spawned
    updateFrame(state); // configured frame → first spawn
    expect(state.pipes.length).toBe(1);
    // The pipe spawns at CANVAS_WIDTH then scrolls left by the route speed in
    // the same frame.
    expect(state.pipes[0].x).toBe(CANVAS_WIDTH - state.tuning.pipeSpeed);
    expect(state.pipes[0].gapY).toBeGreaterThanOrEqual(state.tuning.pipeMargin);
    expect(state.pipes[0].scored).toBe(false);
  });

  it("pipes scroll left each frame and are removed when off-screen", () => {
    const state = createGameState("pipe-scroll");
    state.phase = "playing";
    // Spawn a pipe by advancing frames — keep the bird alive with flaps so the
    // phase stays "playing" until the first pipe spawns.
    while (state.pipes.length === 0) {
      if (state.bird.y > CANVAS_HEIGHT / 2) flap(state);
      updateFrame(state);
    }
    const pipeX = state.pipes[0].x;
    updateFrame(state);
    expect(state.pipes[0].x).toBe(pipeX - state.tuning.pipeSpeed);
  });
});

describe("flappy-dash scoring and collision", () => {
  it("increments score when bird passes a pipe", () => {
    const state = createGameState("scoring");
    state.phase = "playing";
    // Manually place a pipe just before the bird
    state.pipes.push({
      x: BIRD_X - PIPE_WIDTH + 1, // just about to pass
      gapY: 200,
      scored: false,
    });
    const prevScore = state.score;
    updateFrame(state);
    // Pipe should now be scored
    expect(state.score).toBe(prevScore + 1);
    expect(state.pipes[0].scored).toBe(true);
  });

  it("detects collision with top pipe and transitions to crashed", () => {
    const state = createGameState("top-pipe-collision");
    state.phase = "playing";
    // Place bird overlapping the top pipe area
    state.bird.y = 0;
    state.pipes.push({
      x: BIRD_X - 10,
      gapY: 100, // top pipe occupies y 0..100
      scored: false,
    });
    updateFrame(state);
    expect(state.phase).toBe("crashed");
  });

  it("detects collision with bottom pipe and transitions to crashed", () => {
    const state = createGameState("bottom-pipe-collision");
    state.phase = "playing";
    // Place bird near the bottom overlapping the bottom pipe
    state.bird.y = CANVAS_HEIGHT - GROUND_HEIGHT - BIRD_HEIGHT - 10;
    state.pipes.push({
      x: BIRD_X - 10,
      gapY: 100,
      scored: false,
    });
    updateFrame(state);
    expect(state.phase).toBe("crashed");
  });

  it("no collision when bird passes cleanly through the gap", () => {
    const state = createGameState("clean-pass");
    state.phase = "playing";
    // Keep the bird centred in the route's gap and
    // scroll the pipe fully past the bird — it should score, never crash.
    state.pipes.push({
      x: BIRD_X - 10,
      gapY: 250,
      scored: false,
    });
    // A pipe scores once its right edge (x + PIPE_WIDTH) clears the bird's left
    // edge (BIRD_X); advance enough frames for the pipe to fully pass.
    for (let i = 0; i < 60 && state.pipes.length > 0 && !state.pipes[0]?.scored; i++) {
      state.bird.y = 250 + state.tuning.pipeGap / 2 - BIRD_HEIGHT / 2;
      updateFrame(state);
    }
    expect(state.phase).toBe("playing");
    expect(state.score).toBe(1);
  });

  it("uses the artwork body rather than transparent sprite padding for near misses", () => {
    const state = createGameState("forgiving-hitbox", 0);
    state.phase = "playing";
    state.bird.y = 198;
    state.bird.vy = 0;
    state.pipes.push({ x: BIRD_X, gapY: 200, scored: false });

    updateFrame(state);

    expect(state.phase).toBe("playing");
  });
});
