import { describe, expect, it, vi } from "vitest";

import { createGameSessionObservables } from "../../../framework/game";
import { createObservable } from "../../../framework/reactive";
import {
  TICKS_MAX,
  parseInitialState,
  simulateShot,
} from "../../curve-arrow/src/logic/arrow-engine";
import type { LevelSpec } from "../../curve-arrow/src/logic/arrow-engine";
import { createGuestEngine } from "../../curve-arrow/src/logic/guest-engine";

/**
 * Curve Arrow guest (free / local) engine tests.
 *
 * Guest mode must be a fully playable LOCAL archery game: the engine deals
 * clearable wall/target layouts with the Web-Crypto RNG, drives the same
 * observables the Phaser scene reads, mirrors the run from recorded shots to
 * score it, and submits to the OFF-CHAIN guest leaderboard — making ZERO chain,
 * oracle, or reward calls (it is only ever handed session observables + the
 * guest leaderboard, so on-chain access is structurally impossible).
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
  const clues = createObservable("");
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
    clues,
    guestLeaderboard,
    t: messages,
    setStatus,
  });
  return { engine, obs, clues, guestLeaderboard, submitted, setStatus };
}

/** Mirror of the engine's single-hold solver: the clearing holds, or null. */
function clearingHolds(level: LevelSpec): number[] | null {
  if (simulateShot(level, []).hit) return [];
  for (let press = 0; press <= 60; press += 3) {
    for (let dur = 4; dur <= 220; dur += 4) {
      const release = press + dur;
      if (release >= TICKS_MAX) break;
      if (simulateShot(level, [press, release]).hit) return [press, release];
    }
  }
  return null;
}

function dealtLevels(clues: { get(): string }): LevelSpec[] {
  const parsed = parseInitialState(clues.get());
  expect(parsed, "guest clues must parse as valid level layouts").not.toBeNull();
  return parsed!.levels;
}

describe("curve-arrow guest engine: level generation", () => {
  for (const difficulty of [0, 1, 2]) {
    it(`deals only clearable, valid levels for difficulty ${difficulty}`, () => {
      const targetCount = [3, 5, 7][difficulty];
      for (let trial = 0; trial < 6; trial += 1) {
        const { engine, clues } = makeGuest();
        engine.startGame(difficulty);
        const levels = dealtLevels(clues);
        expect(levels).toHaveLength(targetCount);
        for (const level of levels) {
          // Valid bounds (parseInitialState already enforced) + provably clearable.
          expect(clearingHolds(level), "every dealt level must be clearable").not.toBeNull();
        }
      }
    });
  }
});

describe("curve-arrow guest engine: play flow", () => {
  it("drives the scene observables on start (dealt, clues, deadline)", () => {
    const { engine, obs, clues } = makeGuest();
    engine.startGame(1);
    expect(obs.gameStatus.get()).toBe("dealt");
    expect(obs.gameDifficulty.get()).toBe(1);
    expect(obs.activeGameId.get()).toBe("guest");
    expect(clues.get().length).toBeGreaterThan(0);
    expect(obs.deadline.get()).toBeGreaterThan(Date.now());
    expect(obs.dealtAt.get()).toBeGreaterThan(0);
    expect(obs.commitment.get()).toBe("");
  });

  it("plays a full clearing run to a solved result and submits the score off-chain", async () => {
    const { engine, obs, clues, guestLeaderboard, submitted } = makeGuest();
    engine.startGame(0);
    const levels = dealtLevels(clues);
    // Clear each level with one arrow (the scene records one shot per flight).
    for (const level of levels) {
      const holds = clearingHolds(level);
      expect(holds).not.toBeNull();
      engine.recordShot(holds!);
    }
    await engine.submitSolution();
    expect(obs.gameStatus.get()).toBe("solved");
    expect(obs.activeGameId.get()).toBe("0");
    expect(obs.myTotalWon.get()).toBe(levels.length);
    expect(guestLeaderboard.submit).toHaveBeenCalledTimes(1);
    expect(submitted).toEqual([levels.length]);
    // Board reloaded into the leaderboard observable (guest namespace only).
    expect(obs.leaderboard.get().length).toBeGreaterThan(0);
  });

  it("settles the run and records only the partial score actually cleared", async () => {
    const { engine, obs, clues, guestLeaderboard, submitted } = makeGuest();
    engine.startGame(0);
    dealtLevels(clues);
    // Spend the whole arrow budget on straight shots (no curve). Some open
    // levels may fall to a straight shot, walled ones will not — either way the
    // run settles to the exact number of targets actually cleared.
    const budget = 9;
    for (let i = 0; i < budget; i += 1) engine.recordShot([]);
    await engine.submitSolution();
    const cleared = obs.myTotalWon.get();
    expect(["solved", "expired"]).toContain(obs.gameStatus.get());
    // The off-chain board only gets a row when a positive score was reached
    // (best-effort skips non-positive scores); it never records more than cleared.
    if (cleared > 0) {
      expect(submitted).toEqual([cleared]);
    } else {
      expect(guestLeaderboard.submit).not.toHaveBeenCalled();
    }
  });

  it("resets to a clean local lobby and zeroes on-chain-only counters on enter", async () => {
    const { engine, obs } = makeGuest();
    obs.credit.set(5);
    obs.poolFree.set(9);
    obs.myRank.set(3);
    await engine.enter();
    expect(obs.gameStatus.get()).toBe("idle");
    expect(obs.credit.get()).toBe(0);
    expect(obs.poolFree.get()).toBe(0);
    expect(obs.myRank.get()).toBe(0);
    expect(obs.progressionReady.get()).toBe(true);
    expect(obs.progressionRequiredDifficulty.get()).toBe(0);
  });

  it("expireGame returns to the lobby without a chain call", () => {
    const { engine, obs } = makeGuest();
    engine.startGame(2);
    expect(obs.gameStatus.get()).toBe("dealt");
    engine.expireGame();
    expect(obs.gameStatus.get()).toBe("idle");
    expect(obs.activeGameId.get()).toBe("0");
  });
});
