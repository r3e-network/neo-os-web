import { describe, expect, it, vi } from "vitest";

import { createGameSessionObservables } from "../../../framework/game";
import { createObservable } from "../../../framework/reactive";
import { ruleOf } from "../../aim-master/src/logic/game-rules";
import type { HitResult } from "../../aim-master/src/logic/aim-engine";
import {
  createGuestEngine,
  secureRandomSeed,
} from "../../aim-master/src/logic/guest-engine";

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

interface MemoryStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
}

function makeMemoryStorage(): MemoryStorage {
  const values = new Map<string, unknown>();
  return {
    get<T>(key: string, fallback: T | null = null): T | null {
      return values.has(key) ? values.get(key) as T : fallback;
    },
    set(key: string, value: unknown): void { values.set(key, value); },
  };
}

function makeGuest(options: { storage?: MemoryStorage; seedSource?: () => string } = {}) {
  const obs = createGameSessionObservables();
  const pattern = createObservable("");
  const targetAccuracy = createObservable(3);
  const ringsHit = createObservable(0);
  const roundIndex = createObservable(0);
  const roundResults = createObservable<HitResult[]>([]);
  const scorePoints = createObservable(0);
  const combo = createObservable(0);
  const maxCombo = createObservable(0);
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
    scorePoints,
    combo,
    maxCombo,
    guestLeaderboard,
    storage: options.storage,
    seedSource: options.seedSource,
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
    scorePoints,
    combo,
    maxCombo,
    guestLeaderboard,
    submitted,
    setStatus,
  };
}

/** Build the accuracy-hit run the scene would stream to reach a win. */
function accuracyRun(count: number): HitResult[] {
  return Array.from({ length: count }, () => ({ ring: 0, points: 10, offset: 0 }));
}

function streamAccuracy(
  engine: ReturnType<typeof createGuestEngine>,
  count: number,
): HitResult[] {
  const results: HitResult[] = [];
  for (let index = 0; index < count; index += 1) {
    results.push({ ring: 0, points: 10, offset: 0 });
    engine.aimHit({ roundResults: results.slice() });
  }
  return results;
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

  it("fails closed instead of falling back to Math.random when secure entropy is unavailable", () => {
    expect(() => secureRandomSeed(null)).toThrow("secure-random-unavailable");
    const guest = makeGuest({ seedSource: () => { throw new Error("no entropy"); } });
    guest.engine.startGame(0);
    expect(guest.obs.gameStatus.get()).toBe("idle");
    expect(guest.obs.isStarting.get()).toBe(false);
    expect(guest.pattern.get()).toBe("");
    expect(guest.setStatus).toHaveBeenCalledWith("guestEntropyUnavailable", "error");
  });

  it("does not replace an active run on a repeated start action", () => {
    const { engine, obs, pattern } = makeGuest();
    engine.startGame(0);
    const activePattern = pattern.get();
    const activeDeadline = obs.deadline.get();
    engine.startGame(2);
    expect(obs.gameDifficulty.get()).toBe(0);
    expect(pattern.get()).toBe(activePattern);
    expect(obs.deadline.get()).toBe(activeDeadline);
  });
});

