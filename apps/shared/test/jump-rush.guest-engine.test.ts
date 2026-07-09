import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGuestEngine } from "../../jump-rush/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../jump-rush/src/logic/guest-engine";
import type { LeaderEntry, RunRow } from "../../jump-rush/src/main";
import { MAX_UNDOS, ruleOf } from "../../jump-rush/src/logic/game-rules";

/**
 * Guest engine tests for Jump Rush.
 *
 * The guest engine is a purely LOCAL platform runner — it must drive the same
 * scene observables the gamefi flow does while making ZERO chain / oracle /
 * reward calls. These tests assert the off-chain guest leaderboard is the ONLY
 * external surface it ever touches (and only on settle / refresh / enter,
 * never while dealing or jumping).
 */

function makeObs<T>(initial: T) {
  return createObservable<T>(initial);
}

function setup() {
  const gameStatus = makeObs("idle");
  const activeGameId = makeObs("0");
  const gameDifficulty = makeObs(0);
  const platformsView = makeObs<number[]>([]);
  const commitment = makeObs("");
  const dealtAt = makeObs(0);
  const deadline = makeObs(0);
  const undosUsed = makeObs(0);
  const lastPayout = makeObs("");
  const lastElapsedMs = makeObs(0);
  const leaderboard = makeObs<LeaderEntry[]>([]);
  const myRank = makeObs(0);
  const myTotalWon = makeObs(0);
  const myRuns = makeObs(0);
  const myHistory = makeObs<RunRow[]>([]);
  const isStarting = makeObs(false);
  const isDealing = makeObs(false);
  const isSubmitting = makeObs(false);
  const isUndoing = makeObs(false);
  const lastStatus = makeObs("");
  const jumpCount = makeObs(0);
  const currentPlatform = makeObs(0);
  const perfectCount = makeObs(0);
  const comboCount = makeObs(0);
  const chargeLevel = makeObs(0);
  const isCharging = makeObs(false);
  const isJumping = makeObs(false);
  const missedPlatform = makeObs(false);

  const submit = vi.fn(async (_score: number | string) => {});
  const board: Array<{ user: string; score: string }> = [];
  const get = vi.fn(async (_limit?: number) => board.slice());
  const guestLeaderboard = { submit, get };

  const setStatus = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  const deps: GuestEngineDeps = {
    gameStatus,
    activeGameId,
    gameDifficulty,
    platformsView,
    commitment,
    dealtAt,
    deadline,
    undosUsed,
    lastPayout,
    lastElapsedMs,
    leaderboard,
    myRank,
    myTotalWon,
    myRuns,
    myHistory,
    isStarting,
    isDealing,
    isSubmitting,
    isUndoing,
    lastStatus,
    jumpCount,
    currentPlatform,
    perfectCount,
    comboCount,
    chargeLevel,
    isCharging,
    isJumping,
    missedPlatform,
    guestLeaderboard,
    t,
    setStatus,
  };
  const engine = createGuestEngine(deps);
  return {
    engine, submit, get, board, setStatus,
    gameStatus, activeGameId, commitment, platformsView, dealtAt, deadline,
    undosUsed, lastPayout, lastElapsedMs, leaderboard, myRank, myTotalWon,
    myRuns, myHistory, jumpCount,
  };
}

