import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "@shared/react/context";
import type { GameHistoryItem, GameResult } from "../composables/useCoinFlip";
import { createGuestEngine } from "./guest-engine";
import type { GuestEngineDeps } from "./guest-engine";

function observable<T>(value: T) {
  return createObservable(value);
}

function setup() {
  const deps: GuestEngineDeps = {
    betAmount: observable("1"),
    choice: observable<"heads" | "tails">("heads"),
    isFlipping: observable(false),
    revealing: observable(false),
    result: observable<GameResult | null>(null),
    displayOutcome: observable<"heads" | "tails" | null>(null),
    showWinOverlay: observable(false),
    winAmount: observable("0"),
    validationError: observable<string | null>(null),
    wins: observable(0),
    losses: observable(0),
    totalWon: observable(0),
    gameHistory: observable<GameHistoryItem[]>([]),
    streak: observable(0),
    bankrollBase: observable(0n),
    freeBankrollBase: observable(0n),
    creditBase: observable(0n),
    guestLeaderboard: {
      submit: vi.fn(async () => undefined),
      get: vi.fn(async () => []),
    },
    t: (key) => key,
  };
  return { deps, engine: createGuestEngine(deps) };
}

describe("FogPlay guest lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("crypto", {
      getRandomValues(bytes: Uint8Array) {
        bytes[0] = 0;
        return bytes;
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("cancels an in-flight local flip on mode switch or unmount", async () => {
    const { deps, engine } = setup();
    const pending = engine.placeBet();

    expect(deps.isFlipping.get()).toBe(true);
    engine.dispose();
    await vi.runAllTimersAsync();
    await pending;

    expect(deps.isFlipping.get()).toBe(false);
    expect(deps.result.get()).toBeNull();
    expect(deps.gameHistory.get()).toEqual([]);
    expect(deps.wins.get()).toBe(0);
    expect(deps.losses.get()).toBe(0);
  });

  it("can enter a fresh guest table after being disposed", async () => {
    const { deps, engine } = setup();
    engine.dispose();
    await engine.enter();

    const pending = engine.placeBet();
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ won: true, outcome: "HEADS" });
    expect(deps.gameHistory.get()).toHaveLength(1);
  });

  it("fails closed when secure browser randomness is unavailable", async () => {
    vi.stubGlobal("crypto", undefined);
    const { deps, engine } = setup();

    const pending = engine.placeBet();
    const rejection = expect(pending).rejects.toThrow("secureRandomUnavailable");
    await vi.runAllTimersAsync();
    await rejection;

    expect(deps.isFlipping.get()).toBe(false);
    expect(deps.validationError.get()).toBe("secureRandomUnavailable");
    expect(deps.result.get()).toBeNull();
    expect(deps.gameHistory.get()).toEqual([]);
  });

  it("settles promptly when the player prefers reduced motion", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const { deps, engine } = setup();

    const pending = engine.placeBet();
    await vi.advanceTimersByTimeAsync(119);
    expect(deps.result.get()).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ won: true, outcome: "HEADS" });
  });
});
