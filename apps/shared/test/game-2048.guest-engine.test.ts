import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGameSessionObservables } from "@framework/game";
import { createGuestEngine } from "../../game-2048/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../game-2048/src/logic/guest-engine";
import { applyMove } from "../../game-2048/src/logic/engine-2048";
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

function makeObs<T>(initial: T) {
  return createObservable<T>(initial);
}

function setup() {
  const obs = createGameSessionObservables();
  const runBoard = makeObs<number[]>([]);
  const runMoveCount = makeObs<number>(0);
  const runMaxExp = makeObs<number>(0);
  const isMoving = makeObs<boolean>(false);
  const balancesReady = makeObs<boolean>(false);

  const submit = vi.fn(async (_score: number | string) => {});
  const board: Array<{ user: string; score: string }> = [];
  const get = vi.fn(async (_limit?: number) => board.slice());
  const guestLeaderboard = { submit, get };

  const setStatus = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  const deps: GuestEngineDeps = {
    obs,
    runBoard,
    runMoveCount,
    runMaxExp,
    isMoving,
    balancesReady,
    guestLeaderboard,
    t,
    setStatus,
  };
  const engine = createGuestEngine(deps);
  return { engine, obs, runBoard, runMoveCount, runMaxExp, isMoving, balancesReady, submit, get, board, setStatus };
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

  it("commits a valid move after the local latency and spawns a tile, no writes", () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });
    const dir = firstValidDir(h.runBoard.get());
    expect(dir).toBeGreaterThanOrEqual(0);

    h.engine.playMove({ dir });
    // Move is pending: board unchanged, isMoving true (mirrors gamefi round-trip).
    expect(h.isMoving.get()).toBe(true);
    expect(h.runMoveCount.get()).toBe(0);

    vi.advanceTimersByTime(200);

    expect(h.isMoving.get()).toBe(false);
    expect(h.runMoveCount.get()).toBe(1);
    const after = h.runBoard.get();
    expect(after.filter((v) => v > 0).length).toBeGreaterThanOrEqual(2); // move + spawn
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
    vi.advanceTimersByTime(200);
    expect(h.runMoveCount.get()).toBe(1);
  });

  it("submitRun settles the run, records the best tile off-chain, and returns to lobby", async () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });
    const maxExp = h.runMaxExp.get();

    await h.engine.submitRun();

    expect(h.obs.gameStatus.get()).toBe("solved");
    expect(h.obs.activeGameId.get()).toBe("0");
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.submit).toHaveBeenCalledWith(2 ** maxExp); // highest tile value
    expect(h.get).toHaveBeenCalled(); // guest board refreshed after settle
    expect(h.obs.myTotalWon.get()).toBe(2 ** maxExp); // best tile, not GAS
  });

  it("undo trims the last move locally with no penalty status", async () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });
    const dir = firstValidDir(h.runBoard.get());
    h.engine.playMove({ dir });
    vi.advanceTimersByTime(200);
    expect(h.runMoveCount.get()).toBe(1);

    h.engine.useUndo();

    expect(h.runMoveCount.get()).toBe(0);
    expect(h.obs.lastStatus.get()).toBe("guestUndo");
    expect(h.obs.undosUsed.get()).toBe(0); // no reward penalty tracked in guest
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
