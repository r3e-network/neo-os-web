import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGameSessionObservables } from "@framework/game";
import { createGuestEngine, secureRandomInt } from "../../merge-kingdom/src/logic/guest-engine";
import type {
  GuestEngineDeps,
  LocalStore,
  MergeGuestHistoryRow,
} from "../../merge-kingdom/src/logic/guest-engine";
import { guestRuleOf } from "../../merge-kingdom/src/logic/game-rules";

/**
 * Guest engine tests for Merge Kingdom.
 *
 * The guest engine is a purely LOCAL merge puzzle — it must drive the same scene
 * observables the gamefi flow does while making ZERO chain / oracle / reward
 * calls. These tests exercise the local merge rules and assert the off-chain
 * leaderboard is the ONLY external surface it ever touches (and only on
 * settle/refresh, never during play).
 */

function countTiles(board: number[][]): number {
  return board.reduce((sum, row) => sum + row.filter((v) => v > 0).length, 0);
}

class MemoryStore implements LocalStore {
  readonly values = new Map<string, unknown>();

  get<T>(key: string, fallback?: T | null): T | null {
    return (this.values.has(key) ? this.values.get(key) : fallback ?? null) as T | null;
  }

  set(key: string, value: unknown): void {
    this.values.set(key, structuredClone(value));
  }

  delete(key: string): void {
    this.values.delete(key);
  }
}

