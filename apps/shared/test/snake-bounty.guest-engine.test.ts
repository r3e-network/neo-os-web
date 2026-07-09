import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGameSessionObservables } from "@framework/game";
import { createGuestEngine } from "../../snake-bounty/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../snake-bounty/src/logic/guest-engine";
import { parseInitialState, GRID_SIZE } from "../../snake-bounty/src/logic/snake-engine";
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

function setup() {
  const obs = createGameSessionObservables();
  const clues = createObservable("");

  const submit = vi.fn(async (_score: number | string) => {});
  const board: Array<{ user: string; score: string }> = [];
  const get = vi.fn(async (_limit?: number) => board.slice());
  const guestLeaderboard = { submit, get };

  const setStatus = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  const deps: GuestEngineDeps = { obs, clues, guestLeaderboard, t, setStatus };
  const engine = createGuestEngine(deps);
  return { engine, obs, clues, submit, get, board, setStatus };
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

  it("recordMove is a local no-op (scene owns the simulation)", () => {
    const h = setup();
    h.engine.startGame(0);
    const before = h.clues.get();
    h.engine.recordMove(2);
    expect(h.clues.get()).toBe(before);
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("submitSolution records the trail length off-chain and returns to lobby", async () => {
    const h = setup();
    h.engine.startGame(1); // medium → target 20
    const target = ruleOf(1).targetLength;

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
    const h = setup();
    h.engine.startGame(2); // hard → 35
    await h.engine.submitSolution();
    expect(h.obs.myTotalWon.get()).toBe(ruleOf(2).targetLength);

    h.engine.startGame(0); // easy → 10 (lower)
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
