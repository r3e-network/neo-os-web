import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGameSessionObservables } from "@framework/game";
import {
  applyCare,
  createGuestEngine,
} from "../../pet-potion/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../pet-potion/src/logic/guest-engine";
import {
  MAX_MOVES,
  emptyIngredientCounts,
  recipeReady,
  ruleOf,
  type IngredientCounts,
} from "../../pet-potion/src/logic/game-rules";

/**
 * Guest engine tests for Pet Potion.
 *
 * The guest engine is a purely LOCAL pet-care game — it must drive the same
 * scene observables the gamefi flow does while making ZERO chain / oracle /
 * reward calls. These tests exercise the local care rules and assert the
 * off-chain leaderboard is the ONLY external surface it ever touches (and only
 * on settle / refresh / enter, never during play).
 */

function setup(overrides: Partial<GuestEngineDeps> = {}) {
  const obs = createGameSessionObservables();
  const actionsUsed = createObservable<number>(0);
  const happinessAchieved = createObservable<number>(0);
  const petHappiness = createObservable<number>(50);
  const petHunger = createObservable<number>(50);
  const petEnergy = createObservable<number>(50);
  const petStage = createObservable<number>(0);
  const actionHistory = createObservable<string[]>([]);
  const ingredientCounts = createObservable<IngredientCounts>(emptyIngredientCounts());
  const potionBrewed = createObservable(false);
  const lastPayoutFixed8 = createObservable<bigint>(0n);

  const submit = vi.fn(async (_score: number | string) => {});
  const board: Array<{ user: string; score: string }> = [];
  const get = vi.fn(async (_limit?: number) => board.slice());
  const guestLeaderboard = { submit, get };
  const storageData = new Map<string, unknown>();
  const storage = overrides.storage ?? {
    get<T>(key: string, fallback?: T | null): T | null {
      return (storageData.has(key) ? storageData.get(key) : (fallback ?? null)) as T | null;
    },
    set: vi.fn((key: string, value: unknown) => { storageData.set(key, structuredClone(value)); }),
    delete: vi.fn((key: string) => { storageData.delete(key); }),
  };

  const setStatus = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  const deps: GuestEngineDeps = {
    obs,
    actionsUsed,
    happinessAchieved,
    petHappiness,
    petHunger,
    petEnergy,
    petStage,
    actionHistory,
    ingredientCounts,
    potionBrewed,
    lastPayoutFixed8,
    guestLeaderboard,
    storage,
    t,
    setStatus,
    ...overrides,
  };
  const engine = createGuestEngine(deps);
  return {
    engine, obs, actionsUsed, happinessAchieved,
    petHappiness, petHunger, petEnergy, petStage,
    actionHistory, ingredientCounts, potionBrewed,
    lastPayoutFixed8, submit, get, board, setStatus, storage, storageData,
  };
}

/** Drive a live guest run to (or past) the difficulty target with balanced care. */
function playToTarget(h: ReturnType<typeof setup>, target: number): void {
  const cadence = ["feed", "play", "pet", "rest"] as const;
  for (let i = 0; i < MAX_MOVES && (h.petHappiness.get() < target || !recipeReady(h.ingredientCounts.get())); i += 1) {
    h.engine.recordAction({ type: cadence[i % cadence.length] });
  }
}

describe("pet-potion applyCare (local care rules)", () => {
  it("feed raises satiety and applies the Morpheus hunger-gap gain", () => {
    const next = applyCare({ happiness: 40, hunger: 60, energy: 50 }, "feed");
    expect(next).toEqual({ happiness: 45, hunger: 90, energy: 50 });
  });

  it("play raises happiness but drains energy and builds hunger", () => {
    const next = applyCare({ happiness: 40, hunger: 40, energy: 60 }, "play");
    expect(next.happiness).toBeGreaterThan(40);
    expect(next.energy).toBeLessThan(60);
    expect(next.hunger).toBeLessThan(40);
  });

  it("matches Morpheus play gating when satiety or energy is low", () => {
    expect(applyCare({ happiness: 40, hunger: 40, energy: 60 }, "play").happiness).toBe(52);
    expect(applyCare({ happiness: 40, hunger: 8, energy: 60 }, "play").happiness).toBe(42);
  });

  it("keeps every stat clamped to 0..100", () => {
    const high = applyCare({ happiness: 98, hunger: 2, energy: 98 }, "rest");
    expect(high.energy).toBeLessThanOrEqual(100);
    const low = applyCare({ happiness: 0, hunger: 2, energy: 5 }, "play");
    expect(low.energy).toBeGreaterThanOrEqual(0);
  });

  it("ignores unknown actions", () => {
    const stats = { happiness: 40, hunger: 40, energy: 40 };
    expect(applyCare(stats, "sleep")).toEqual(stats);
  });
});

