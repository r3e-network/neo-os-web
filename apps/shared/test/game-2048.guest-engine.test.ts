import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGameSessionObservables } from "@framework/game";
import { createGuestEngine } from "../../game-2048/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../game-2048/src/logic/guest-engine";
import {
  MOVE_ANIMATION_MS,
  applyMove,
} from "../../game-2048/src/logic/engine-2048";
import type { MoveTransition } from "../../game-2048/src/logic/engine-2048";
import { ruleOf } from "../../game-2048/src/logic/game-rules";

/**
 * Guest engine tests for 2048 Rush.
 *
 * The guest engine is a purely LOCAL 2048 — it must drive the same scene
 * observables the gamefi flow does while making ZERO chain / oracle / reward
 * calls. These tests exercise the local rules and assert the off-chain
 * leaderboard is the ONLY external surface it ever touches (and only on
 * settle/refresh, never during play).
 */

function memoryStorage() {
  const values = new Map<string, unknown>();
  return {
    get<T>(key: string, fallback: T | null = null): T | null {
      return values.has(key) ? values.get(key) as T : fallback;
    },
    set(key: string, value: unknown): void {
      values.set(key, structuredClone(value));
    },
    delete(key: string): void {
      values.delete(key);
    },
  };
}

function setup(overrides: Partial<GuestEngineDeps> = {}) {
  const obs = createGameSessionObservables();
  const runBoard = createObservable<number[]>([]);
  const runMoveCount = createObservable<number>(0);
  const runMaxExp = createObservable<number>(0);
  const moveTransition = createObservable<MoveTransition | null>(null);
  const isMoving = createObservable<boolean>(false);
  const balancesReady = createObservable<boolean>(false);

  const submit = vi.fn(async (_score: number | string) => {});
  const board: Array<{ user: string; score: string }> = [];
  const get = vi.fn(async (_limit?: number) => board.slice());
  const guestLeaderboard = { submit, get };
  const storage = overrides.storage ?? memoryStorage();

  const setStatus = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  const deps: GuestEngineDeps = {
    obs,
    runBoard,
    runMoveCount,
    runMaxExp,
    moveTransition,
    isMoving,
    balancesReady,
    guestLeaderboard,
    storage,
    t,
    setStatus,
    ...overrides,
  };
  const engine = createGuestEngine(deps);
  return {
    engine,
    obs,
    runBoard,
    runMoveCount,
    runMaxExp,
    moveTransition,
    isMoving,
    balancesReady,
    submit,
    get,
    board,
    storage,
    setStatus,
  };
}

/** Find a direction (0..3) that changes the given board, or -1 if none. */
function firstValidDir(board: number[]): number {
  for (let dir = 0; dir < 4; dir += 1) {
    if (applyMove([...board], dir)) return dir;
  }
  return -1;
}

