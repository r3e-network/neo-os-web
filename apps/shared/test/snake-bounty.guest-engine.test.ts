import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGameSessionObservables } from "@framework/game";
import { createGuestEngine } from "../../snake-bounty/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../snake-bounty/src/logic/guest-engine";
import { parseInitialState, GRID_SIZE, snakeLength, step } from "../../snake-bounty/src/logic/snake-engine";
import type { Direction, Point, SnakeState } from "../../snake-bounty/src/logic/snake-engine";
import { ruleOf } from "../../snake-bounty/src/logic/game-rules";

/**
 * Guest engine tests for Snake Bounty.
 *
 * The guest engine is a purely LOCAL snake — it must drive the same scene
 * observables the gamefi flow does while making ZERO chain / oracle / reward
 * calls. These tests assert the off-chain guest leaderboard is the ONLY
 * external surface it ever touches (and only on submit / refresh / enter,
 * never while dealing or moving).
 */

function safeClues(targetLength: number): string {
  const route: Point[] = [];
  for (let x = 11; x <= 19; x += 1) route.push({ x, y: 10 });
  route.push({ x: 19, y: 11 });
  for (let x = 18; x >= 0; x -= 1) route.push({ x, y: 11 });
  route.push({ x: 0, y: 12 });
  for (let x = 1; x <= 19; x += 1) route.push({ x, y: 12 });
  const foods = route.slice(0, targetLength + 4);
  return JSON.stringify({
    body: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
    direction: 1,
    food: foods[0],
    foodQueue: foods.slice(1),
  });
}

