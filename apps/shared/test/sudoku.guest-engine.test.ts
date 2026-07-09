import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGameSessionObservables } from "@framework/game";
import { createGuestEngine } from "../../sudoku/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../sudoku/src/logic/guest-engine";
import { dealPuzzle } from "../../sudoku/src/logic/sudoku-engine";
import { ruleOf } from "../../sudoku/src/logic/game-rules";

/**
 * Guest engine tests for Sudoku Arena.
 *
 * The guest engine is a purely LOCAL Sudoku — it must drive the same scene
 * observables the gamefi flow does while making ZERO chain / oracle / reward
 * calls. The off-chain guest leaderboard is the ONLY external surface it ever
 * touches, and only on settle / refresh / enter, never during play.
 */

// A fixed 32-byte seed so `randomSeed()` (via crypto.getRandomValues) is
// deterministic — lets the test reconstruct the exact derived solution.
const FIXED_SEED = new Uint8Array(32);
for (let i = 0; i < 32; i += 1) FIXED_SEED[i] = (i * 7 + 3) & 0xff;

function makeObs<T>(initial: T) {
  return createObservable<T>(initial);
}

function setup() {
  const obs = createGameSessionObservables();
  const clues = makeObs<string>("");
  const walletConnected = makeObs<boolean>(false);

  const submit = vi.fn(async (_score: number | string) => {});
  const board: Array<{ user: string; score: string }> = [];
  const get = vi.fn(async (_limit?: number) => board.slice());
  const guestLeaderboard = { submit, get };

  const setStatus = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  const deps: GuestEngineDeps = {
    obs,
    clues,
    walletConnected,
    guestLeaderboard,
    t,
    setStatus,
  };
  const engine = createGuestEngine(deps);
  return { engine, obs, clues, walletConnected, submit, get, board, setStatus };
}

describe("sudoku guest engine", () => {
  beforeEach(() => {
    vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation((arr) => {
      const u8 = arr as Uint8Array;
      for (let i = 0; i < u8.length; i += 1) u8[i] = FIXED_SEED[i % 32] ?? 0;
      return arr;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deals a fully local puzzle on startGame with no leaderboard writes", () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });

    expect(h.obs.gameStatus.get()).toBe("dealt");
    expect(h.obs.activeGameId.get()).toBe("guest");
    expect(h.obs.commitment.get()).toBe(""); // no on-chain commitment in guest
    // Scene routes to the game view only when clues is 81 digits.
    expect(h.clues.get()).toMatch(/^[0-9]{81}$/);
    expect(h.clues.get()).toBe(dealPuzzle(FIXED_SEED, 0).puzzle);
    expect(h.obs.deadline.get() - h.obs.dealtAt.get()).toBe(ruleOf(0).limitMs);
    // Dealing a puzzle never touches the off-chain board.
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("recordMove is a local no-op that never writes off-chain", () => {
    const h = setup();
    h.engine.startGame({ difficulty: 1 });
    h.engine.recordMove({ cell: 3, digit: 7 });
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
    expect(h.obs.gameStatus.get()).toBe("dealt");
  });

  it("useUndo increments the capped undo counter with a non-reward status", () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });
    h.engine.useUndo();
    expect(h.obs.undosUsed.get()).toBe(1);
    expect(h.setStatus).toHaveBeenLastCalledWith("guestUndoUsed", "info");
    h.engine.useUndo();
    h.engine.useUndo();
    h.engine.useUndo(); // capped at MAX_UNDOS = 3
    expect(h.obs.undosUsed.get()).toBe(3);
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("submitSolution settles a correct board off-chain and returns to lobby", async () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });
    const solution = dealPuzzle(FIXED_SEED, 0).solution;

    await h.engine.submitSolution({ solution });

    expect(h.obs.gameStatus.get()).toBe("solved");
    expect(h.obs.activeGameId.get()).toBe("0");
    expect(h.submit).toHaveBeenCalledTimes(1);
    const score = (h.submit.mock.calls[0]?.[0]) as number;
    expect(score).toBeGreaterThan(0);
    expect(h.obs.myTotalWon.get()).toBe(score); // best local score, not GAS
    expect(h.obs.mySolves.get()).toBe(1);
    expect(h.get).toHaveBeenCalled(); // guest board refreshed after settle
  });

  it("submitSolution rejects a wrong complete board with no write", async () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });
    const wrong = "1".repeat(81); // complete but not the derived solution

    await h.engine.submitSolution({ solution: wrong });

    expect(h.obs.gameStatus.get()).toBe("dealt"); // still playable
    expect(h.setStatus).toHaveBeenLastCalledWith("guestNotSolved", "error");
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("submitSolution rejects an incomplete board", async () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });

    await h.engine.submitSolution({ solution: "0".repeat(81) });

    expect(h.obs.gameStatus.get()).toBe("dealt");
    expect(h.setStatus).toHaveBeenLastCalledWith("statusBoardIncomplete", "error");
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("expireGame marks a live board expired", () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });
    h.engine.expireGame();
    expect(h.obs.gameStatus.get()).toBe("expired");
    expect(h.obs.activeGameId.get()).toBe("0");
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("enter() zeroes on-chain counters, opens local gates, and loads the board", async () => {
    const h = setup();
    // Pretend a prior gamefi read populated these before switching to guest.
    h.obs.credit.set(5);
    h.obs.myRank.set(3);
    h.obs.myTotalWon.set(9);

    await h.engine.enter();

    expect(h.obs.credit.get()).toBe(0);
    expect(h.obs.myRank.get()).toBe(0);
    expect(h.obs.myTotalWon.get()).toBe(0);
    expect(h.obs.gameStatus.get()).toBe("idle");
    // Local play gates the frozen scene checks are all open.
    expect(h.walletConnected.get()).toBe(true);
    expect(h.obs.progressionReady.get()).toBe(true);
    expect(h.obs.progressionRequiredDifficulty.get()).toBe(0);
    expect(h.obs.poolFree.get()).toBeGreaterThanOrEqual(1);
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
