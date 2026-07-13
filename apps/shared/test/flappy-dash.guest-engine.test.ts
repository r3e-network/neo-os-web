import { describe, expect, it, vi, afterEach } from "vitest";

import { createGameSessionObservables } from "@framework/game";
import { createObservable } from "../react/context";
import { createGuestEngine } from "../../flappy-dash/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../flappy-dash/src/logic/guest-engine";
import { ruleOf } from "../../flappy-dash/src/logic/game-rules";

function setup() {
  const obs = createGameSessionObservables();
  const seed = createObservable("");
  const pipesPassed = createObservable(0);
  const board: Array<{ user: string; score: string }> = [];
  const submit = vi.fn(async (_score: number | string) => {});
  const get = vi.fn(async (_limit?: number) => board.slice());
  const setStatus = vi.fn();
  const stored = new Map<string, unknown>();
  const storage = {
    get<T>(key: string, fallback?: T | null): T | null {
      return (stored.has(key) ? stored.get(key) : fallback ?? null) as T | null;
    },
    set(key: string, value: unknown): void {
      stored.set(key, structuredClone(value));
    },
  };
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  const deps: GuestEngineDeps = {
    obs,
    seed,
    pipesPassed,
    guestLeaderboard: { submit, get },
    storage,
    t,
    setStatus,
  };
  const engine = createGuestEngine(deps);
  return { engine, obs, seed, pipesPassed, board, submit, get, setStatus, stored };
}

describe("flappy-dash guest engine", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deals a local pipe seed and never writes the board while starting", () => {
    const h = setup();

    h.engine.startGame(2);

    expect(h.obs.gameStatus.get()).toBe("dealt");
    expect(h.obs.activeGameId.get()).toBe("guest");
    expect(h.obs.gameDifficulty.get()).toBe(2);
    expect(h.obs.commitment.get()).toBe("");
    expect(h.seed.get()).toMatch(/^[0-9a-f]{32}$/);
    expect(h.obs.deadline.get() - h.obs.dealtAt.get()).toBe(ruleOf(2).limitMs);
    expect(h.pipesPassed.get()).toBe(0);
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("tracks pipes forward-only with no leaderboard write during play", () => {
    const h = setup();
    h.engine.startGame(0);

    h.engine.recordFlap(3);
    h.engine.recordFlap(2);
    h.engine.recordFlap(7);

    expect(h.pipesPassed.get()).toBe(7);
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("syncs the local HUD without a leaderboard or chain-shaped side effect", () => {
    const h = setup();
    h.engine.startGame(1);
    h.engine.recordFlap(6);

    h.engine.syncScore(2);

    expect(h.pipesPassed.get()).toBe(2);
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("settles the local run, writes only the pipe score, and refreshes the guest board", async () => {
    const h = setup();
    h.board.push({ user: "Nfast", score: "12" });
    h.board.push({ user: "Nslow", score: "4" });
    h.engine.startGame(0);
    h.engine.recordFlap(6);

    await h.engine.submitSolution(9);

    expect(h.obs.gameStatus.get()).toBe("solved");
    expect(h.obs.activeGameId.get()).toBe("0");
    expect(h.pipesPassed.get()).toBe(9);
    expect(h.obs.lastPayout.get()).toBe('guestLastPayout:{"pipes":9}');
    expect(h.obs.myTotalWon.get()).toBe(9);
    expect(h.obs.mySolves.get()).toBe(1);
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.submit).toHaveBeenCalledWith(9);
    expect(h.get).toHaveBeenCalled();
    expect(h.obs.leaderboard.get()[0]).toMatchObject({ address: "Nfast", totalWon: 12, rank: 1 });
    expect(h.setStatus).toHaveBeenCalledWith('guestRunComplete:{"count":9}', "success");
  });

  it("saves a crashed score without calling it a clear", async () => {
    const h = setup();
    h.engine.startGame(1);
    h.engine.recordFlap(4);

    await h.engine.submitSolution(4);

    expect(h.obs.gameStatus.get()).toBe("expired");
    expect(h.obs.myTotalWon.get()).toBe(4);
    expect(h.obs.mySolves.get()).toBe(0);
    expect(h.obs.lastStatus.get()).toBe('guestScoreSaved:{"count":4}');
    expect(h.setStatus).toHaveBeenCalledWith('guestScoreSaved:{"count":4}', "info");
  });

  it("restores the local best and clear count from framework storage", async () => {
    const h = setup();
    h.stored.set("guest:profile", { bestScore: 14, clears: 3 });

    await h.engine.enter();

    expect(h.obs.myTotalWon.get()).toBe(14);
    expect(h.obs.mySolves.get()).toBe(3);
  });

  it("enter() zeros gamefi counters and loads only the guest board", async () => {
    const h = setup();
    h.obs.credit.set(3);
    h.obs.poolFree.set(10);
    h.obs.myRank.set(4);
    h.obs.myTotalWon.set(99);
    h.obs.mySolves.set(8);
    h.obs.myHistory.set([{ gameId: "1", difficulty: 0, solveMs: 1, undos: 0, payout: "1 GAS" }]);

    await h.engine.enter();

    expect(h.obs.credit.get()).toBe(0);
    expect(h.obs.poolFree.get()).toBe(0);
    expect(h.obs.myRank.get()).toBe(0);
    expect(h.obs.myTotalWon.get()).toBe(0);
    expect(h.obs.mySolves.get()).toBe(0);
    expect(h.obs.myHistory.get()).toEqual([]);
    expect(h.obs.gameStatus.get()).toBe("idle");
    expect(h.seed.get()).toBe("");
    expect(h.get).toHaveBeenCalled();
    expect(h.submit).not.toHaveBeenCalled();
  });
});