function setup(options: { deterministic?: boolean; storageData?: Map<string, unknown> } = {}) {
  const obs = createGameSessionObservables();
  const clues = createObservable("");
  const currentLength = createObservable(3);
  const snakeDead = createObservable(false);

  const submit = vi.fn(async (_score: number | string) => {});
  const board: Array<{ user: string; score: string }> = [];
  const get = vi.fn(async (_limit?: number) => board.slice());
  const guestLeaderboard = { submit, get };

  const setStatus = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  const storageData = options.storageData ?? new Map<string, unknown>();
  const storage = {
    get<T>(key: string, fallback: T | null = null): T | null {
      return storageData.has(key) ? storageData.get(key) as T : fallback;
    },
    set(key: string, value: unknown): void { storageData.set(key, value); },
    delete(key: string): void { storageData.delete(key); },
  };
  const deps: GuestEngineDeps = {
    obs,
    clues,
    currentLength,
    snakeDead,
    guestLeaderboard,
    storage,
    createClues: options.deterministic ? safeClues : undefined,
    t,
    setStatus,
  };
  const engine = createGuestEngine(deps);
  return { engine, obs, clues, currentLength, snakeDead, submit, get, board, setStatus, storageData };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function directionToFood(state: SnakeState): Direction {
  const head = state.body[0]!;
  const dx = state.food.x - head.x;
  const dy = state.food.y - head.y;
  if (dx === 1 && dy === 0) return 1;
  if (dx === -1 && dy === 0) return 3;
  if (dx === 0 && dy === 1) return 2;
  if (dx === 0 && dy === -1) return 0;
  throw new Error("deterministic food must be adjacent");
}

function playToTarget(h: ReturnType<typeof setup>, target: number): void {
  let local = parseInitialState(h.clues.get());
  while (snakeLength(local) < target) {
    const dir = directionToFood(local);
    h.engine.recordMove(dir);
    local = step(local, dir);
  }
}

describe("snake-bounty guest engine", () => {
  it("deals a fully local board on startGame with no leaderboard writes", () => {
    const h = setup();
    h.engine.startGame(0);

    expect(h.obs.gameStatus.get()).toBe("dealt");
    expect(h.obs.activeGameId.get()).toBe("guest");
    expect(h.obs.commitment.get()).toBe(""); // no on-chain commitment in guest
    expect(h.obs.gameDifficulty.get()).toBe(0);
    expect(h.obs.deadline.get() - h.obs.dealtAt.get()).toBe(ruleOf(0).limitMs);

    // clues is a valid board with enough queued food to reach the target.
    const board = parseInitialState(h.clues.get());
    expect(board.body).toHaveLength(3);
    expect(board.direction).toBe(1);
    expect(board.foodQueue.length).toBeGreaterThanOrEqual(ruleOf(0).targetLength - board.body.length);
    const cells = [board.food, ...board.foodQueue, ...board.body];
    for (const cell of cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.x).toBeLessThan(GRID_SIZE);
      expect(cell.y).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeLessThan(GRID_SIZE);
    }

    // Dealing a board never touches the off-chain board (guard-never-fires analog).
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("generates a distinct board each run (local RNG seed)", () => {
    const h = setup();
    h.engine.startGame(2);
    const first = h.clues.get();
    h.engine.expireGame(); // clean lobby
    h.engine.startGame(2);
    const second = h.clues.get();
    expect(second).not.toBe(first);
  });

  it("selectDifficulty updates the picked difficulty without dealing", () => {
    const h = setup();
    h.engine.selectDifficulty(2);
    expect(h.obs.gameDifficulty.get()).toBe(2);
    expect(h.obs.gameStatus.get()).toBe("idle");
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("recordMove advances the authoritative local state without external writes", () => {
    const h = setup({ deterministic: true });
    h.engine.startGame(0);
    const before = h.clues.get();
    h.engine.recordMove(1);
    expect(h.clues.get()).toBe(before);
    expect(h.currentLength.get()).toBe(4);
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("restores an unfinished local snake, food queue, difficulty, and original clock after reload", async () => {
    const storageData = new Map<string, unknown>();
    const first = setup({ deterministic: true, storageData });
    first.engine.startGame(1);
    const deadline = first.obs.deadline.get();
    first.engine.recordMove(1);
    expect(first.currentLength.get()).toBe(4);

    const restored = setup({ deterministic: true, storageData });
    await restored.engine.enter();

    expect(restored.obs.gameStatus.get()).toBe("dealt");
    expect(restored.obs.activeGameId.get()).toBe("guest");
    expect(restored.obs.gameDifficulty.get()).toBe(1);
    expect(restored.obs.deadline.get()).toBe(deadline);
    expect(restored.currentLength.get()).toBe(4);
    expect(parseInitialState(restored.clues.get()).body).toHaveLength(4);
    expect(restored.obs.lastStatus.get()).toBe("guestRunRecovered");

    const state = parseInitialState(restored.clues.get());
    restored.engine.recordMove(directionToFood(state));
    expect(restored.currentLength.get()).toBe(5);
  });

  it("can finish a target-reaching move persisted just before reload", async () => {
    const storageData = new Map<string, unknown>();
    const first = setup({ deterministic: true, storageData });
    first.engine.startGame(0);
    playToTarget(first, ruleOf(0).targetLength);
    expect(first.obs.gameStatus.get()).toBe("dealt");

    const restored = setup({ deterministic: true, storageData });
    await restored.engine.enter();
    expect(restored.currentLength.get()).toBe(ruleOf(0).targetLength);

    await restored.engine.submitSolution();
    expect(restored.obs.gameStatus.get()).toBe("solved");
    expect(restored.obs.activeGameId.get()).toBe("0");
  });

  it("discards an expired persisted run instead of silently extending its timer", async () => {
    const storageData = new Map<string, unknown>();
    const first = setup({ deterministic: true, storageData });
    first.engine.startGame(0);
    const key = [...storageData.keys()].find((candidate) => candidate.includes("guest-active-run"));
    expect(key).toBeTruthy();
    const saved = storageData.get(key!) as { deadline: number };
    saved.deadline = Date.now() - 1;

    const restored = setup({ deterministic: true, storageData });
    await restored.engine.enter();

    expect(restored.obs.gameStatus.get()).toBe("idle");
    expect(restored.obs.activeGameId.get()).toBe("0");
    expect(restored.clues.get()).toBe("");
    expect(storageData.has(key!)).toBe(false);
  });

  it("fails closed when secure local randomness is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    const h = setup();

    expect(() => h.engine.startGame(0)).toThrow("secureRandomUnavailable");
    expect(h.obs.gameStatus.get()).toBe("idle");
    expect(h.setStatus).toHaveBeenCalledWith("secureRandomUnavailable", "error");
  });

  it("rejects a direct submit before the snake reaches the target", async () => {
    const h = setup({ deterministic: true });
    h.engine.startGame(0);
    await h.engine.submitSolution();
    expect(h.obs.gameStatus.get()).toBe("dealt");
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.setStatus).toHaveBeenCalledWith("guestRunIncomplete", "warning");
  });

  it("submitSolution records the trail length off-chain and returns to lobby", async () => {
    const h = setup({ deterministic: true });
    h.engine.startGame(1); // medium → target 20
    const target = ruleOf(1).targetLength;
    playToTarget(h, target);
    await h.engine.submitSolution();

    expect(h.obs.gameStatus.get()).toBe("solved");
    expect(h.obs.activeGameId.get()).toBe("0");
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.submit).toHaveBeenCalledWith(target); // trail length, not GAS
    expect(h.get).toHaveBeenCalled(); // guest board refreshed after settle
    expect(h.obs.lastPayout.get()).toBe(String(target));
    expect(h.obs.myTotalWon.get()).toBe(target); // best length, not GAS
    expect(h.obs.mySolves.get()).toBe(1);
    expect(h.obs.isSubmitting.get()).toBe(false);
  });

  it("keeps the best length across runs on repeated submits", async () => {
    const h = setup({ deterministic: true });
    h.engine.startGame(2); // hard → 35
    playToTarget(h, ruleOf(2).targetLength);
    await h.engine.submitSolution();
    expect(h.obs.myTotalWon.get()).toBe(ruleOf(2).targetLength);

    h.engine.startGame(0); // easy → 10 (lower)
    playToTarget(h, ruleOf(0).targetLength);
    await h.engine.submitSolution();
    expect(h.obs.myTotalWon.get()).toBe(ruleOf(2).targetLength); // unchanged (best kept)
    expect(h.obs.mySolves.get()).toBe(2);
  });

  it("expireGame resets to a clean local lobby", () => {
    const h = setup();
    h.engine.startGame(0);
    h.engine.expireGame();
    expect(h.obs.gameStatus.get()).toBe("idle");
    expect(h.obs.activeGameId.get()).toBe("0");
    expect(h.clues.get()).toBe("");
    expect(h.obs.deadline.get()).toBe(0);
  });

  it("enter() zeroes on-chain counters and loads the off-chain board", async () => {
    const h = setup();
    // Pretend a prior gamefi read populated these before switching to guest.
    h.obs.credit.set(5);
    h.obs.poolFree.set(9);
    h.obs.myRank.set(3);
    h.obs.myTotalWon.set(9);
    h.obs.mySolves.set(4);

    await h.engine.enter();

    expect(h.obs.credit.get()).toBe(0);
    expect(h.obs.poolFree.get()).toBe(0);
    expect(h.obs.myRank.get()).toBe(0);
    expect(h.obs.myTotalWon.get()).toBe(0);
    expect(h.obs.mySolves.get()).toBe(0);
    expect(h.obs.gameStatus.get()).toBe("idle");
    expect(h.get).toHaveBeenCalled(); // guest board loaded
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("restores the local best and solve count on a later engine instance", async () => {
    const storageData = new Map<string, unknown>();
    const first = setup({ deterministic: true, storageData });
    first.engine.startGame(0);
    playToTarget(first, ruleOf(0).targetLength);
    await first.engine.submitSolution();

    const restored = setup({ deterministic: true, storageData });
    await restored.engine.enter();
    expect(restored.obs.myTotalWon.get()).toBe(ruleOf(0).targetLength);
    expect(restored.obs.mySolves.get()).toBe(1);
  });

  it("maps the off-chain guest board into ranked leaderboard entries", async () => {
    const h = setup();
    h.board.push({ user: "NplayerA", score: "12" });
    h.board.push({ user: "NplayerB", score: "27" });

    await h.engine.refreshLeaderboard();

    const ranked = h.obs.leaderboard.get();
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.address).toBe("NplayerB");
    expect(ranked[0]?.totalWon).toBe(27);
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[1]?.rank).toBe(2);
  });
});
