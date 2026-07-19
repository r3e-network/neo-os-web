/**
 * RFC P1-1 guest-kit — the shared guest-engine scaffold.
 *
 * Covers: the rejection-sampling Web-Crypto RNG (bounds, debias, distribution
 * sanity, fail-closed), the difficulty clamp edges, the guest leaderboard
 * get/submit mapping, and the versioned guest persistence (round-trip, stale
 * version, fail-open storage).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GUEST_BOARD_LIMIT,
  clampDifficulty,
  createGuestLeaderboardAdapter,
  createGuestPersistence,
  createGuestRng,
  guestRowsToLeaderEntries,
} from "../game/guest-kit";
import type { GuestRngCrypto, GuestStorage } from "../game/guest-kit";
import type { FrameworkModeSurface } from "../types";

/** Deterministic Web-Crypto stand-in: hands out `words` in order, cyclically. */
function fakeCrypto(words: number[]): GuestRngCrypto & { drawn: number[] } {
  let index = 0;
  const drawn: number[] = [];
  return {
    drawn,
    getRandomValues(array: Uint32Array): Uint32Array {
      for (let i = 0; i < array.length; i += 1) {
        const word = (words[index % words.length] ?? 0) >>> 0;
        array[i] = word;
        drawn.push(word);
        index += 1;
      }
      return array;
    },
  };
}

function memoryStorage() {
  const values = new Map<string, unknown>();
  return {
    values,
    get<T>(key: string, fallback: T | null = null): T | null {
      return values.has(key) ? (values.get(key) as T) : fallback;
    },
    set(key: string, value: unknown): void {
      values.set(key, structuredClone(value));
    },
    delete(key: string): void {
      values.delete(key);
    },
  };
}

function mockMode(rows: Array<{ user: string; score: string }> = []) {
  const get = vi.fn(async (_limit?: number) => rows.slice());
  const submit = vi.fn(async (_score: number | string) => {});
  const mode = { guestLeaderboard: { get, submit } } as unknown as FrameworkModeSurface;
  return { mode, get, submit };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("guest-kit clampDifficulty", () => {
  it("rounds to the nearest integer inside the default 0..2 window", () => {
    expect(clampDifficulty(0)).toBe(0);
    expect(clampDifficulty(1.4)).toBe(1);
    expect(clampDifficulty(1.5)).toBe(2);
    expect(clampDifficulty(2)).toBe(2);
  });

  it("clamps out-of-window values to the window edges", () => {
    expect(clampDifficulty(-3)).toBe(0);
    expect(clampDifficulty(-0.4)).toBe(0);
    expect(clampDifficulty(99)).toBe(2);
  });

  it("falls back to min for non-finite / absent input", () => {
    expect(clampDifficulty(Number.NaN)).toBe(0);
    expect(clampDifficulty(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampDifficulty(undefined)).toBe(0);
    expect(clampDifficulty(null)).toBe(0);
    expect(clampDifficulty("nope")).toBe(0);
  });

  it("coerces numeric strings (persisted / form values)", () => {
    expect(clampDifficulty("1")).toBe(1);
    expect(clampDifficulty("2")).toBe(2);
  });

  it("honors custom windows (and swapped bounds)", () => {
    expect(clampDifficulty(5, 1, 3)).toBe(3);
    expect(clampDifficulty(0, 1, 3)).toBe(1);
    expect(clampDifficulty(Number.NaN, 1, 3)).toBe(1);
    expect(clampDifficulty(2, 3, 1)).toBe(2);
    expect(clampDifficulty(9, 3, 1)).toBe(3);
  });
});

describe("guest-kit createGuestRng", () => {
  it("int() returns uniform integers within [0, maxExclusive)", () => {
    // 6000 consecutive draws with bound 6: every residue wins exactly 1000×.
    const words = Array.from({ length: 6000 }, (_, i) => i);
    const rng = createGuestRng({ crypto: fakeCrypto(words) });
    const counts = new Array(6).fill(0) as number[];
    for (let i = 0; i < 6000; i += 1) {
      const value = rng.int(6);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
      expect(Number.isInteger(value)).toBe(true);
      counts[value] = (counts[value] ?? 0) + 1;
    }
    expect(counts).toEqual([1000, 1000, 1000, 1000, 1000, 1000]);
  });

  it("int() rejects draws at/above the debias ceiling (no modulo bias)", () => {
    // bound 3: ceiling = floor(2^32 / 3) * 3 = 4294967295, so 2^32-1 is rejected.
    const crypto = fakeCrypto([4294967295, 4294967295, 7]);
    const rng = createGuestRng({ crypto });
    expect(rng.int(3)).toBe(1); // 7 % 3
    expect(crypto.drawn).toEqual([4294967295, 4294967295, 7]);
  });

  it("int() returns 0 without drawing for bounds ≤ 1", () => {
    const crypto = fakeCrypto([123]);
    const rng = createGuestRng({ crypto });
    expect(rng.int(1)).toBe(0);
    expect(rng.int(0)).toBe(0);
    expect(rng.int(-5)).toBe(0);
    expect(crypto.drawn).toEqual([]);
  });

  it("int() floors non-integer bounds", () => {
    const rng = createGuestRng({ crypto: fakeCrypto([5]) });
    expect(rng.int(3.9)).toBe(2); // bound 3 → 5 % 3
  });

  it("random() returns a uniform float in [0, 1)", () => {
    const rng = createGuestRng({ crypto: fakeCrypto([0, 4294967295, 2147483648]) });
    expect(rng.random()).toBe(0);
    expect(rng.random()).toBeCloseTo(1 - 1 / 0x1_0000_0000, 12);
    const mid = rng.random();
    expect(mid).toBeGreaterThanOrEqual(0);
    expect(mid).toBeLessThan(1);
    expect(mid).toBeCloseTo(0.5, 6);
  });

  it("pick() chooses a uniform element", () => {
    const rng = createGuestRng({ crypto: fakeCrypto([0, 1, 2, 3]) });
    const items = ["a", "b", "c"] as const;
    expect(rng.pick(items)).toBe("a");
    expect(rng.pick(items)).toBe("b");
    expect(rng.pick(items)).toBe("c");
    expect(rng.pick(items)).toBe("a"); // 3 % 3
  });

  it("shuffle() is Fisher–Yates on a copy (input untouched, multiset kept)", () => {
    const rng = createGuestRng({ crypto: fakeCrypto([0]) });
    const input = [1, 2, 3, 4];
    const out = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4]); // not mutated
    // j=0 at every step: [1,2,3,4] →[4,2,3,1] →[3,2,4,1] →[2,3,4,1]
    expect(out).toEqual([2, 3, 4, 1]);
    expect([...out].sort()).toEqual([1, 2, 3, 4]);
  });

  it("fails closed with Error(secureRandomUnavailable) when no CSPRNG exists", () => {
    vi.stubGlobal("crypto", undefined);
    const rng = createGuestRng();
    expect(() => rng.int(4)).toThrowError("secureRandomUnavailable");
    expect(() => rng.random()).toThrowError("secureRandomUnavailable");
    expect(() => rng.shuffle([1, 2])).toThrowError("secureRandomUnavailable");
  });

  it("resolves globalThis.crypto per draw (late stubbing is honored)", () => {
    const rng = createGuestRng();
    vi.stubGlobal("crypto", fakeCrypto([2]));
    expect(rng.int(10)).toBe(2);
  });

  const hasRealCrypto =
    typeof globalThis.crypto?.getRandomValues === "function";
  it.runIf(hasRealCrypto)(
    "real Web Crypto stays in bounds with a sane spread (smoke)",
    () => {
      const rng = createGuestRng();
      const seen = new Set<number>();
      for (let i = 0; i < 3000; i += 1) {
        const value = rng.int(6);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(6);
        seen.add(value);
        const unit = rng.random();
        expect(unit).toBeGreaterThanOrEqual(0);
        expect(unit).toBeLessThan(1);
      }
      expect(seen.size).toBe(6); // every face shows up in 3000 draws
    },
  );
});