describe("game-2048 guest engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("deals a fully local board on startGame with no leaderboard writes", () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });

    expect(h.obs.gameStatus.get()).toBe("dealt");
    expect(h.obs.activeGameId.get()).toBe("guest");
    expect(h.obs.commitment.get()).toBe(""); // no on-chain commitment in guest
    const b = h.runBoard.get();
    expect(b).toHaveLength(16);
    expect(b.filter((v) => v > 0)).toHaveLength(2); // two starting tiles
    expect(h.obs.deadline.get()).toBeGreaterThan(h.obs.dealtAt.get());
    expect(h.obs.deadline.get() - h.obs.dealtAt.get()).toBe(ruleOf(0).limitMs);
    // Dealing a board never touches the off-chain board.
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("commits a valid move with an authoritative trace and holds the animation lock", () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });
    const before = [...h.runBoard.get()];
    const dir = firstValidDir(before);
    expect(dir).toBeGreaterThanOrEqual(0);

    h.engine.playMove({ dir });
    // Move is pending: board unchanged, isMoving true (mirrors gamefi round-trip).
    expect(h.isMoving.get()).toBe(true);
    expect(h.runMoveCount.get()).toBe(0);
    expect(h.moveTransition.get()).toBeNull();

    vi.advanceTimersByTime(200);

    // The local move has committed, but input stays locked through Phaser's
    // slide + merge/spawn window.
    expect(h.isMoving.get()).toBe(true);
    expect(h.runMoveCount.get()).toBe(1);
    const after = h.runBoard.get();
    expect(after.filter((v) => v > 0).length).toBeGreaterThanOrEqual(2); // move + spawn
    const transition = h.moveTransition.get();
    expect(transition?.before).toEqual(before);
    expect(transition?.after).toEqual(after);
    expect(transition?.motions.map((motion) => motion.source).sort((a, b) => a - b)).toEqual(
      before.flatMap((exp, index) => (exp > 0 ? [index] : [])),
    );

    vi.advanceTimersByTime(MOVE_ANIMATION_MS);
    expect(h.isMoving.get()).toBe(false);
    // A normal move never hits the off-chain board (guard-never-fires analog).
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("ignores no-op moves and blocks input while a move is in flight", () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });
    const dir = firstValidDir(h.runBoard.get());

    h.engine.playMove({ dir });
    expect(h.isMoving.get()).toBe(true);
    // Second move while in flight is dropped.
    h.engine.playMove({ dir });
    vi.advanceTimersByTime(200 + MOVE_ANIMATION_MS);
    expect(h.runMoveCount.get()).toBe(1);
  });

  it("submitRun settles the run, records the best tile off-chain, and returns to lobby", async () => {
    const winningBoard = [9, ...new Array(15).fill(0)];
    const h = setup({ initialBoardFactory: () => winningBoard });
    h.engine.startGame({ difficulty: 0 });
    const maxExp = h.runMaxExp.get();

    await h.engine.submitRun();

    expect(h.obs.gameStatus.get()).toBe("solved");
    expect(h.obs.activeGameId.get()).toBe("0");
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.submit).toHaveBeenCalledWith(2 ** maxExp); // highest tile value
    expect(h.get).toHaveBeenCalled(); // guest board refreshed after settle
    expect(h.obs.myTotalWon.get()).toBe(2 ** maxExp); // best tile, not GAS
    expect(h.obs.myHistory.get()[0]).toMatchObject({
      difficulty: 0,
      payout: "0 GAS",
      bestTile: 512,
      won: true,
    });
  });

  it("rejects an early guest settlement before the target or game-over state", async () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });

    await h.engine.submitRun();

    expect(h.obs.gameStatus.get()).toBe("dealt");
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.obs.lastStatus.get()).toContain("guestTargetPending");
  });

  it("fails closed when secure randomness is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    const h = setup();

    expect(() => h.engine.startGame({ difficulty: 0 })).toThrow("secureRandomUnavailable");
    expect(h.obs.gameStatus.get()).toBe("idle");
    expect(h.setStatus).toHaveBeenCalledWith("secureRandomUnavailable", "error");
  });

  it("undo trims the last move locally and consumes one of the three rescues", async () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });
    const dir = firstValidDir(h.runBoard.get());
    h.engine.playMove({ dir });
    vi.advanceTimersByTime(200 + MOVE_ANIMATION_MS);
    expect(h.runMoveCount.get()).toBe(1);

    h.engine.useUndo();

    expect(h.runMoveCount.get()).toBe(0);
    expect(h.moveTransition.get()).toBeNull();
    expect(h.obs.lastStatus.get()).toBe("guestUndo");
    expect(h.obs.undosUsed.get()).toBe(1);
  });

  it("restores an unfinished board, timer, and undo count after reload", async () => {
    const first = setup();
    first.engine.startGame({ difficulty: 1 });
    const dir = firstValidDir(first.runBoard.get());
    first.engine.playMove({ dir });
    vi.advanceTimersByTime(200 + MOVE_ANIMATION_MS);
    first.engine.useUndo();

    const expectedBoard = [...first.runBoard.get()];
    const expectedDeadline = first.obs.deadline.get();
    const second = setup({ storage: first.storage });
    await second.engine.enter();

    expect(second.obs.gameStatus.get()).toBe("dealt");
    expect(second.obs.activeGameId.get()).toBe("guest");
    expect(second.obs.gameDifficulty.get()).toBe(1);
    expect(second.obs.deadline.get()).toBe(expectedDeadline);
    expect(second.obs.undosUsed.get()).toBe(1);
    expect(second.runBoard.get()).toEqual(expectedBoard);
    expect(second.obs.lastStatus.get()).toBe("guestRunRecovered");
  });

  it("persists best tile and local history across sessions", async () => {
    const winningBoard = [9, ...new Array(15).fill(0)];
    const first = setup({ initialBoardFactory: () => winningBoard });
    first.engine.startGame({ difficulty: 0 });
    await first.engine.submitRun();

    const second = setup({ storage: first.storage });
    await second.engine.enter();

    expect(second.obs.myTotalWon.get()).toBe(512);
    expect(second.obs.mySolves.get()).toBe(1);
    expect(second.obs.myHistory.get()[0]).toMatchObject({
      bestTile: 512,
      difficulty: 0,
      won: true,
    });
  });

  it("enter() zeroes on-chain counters and loads the off-chain board", async () => {
    const h = setup();
    // Pretend a prior gamefi read populated these before switching to guest.
    h.obs.credit.set(5);
    h.obs.poolFree.set(9);
    h.obs.myRank.set(3);

    await h.engine.enter();

    expect(h.obs.credit.get()).toBe(0);
    expect(h.obs.poolFree.get()).toBe(0);
    expect(h.obs.myRank.get()).toBe(0);
    expect(h.obs.gameStatus.get()).toBe("idle");
    expect(h.balancesReady.get()).toBe(true);
    expect(h.get).toHaveBeenCalled(); // guest board loaded
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("maps the off-chain guest board into ranked leaderboard entries", async () => {
    const h = setup();
    h.board.push({ user: "NplayerA", score: "512" });
    h.board.push({ user: "NplayerB", score: "1024" });

    await h.engine.refreshLeaderboard();

    const ranked = h.obs.leaderboard.get();
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.address).toBe("NplayerB");
    expect(ranked[0]?.totalWon).toBe(1024);
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[1]?.rank).toBe(2);
  });
});
