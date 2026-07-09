import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGameSessionObservables } from "@framework/game";
import {
  applyCare,
  createGuestEngine,
} from "../../pet-potion/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../pet-potion/src/logic/guest-engine";
import { MAX_MOVES, ruleOf } from "../../pet-potion/src/logic/game-rules";

/**
 * Guest engine tests for Pet Potion.
 *
 * The guest engine is a purely LOCAL pet-care game — it must drive the same
 * scene observables the gamefi flow does while making ZERO chain / oracle /
 * reward calls. These tests exercise the local care rules and assert the
 * off-chain leaderboard is the ONLY external surface it ever touches (and only
 * on settle / refresh / enter, never during play).
 */

function makeObs<T>(initial: T) {
  return createObservable<T>(initial);
}

function setup() {
  const obs = createGameSessionObservables();
  const actionsUsed = makeObs<number>(0);
  const happinessAchieved = makeObs<number>(0);
  const petHappiness = makeObs<number>(50);
  const petHunger = makeObs<number>(50);
  const petEnergy = makeObs<number>(50);
  const petStage = makeObs<number>(0);
  const actionHistory = makeObs<string[]>([]);
  const lastPayoutFixed8 = makeObs<bigint>(0n);

  const submit = vi.fn(async (_score: number | string) => {});
  const board: Array<{ user: string; score: string }> = [];
  const get = vi.fn(async (_limit?: number) => board.slice());
  const guestLeaderboard = { submit, get };

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
    lastPayoutFixed8,
    guestLeaderboard,
    t,
    setStatus,
  };
  const engine = createGuestEngine(deps);
  return {
    engine, obs, actionsUsed, happinessAchieved,
    petHappiness, petHunger, petEnergy, petStage,
    actionHistory, lastPayoutFixed8, submit, get, board, setStatus,
  };
}

/** Drive a live guest run to (or past) the difficulty target with balanced care. */
function playToTarget(h: ReturnType<typeof setup>, target: number): void {
  for (let i = 0; i < MAX_MOVES && h.petHappiness.get() < target; i += 1) {
    if (h.petEnergy.get() <= 25) h.engine.recordAction({ type: "rest" });
    else if (h.petHunger.get() >= 60) h.engine.recordAction({ type: "feed" });
    else h.engine.recordAction({ type: "pet" });
  }
}

describe("pet-potion applyCare (local care rules)", () => {
  it("feed fills the pet (lowers hunger) and nudges happiness", () => {
    const next = applyCare({ happiness: 40, hunger: 60, energy: 50 }, "feed");
    expect(next.hunger).toBeLessThan(60);
    expect(next.happiness).toBeGreaterThan(40);
  });

  it("play raises happiness but drains energy and builds hunger", () => {
    const next = applyCare({ happiness: 40, hunger: 40, energy: 60 }, "play");
    expect(next.happiness).toBeGreaterThan(40);
    expect(next.energy).toBeLessThan(60);
    expect(next.hunger).toBeGreaterThan(40);
  });

  it("dampens happiness gains when the pet is starving or exhausted", () => {
    const healthy = applyCare({ happiness: 40, hunger: 40, energy: 60 }, "pet");
    const starving = applyCare({ happiness: 40, hunger: 90, energy: 60 }, "pet");
    const exhausted = applyCare({ happiness: 40, hunger: 40, energy: 10 }, "pet");
    const healthyGain = healthy.happiness - 40;
    expect(starving.happiness - 40).toBeLessThan(healthyGain);
    expect(exhausted.happiness - 40).toBeLessThan(healthyGain);
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
    expect(h.petHunger.get()).toBeLessThan(beforeHunger); // feeding fills the pet
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
    expect(h.obs.lastStatus.get()).toBe("all-correct");
    // Reaching the target locally still writes nothing to the off-chain board.
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("submitSolution settles a solved run, records best happiness off-chain, returns to lobby", async () => {
    const h = setup();
    h.engine.startGame(0);
    playToTarget(h, ruleOf(0).targetHappiness);
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