describe("guest-kit createGuestLeaderboardAdapter", () => {
  it("refresh() fetches the default window and ranks numerically desc", async () => {
    const { mode, get } = mockMode([
      { user: "alice", score: "9" },
      { user: "bob", score: "100" },
      { user: "carol", score: "abc" }, // non-numeric sinks last
    ]);
    const adapter = createGuestLeaderboardAdapter(mode);
    const entries = await adapter.refresh();
    expect(get).toHaveBeenCalledWith(DEFAULT_GUEST_BOARD_LIMIT);
    expect(entries).toEqual([
      { user: "bob", score: "100", rank: 1 },
      { user: "alice", score: "9", rank: 2 },
      { user: "carol", score: "abc", rank: 3 },
    ]);
  });

  it("refresh() honors a custom limit and trims overflow rows", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      user: `u${i}`,
      score: String(100 - i),
    }));
    const { mode, get } = mockMode(rows);
    const adapter = createGuestLeaderboardAdapter(mode, { limit: 3 });
    const entries = await adapter.refresh();
    expect(get).toHaveBeenCalledWith(3);
    expect(entries.map((entry) => entry.rank)).toEqual([1, 2, 3]);
    expect(entries.at(-1)?.user).toBe("u2");
  });

  it("refresh() resolves to [] when the board is unreachable", async () => {
    const { mode, get } = mockMode();
    get.mockRejectedValueOnce(new Error("offline"));
    const adapter = createGuestLeaderboardAdapter(mode);
    await expect(adapter.refresh()).resolves.toEqual([]);
  });

  it("refreshLeaderEntries() projects rows onto the session LeaderEntry shape", async () => {
    const { mode } = mockMode([
      { user: "alice", score: "3.5" },
      { user: "bob", score: "42" },
    ]);
    const adapter = createGuestLeaderboardAdapter(mode);
    expect(await adapter.refreshLeaderEntries()).toEqual([
      { rank: 1, address: "bob", totalWon: 42, solves: 1, isUser: false },
      { rank: 2, address: "alice", totalWon: 3.5, solves: 1, isUser: false },
    ]);
  });

  it("refreshLeaderEntries() resolves to [] when the board is unreachable", async () => {
    const { mode, get } = mockMode();
    get.mockRejectedValueOnce(new Error("offline"));
    const adapter = createGuestLeaderboardAdapter(mode);
    await expect(adapter.refreshLeaderEntries()).resolves.toEqual([]);
  });

  it("guestRowsToLeaderEntries() matches the fleet's hand-rolled mapping", () => {
    expect(
      guestRowsToLeaderEntries([
        { user: "a", score: "not-a-number" },
        { user: "b", score: "7" },
      ]),
    ).toEqual([
      { rank: 1, address: "b", totalWon: 7, solves: 1, isUser: false },
      { rank: 2, address: "a", totalWon: 0, solves: 1, isUser: false },
    ]);
  });

  it("submit() forwards positive scores verbatim (numbers and strings)", async () => {
    const { mode, submit } = mockMode();
    const adapter = createGuestLeaderboardAdapter(mode);
    await adapter.submit(42);
    await adapter.submit("7.5");
    expect(submit).toHaveBeenNthCalledWith(1, 42);
    expect(submit).toHaveBeenNthCalledWith(2, "7.5");
  });

  it("submit() skips non-positive / non-numeric scores", async () => {
    const { mode, submit } = mockMode();
    const adapter = createGuestLeaderboardAdapter(mode);
    await adapter.submit(0);
    await adapter.submit(-3);
    await adapter.submit("0");
    await adapter.submit("nope");
    expect(submit).not.toHaveBeenCalled();
  });

  it("submit() never throws — board failures are best-effort", async () => {
    const { mode, submit } = mockMode();
    submit.mockRejectedValueOnce(new Error("no wallet"));
    const adapter = createGuestLeaderboardAdapter(mode);
    await expect(adapter.submit(10)).resolves.toBeUndefined();
  });
});

