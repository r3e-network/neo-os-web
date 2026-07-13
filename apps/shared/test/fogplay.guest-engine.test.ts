import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createGuestEngine } from "../../fogplay/src/logic/guest-engine";
import type { GuestEngineDeps } from "../../fogplay/src/logic/guest-engine";
import type { GameHistoryItem, GameResult } from "../../fogplay/src/composables/useCoinFlip";

function stubCoin(byte: number): void {
  vi.stubGlobal("crypto", {
    getRandomValues(array: Uint8Array) {
      array[0] = byte;
      return array;
    },
  });
}

function setup() {
  const betAmount = createObservable("5");
  const choice = createObservable<"heads" | "tails">("heads");
  const isFlipping = createObservable(false);
  const revealing = createObservable(false);
  const result = createObservable<GameResult | null>(null);
  const displayOutcome = createObservable<"heads" | "tails" | null>(null);
  const showWinOverlay = createObservable(false);
  const winAmount = createObservable("old");
  const validationError = createObservable<string | null>("old error");
  const wins = createObservable(0);
  const losses = createObservable(0);
  const totalWon = createObservable(12);
  const gameHistory = createObservable<GameHistoryItem[]>([]);
  const streak = createObservable(0);
  const bankrollBase = createObservable(100n);
  const freeBankrollBase = createObservable(50n);
  const creditBase = createObservable(25n);
  const submit = vi.fn(async (_score: number | string) => {});
  const get = vi.fn(async (_limit?: number) => []);
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  const deps: GuestEngineDeps = {
    betAmount,
    choice,
    isFlipping,
    revealing,
    result,
    displayOutcome,
    showWinOverlay,
    winAmount,
    validationError,
    wins,
    losses,
    totalWon,
    gameHistory,
    streak,
    bankrollBase,
    freeBankrollBase,
    creditBase,
    guestLeaderboard: { submit, get },
    t,
  };
  const engine = createGuestEngine(deps);
  return {
    engine,
    betAmount,
    choice,
    isFlipping,
    revealing,
    result,
    displayOutcome,
    showWinOverlay,
    winAmount,
    validationError,
    wins,
    losses,
    totalWon,
    gameHistory,
    streak,
    bankrollBase,
    freeBankrollBase,
    creditBase,
    submit,
    get,
  };
}

describe("fogplay guest engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("enter() clears gamefi bankroll/credit and resets the local flip table", async () => {
    const h = setup();
    h.result.set({ won: true, outcome: "HEADS" });
    h.displayOutcome.set("heads");
    h.showWinOverlay.set(true);
    h.gameHistory.set([
      { betId: "old", amount: 1, choice: "heads", outcome: "heads", won: true, payout: 2, time: "" },
    ]);

    await h.engine.enter();

    expect(h.isFlipping.get()).toBe(false);
    expect(h.revealing.get()).toBe(false);
    expect(h.result.get()).toBeNull();
    expect(h.displayOutcome.get()).toBeNull();
    expect(h.showWinOverlay.get()).toBe(false);
    expect(h.winAmount.get()).toBe("0");
    expect(h.validationError.get()).toBeNull();
    expect(h.wins.get()).toBe(0);
    expect(h.losses.get()).toBe(0);
    expect(h.totalWon.get()).toBe(0);
    expect(h.streak.get()).toBe(0);
    expect(h.gameHistory.get()).toEqual([]);
    expect(h.bankrollBase.get()).toBe(0n);
    expect(h.freeBankrollBase.get()).toBe(0n);
    expect(h.creditBase.get()).toBe(0n);
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("resolves a local win after the flip animation and writes only the best streak", async () => {
    stubCoin(0); // heads
    const h = setup();

    const flip = h.engine.placeBet();

    expect(h.isFlipping.get()).toBe(true);
    expect(h.result.get()).toBeNull();
    await vi.advanceTimersByTimeAsync(780);
    const result = await flip;

    expect(result).toEqual({ won: true, outcome: "HEADS" });
    expect(h.isFlipping.get()).toBe(false);
    expect(h.displayOutcome.get()).toBe("heads");
    expect(h.wins.get()).toBe(1);
    expect(h.losses.get()).toBe(0);
    expect(h.streak.get()).toBe(1);
    expect(h.showWinOverlay.get()).toBe(true);
    expect(h.winAmount.get()).toBe('guestStreakBadge:{"n":1}');
    expect(h.gameHistory.get()[0]).toMatchObject({
      betId: "local-1",
      amount: 5,
      choice: "heads",
      outcome: "heads",
      won: true,
      payout: 0,
    });
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.submit).toHaveBeenCalledWith(1);
  });

  it("resolves a local loss without submitting a positive guest score", async () => {
    stubCoin(1); // tails
    const h = setup();

    const flip = h.engine.placeBet();
    await vi.advanceTimersByTimeAsync(780);
    await flip;

    expect(h.result.get()).toEqual({ won: false, outcome: "TAILS" });
    expect(h.losses.get()).toBe(1);
    expect(h.streak.get()).toBe(0);
    expect(h.showWinOverlay.get()).toBe(false);
    expect(h.gameHistory.get()[0]).toMatchObject({ outcome: "tails", won: false });
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("ignores overlapping local flips while one is resolving", async () => {
    stubCoin(0);
    const h = setup();

    const first = h.engine.placeBet();
    const second = await h.engine.placeBet();

    expect(second).toEqual({ won: false, outcome: "" });
    expect(h.gameHistory.get()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(780);
    await first;
    expect(h.gameHistory.get()).toHaveLength(1);
  });
});
