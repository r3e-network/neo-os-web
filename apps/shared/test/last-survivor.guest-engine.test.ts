import { describe, expect, it, vi } from "vitest";

import { createGuestEngine, type GuestEngineDeps } from "../../last-survivor/src/logic/guest-engine";
import { createObservable } from "../react/context";
import type { HistoryEvent } from "../../last-survivor/src/composables/useLastSurvivor";

/**
 * Guest engine is a purely LOCAL doomsday-clock game. These tests exercise the
 * engine in isolation over the same observables the scene reads and assert it
 * NEVER needs a chain/oracle/reward surface — only the off-chain guest
 * leaderboard, which is best-effort.
 */

function t(key: string, params?: Record<string, string | number>) {
  const table: Record<string, string> = {
    invalidKeyCount: "Invalid key count",
    noCredit: "No prepaid credit to withdraw",
    guestBoardEntry: "Survivor",
    guestStreakValue: "{count} keys",
  };
  let value = table[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) value = value.replaceAll(`{${k}}`, String(v));
  return value;
}

function makeBoard(initial: Array<{ user: string; score: string }> = []) {
  const rows = [...initial];
  return {
    rows,
    submit: vi.fn(async (score: number | string) => {
      rows.push({ user: "NLocalYou", score: String(score) });
    }),
    get: vi.fn(async () => rows.slice()),
  };
}

function setup(boardRows: Array<{ user: string; score: string }> = []) {
  const board = makeBoard(boardRows);
  const setStatus = vi.fn();
  const obs = {
    roundId: createObservable(0),
    totalPot: createObservable(0),
    isRoundActive: createObservable(false),
    lastBuyer: createObservable<string | null>(null),
    userKeys: createObservable(0),
    totalKeysInRound: createObservable(0n),
    endTime: createObservable(0),
    timeRemainingSeconds: createObservable(0),
    history: createObservable<HistoryEvent[]>([]),
    roundDataAvailable: createObservable(false),
    serviceNotice: createObservable("service down"),
    keyValidationError: createObservable<string | null>(null),
    isBuyingKeys: createObservable(false),
    isSettling: createObservable(false),
    prepaidCredit: createObservable(3),
    address: createObservable<string | null>(null),
  };
  const deps: GuestEngineDeps = {
    ...obs,
    guestLeaderboard: board,
    t,
    setStatus,
  };
  const engine = createGuestEngine(deps);
  return { engine, obs, board, setStatus };
}

describe("last-survivor guest engine (local doomsday drill)", () => {
  it("enter() resets to a clean local arena and loads the off-chain board", async () => {
    const { engine, obs, board } = setup([
      { user: "NAaa", score: "9" },
      { user: "NBbb", score: "4" },
    ]);

    await engine.enter();

    expect(obs.roundId.get()).toBe(1);
    expect(obs.isRoundActive.get()).toBe(true);
    expect(obs.roundDataAvailable.get()).toBe(true);
    expect(obs.serviceNotice.get()).toBe("");
    expect(obs.totalKeysInRound.get()).toBe(0n);
    expect(obs.totalPot.get()).toBe(0);
    expect(obs.prepaidCredit.get()).toBe(0);
    expect(board.get).toHaveBeenCalled();
    // Board renders into `history`, sorted desc, prefixed by rank.
    const rows = obs.history.get();
    expect(rows).toHaveLength(2);
    expect(rows[0].sortKey).toBe(9);
    expect(rows[0].details).toContain("9 keys");
    expect(board.submit).not.toHaveBeenCalled();
  });

  it("buyKeys grows the streak + pot and extends the clock without touching the board", async () => {
    const { engine, obs, board } = setup();
    await engine.enter();
    board.get.mockClear();

    engine.buyKeys("3");

    expect(obs.totalKeysInRound.get()).toBe(3n);
    expect(obs.userKeys.get()).toBe(3);
    expect(obs.totalPot.get()).toBe(3); // pot tracks the streak, not GAS
    expect(obs.lastBuyer.get()).toBeTruthy();
    expect(obs.endTime.get()).toBeGreaterThan(Date.now());
    // Loading keys is a pure local move — no leaderboard read/write.
    expect(board.submit).not.toHaveBeenCalled();
    expect(board.get).not.toHaveBeenCalled();

    engine.buyKeys("5");
    expect(obs.totalKeysInRound.get()).toBe(8n);
    expect(obs.userKeys.get()).toBe(8);
  });

  it("ends the round (claim state) when the local clock hits zero", async () => {
    const { engine, obs } = setup();
    await engine.enter();
    engine.buyKeys("2");
    expect(obs.isRoundActive.get()).toBe(true);

    // Simulate the countdown ticker: some time remaining, then draining to zero.
    obs.timeRemainingSeconds.set(12);
    obs.timeRemainingSeconds.set(0);

    expect(obs.isRoundActive.get()).toBe(false);
    // needsLifecycleSync prerequisites: last buyer recorded + a non-zero pot.
    expect(obs.lastBuyer.get()).toBeTruthy();
    expect(obs.totalPot.get()).toBeGreaterThan(0);
  });

  it("settleRound banks the streak off-chain and opens a fresh local round", async () => {
    const { engine, obs, board } = setup();
    await engine.enter();
    engine.buyKeys("4");
    obs.timeRemainingSeconds.set(20);
    obs.timeRemainingSeconds.set(0); // clock expired → claimable

    await engine.settleRound();

    expect(board.submit).toHaveBeenCalledWith(4);
    // Fresh round after claiming.
    expect(obs.roundId.get()).toBe(2);
    expect(obs.isRoundActive.get()).toBe(true);
    expect(obs.totalKeysInRound.get()).toBe(0n);
    expect(obs.userKeys.get()).toBe(0);
    expect(obs.isSettling.get()).toBe(false);
  });

  it("does not claim while the clock is still running", async () => {
    const { engine, obs, board } = setup();
    await engine.enter();
    engine.buyKeys("3");

    await engine.settleRound();

    expect(board.submit).not.toHaveBeenCalled();
    expect(obs.totalKeysInRound.get()).toBe(3n); // run untouched
    expect(obs.roundId.get()).toBe(1);
  });

  it("withdraw surfaces a no-credit notice (guest has no on-chain credit)", () => {
    const { engine, setStatus } = setup();
    engine.withdraw();
    expect(setStatus).toHaveBeenCalledWith("No prepaid credit to withdraw", "info");
  });
});