describe("jump-rush guest engine", () => {
  it("deals a fully local route on startGame with no leaderboard writes", () => {
    const h = setup();
    h.engine.startGame(0);

    expect(h.gameStatus.get()).toBe("dealt");
    expect(h.activeGameId.get()).toBe("guest");
    expect(h.commitment.get()).toBe(""); // no on-chain commitment in guest
    const view = h.platformsView.get();
    expect(view.length).toBe(Math.min(15, ruleOf(0).targetJumps)); // easy → 10 bytes
    expect(view.every((b) => b >= 0 && b <= 255)).toBe(true);
    expect(h.deadline.get() - h.dealtAt.get()).toBe(ruleOf(0).limitMs);
    // Dealing a route never touches the off-chain board.
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("generates a distinct route each run (local RNG seed)", () => {
    const h = setup();
    h.engine.startGame(2);
    const first = h.platformsView.get().join(",");
    // Force a re-deal from a clean lobby.
    h.engine.expireGame();
    h.engine.startGame(2);
    const second = h.platformsView.get().join(",");
    expect(second).not.toBe(first);
  });

  it("tracks cleared jumps forward-only and writes nothing while jumping", () => {
    const h = setup();
    h.engine.startGame(0);
    h.engine.recordJump(3);
    expect(h.jumpCount.get()).toBe(3);
    // A lower/replayed index never rewinds the tracked progress.
    h.engine.recordJump(2);
    expect(h.jumpCount.get()).toBe(3);
    h.engine.recordJump(5);
    expect(h.jumpCount.get()).toBe(5);
    // Jumping is a local, off-chain-free operation (guard-never-fires analog).
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("useUndo bumps undosUsed up to the max, then blocks with an info status", () => {
    const h = setup();
    h.engine.startGame(0);
    for (let i = 1; i <= MAX_UNDOS; i += 1) {
      h.engine.useUndo();
      expect(h.undosUsed.get()).toBe(i);
    }
    h.setStatus.mockClear();
    h.engine.useUndo(); // over the cap
    expect(h.undosUsed.get()).toBe(MAX_UNDOS);
    expect(h.setStatus).toHaveBeenCalledWith("undoLimitReached", "info");
    // Undos never hit the chain / off-chain board.
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("submitRun records the cleared-jump count off-chain and returns to lobby", async () => {
    const h = setup();
    h.engine.startGame(0);
    h.engine.recordJump(7);

    await h.engine.submitRun();

    expect(h.gameStatus.get()).toBe("solved");
    expect(h.activeGameId.get()).toBe("0");
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.submit).toHaveBeenCalledWith(7); // jumps cleared, not GAS
    expect(h.get).toHaveBeenCalled(); // guest board refreshed after settle
    expect(h.lastPayout.get()).toBe("7");
    expect(h.myTotalWon.get()).toBe(7); // best run, not GAS
    expect(h.myRuns.get()).toBe(1);
  });

  it("falls back to the route length when no jumps were recorded on submit", async () => {
    const h = setup();
    h.engine.startGame(1); // medium → 15-byte route
    await h.engine.submitRun();
    expect(h.submit).toHaveBeenCalledWith(Math.min(15, ruleOf(1).targetJumps));
  });

  it("expireGame resets to a clean local lobby", () => {
    const h = setup();
    h.engine.startGame(0);
    h.engine.recordJump(4);
    h.engine.expireGame();
    expect(h.gameStatus.get()).toBe("idle");
    expect(h.activeGameId.get()).toBe("0");
    expect(h.platformsView.get()).toEqual([]);
    expect(h.jumpCount.get()).toBe(0);
    expect(h.undosUsed.get()).toBe(0);
  });

  it("enter() zeroes on-chain counters and loads the off-chain board", async () => {
    const h = setup();
    // Pretend a prior gamefi read populated these before switching to guest.
    h.myRank.set(3);
    h.myTotalWon.set(9);
    h.myRuns.set(4);
    h.myHistory.set([{ gameId: "1", difficulty: 0, elapsedMs: 1, undos: 0, jumps: 5, perfects: 2, payout: "0.1 GAS" }]);

    await h.engine.enter();

    expect(h.myRank.get()).toBe(0);
    expect(h.myTotalWon.get()).toBe(0);
    expect(h.myRuns.get()).toBe(0);
    expect(h.myHistory.get()).toEqual([]);
    expect(h.gameStatus.get()).toBe("idle");
    expect(h.get).toHaveBeenCalled(); // guest board loaded
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("maps the off-chain guest board into ranked leaderboard entries", async () => {
    const h = setup();
    h.board.push({ user: "NplayerA", score: "8" });
    h.board.push({ user: "NplayerB", score: "15" });

    await h.engine.refreshLeaderboard();

    const ranked = h.leaderboard.get();
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.address).toBe("NplayerB");
    expect(ranked[0]?.totalWon).toBe(15);
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[1]?.rank).toBe(2);
  });
});
