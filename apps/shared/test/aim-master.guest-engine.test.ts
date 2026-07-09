import { describe, expect, it, vi } from "vitest";

import { createGameSessionObservables } from "../../../framework/game";
import { createObservable } from "../../../framework/reactive";
import { ruleOf } from "../../aim-master/src/logic/game-rules";
import type { HitResult } from "../../aim-master/src/logic/aim-engine";
import { createGuestEngine } from "../../aim-master/src/logic/guest-engine";

/**
 * Aim Master guest (free / local) engine tests.
 *
 * Guest mode must be a fully playable LOCAL target-shooting game: the engine
 * seeds a target pattern with the Web-Crypto RNG, drives the SAME observables
 * the Phaser scene reads, records the taps the scene streams via `aimHit`,
 * scores them locally, and submits to the OFF-CHAIN guest leaderboard — making
 * ZERO chain, oracle, or reward calls (it is only ever handed session
 * observables + the guest leaderboard, so on-chain access is structurally
 * impossible — the framework guest guard can never fire in guest play).
 */

function messages(key: string, params?: Record<string, string | number>): string {
  let value = key;
  if (params) {
    for (const [k, v] of Object.entries(params)) value += ` ${k}=${v}`;
  }
  return value;
}

function makeGuest() {
  const obs = createGameSessionObservables();
  const pattern = createObservable("");
  const targetAccuracy = createObservable(3);
  const ringsHit = createObservable(0);
  const roundIndex = createObservable(0);
  const roundResults = createObservable<HitResult[]>([]);
  const submitted: Array<number | string> = [];
  const board: Array<{ user: string; score: string }> = [];
  const guestLeaderboard = {
    submit: vi.fn(async (score: number | string) => {
      submitted.push(score);
      board.push({ user: "guest-player", score: String(score) });
    }),
    get: vi.fn(async () => board.slice()),
  };
  const setStatus = vi.fn();
  const engine = createGuestEngine({
    obs,
    pattern,
    targetAccuracy,
    ringsHit,
    roundIndex,
    roundResults,
    guestLeaderboard,
    t: messages,
    setStatus,
  });
  return {
    engine,
    obs,
    pattern,
    targetAccuracy,
    ringsHit,
    roundIndex,
    roundResults,
    guestLeaderboard,
    submitted,
    setStatus,
  };
}

/** Build the accuracy-hit run the scene would stream to reach a win. */
function accuracyRun(count: number): HitResult[] {
  return Array.from({ length: count }, () => ({ ring: 0, points: 10, offset: 0 }));
}

describe("aim-master guest engine: start", () => {
  for (const difficulty of [0, 1, 2]) {
    it(`deals a local target pattern for difficulty ${difficulty}`, () => {
      const { engine, obs, pattern, targetAccuracy } = makeGuest();
      engine.startGame(difficulty);
      expect(obs.gameStatus.get()).toBe("dealt");
      expect(obs.gameDifficulty.get()).toBe(difficulty);
      expect(obs.activeGameId.get()).toBe("guest");
      expect(obs.commitment.get()).toBe("");
      expect(targetAccuracy.get()).toBe(ruleOf(difficulty).targetAccuracy);
      const positions = pattern.get().split(",").map(Number);
      expect(positions.length).toBeGreaterThan(0);
      expect(positions.every((n) => Number.isFinite(n))).toBe(true);
      expect(obs.deadline.get()).toBeGreaterThan(Date.now());
      expect(obs.dealtAt.get()).toBeGreaterThan(0);
    });
  }

  it("uses the Web-Crypto RNG so consecutive runs differ", () => {
    const a = makeGuest();
    a.engine.startGame(0);
    const b = makeGuest();
    b.engine.startGame(0);
    expect(a.pattern.get()).not.toBe(b.pattern.get());
  });
});

