import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGuestEngine } from "../../jump-rush/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../jump-rush/src/logic/guest-engine";
import { formatRankDisplay } from "../../jump-rush/src/main";
import type { LeaderEntry, RunRow } from "../../jump-rush/src/main";
import { MAX_UNDOS, ruleOf } from "../../jump-rush/src/logic/game-rules";
import type { Platform } from "../../jump-rush/src/logic/jump-engine";

/**
 * Guest engine tests for Jump Rush.
 *
 * The guest engine is a purely LOCAL platform runner — it must drive the same
 * scene observables the gamefi flow does while making ZERO chain / oracle /
 * reward calls. These tests assert the off-chain guest leaderboard is the ONLY
 * external surface it ever touches (and only on settle / refresh / enter,
 * never while dealing or jumping).
 */

function setup(sharedStorage = new Map<string, unknown>()) {
  const gameStatus = createObservable("idle");
  const activeGameId = createObservable("0");
  const gameDifficulty = createObservable(0);
  const platformsView = createObservable<Platform[]>([]);
  const commitment = createObservable("");
  const dealtAt = createObservable(0);
  const deadline = createObservable(0);
  const undosUsed = createObservable(0);
  const lastPayout = createObservable("");
  const lastElapsedMs = createObservable(0);
  const leaderboard = createObservable<LeaderEntry[]>([]);
  // Mirror production main.tsx: `undefined` (unread), not a fabricated 0. The
  // guest engine only ever SETS these; enter()/submitRun() settle them.
  const myRank = createObservable<number | undefined>(undefined);
  const myTotalWon = createObservable<number | undefined>(undefined);
  const myRuns = createObservable<number | undefined>(undefined);
  const myHistory = createObservable<RunRow[]>([]);
  const isStarting = createObservable(false);
  const isDealing = createObservable(false);
  const isSubmitting = createObservable(false);
  const isUndoing = createObservable(false);
  const lastStatus = createObservable("");
  const jumpCount = createObservable(0);
  const currentPlatform = createObservable(0);
  const perfectCount = createObservable(0);
  const comboCount = createObservable(0);
  const chargeLevel = createObservable(0);
  const isCharging = createObservable(false);
  const isJumping = createObservable(false);
  const missedPlatform = createObservable(false);

  const submit = vi.fn(async (_score: number | string) => {});
  const board: Array<{ user: string; score: string }> = [];
  const get = vi.fn(async (_limit?: number) => board.slice());
  const guestLeaderboard = { submit, get };
  const storageData = sharedStorage;
  const storage = {
    get<T>(key: string, fallback?: T | null): T | null {
      return (storageData.has(key) ? storageData.get(key) : (fallback ?? null)) as T | null;
    },
    set: vi.fn((key: string, value: unknown) => { storageData.set(key, value); }),
    delete: vi.fn((key: string) => { storageData.delete(key); }),
  };

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
    storage,
    t,
    setStatus,
  };
  const engine = createGuestEngine(deps);
  return {
    engine, submit, get, board, setStatus,
    gameStatus, activeGameId, commitment, platformsView, dealtAt, deadline,
    undosUsed, lastPayout, lastElapsedMs, leaderboard, myRank, myTotalWon,
    myRuns, myHistory, jumpCount, currentPlatform, perfectCount, comboCount,
    missedPlatform, storage, storageData,
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
    expect(view.length).toBe(ruleOf(0).targetJumps + 1);
    expect(view[0]).toMatchObject({ x: 60, width: 120, gap: 0 });
    expect(view.slice(1).every((platform) => platform.gap >= 60 && platform.gap <= 120)).toBe(true);
    expect(h.deadline.get() - h.dealtAt.get()).toBe(ruleOf(0).limitMs);
    // Dealing a route never touches the off-chain board.
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("generates a distinct route each run (local RNG seed)", () => {
    const h = setup();
    h.engine.startGame(2);
    const first = JSON.stringify(h.platformsView.get());
    // Force a re-deal from a clean lobby.
    h.engine.expireGame();
    h.engine.startGame(2);
    const second = JSON.stringify(h.platformsView.get());
    expect(second).not.toBe(first);
  });

  it("does not repeat the first 16-platform pattern on long local routes", () => {
    const h = setup();
    h.engine.startGame(2);
    const route = h.platformsView.get();
    const firstBand = route.slice(1, 15).map(({ width, gap }) => ({ width, gap }));
    const secondBand = route.slice(17, 31).map(({ width, gap }) => ({ width, gap }));

    expect(secondBand).not.toEqual(firstBand);
  });

  it.each([
    { difficulty: 0, minGap: 60, maxGap: 120 },
    { difficulty: 1, minGap: 100, maxGap: 180 },
    { difficulty: 2, minGap: 140, maxGap: 260 },
  ])(
    "deals the full target route for difficulty $difficulty",
    ({ difficulty, minGap, maxGap }) => {
      const h = setup();
      h.engine.startGame(difficulty);
      const route = h.platformsView.get();

      expect(route).toHaveLength(ruleOf(difficulty).targetJumps + 1);
      expect(route.slice(1).every((platform) => platform.gap >= minGap && platform.gap <= maxGap)).toBe(true);
    },
  );

  it("accepts only sequential landed jumps and tracks perfect combos", () => {
    const h = setup();
    h.engine.startGame(0);
    h.engine.recordJump(3, true, false); // cannot skip ahead
    expect(h.jumpCount.get()).toBe(0);
    h.engine.recordJump(1, true, true);
    expect(h.jumpCount.get()).toBe(1);
    expect(h.currentPlatform.get()).toBe(1);
    expect(h.perfectCount.get()).toBe(1);
    expect(h.comboCount.get()).toBe(1);
    h.engine.recordJump(1, true, true); // replay ignored
    expect(h.jumpCount.get()).toBe(1);
    h.engine.recordJump(2, true, false);
    expect(h.jumpCount.get()).toBe(2);
    expect(h.comboCount.get()).toBe(0);
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

  it("marks a miss and lets undo re-arm the local run", () => {
    const h = setup();
    h.engine.startGame(0);
    h.engine.recordJump(1, false, false);
    expect(h.missedPlatform.get()).toBe(true);
    expect(h.jumpCount.get()).toBe(0);
    h.engine.useUndo();
    expect(h.missedPlatform.get()).toBe(false);
    expect(h.undosUsed.get()).toBe(1);
  });

  it("submitRun records the cleared-jump count off-chain and returns to lobby", async () => {
    const h = setup();
    h.engine.startGame(0);
    for (let index = 1; index <= ruleOf(0).targetJumps; index += 1) {
      h.engine.recordJump(index, true, index % 2 === 0);
    }

    await h.engine.submitRun();

    expect(h.gameStatus.get()).toBe("solved");
    expect(h.activeGameId.get()).toBe("0");
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.submit).toHaveBeenCalledWith(ruleOf(0).targetJumps); // jumps cleared, not GAS
    expect(h.get).toHaveBeenCalled(); // guest board refreshed after settle
    expect(h.lastPayout.get()).toBe(String(ruleOf(0).targetJumps));
    expect(h.myTotalWon.get()).toBe(ruleOf(0).targetJumps); // best run, not GAS
    expect(h.myRuns.get()).toBe(1);
    expect(h.storage.set).toHaveBeenCalledWith("guest:profile", {
      bestJumps: ruleOf(0).targetJumps,
      runs: 1,
      history: [expect.objectContaining({
        difficulty: 0,
        jumps: ruleOf(0).targetJumps,
        perfects: Math.floor(ruleOf(0).targetJumps / 2),
      })],
    });
    expect(h.myHistory.get()).toHaveLength(1);
  });

  it("blocks an incomplete direct submit instead of awarding the route length", async () => {
    const h = setup();
    h.engine.startGame(1);
    await h.engine.submitRun();
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.gameStatus.get()).toBe("dealt");
    expect(h.setStatus).toHaveBeenCalledWith("statusBoardIncomplete", "info");
  });

  it("expireGame resets to a clean local lobby", () => {
    const h = setup();
    h.engine.startGame(0);
    h.engine.recordJump(1, true, false);
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

  it("restores local best and runs from framework storage", async () => {
    const h = setup();
    h.storageData.set("guest:profile", { bestJumps: 20, runs: 4 });
    await h.engine.enter();
    expect(h.myTotalWon.get()).toBe(20);
    expect(h.myRuns.get()).toBe(4);
  });

  it("restores an unfinished local run with progress, miss state, and deadline", async () => {
    const sharedStorage = new Map<string, unknown>();
    const first = setup(sharedStorage);
    first.engine.startGame(0);
    first.engine.recordJump(1, true, true);
    first.engine.recordJump(2, true, false);
    first.engine.recordJump(3, false, false);
    const originalRoute = first.platformsView.get();
    const originalDeadline = first.deadline.get();

    const recovered = setup(sharedStorage);
    await recovered.engine.enter();

    expect(recovered.gameStatus.get()).toBe("dealt");
    expect(recovered.activeGameId.get()).toBe("guest");
    expect(recovered.platformsView.get()).toEqual(originalRoute);
    expect(recovered.deadline.get()).toBe(originalDeadline);
    expect(recovered.jumpCount.get()).toBe(2);
    expect(recovered.currentPlatform.get()).toBe(2);
    expect(recovered.perfectCount.get()).toBe(1);
    expect(recovered.missedPlatform.get()).toBe(true);
  });

  it("discards malformed or expired recovery data instead of reviving a broken run", async () => {
    const sharedStorage = new Map<string, unknown>([[
      "guest:active-run/v1",
      { version: 1, difficulty: 0, deadline: Date.now() - 1 },
    ]]);
    const h = setup(sharedStorage);

    await h.engine.enter();

    expect(h.gameStatus.get()).toBe("idle");
    expect(h.activeGameId.get()).toBe("0");
    expect(sharedStorage.has("guest:active-run/v1")).toBe(false);
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

  it("drops malformed off-chain scores instead of rendering impossible rankings", async () => {
    const h = setup();
    h.board.push({ user: "Nvalid", score: "12" });
    h.board.push({ user: "Ninfinite", score: "Infinity" });
    h.board.push({ user: "Nnegative", score: "-4" });
    h.board.push({ user: "", score: "9" });

    await h.engine.refreshLeaderboard();

    expect(h.leaderboard.get()).toEqual([
      expect.objectContaining({ rank: 1, address: "Nvalid", totalWon: 12 }),
    ]);
  });

  // pendingKey migration guard: the stat rail / sidebar bind these observables
  // with no loading gate, so a `0` at rest is published as "Best run 0 / Runs 0
  // / Rank 0" before any read runs — a fabricated claim. `undefined` is the
  // unread state (the shell's pendingKey trigger); a settled 0 is a real
  // reading; and rank 0 is never printed as "0".
  const tStub = (key: string) => key;

  it("holds the chrome read-outs unread (undefined), never a fabricated 0, until a read settles", async () => {
    const h = setup();

    // Before any read has settled: absence, not a zero the app never measured.
    expect(h.myRank.get()).toBeUndefined();
    expect(h.myTotalWon.get()).toBeUndefined();
    expect(h.myRuns.get()).toBeUndefined();
    expect(formatRankDisplay(h.myRank.get(), tStub)).toBeUndefined();

    // enter() with an empty local profile is a real, SETTLED zero-state read.
    await h.engine.enter();

    // A settled 0 is a legitimate answer (a player with 0 runs) — renders as 0.
    expect(h.myRuns.get()).toBe(0);
    expect(h.myTotalWon.get()).toBe(0);
    // But rank 0 is not a rank: local guest play holds no global board seat, so
    // the chrome reads a word, never "0".
    expect(h.myRank.get()).toBe(0);
    expect(formatRankDisplay(h.myRank.get(), tStub)).toBe(tStub("rankUnranked"));
    expect(formatRankDisplay(h.myRank.get(), tStub)).not.toBe("0");
  });

  it("formatRankDisplay renders three honest ranking phases", () => {
    expect(formatRankDisplay(undefined, tStub)).toBeUndefined();      // unread → pendingKey
    expect(formatRankDisplay(0, tStub)).toBe(tStub("rankUnranked"));  // settled, no seat
    expect(formatRankDisplay(-1, tStub)).toBe(tStub("rankUnranked")); // settled, no seat
    expect(formatRankDisplay(4, tStub)).toBe("#4");                   // ranked
    expect(formatRankDisplay(0, tStub)).not.toBe("0");
  });
});
