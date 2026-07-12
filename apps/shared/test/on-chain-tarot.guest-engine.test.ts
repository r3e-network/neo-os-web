import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createTarotGuestEngine } from "../../on-chain-tarot/src/logic/guest-engine";
import type { TarotGuestEngineDeps } from "../../on-chain-tarot/src/logic/guest-engine";
import type {
  Card,
  TarotReadingMode,
} from "../../on-chain-tarot/src/composables/useTarot";

function makeObs<T>(initial: T) {
  return createObservable<T>(initial);
}

function stubRandomInts(values: number[]): void {
  const queue = [...values];
  vi.stubGlobal("crypto", {
    getRandomValues: vi.fn((array: Uint32Array) => {
      array[0] = queue.shift() ?? 0;
      return array;
    }),
  });
}

function makeStorage(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    store,
    get: vi.fn(<T,>(key: string, fallback?: T | null): T | null => {
      return (store.has(key) ? store.get(key) : fallback ?? null) as T | null;
    }),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
    }),
  };
}

function setup(initialStorage: Record<string, unknown> = {}) {
  const drawn = makeObs<Card[]>([]);
  const readingMode = makeObs<TarotReadingMode>("idle");
  const readingsCount = makeObs(0);
  const prepaidCredit = makeObs(1.5);
  const isLoading = makeObs(false);
  const question = makeObs("Will I win?");
  const storage = makeStorage(initialStorage);
  const setStatus = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  const deps: TarotGuestEngineDeps = {
    drawn,
    readingMode,
    readingsCount,
    prepaidCredit,
    isLoading,
    question,
    storage,
    t,
    setStatus,
  };
  const engine = createTarotGuestEngine(deps);
  return {
    engine,
    drawn,
    readingMode,
    readingsCount,
    prepaidCredit,
    isLoading,
    question,
    storage,
    setStatus,
  };
}

describe("on-chain-tarot guest engine", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enter() resets to a local lobby and restores the on-device guest tally", async () => {
    const h = setup({ "guest:readings": 4 });
    h.drawn.set([{ id: 0 } as Card]);
    h.readingMode.set("oracle");
    h.isLoading.set(true);

    await h.engine.enter();

    expect(h.drawn.get()).toEqual([]);
    expect(h.readingMode.get()).toBe("idle");
    expect(h.isLoading.get()).toBe(false);
    expect(h.question.get()).toBe("questionPresetDecision");
    expect(h.prepaidCredit.get()).toBe(0);
    expect(h.readingsCount.get()).toBe(4);
  });

  it("draws three distinct local cards and writes only the guest reading count", async () => {
    // Partial Fisher-Yates with zero offsets yields card ids 0, 1, 2.
    stubRandomInts([0, 0, 0]);
    const h = setup({ "guest:readings": 1 });

    await h.engine.draw();

    const cards = h.drawn.get();
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((card) => card.id)).size).toBe(3);
    expect(cards.map((card) => card.id)).toEqual([0, 1, 2]);
    expect(h.readingMode.get()).toBe("local");
    expect(h.readingsCount.get()).toBe(2);
    expect(h.question.get()).toBe("");
    expect(h.isLoading.get()).toBe(false);
    expect(h.storage.set).toHaveBeenCalledWith("guest:readings", 2);
  });

  it("rejects modulo-biased values before accepting a secure random sample", async () => {
    // UINT32_MAX falls in the incomplete range for a 78-card deck and must be
    // discarded. The following zero values produce ids 0, 1 and 2.
    stubRandomInts([0xffff_ffff, 0, 0, 0]);
    const h = setup();

    await h.engine.draw();

    expect(h.drawn.get().map((card) => card.id)).toEqual([0, 1, 2]);
    expect(globalThis.crypto.getRandomValues).toHaveBeenCalledTimes(4);
  });

  it("fails closed when the device has no secure random generator", async () => {
    vi.stubGlobal("crypto", undefined);
    const h = setup();

    await expect(h.engine.draw()).rejects.toThrow("secureRandomUnavailable");

    expect(h.drawn.get()).toEqual([]);
    expect(h.readingMode.get()).toBe("idle");
    expect(h.isLoading.get()).toBe(false);
    expect(h.storage.set).not.toHaveBeenCalled();
  });

  it("keeps the reading playable when local tally storage is unavailable", async () => {
    stubRandomInts([0, 0, 0]);
    const h = setup();
    h.storage.get.mockImplementation(() => {
      throw new Error("storage blocked");
    });
    h.storage.set.mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    await expect(h.engine.draw()).resolves.toBeUndefined();

    expect(h.drawn.get()).toHaveLength(3);
    expect(h.readingMode.get()).toBe("local");
    expect(h.readingsCount.get()).toBe(1);
    expect(h.isLoading.get()).toBe(false);
  });

  it("ignores a draw request while a local reading is already loading", async () => {
    const h = setup();
    h.isLoading.set(true);

    await h.engine.draw();

    expect(h.drawn.get()).toEqual([]);
    expect(h.storage.set).not.toHaveBeenCalled();
  });

  it("refresh() loads only the local tally and clears prepaid credit", async () => {
    const h = setup({ "guest:readings": 7 });
    h.prepaidCredit.set(3);

    await h.engine.refresh();

    expect(h.readingsCount.get()).toBe(7);
    expect(h.prepaidCredit.get()).toBe(0);
  });

  it("withdrawCredit() is a guest no-op with an info status", () => {
    const h = setup();

    h.engine.withdrawCredit();

    expect(h.setStatus).toHaveBeenCalledWith("noCredit", "info");
  });
});