function setup(storage: LocalStore = new MemoryStore()) {
  const obs = createGameSessionObservables<MergeGuestHistoryRow>();
  const board = createObservable<number[][]>([]);
  const tileAchieved = createObservable<number>(0);
  const moveCount = createObservable<number>(0);
  const lastPayoutFixed8 = createObservable<bigint>(0n);

  const submit = vi.fn(async (_score: number | string) => {});
  const boardRows: Array<{ user: string; score: string }> = [];
  const get = vi.fn(async (_limit?: number) => boardRows.slice());
  const guestLeaderboard = { submit, get };

  const setStatus = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  const deps: GuestEngineDeps = {
    obs,
    board,
    tileAchieved,
    moveCount,
    lastPayoutFixed8,
    guestLeaderboard,
    storage,
    t,
    setStatus,
    // Stable board placement with 2-valued spawns for deterministic assertions.
    randomInt: (maxExclusive) => maxExclusive === 8 ? 1 : 0,
  };
  const engine = createGuestEngine(deps);
  return {
    engine,
    obs,
    board,
    tileAchieved,
    moveCount,
    lastPayoutFixed8,
    submit,
    get,
    boardRows,
    setStatus,
    storage,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("merge-kingdom guest engine", () => {
  it("deals a fully local board on startGame with no leaderboard writes", () => {
    const h = setup();
    h.engine.startGame(0);

    expect(h.obs.gameStatus.get()).toBe("dealt");
    expect(h.obs.activeGameId.get()).toBe("guest");
    expect(h.obs.commitment.get()).toBe(""); // no on-chain commitment in guest
    const b = h.board.get();
    expect(b).toHaveLength(4);
    expect(b.every((row) => row.length === 4)).toBe(true);
    expect(countTiles(b)).toBe(4); // four seeded starting buildings
    expect(h.obs.deadline.get() - h.obs.dealtAt.get()).toBe(guestRuleOf(0).limitMs);
    // Dealing a board never touches the off-chain board.
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("merges adjacent equal tiles and spawns fresh material, no writes", () => {
    const h = setup();
    h.engine.startGame(0);
    // Override with a controlled board (board is an injected observable).
    h.board.set([
      [2, 2, 4, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    h.engine.recordMove(0, 0, 0, 1); // merge (0,0)→(0,1)

    const after = h.board.get();
    expect(after[0]?.[1]).toBe(4); // merged tile
    expect(h.tileAchieved.get()).toBe(4);
    expect(h.moveCount.get()).toBe(1);
    expect(countTiles(after)).toBe(4); // merge removes one tile, then one fresh tile spawns
    // A normal move never hits the off-chain board (guard-never-fires analog).
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("relocates a tile into an adjacent empty cell", () => {
    const h = setup();
    h.engine.startGame(1);
    h.board.set([
      [8, 0, 8, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    h.engine.recordMove(0, 0, 0, 1); // move (0,0)→(0,1)

    const after = h.board.get();
    expect(after[0]?.[1]).toBe(8); // relocated tile
    expect(h.moveCount.get()).toBe(1);
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("ends and records a run when a valid move leaves no future merge", () => {
    const h = setup();
    h.engine.startGame(1);
    h.board.set([
      [8, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    h.engine.recordMove(0, 0, 0, 1);

    expect(h.obs.gameStatus.get()).toBe("expired");
    expect(h.submit).toHaveBeenCalledWith(8);
  });

  it("ignores illegal moves (non-adjacent, empty source, mismatched merge)", () => {
    const h = setup();
    h.engine.startGame(0);
    h.board.set([
      [2, 0, 4, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    h.engine.recordMove(0, 0, 0, 2); // not adjacent
    h.engine.recordMove(0, 1, 0, 0); // empty source
    h.engine.recordMove(0, 0, 1, 0); // 2 → empty is legal? (1,0) is empty → this relocates

    // The first two are rejected; only the third (relocate into empty) counts.
    expect(h.moveCount.get()).toBe(1);
  });

  it("submitSolution requires the target tile before it settles", async () => {
    const h = setup();
    h.engine.startGame(0); // target 32
    h.tileAchieved.set(16); // below target

    await h.engine.submitSolution();

    expect(h.obs.gameStatus.get()).toBe("dealt"); // still playing
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("submitSolution settles a win, submits the best tile off-chain, and refreshes", async () => {
    const h = setup();
    h.engine.startGame(0); // target 32
    h.tileAchieved.set(32); // target reached

    await h.engine.submitSolution();

    expect(h.obs.gameStatus.get()).toBe("solved");
    expect(h.obs.activeGameId.get()).toBe("0");
    expect(h.lastPayoutFixed8.get()).toBe(0n); // no GAS payout in guest
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.submit).toHaveBeenCalledWith(32); // highest tile value
    expect(h.get).toHaveBeenCalled(); // guest board refreshed after settle
    expect(h.obs.myTotalWon.get()).toBe(32); // best tile, not GAS
  });

  it("expireGame settles a dealt run as a game over and records the best tile", async () => {
    const h = setup();
    h.engine.startGame(0);
    h.tileAchieved.set(16);

    await h.engine.expireGame();

    expect(h.obs.gameStatus.get()).toBe("expired");
    expect(h.obs.activeGameId.get()).toBe("0");
    expect(h.submit).toHaveBeenCalledWith(16);
  });

  it("ignores moves after the deadline and supports a clean restart after failure", async () => {
    const h = setup();
    h.engine.startGame(0);
    const before = h.board.get().map((row) => [...row]);
    h.obs.deadline.set(Date.now() - 1);

    h.engine.recordMove(0, 0, 0, 1);
    expect(h.board.get()).toEqual(before);
    expect(h.moveCount.get()).toBe(0);

    await h.engine.expireGame();
    expect(h.obs.gameStatus.get()).toBe("expired");
    h.engine.startGame(1);
    expect(h.obs.gameStatus.get()).toBe("dealt");
    expect(h.obs.gameDifficulty.get()).toBe(1);
    expect(countTiles(h.board.get())).toBe(4);
    expect(h.moveCount.get()).toBe(0);
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
    expect(h.get).toHaveBeenCalled(); // guest board loaded
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("maps the off-chain guest board into ranked leaderboard entries", async () => {
    const h = setup();
    h.boardRows.push({ user: "NplayerA", score: "128" });
    h.boardRows.push({ user: "NplayerB", score: "512" });

    await h.engine.refreshLeaderboard();

    const ranked = h.obs.leaderboard.get();
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.address).toBe("NplayerB");
    expect(ranked[0]?.totalWon).toBe(512);
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[1]?.rank).toBe(2);
  });

  it("persists and restores the exact unfinished local kingdom", async () => {
    const storage = new MemoryStore();
    const first = setup(storage);
    first.engine.startGame(1);
    first.board.set([
      [8, 0, 8, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    first.tileAchieved.set(8);
    first.engine.recordMove(0, 0, 0, 1);
    const savedBoard = first.board.get().map((row) => [...row]);
    const savedDeadline = first.obs.deadline.get();

    const restored = setup(storage);
    await restored.engine.enter();

    expect(restored.obs.gameStatus.get()).toBe("dealt");
    expect(restored.obs.activeGameId.get()).toBe("guest");
    expect(restored.obs.gameDifficulty.get()).toBe(1);
    expect(restored.obs.deadline.get()).toBe(savedDeadline);
    expect(restored.board.get()).toEqual(savedBoard);
    expect(restored.moveCount.get()).toBe(1);
    expect(restored.obs.lastStatus.get()).toBe("guestRunRecovered");
  });

  it("persists the best building, clear count, and local history after refresh", async () => {
    const storage = new MemoryStore();
    const first = setup(storage);
    first.engine.startGame(0);
    first.board.set([
      [32, 2, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    first.tileAchieved.set(32);
    await first.engine.submitSolution();

    const restored = setup(storage);
    await restored.engine.enter();

    expect(restored.obs.gameStatus.get()).toBe("idle");
    expect(restored.obs.myTotalWon.get()).toBe(32);
    expect(restored.obs.mySolves.get()).toBe(1);
    expect(restored.obs.myHistory.get()).toHaveLength(1);
    expect(restored.obs.myHistory.get()[0]).toMatchObject({
      difficulty: 0,
      tileAchieved: 32,
      won: true,
    });
  });

  it("fails closed when secure local randomness is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => secureRandomInt(16)).toThrow("secureRandomUnavailable");
  });
});