describe("guest-kit createGuestPersistence", () => {
  interface Profile {
    bestScore: number;
    solves: number;
  }

  it("round-trips a plain record, stamping the configured version", () => {
    const storage = memoryStorage();
    const slot = createGuestPersistence<Profile>(storage, "guest:profile:v1", 1);
    slot.save({ bestScore: 7, solves: 2 });
    expect(slot.load()).toEqual({ bestScore: 7, solves: 2, version: 1 });
  });

  it("load() returns null when the key is absent", () => {
    const slot = createGuestPersistence<Profile>(memoryStorage(), "nope", 1);
    expect(slot.load()).toBeNull();
  });

  it("load() rejects records stamped with a different version", () => {
    const storage = memoryStorage();
    createGuestPersistence<Profile>(storage, "guest:profile:v1", 1).save({
      bestScore: 7,
      solves: 2,
    });
    const staleReader = createGuestPersistence<Profile>(storage, "guest:profile:v1", 2);
    expect(staleReader.load()).toBeNull();
    // The matching-version reader still sees the record.
    const matching = createGuestPersistence<Profile>(storage, "guest:profile:v1", 1);
    expect(matching.load()?.bestScore).toBe(7);
  });

  it("accepts pre-stamped records carrying the configured version (sudoku shape)", () => {
    const storage = memoryStorage();
    storage.set("guest-profile:v1", { version: 1, bestScore: 3, solves: 1 });
    const slot = createGuestPersistence<Profile>(storage, "guest-profile:v1", 1);
    expect(slot.load()).toEqual({ version: 1, bestScore: 3, solves: 1 });
  });

  it("round-trips primitive states without a version stamp", () => {
    const storage = memoryStorage();
    const slot = createGuestPersistence<number>(storage, "guest:counter", 1);
    slot.save(5);
    expect(slot.load()).toBe(5);
  });

  it("fails open: throwing storage never escapes load/save/clear", () => {
    const storage: GuestStorage = {
      get(): null {
        throw new Error("denied");
      },
      set(): void {
        throw new Error("quota");
      },
      delete(): void {
        throw new Error("denied");
      },
    };
    const slot = createGuestPersistence<Profile>(storage, "k", 1);
    expect(slot.load()).toBeNull();
    expect(() => slot.save({ bestScore: 1, solves: 1 })).not.toThrow();
    expect(() => slot.clear()).not.toThrow();
  });

  it("clear() prefers delete, falls back to remove, then to writing null", () => {
    const withDelete = memoryStorage();
    const deleteSpy = vi.spyOn(withDelete, "delete");
    createGuestPersistence<Profile>(withDelete, "k", 1).clear();
    expect(deleteSpy).toHaveBeenCalledWith("k");

    const removeSpy = vi.fn();
    const removeOnly: GuestStorage = {
      get: () => null,
      set: () => {},
      remove: removeSpy,
    };
    createGuestPersistence<Profile>(removeOnly, "k", 1).clear();
    expect(removeSpy).toHaveBeenCalledWith("k");

    const setSpy = vi.fn();
    const setOnly: GuestStorage = { get: () => null, set: setSpy };
    createGuestPersistence<Profile>(setOnly, "k", 1).clear();
    expect(setSpy).toHaveBeenCalledWith("k", null);
  });
});