describe("pet-potion guest engine", () => {
  it("deals a fully local pet on startGame with no leaderboard writes", () => {
    const h = setup();
    h.engine.startGame(0);

    expect(h.obs.gameStatus.get()).toBe("dealt");
    expect(h.obs.activeGameId.get()).toBe("guest");
    expect(h.obs.commitment.get()).toBe(""); // no on-chain commitment in guest
    expect(h.actionsUsed.get()).toBe(0);
    expect(h.petHappiness.get()).toBeGreaterThan(0);
    expect(h.petHappiness.get()).toBe(20);
    expect(h.petHunger.get()).toBe(40);
    expect(h.petEnergy.get()).toBe(60);
    expect(h.petHappiness.get()).toBeLessThan(ruleOf(0).targetHappiness); // a real climb
    expect(h.obs.deadline.get() - h.obs.dealtAt.get()).toBe(ruleOf(0).limitMs);
    // Dealing a pet never touches the off-chain board.
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("applies a care action locally and records it, with no writes", () => {
    const h = setup();
    h.engine.startGame(0);
    const beforeHunger = h.petHunger.get();

    h.engine.recordAction({ type: "feed" });

    expect(h.actionsUsed.get()).toBe(1);
    expect(h.actionHistory.get()).toEqual(["feed"]);
    expect(h.petHunger.get()).toBeGreaterThan(beforeHunger); // satiety rises
    expect(h.ingredientCounts.get().feed).toBe(1);
    // A normal care action never hits the off-chain board (guard-never-fires analog).
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("ignores actions before a deal and past the move cap", () => {
    const h = setup();
    // No active run yet.
    h.engine.recordAction({ type: "pet" });
    expect(h.actionsUsed.get()).toBe(0);

    h.engine.startGame(0);
    for (let i = 0; i < MAX_MOVES + 5; i += 1) h.engine.recordAction({ type: "rest" });
    expect(h.actionsUsed.get()).toBe(MAX_MOVES);
  });

  it("flags all-correct once the happiness target is reached", () => {
    const h = setup();
    h.engine.startGame(0);
    playToTarget(h, ruleOf(0).targetHappiness);

    expect(h.petHappiness.get()).toBeGreaterThanOrEqual(ruleOf(0).targetHappiness);
    expect(recipeReady(h.ingredientCounts.get())).toBe(true);
    expect(h.obs.lastStatus.get()).toBe("recipe-ready");
    // Reaching the target locally still writes nothing to the off-chain board.
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("submitSolution settles a solved run, records best happiness off-chain, returns to lobby", async () => {
    const h = setup();
    h.engine.startGame(0);
    playToTarget(h, ruleOf(0).targetHappiness);
    h.engine.brewPotion();
    const achieved = h.happinessAchieved.get();

    await h.engine.submitSolution();

    expect(h.obs.gameStatus.get()).toBe("solved");
    expect(h.obs.activeGameId.get()).toBe("0");
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.submit).toHaveBeenCalledWith(achieved); // happiness reached, not GAS
    expect(h.get).toHaveBeenCalled(); // guest board refreshed after settle
    expect(h.obs.myTotalWon.get()).toBe(achieved); // best happiness, not GAS
    expect(h.obs.mySolves.get()).toBe(1);
    expect(h.lastPayoutFixed8.get()).toBe(0n); // no GAS ever moves in guest
    expect(h.potionBrewed.get()).toBe(true);
    expect(h.storage.set).toHaveBeenCalledWith("guest:profile", {
      bestHappiness: achieved,
      solves: 1,
      history: [expect.objectContaining({
        bestHappiness: achieved,
        difficulty: 0,
        won: true,
      })],
    });
    expect(h.obs.myHistory.get()[0]).toMatchObject({ bestHappiness: achieved, won: true });
  });

  it("requires the complete recipe and an explicit brew before saving", async () => {
    const h = setup();
    h.engine.startGame(0);
    playToTarget(h, ruleOf(0).targetHappiness);
    await h.engine.submitSolution();
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.obs.gameStatus.get()).toBe("dealt");
    h.engine.brewPotion();
    expect(h.potionBrewed.get()).toBe(true);
  });

  it("closes an expired run locally without publishing an incomplete potion", async () => {
    const h = setup();
    h.engine.startGame(0);
    h.engine.recordAction({ type: "pet" });
    h.obs.deadline.set(Date.now() - 1);

    await h.engine.submitSolution();

    expect(h.obs.gameStatus.get()).toBe("expired");
    expect(h.obs.mySolves.get()).toBe(0);
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).toHaveBeenCalled();
  });

  it("closes a 40-action run immediately instead of trapping the player", async () => {
    const h = setup();
    h.engine.startGame(2);
    for (let i = 0; i < MAX_MOVES; i += 1) h.engine.recordAction({ type: "pet" });

    await h.engine.submitSolution();

    expect(h.obs.gameStatus.get()).toBe("expired");
    expect(h.obs.activeGameId.get()).toBe("0");
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("can reach Royal Bloom with a balanced recipe inside the move cap", () => {
    const h = setup();
    h.engine.startGame(2);
    playToTarget(h, ruleOf(2).targetHappiness);
    expect(h.petHappiness.get()).toBe(100);
    expect(h.actionsUsed.get()).toBeLessThanOrEqual(MAX_MOVES);
    expect(recipeReady(h.ingredientCounts.get())).toBe(true);
  });

  it("expireGame resets to a clean local lobby", () => {
    const h = setup();
    h.engine.startGame(0);
    h.engine.recordAction({ type: "pet" });

    h.engine.expireGame();

    expect(h.obs.gameStatus.get()).toBe("idle");
    expect(h.obs.activeGameId.get()).toBe("0");
    expect(h.actionsUsed.get()).toBe(0);
    expect(h.actionHistory.get()).toEqual([]);
    expect(h.ingredientCounts.get()).toEqual(emptyIngredientCounts());
    expect(h.potionBrewed.get()).toBe(false);
  });

  it("restores the local best and solve count from framework storage", async () => {
    const h = setup();
    h.storageData.set("guest:profile", { bestHappiness: 88, solves: 3 });
    await h.engine.enter();
    expect(h.obs.myTotalWon.get()).toBe(88);
    expect(h.obs.mySolves.get()).toBe(3);
  });

  it("restores an unfinished nursery from its validated action history", async () => {
    const first = setup();
    first.engine.startGame(1);
    first.engine.recordAction({ type: "feed" });
    first.engine.recordAction({ type: "play" });
    const expectedStats = {
      happiness: first.petHappiness.get(),
      hunger: first.petHunger.get(),
      energy: first.petEnergy.get(),
    };

    const second = setup({ storage: first.storage });
    await second.engine.enter();

    expect(second.obs.gameStatus.get()).toBe("dealt");
    expect(second.obs.activeGameId.get()).toBe("guest");
    expect(second.obs.gameDifficulty.get()).toBe(1);
    expect(second.actionHistory.get()).toEqual(["feed", "play"]);
    expect(second.actionsUsed.get()).toBe(2);
    expect({
      happiness: second.petHappiness.get(),
      hunger: second.petHunger.get(),
      energy: second.petEnergy.get(),
    }).toEqual(expectedStats);
    expect(second.obs.lastStatus.get()).toBe("guestRunRecovered");
  });

  it("restores local result history after a completed potion", async () => {
    const first = setup();
    first.engine.startGame(0);
    playToTarget(first, ruleOf(0).targetHappiness);
    first.engine.brewPotion();
    await first.engine.submitSolution();

    const second = setup({ storage: first.storage });
    await second.engine.enter();

    expect(second.obs.mySolves.get()).toBe(1);
    expect(second.obs.myHistory.get()[0]).toMatchObject({
      difficulty: 0,
      won: true,
    });
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
    h.board.push({ user: "NplayerA", score: "58" });
    h.board.push({ user: "NplayerB", score: "100" });

    await h.engine.refreshLeaderboard();

    const ranked = h.obs.leaderboard.get();
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.address).toBe("NplayerB");
    expect(ranked[0]?.totalWon).toBe(100);
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[1]?.rank).toBe(2);
  });

  it("makes zero off-chain calls across a full local play session until settle", () => {
    const h = setup();
    h.engine.startGame(1);
    for (let i = 0; i < 12; i += 1) h.engine.recordAction({ type: i % 3 === 0 ? "feed" : "pet" });
    // Retry is a no-op in guest; dealing + playing never touches the board.
    h.engine.retryDeal();
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });
});
