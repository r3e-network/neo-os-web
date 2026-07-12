import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createBetTracker } from "../../dice-game/src/bet-tracker";
import {
  createDiceGuestEngine,
  rollLocalDie,
} from "../../dice-game/src/logic/guest-engine";
import type { DiceGuestEngineDeps } from "../../dice-game/src/logic/guest-engine";

function makeObs<T>(initial: T) {
  return createObservable<T>(initial);
}

function stubDieRoll(roll: number): void {
  const raw = Math.max(0, Math.floor(roll - 1));
  vi.stubGlobal("crypto", {
    getRandomValues(array: Uint8Array) {
      array[0] = raw;
      return array;
    },
  });
}

function setup() {
  const tracker = createBetTracker();
  const selectedFace = makeObs("6");
  const stakeAmount = makeObs("0.10 GAS");
  const payoutPreview = makeObs("0.57 GAS");
  const lastStatus = makeObs("");
  const isSubmitting = makeObs(false);
  const chainLabel = makeObs("Neo N3");
  const houseLiquidity = makeObs(99);
  const directCredit = makeObs(3);
  const maxPayableStake = makeObs(20);
  const submit = vi.fn(async (_score: number | string) => {});
  const get = vi.fn(async (_limit?: number) => []);
  const setStatus = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) => {
    if (key === "guestUnit") return "chips";
    return params ? `${key}:${JSON.stringify(params)}` : key;
  };

  const deps: DiceGuestEngineDeps = {
    tracker,
    selectedFace,
    stakeAmount,
    payoutPreview,
    lastStatus,
    isSubmitting,
    chainLabel,
    houseLiquidity,
    directCredit,
    maxPayableStake,
    guestLeaderboard: { submit, get },
    t,
    setStatus,
  };
  const engine = createDiceGuestEngine(deps);
  return {
    engine,
    tracker,
    selectedFace,
    stakeAmount,
    payoutPreview,
    lastStatus,
    isSubmitting,
    chainLabel,
    houseLiquidity,
    directCredit,
    maxPayableStake,
    submit,
    get,
    setStatus,
  };
}

describe("dice-game guest engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("enter() clears chain-only surfaces and resets the local table", async () => {
    const h = setup();
    h.tracker.beginBet({
      face: "6",
      stake: "1 chips",
      result: "rolling",
      payout: "5.70 chips",
      outcome: "pending",
      at: "",
    });

    await h.engine.enter();

    expect(h.tracker.rollHistory.get()).toEqual([]);
    expect(h.tracker.lastOutcome.get()).toBe("");
    expect(h.tracker.isResolving.get()).toBe(false);
    expect(h.isSubmitting.get()).toBe(false);
    expect(h.chainLabel.get()).toBe("");
    expect(h.houseLiquidity.get()).toBe(0);
    expect(h.directCredit.get()).toBe(0);
    expect(h.maxPayableStake.get()).toBe(0);
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("rolls and settles locally, submitting only the guest win count on a win", async () => {
    stubDieRoll(6);
    const h = setup();

    h.engine.placeDiceBet({ chosenNumber: "6", amount: "0.10" });

    expect(h.selectedFace.get()).toBe("6");
    expect(h.stakeAmount.get()).toBe("0.10 chips");
    expect(h.payoutPreview.get()).toBe("0.57 chips");
    expect(h.tracker.isResolving.get()).toBe(true);
    expect(h.tracker.rollHistory.get()).toHaveLength(1);
    expect(h.submit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1100);

    expect(h.tracker.isResolving.get()).toBe(false);
    expect(h.tracker.lastRoll.get()).toBe("6");
    expect(h.tracker.lastOutcome.get()).toBe("won");
    expect(h.tracker.rollHistory.get()[0]?.result).toBe(
      "outcomeWon · rolledLabel 6",
    );
    expect(h.tracker.rollHistory.get()[0]?.payout).toBe("0.57 chips");
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.submit).toHaveBeenCalledWith(1);
    expect(h.setStatus).toHaveBeenCalledWith("statusWon", "success");
  });

  it("settles losses locally without writing a guest score", async () => {
    stubDieRoll(1);
    const h = setup();

    h.engine.placeDiceBet({ chosenNumber: "6", amount: "1" });
    await vi.advanceTimersByTimeAsync(1100);

    expect(h.tracker.lastRoll.get()).toBe("1");
    expect(h.tracker.lastOutcome.get()).toBe("lost");
    expect(h.tracker.rollHistory.get()[0]?.payout).toBe("0 chips");
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.setStatus).toHaveBeenCalledWith("statusLost", "info");
  });

  it("blocks overlapping local rolls while the reveal animation is pending", () => {
    stubDieRoll(6);
    const h = setup();

    h.engine.placeDiceBet({ chosenNumber: "6", amount: "0.10" });
    h.engine.placeDiceBet({ chosenNumber: "1", amount: "20" });

    expect(h.tracker.rollHistory.get()).toHaveLength(1);
    expect(h.selectedFace.get()).toBe("6");
  });

  it("shortens cosmetic reveal pacing when reduced motion is requested", async () => {
    stubDieRoll(2);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const h = setup();

    h.engine.placeDiceBet({ chosenNumber: "2", amount: "0.10" });
    await vi.advanceTimersByTimeAsync(119);
    expect(h.tracker.isResolving.get()).toBe(true);

    await vi.advanceTimersByTimeAsync(1);
    expect(h.tracker.isResolving.get()).toBe(false);
    expect(h.tracker.lastRoll.get()).toBe("2");
  });

  it("rejects the biased byte tail before mapping a secure sample to a face", () => {
    const values = [255, 5];
    const getRandomValues = vi.fn((array: Uint8Array) => {
      array[0] = values.shift() ?? 0;
      return array;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(rollLocalDie()).toBe(6);
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it("fails closed without a browser CSPRNG and never opens a fake pending roll", () => {
    vi.stubGlobal("crypto", undefined);
    const h = setup();

    h.engine.placeDiceBet({ chosenNumber: "6", amount: "0.10" });

    expect(h.tracker.rollHistory.get()).toEqual([]);
    expect(h.tracker.isResolving.get()).toBe(false);
    expect(h.lastStatus.get()).toBe("guestRandomUnavailable");
    expect(h.setStatus).toHaveBeenCalledWith("guestRandomUnavailable", "error");
  });
});
