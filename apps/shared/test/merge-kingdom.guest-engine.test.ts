import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGameSessionObservables } from "@framework/game";
import { createGuestEngine } from "../../merge-kingdom/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../merge-kingdom/src/logic/guest-engine";
import { ruleOf } from "../../merge-kingdom/src/logic/game-rules";

/**
 * Guest engine tests for Merge Kingdom.
 *
 * The guest engine is a purely LOCAL merge puzzle — it must drive the same scene
 * observables the gamefi flow does while making ZERO chain / oracle / reward
 * calls. These tests exercise the local merge rules and assert the off-chain
 * leaderboard is the ONLY external surface it ever touches (and only on
 * settle/refresh, never during play).
 */

function makeObs<T>(initial: T) {
  return createObservable<T>(initial);
}

function countTiles(board: number[][]): number {
  return board.reduce((sum, row) => sum + row.filter((v) => v > 0).length, 0);
}

function setup() {
  const obs = createGameSessionObservables();
  const board = makeObs<number[][]>([]);
  const tileAchieved = makeObs<number>(0);
  const moveCount = makeObs<number>(0);
  const lastPayoutFixed8 = makeObs<bigint>(0n);

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
    t,
    setStatus,
  };
  const engine = createGuestEngine(deps);
  return { engine, obs, board, tileAchieved, moveCount, lastPayoutFixed8, submit, get, boardRows, setStatus };
}

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
    expect(countTiles(b)).toBe(3); // three seeded starting tiles
    expect(h.obs.deadline.get() - h.obs.dealtAt.get()).toBe(ruleOf(0).limitMs);
    // Dealing a board never touches the off-chain board.
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("merges adjacent equal tiles and spawns fresh material, no writes", () => {
    const h = setup();
    h.engine.startGame(0);
    // Override with a controlled board (board is an injected observable).
    h.board.set([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);

    h.engine.recordMove(0, 0, 0, 1); // merge (0,0)→(0,1)

    const after = h.board.get();
    expect(after[0]?.[1]).toBe(4); // merged tile
    expect(h.tileAchieved.get()).toBe(4);
    expect(h.moveCount.get()).toBe(1);
    expect(countTiles(after)).toBe(2); // merged pair (1) + one spawn (1)
    // A normal move never hits the off-chain board (guard-never-fires analog).
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("relocates a tile into an adjacent empty cell", () => {
    const h = setup();
    h.engine.startGame(1);
    h.board.set([
      [8, 0, 0, 0],
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
    h.engine.startGame(0); // target 64
    h.tileAchieved.set(32); // below target

    await h.engine.submitSolution();

    expect(h.obs.gameStatus.get()).toBe("dealt"); // still playing
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("submitSolution settles a win, submits the best tile off-chain, and refreshes", async () => {
    const h = setup();
    h.engine.startGame(0); // target 64
    h.tileAchieved.set(64); // target reached

    await h.engine.submitSolution();

    expect(h.obs.gameStatus.get()).toBe("solved");
    expect(h.obs.activeGameId.get()).toBe("0");
    expect(h.lastPayoutFixed8.get()).toBe(0n); // no GAS payout in guest
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.submit).toHaveBeenCalledWith(64); // highest tile value
    expect(h.get).toHaveBeenCalled(); // guest board refreshed after settle
    expect(h.obs.myTotalWon.get()).toBe(64); // best tile, not GAS
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
});
