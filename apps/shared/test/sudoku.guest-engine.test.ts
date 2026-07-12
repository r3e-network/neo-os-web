import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGameSessionObservables } from "@framework/game";
import { createGuestEngine } from "../../sudoku/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../sudoku/src/logic/guest-engine";
import type { BoardStorage } from "../../sudoku/src/logic/board-store";
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

function memoryStorage(): BoardStorage {
  const values = new Map<string, unknown>();
  return {
    get<T>(key: string, fallback: T | null = null): T | null {
      return values.has(key) ? values.get(key) as T : fallback;
    },
    set(key: string, value: unknown): void {
      values.set(key, structuredClone(value));
    },
    delete(key: string): void {
      values.delete(key);
    },
  };
}

function setup(storage: BoardStorage = memoryStorage()) {
  const obs = createGameSessionObservables();
  const clues = makeObs<string>("");
  const walletConnected = makeObs<boolean>(false);
  const isPaused = makeObs(false);
  const hintsUsed = makeObs(0);
  const hintCell = makeObs(-1);
  const hintDigit = makeObs(0);
  const hintNonce = makeObs(0);

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
    isPaused,
    hintsUsed,
    hintCell,
    hintDigit,
    hintNonce,
    storage,
    guestLeaderboard,
    t,
    setStatus,
  };
  const engine = createGuestEngine(deps);
  return {
    engine,
    obs,
    clues,
    walletConnected,
    isPaused,
    hintsUsed,
    hintCell,
    hintDigit,
    hintNonce,
    storage,
    submit,
    get,
    board,
    setStatus,
  };
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

  it("keeps local undo available as a normal correction tool", () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });
    h.engine.useUndo();
    expect(h.obs.undosUsed.get()).toBe(1);
    expect(h.setStatus).toHaveBeenLastCalledWith("guestUndoUsed", "info");
    h.engine.useUndo();
    h.engine.useUndo();
    h.engine.useUndo();
    expect(h.obs.undosUsed.get()).toBe(4);
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("does not penalize the local score for correction or undo", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(5_000_000);
    const clean = setup();
    clean.engine.startGame({ difficulty: 0 });
    clock.mockReturnValue(5_060_000);
    await clean.engine.submitSolution({ solution: dealPuzzle(FIXED_SEED, 0).solution });

    clock.mockReturnValue(6_000_000);
    const corrected = setup();
    corrected.engine.startGame({ difficulty: 0 });
    corrected.engine.useUndo();
    clock.mockReturnValue(6_060_000);
    await corrected.engine.submitSolution({ solution: dealPuzzle(FIXED_SEED, 0).solution });

    expect(corrected.obs.lastPayout.get()).toBe(clean.obs.lastPayout.get());
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

  it("reveals a bounded local hint without any reward write", () => {
    const h = setup();
    h.engine.startGame({ difficulty: 0 });
    const dealt = dealPuzzle(FIXED_SEED, 0);
    const cell = dealt.puzzle.indexOf("0");

    h.engine.requestHint({ cell });

    expect(h.hintsUsed.get()).toBe(1);
    expect(h.hintCell.get()).toBe(cell);
    expect(h.hintDigit.get()).toBe(Number(dealt.solution[cell]));
    expect(h.hintNonce.get()).toBe(1);
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("freezes and restores the local clock while paused", () => {
    const h = setup();
    const clock = vi.spyOn(Date, "now");
    clock.mockReturnValue(1_000_000);
    h.engine.startGame({ difficulty: 0 });
    const originalDeadline = h.obs.deadline.get();

    clock.mockReturnValue(1_030_000);
    h.engine.togglePause();
    expect(h.isPaused.get()).toBe(true);
    clock.mockReturnValue(1_075_000);
    h.engine.togglePause();

    expect(h.isPaused.get()).toBe(false);
    expect(h.obs.deadline.get()).toBe(originalDeadline + 45_000);
    expect(h.setStatus).toHaveBeenLastCalledWith("guestResumed", "info");
  });

  it("restores the exact live puzzle, timer, tools, and pause state after refresh", async () => {
    const storage = memoryStorage();
    const clock = vi.spyOn(Date, "now");
    clock.mockReturnValue(2_000_000);
    const first = setup(storage);
    first.engine.startGame({ difficulty: 1 });
    const originalClues = first.clues.get();
    const originalDeadline = first.obs.deadline.get();
    const emptyCell = originalClues.indexOf("0");
    first.engine.requestHint({ cell: emptyCell });
    first.engine.useUndo();
    clock.mockReturnValue(2_030_000);
    first.engine.togglePause();

    clock.mockReturnValue(2_090_000);
    const restored = setup(storage);
    await restored.engine.enter();

    expect(restored.obs.gameStatus.get()).toBe("dealt");
    expect(restored.obs.activeGameId.get()).toBe("guest");
    expect(restored.obs.gameDifficulty.get()).toBe(1);
    expect(restored.clues.get()).toBe(originalClues);
    expect(restored.obs.deadline.get()).toBe(originalDeadline);
    expect(restored.obs.undosUsed.get()).toBe(1);
    expect(restored.hintsUsed.get()).toBe(1);
    expect(restored.isPaused.get()).toBe(true);
    expect(restored.obs.lastStatus.get()).toBe("guestRestored");

    restored.engine.togglePause();
    expect(restored.obs.deadline.get()).toBe(originalDeadline + 60_000);
  });

  it("persists the best local score and solve count without exposing paid state", async () => {
    const storage = memoryStorage();
    const first = setup(storage);
    first.engine.startGame({ difficulty: 0 });
    await first.engine.submitSolution({ solution: dealPuzzle(FIXED_SEED, 0).solution });

    const restored = setup(storage);
    await restored.engine.enter();

    expect(restored.obs.myTotalWon.get()).toBe(first.obs.myTotalWon.get());
    expect(restored.obs.mySolves.get()).toBe(1);
    expect(restored.obs.credit.get()).toBe(0);
    expect(restored.obs.gameStatus.get()).toBe("idle");
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