describe("aim-master guest engine: play flow", () => {
  it("records the scene's aimHit stream into the shared observables", () => {
    const { engine, ringsHit, roundIndex, roundResults, scorePoints, combo } = makeGuest();
    engine.startGame(1);
    streamAccuracy(engine, 3);
    expect(ringsHit.get()).toBe(3);
    expect(roundIndex.get()).toBe(3);
    expect(roundResults.get()).toHaveLength(3);
    expect(scorePoints.get()).toBe(33);
    expect(combo.get()).toBe(3);
  });

  it("plays a winning run to a solved result and submits the score off-chain", async () => {
    const { engine, obs, guestLeaderboard, submitted } = makeGuest();
    engine.startGame(1);
    const targetAcc = ruleOf(1).targetAccuracy;
    streamAccuracy(engine, targetAcc);
    await engine.submitSolution();
    expect(obs.gameStatus.get()).toBe("solved");
    expect(obs.activeGameId.get()).toBe("0");
    expect(obs.myTotalWon.get()).toBe(60);
    expect(obs.mySolves.get()).toBe(1);
    expect(guestLeaderboard.submit).toHaveBeenCalledTimes(1);
    expect(submitted).toEqual([60]);
    // Board reloaded into the leaderboard observable (guest namespace only).
    expect(obs.leaderboard.get().length).toBeGreaterThan(0);
    expect(obs.isSubmitting.get()).toBe(false);
  });

  it("settles a winning run only once under repeated submit input", async () => {
    const { engine, obs, guestLeaderboard } = makeGuest();
    engine.startGame(0);
    streamAccuracy(engine, ruleOf(0).targetAccuracy);
    await Promise.all([engine.submitSolution(), engine.submitSolution()]);
    expect(obs.gameStatus.get()).toBe("solved");
    expect(obs.mySolves.get()).toBe(1);
    expect(guestLeaderboard.submit).toHaveBeenCalledTimes(1);
  });

  it("refuses settlement until the accuracy target is actually reached", async () => {
    const { engine, obs, guestLeaderboard } = makeGuest();
    engine.startGame(0);
    await engine.submitSolution();
    expect(obs.gameStatus.get()).toBe("dealt");
    expect(guestLeaderboard.submit).not.toHaveBeenCalled();
  });

  it("ignores forged counters, points, and ring labels", () => {
    const { engine, ringsHit, roundIndex, scorePoints } = makeGuest();
    engine.startGame(0);
    engine.aimHit({
      ringsHit: 99,
      totalRings: 99,
      totalPoints: 999_999,
      roundResults: [{ ring: 0, points: 999_999, offset: 150 }],
    });
    expect(ringsHit.get()).toBe(0);
    expect(roundIndex.get()).toBe(1);
    expect(scorePoints.get()).toBe(0);
  });

  it("accepts only append-only shot logs", () => {
    const { engine, ringsHit, roundIndex, roundResults } = makeGuest();
    engine.startGame(0);
    const confirmed = streamAccuracy(engine, 2);
    engine.aimHit({ roundResults: [{ ring: 0, points: 10, offset: 20 }, ...confirmed] });
    expect(ringsHit.get()).toBe(2);
    expect(roundIndex.get()).toBe(2);
    expect(roundResults.get().map((result) => result.offset)).toEqual([0, 0]);
  });

  it("rejects several synthetic hits packed into one user action", () => {
    const { engine, ringsHit, roundIndex } = makeGuest();
    engine.startGame(0);
    engine.aimHit({ roundResults: accuracyRun(3) });
    expect(ringsHit.get()).toBe(0);
    expect(roundIndex.get()).toBe(0);
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

  it("expires once the deadline passes and rejects a late shot", () => {
    const { engine, obs, ringsHit } = makeGuest();
    engine.startGame(0);
    obs.deadline.set(Date.now() - 1);
    engine.aimHit({ roundResults: accuracyRun(1) });
    expect(obs.gameStatus.get()).toBe("expired");
    expect(ringsHit.get()).toBe(0);
  });

  it("restarts after expiry with a clean score and a fresh pattern", () => {
    const { engine, obs, pattern, roundIndex, scorePoints, combo } = makeGuest();
    engine.startGame(0);
    const firstPattern = pattern.get();
    streamAccuracy(engine, 2);
    engine.expireGame();
    engine.startGame(2);
    expect(obs.gameStatus.get()).toBe("dealt");
    expect(pattern.get()).not.toBe(firstPattern);
    expect(roundIndex.get()).toBe(0);
    expect(scorePoints.get()).toBe(0);
    expect(combo.get()).toBe(0);
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

  it("restores the local best score and completed-run count when the board is offline", async () => {
    const storage = makeMemoryStorage();
    const first = makeGuest({ storage });
    first.engine.startGame(0);
    streamAccuracy(first.engine, ruleOf(0).targetAccuracy);
    await first.engine.submitSolution();

    const reopened = makeGuest({ storage });
    reopened.guestLeaderboard.get.mockRejectedValueOnce(new Error("offline"));
    await reopened.engine.enter();
    expect(reopened.obs.myTotalWon.get()).toBe(33);
    expect(reopened.obs.mySolves.get()).toBe(1);
    expect(reopened.obs.leaderboard.get()).toEqual([]);
  });
});