describe("aim-master guest engine: play flow", () => {
  it("records the scene's aimHit stream into the shared observables", () => {
    const { engine, ringsHit, roundIndex, roundResults } = makeGuest();
    engine.startGame(1);
    const results = accuracyRun(3);
    engine.aimHit({ ringsHit: 3, totalRings: 4, roundResults: results, totalPoints: 28 });
    expect(ringsHit.get()).toBe(3);
    expect(roundIndex.get()).toBe(4);
    expect(roundResults.get()).toHaveLength(3);
  });

  it("plays a winning run to a solved result and submits the score off-chain", async () => {
    const { engine, obs, guestLeaderboard, submitted } = makeGuest();
    engine.startGame(1);
    const targetAcc = ruleOf(1).targetAccuracy;
    engine.aimHit({
      ringsHit: targetAcc,
      totalRings: targetAcc,
      roundResults: accuracyRun(targetAcc),
      totalPoints: 42,
    });
    await engine.submitSolution();
    expect(obs.gameStatus.get()).toBe("solved");
    expect(obs.activeGameId.get()).toBe("0");
    expect(obs.myTotalWon.get()).toBe(42);
    expect(obs.mySolves.get()).toBe(1);
    expect(guestLeaderboard.submit).toHaveBeenCalledTimes(1);
    expect(submitted).toEqual([42]);
    // Board reloaded into the leaderboard observable (guest namespace only).
    expect(obs.leaderboard.get().length).toBeGreaterThan(0);
    expect(obs.isSubmitting.get()).toBe(false);
  });

  it("solves with a zero score without an off-chain submit (best-effort skips 0)", async () => {
    const { engine, obs, guestLeaderboard } = makeGuest();
    engine.startGame(0);
    await engine.submitSolution();
    expect(obs.gameStatus.get()).toBe("solved");
    expect(guestLeaderboard.submit).not.toHaveBeenCalled();
  });

  it("ignores aimHit and submitSolution outside a dealt round", async () => {
    const { engine, obs, ringsHit } = makeGuest();
    engine.aimHit({ ringsHit: 5, totalRings: 5, roundResults: accuracyRun(5), totalPoints: 50 });
    expect(ringsHit.get()).toBe(0);
    await engine.submitSolution();
    expect(obs.gameStatus.get()).toBe("idle");
  });

  it("expireGame ends the run and returns to the lobby without a chain call", () => {
    const { engine, obs, pattern } = makeGuest();
    engine.startGame(2);
    expect(obs.gameStatus.get()).toBe("dealt");
    expect(pattern.get().length).toBeGreaterThan(0);
    engine.expireGame();
    expect(obs.gameStatus.get()).toBe("expired");
    expect(obs.activeGameId.get()).toBe("0");
    expect(pattern.get()).toBe("");
  });
});

describe("aim-master guest engine: enter / leaderboard", () => {
  it("resets to a clean local lobby and zeroes on-chain-only counters on enter", async () => {
    const { engine, obs } = makeGuest();
    obs.credit.set(5);
    obs.poolFree.set(9);
    obs.myRank.set(3);
    obs.myTotalWon.set(7);
    obs.mySolves.set(2);
    await engine.enter();
    expect(obs.gameStatus.get()).toBe("idle");
    expect(obs.activeGameId.get()).toBe("0");
    expect(obs.credit.get()).toBe(0);
    expect(obs.poolFree.get()).toBe(0);
    expect(obs.myRank.get()).toBe(0);
    expect(obs.myTotalWon.get()).toBe(0);
    expect(obs.mySolves.get()).toBe(0);
    expect(obs.myHistory.get()).toEqual([]);
  });

  it("loads the off-chain guest board into the leaderboard observable", async () => {
    const { engine, obs, guestLeaderboard } = makeGuest();
    guestLeaderboard.get.mockResolvedValueOnce([
      { user: "alice", score: "30" },
      { user: "bob", score: "12" },
    ]);
    await engine.refreshLeaderboard();
    const board = obs.leaderboard.get();
    expect(board).toHaveLength(2);
    expect(board[0]?.address).toBe("alice");
    expect(board[0]?.totalWon).toBe(30);
    expect(board[0]?.rank).toBe(1);
    expect(board[1]?.rank).toBe(2);
  });
});
