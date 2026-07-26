import { afterEach, describe, expect, it, vi } from "vitest";
import { createGuestEngine, isStoredRunState, type GuestEngineDeps, type PowerupCounts } from "./guest-engine";
import { EMPTY_EXTRACT_RECEIPT, type ItemInstance } from "./engine-zhuada";
import { EMPTY_PROGRESS, type GooseProgress } from "./progress";
import { EMPTY_DAILY, type DailyState } from "./daily-reward";
import { TOTAL_LEVELS, specOf } from "./game-rules";
import {
  STREAM_INITIAL_VISIBLE,
  STREAM_REFILL_BATCH,
  STREAM_REFILL_TRIGGER,
} from "./item-stream";

class TestObservable<T> {
  constructor(private value: T) {}
  get(): T { return this.value; }
  set(value: T): void { this.value = value; }
  subscribe(): () => void { return () => {}; }
}

const observable = <T>(value: T) => new TestObservable(value);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function createHarness(factory: typeof createGuestEngine = createGuestEngine) {
  const gameStatus = observable("idle");
  const lastStatus = observable("");
  const leaderboard = observable<unknown[]>([]);
  const items = observable<ItemInstance[]>([]);
  const reserveCount = observable(0);
  const tray = observable<(number | null)[]>(Array(7).fill(null));
  const shelf = observable<(number | null)[]>(Array(3).fill(null));
  const dealNonce = observable(0);
  const shuffleNonce = observable(0);
  const hintNonce = observable(0);
  const resumeAvailable = observable(false);
  const resumeLevel = observable(0);
  const continueAvailable = observable(false);
  const undoable = observable(false);
  const progress = observable<GooseProgress>({
    ...EMPTY_PROGRESS,
    highestUnlockedLevel: TOTAL_LEVELS,
    lastPlayedLevel: TOTAL_LEVELS,
    level: TOTAL_LEVELS,
    levels: {},
    best: {},
    geese: [],
  });
  const deps = {
    obs: { gameStatus, lastStatus, leaderboard },
    items,
    reserveCount,
    tray,
    shelf,
    score: observable(0),
    comboCount: observable(0),
    frenzyCharges: observable(0),
    frenzyFx: observable(0),
    timeLeftMs: observable(0),
    level: observable(1),
    isPlaying: observable(false),
    clearedFx: observable<number[]>([]),
    shelfClearedFx: observable<number[]>([]),
    failReason: observable<"" | "timeout" | "trayFull">(""),
    powerups: observable<PowerupCounts>({ shuffle: 0, hint: 0, remove: 0, undo: 0, addTime: 0 }),
    undoable,
    timedMode: observable(false),
    shakeReadyAt: observable(0),
    dealNonce,
    shakeNonce: observable(0),
    shuffleNonce,
    hintNonce,
    extractReceipt: observable({ ...EMPTY_EXTRACT_RECEIPT }),
    shakeStrength: observable(1),
    themeId: observable<"fresh-market" | "farm-kitchen" | "night-market">("fresh-market"),
    resumeAvailable,
    resumeLevel,
    continueAvailable,
    dailyState: observable<DailyState>({ ...EMPTY_DAILY }),
    dailyClaimable: observable(false),
    dailyGrants: observable<PowerupCounts>({ shuffle: 0, hint: 0, remove: 0, undo: 0, addTime: 0 }),
    dailyMilestoneFx: observable(0),
    progress,
    unlockNotice: observable(-1),
    t: (key: string) => key,
    setStatus: () => {},
  } as unknown as GuestEngineDeps;
  return {
    engine: factory(deps), items, reserveCount, tray, shelf,
    gameStatus, dealNonce, resumeAvailable, resumeLevel, continueAvailable,
    timeLeftMs: deps.timeLeftMs,
    score: deps.score,
    comboCount: deps.comboCount,
    frenzyCharges: deps.frenzyCharges,
    frenzyFx: deps.frenzyFx,
    failReason: deps.failReason,
    powerups: deps.powerups,
    undoable,
    shuffleNonce,
    shakeReadyAt: deps.shakeReadyAt,
    hintNonce,
    progress,
    unlockNotice: deps.unlockNotice,
    dailyState: deps.dailyState,
    dailyClaimable: deps.dailyClaimable,
    dailyGrants: deps.dailyGrants,
    dailyMilestoneFx: deps.dailyMilestoneFx,
  };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    values,
  };
}

function visibilityHarness(initialHidden = false) {
  const listeners = new Map<string, Set<() => void>>();
  const documentStub = {
    hidden: initialHidden,
    addEventListener: (event: string, listener: () => void) => {
      const list = listeners.get(event) ?? new Set<() => void>();
      list.add(listener);
      listeners.set(event, list);
    },
    removeEventListener: (event: string, listener: () => void) => {
      listeners.get(event)?.delete(listener);
    },
    dispatch: (event: string) => {
      for (const listener of listeners.get(event) ?? []) listener();
    },
  };
  vi.stubGlobal("document", documentStub);
  return documentStub;
}

describe("fresh deal boundary", () => {
  it("increments for every start/retry and publishes a different layout", () => {
    const { engine, items, dealNonce } = createHarness();
    engine.startLevel(5);
    const first = items.get().map((item) => `${item.kind}:${item.px.toFixed(4)}:${item.pz.toFixed(4)}`);
    expect(dealNonce.get()).toBe(1);

    engine.startLevel(5);
    const second = items.get().map((item) => `${item.kind}:${item.px.toFixed(4)}:${item.pz.toFixed(4)}`);
    expect(dealNonce.get()).toBe(2);
    expect(second).not.toEqual(first);
  });

  it("keeps a 1,008-item level behind a dense 54-body window and refills from below", () => {
    vi.stubGlobal("window", {});
    const { engine, items } = createHarness();
    engine.startLevel(3);
    const initial = items.get();
    expect(initial).toHaveLength(STREAM_INITIAL_VISIBLE);

    // Thirty-six accepted picks expose the floor, then one complete
    // twenty-seven-item bottom-up layer restores a substantial heap.
    const excavation = STREAM_INITIAL_VISIBLE - STREAM_REFILL_TRIGGER;
    const byKind = new Map<number, ItemInstance[]>();
    for (const item of initial) {
      const group = byKind.get(item.kind) ?? [];
      group.push(item);
      byKind.set(item.kind, group);
    }
    const safeExcavation = [...byKind.values()]
      .filter((group) => group.length >= 3)
      .slice(0, excavation / 3)
      .flatMap((group) => group.slice(0, 3));
    for (const item of safeExcavation) engine.extract(item.id);
    // Matching and Frenzy can consume additional live pieces during the same
    // sequence, but the wave must restore the heap well above its refill floor.
    expect(items.get().length).toBeGreaterThanOrEqual(STREAM_REFILL_TRIGGER);
    expect(items.get().length).toBeLessThanOrEqual(STREAM_INITIAL_VISIBLE);
    const liveReservoirItems = items.get().filter((item) => item.spawnMode === "reservoir");
    // item-stream.test.ts owns the exact +27 activation contract. At engine
    // level the match that crosses the trigger may also start Frenzy, which is
    // allowed to consume up to three freshly activated items immediately.
    expect(liveReservoirItems.length).toBeGreaterThanOrEqual(STREAM_REFILL_BATCH - 3);
    expect(liveReservoirItems.length).toBeLessThanOrEqual(STREAM_REFILL_BATCH);
  });

  it.each(Array.from({ length: TOTAL_LEVELS }, (_, index) => index + 1))(
    "drains every L%s reserve wave and wins only with box, reserve, tray and shelf empty",
    (level) => {
    vi.stubGlobal("window", {});
    const { engine, items, reserveCount, tray, shelf, gameStatus } = createHarness();
    engine.startLevel(level);
    const expectedTotal = specOf(level).kinds * specOf(level).perKind * 3;
    expect(items.get().length + reserveCount.get()).toBe(expectedTotal);

    let extracted = 0;
    let guard = Math.ceil(expectedTotal / 3) + 8;
    while (gameStatus.get() === "dealt" && guard-- > 0) {
      const live = items.get();
      // A Frenzy pull (R6) can leave a partial group sitting in the tray / side
      // shelf, so a competent player — and this solver — finishes those first
      // instead of only scanning the box. The multiple-of-3 invariant guarantees
      // any partial group can always be completed from the box.
      const pending = new Map<number, number>();
      for (const k of tray.get()) if (k !== null) pending.set(k, (pending.get(k) ?? 0) + 1);
      for (const k of shelf.get()) if (k !== null) pending.set(k, (pending.get(k) ?? 0) + 1);
      const inBox = new Map<number, ItemInstance[]>();
      for (const item of live) {
        const group = inBox.get(item.kind) ?? [];
        group.push(item);
        inBox.set(item.kind, group);
      }
      let pick: ItemInstance[] | undefined;
      // 1) Finish a tray/shelf group that still needs copies (deficit ≤ 2).
      for (const [kind, have] of pending) {
        const deficit = 3 - have;
        const avail = inBox.get(kind) ?? [];
        if (deficit > 0 && avail.length >= deficit) { pick = avail.slice(0, deficit); break; }
      }
      // 2) Otherwise grab a clean triple straight from the box.
      if (!pick) {
        const triple = [...inBox.values()].find((group) => group.length >= 3);
        expect(triple).toBeDefined();
        pick = triple!.slice(0, 3);
      }
      for (const item of pick) {
        engine.extract(item.id);
        extracted += 1;
      }
    }

    expect(guard).toBeGreaterThan(0);
    // Frenzy auto-pulls remove items from the box without a player extract, so
    // the player's own extract count is ≤ the level total (it never exceeds it).
    expect(extracted).toBeGreaterThan(0);
    expect(extracted).toBeLessThanOrEqual(expectedTotal);
    expect(gameStatus.get()).toBe("solved");
    expect(items.get()).toHaveLength(0);
    expect(reserveCount.get()).toBe(0);
    expect(tray.get().every((slot) => slot === null)).toBe(true);
    expect(shelf.get().every((slot) => slot === null)).toBe(true);
    },
  );

  it("survives twenty consecutive late-level redeals without exceeding the live-body ceiling", () => {
    vi.stubGlobal("window", {});
    const { engine, items, reserveCount, dealNonce } = createHarness();
    let previousLayout = "";

    for (let run = 1; run <= 20; run += 1) {
      engine.startLevel(15);
      const active = items.get();
      const layout = active.map((item) => `${item.kind}:${item.px.toFixed(4)}:${item.pz.toFixed(4)}`).join("|");
      expect(dealNonce.get()).toBe(run);
      expect(active.length).toBeLessThanOrEqual(54);
      expect(active.length + reserveCount.get()).toBe(1440);
      expect(new Set(active.map((item) => item.id)).size).toBe(active.length);
      expect(layout).not.toBe(previousLayout);
      previousLayout = layout;
    }
  });

  it("keeps reserve packets private across shuffle and consumes bottom spawn commands once", () => {
    vi.stubGlobal("window", {});
    const { engine, items, reserveCount } = createHarness();
    engine.startLevel(3);
    const hiddenBefore = reserveCount.get();
    engine.shuffle();
    expect(reserveCount.get()).toBe(hiddenBefore);
    expect(items.get().every((item) => item.spawnMode === "drop")).toBe(true);
  });

  it("undo restores the same active id once without pulling from the reserve", () => {
    vi.stubGlobal("window", {});
    const { engine, items, reserveCount } = createHarness();
    engine.startLevel(3);
    const picked = items.get()[0]!;
    const hiddenBefore = reserveCount.get();
    engine.extract(picked.id);
    engine.undo();
    expect(items.get().filter((item) => item.id === picked.id)).toHaveLength(1);
    expect(items.get().find((item) => item.id === picked.id)?.kind).toBe(picked.kind);
    expect(reserveCount.get()).toBe(hiddenBefore);
  });

  it("restores an interrupted streamed run with tray, tools and reserve intact", () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", {});
    const first = createHarness();
    first.engine.startLevel(3);
    for (const item of first.items.get().slice(0, 6)) first.engine.extract(item.id);
    vi.advanceTimersByTime(200);

    expect(storage.values.has("zhuada-e:run:v1")).toBe(true);
    const activeBefore = first.items.get().map((item) => item.id);
    const reserveBefore = first.reserveCount.get();
    const trayBefore = first.tray.get();

    const restored = createHarness();
    restored.engine.enter();
    expect(restored.resumeAvailable.get()).toBe(true);
    expect(restored.resumeLevel.get()).toBe(3);
    restored.engine.resumeRun();

    expect(restored.gameStatus.get()).toBe("dealt");
    expect(restored.items.get().map((item) => item.id)).toEqual(activeBefore);
    expect(restored.items.get().every((item) => item.spawnMode === "drop")).toBe(true);
    expect(restored.reserveCount.get()).toBe(reserveBefore);
    expect(restored.tray.get()).toEqual(trayBefore);
    expect(restored.resumeAvailable.get()).toBe(false);
  });

  it("accepts the expanded kind catalog in resumable run snapshots", () => {
    const base = {
      level: 2,
      themeId: "fresh-market" as const,
      timedMode: false,
      active: [{ id: 1, kind: 53, px: 0, py: 1, pz: 0 }],
      reserve: [],
      tray: [53, null, null, null, null, null, null],
      shelf: [null, null, null],
      score: 0,
      powerups: { shuffle: 1, hint: 3, remove: 1, undo: 1, addTime: 0 },
      lastGrab: { itemId: 1, kind: 53, slot: 0 },
      timeLeftMs: 0,
      elapsedMs: 100,
      shakeCooldownMs: 0,
      continueUsed: false,
    };
    expect(isStoredRunState(base)).toBe(true);
    expect(isStoredRunState({ ...base, active: [{ ...base.active[0], kind: 54 }] })).toBe(false);
  });

  it("accepts the 1,584-item late-game reservoir but rejects oversized snapshots", () => {
    const item = (id: number) => ({ id, kind: id % 54, px: 0, py: 1, pz: 0 });
    const base = {
      level: 24,
      themeId: "night-market" as const,
      timedMode: false,
      active: Array.from({ length: 54 }, (_, id) => item(id)),
      reserve: Array.from({ length: 1530 }, (_, index) => item(index + 54)),
      tray: [null, null, null, null, null, null, null],
      shelf: [null, null, null],
      score: 0,
      powerups: { shuffle: 1, hint: 3, remove: 1, undo: 1, addTime: 0 },
      lastGrab: null,
      timeLeftMs: 0,
      elapsedMs: 100,
      shakeCooldownMs: 0,
      continueUsed: false,
    };
    expect(isStoredRunState(base)).toBe(true);
    expect(isStoredRunState({ ...base, reserve: [...base.reserve, item(1584)] })).toBe(false);
  });

  it("lets the lobby discard a resumable run", () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", {});
    const first = createHarness();
    first.engine.startLevel(3);
    vi.advanceTimersByTime(200);

    const lobby = createHarness();
    lobby.engine.enter();
    expect(lobby.resumeAvailable.get()).toBe(true);
    lobby.engine.discardRun();
    expect(lobby.resumeAvailable.get()).toBe(false);
    expect(storage.values.has("zhuada-e:run:v1")).toBe(false);
  });

  it("allows exactly one recovery feather for a failed run", () => {
    vi.stubGlobal("window", {});
    const { engine, gameStatus, continueAvailable } = createHarness();
    engine.startLevel(3);
    engine.debugLose!("timeout");
    expect(gameStatus.get()).toBe("expired");
    expect(continueAvailable.get()).toBe(true);

    engine.continueAfterFailure();
    expect(gameStatus.get()).toBe("dealt");
    expect(continueAvailable.get()).toBe(false);

    engine.debugLose!("timeout");
    expect(gameStatus.get()).toBe("expired");
    expect(continueAvailable.get()).toBe(false);
    engine.continueAfterFailure();
    expect(gameStatus.get()).toBe("expired");
  });

  it("returns three jammed tray items to the logical stream when recovering", () => {
    vi.stubGlobal("window", {});
    const { engine, tray, gameStatus, continueAvailable, items, reserveCount } = createHarness();
    engine.startLevel(3);
    tray.set([0, 1, 2, 3, 4, 5, 6]);
    const before = items.get().length + reserveCount.get();
    engine.debugLose!("trayFull");
    expect(continueAvailable.get()).toBe(true);
    engine.continueAfterFailure();

    expect(gameStatus.get()).toBe("dealt");
    expect(tray.get().filter((slot) => slot === null)).toHaveLength(3);
    expect(items.get().length + reserveCount.get()).toBe(before + 3);
    expect(items.get().length).toBeLessThanOrEqual(54);
  });
});

describe("power-up guardrails", () => {
  it("grants original-trio tools plus hint, and keeps add-time timed-only", () => {
    vi.stubGlobal("window", {});
    const relaxed = createHarness();
    relaxed.engine.startLevel(3);
    expect(relaxed.powerups.get()).toEqual({
      remove: 1,
      undo: 1,
      shuffle: 1,
      hint: 3,
      addTime: 0,
    });

    const timed = createHarness();
    timed.engine.setTimedMode(true);
    timed.engine.startLevel(3);
    expect(timed.powerups.get()).toEqual({
      remove: 1,
      undo: 1,
      shuffle: 1,
      hint: 3,
      addTime: 1,
    });
    timed.engine.setTimedMode(false);
  });

  it("keeps hint unavailable states free and increments the hint pulse only when spent", () => {
    vi.stubGlobal("window", {});
    const { engine, powerups, hintNonce } = createHarness();

    engine.hint();
    expect(powerups.get().hint).toBe(0);
    expect(hintNonce.get()).toBe(0);

    engine.startLevel(3);
    const granted = powerups.get().hint;
    engine.hint();
    expect(powerups.get().hint).toBe(granted - 1);
    expect(hintNonce.get()).toBe(1);

    powerups.set({ ...powerups.get(), hint: 0 });
    engine.hint();
    expect(powerups.get().hint).toBe(0);
    expect(hintNonce.get()).toBe(1);
  });

  it("charges shuffle only when a live pile exists and invalidates undo targeting", () => {
    vi.stubGlobal("window", {});
    const { engine, items, powerups, shuffleNonce, undoable } = createHarness();

    engine.shuffle();
    expect(powerups.get().shuffle).toBe(0);
    expect(shuffleNonce.get()).toBe(0);

    engine.startLevel(3);
    const picked = items.get()[0]!;
    engine.extract(picked.id);
    expect(undoable.get()).toBe(true);
    const before = powerups.get().shuffle;

    engine.shuffle();
    expect(powerups.get().shuffle).toBe(before - 1);
    expect(shuffleNonce.get()).toBe(1);
    expect(undoable.get()).toBe(false);

    items.set([]);
    engine.shuffle();
    expect(powerups.get().shuffle).toBe(before - 1);
    expect(shuffleNonce.get()).toBe(1);
  });

  it("charges remove only for a free shelf and at least three occupied tray slots", () => {
    vi.stubGlobal("window", {});
    const { engine, tray, shelf, powerups, undoable } = createHarness();
    engine.startLevel(3);

    engine.removeToShelf();
    expect(powerups.get().remove).toBe(1);
    expect(shelf.get()).toEqual([null, null, null]);

    tray.set([0, null, 1, null, 2, 3, null]);
    undoable.set(true);
    engine.removeToShelf();
    expect(powerups.get().remove).toBe(0);
    expect(tray.get()).toEqual([3, null, null, null, null, null, null]);
    expect(shelf.get()).toEqual([0, 1, 2]);
    expect(undoable.get()).toBe(false);

    powerups.set({ ...powerups.get(), remove: 1 });
    engine.removeToShelf();
    expect(powerups.get().remove).toBe(1);
    expect(shelf.get()).toEqual([0, 1, 2]);
  });

  it("charges undo only for the last unmatched grab and returns the same item id once", () => {
    vi.stubGlobal("window", {});
    const { engine, items, tray, powerups, undoable } = createHarness();

    engine.startLevel(3);
    engine.undo();
    expect(powerups.get().undo).toBe(1);
    expect(undoable.get()).toBe(false);

    const picked = items.get()[0]!;
    engine.extract(picked.id);
    expect(undoable.get()).toBe(true);
    expect(tray.get().some((slot) => slot === picked.kind)).toBe(true);
    const activeAfterPick = items.get().length;

    engine.undo();
    expect(powerups.get().undo).toBe(0);
    expect(undoable.get()).toBe(false);
    expect(items.get()).toHaveLength(activeAfterPick + 1);
    expect(items.get().filter((item) => item.id === picked.id && item.kind === picked.kind)).toHaveLength(1);

    engine.undo();
    expect(powerups.get().undo).toBe(0);
    expect(items.get().filter((item) => item.id === picked.id)).toHaveLength(1);
  });

  it("keeps add-time inert in relaxed mode and bounded to positive timed uses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00.000Z"));
    vi.stubGlobal("window", {});

    const relaxed = createHarness();
    relaxed.engine.startLevel(3);
    relaxed.engine.addTime(15_000);
    expect(relaxed.timeLeftMs.get()).toBe(0);
    expect(relaxed.powerups.get().addTime).toBe(0);

    const timed = createHarness();
    timed.engine.setTimedMode(true);
    timed.engine.startLevel(3);
    const duration = timed.timeLeftMs.get();
    timed.engine.addTime(0);
    expect(timed.timeLeftMs.get()).toBe(duration);
    expect(timed.powerups.get().addTime).toBe(1);

    timed.engine.addTime(15_000);
    expect(timed.timeLeftMs.get()).toBe(duration + 15_000);
    expect(timed.powerups.get().addTime).toBe(0);

    timed.engine.addTime(15_000);
    expect(timed.timeLeftMs.get()).toBe(duration + 15_000);
    timed.engine.setTimedMode(false);
  });
});

describe("terminal state machine", () => {
  it("keeps timed foreground countdown drift under 250ms across a 60s run", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00.000Z"));
    vi.stubGlobal("window", {});
    const { engine, timeLeftMs, gameStatus } = createHarness();
    engine.setTimedMode(true);
    engine.startLevel(3);

    const duration = timeLeftMs.get();
    vi.advanceTimersByTime(60_000);

    const expected = duration - 60_000;
    expect(gameStatus.get()).toBe("dealt");
    expect(Math.abs(timeLeftMs.get() - expected)).toBeLessThanOrEqual(250);
    engine.setTimedMode(false);
  });

  it("pauses timed countdown while hidden and resumes without charging background time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00.000Z"));
    const documentStub = visibilityHarness();
    vi.stubGlobal("window", {});
    const { engine, timeLeftMs, gameStatus } = createHarness();
    engine.setTimedMode(true);
    engine.startLevel(3);
    const duration = timeLeftMs.get();

    vi.advanceTimersByTime(5_000);
    const beforeHidden = timeLeftMs.get();
    documentStub.hidden = true;
    documentStub.dispatch("visibilitychange");
    vi.advanceTimersByTime(30_000);
    expect(timeLeftMs.get()).toBe(beforeHidden);

    documentStub.hidden = false;
    documentStub.dispatch("visibilitychange");
    vi.advanceTimersByTime(100);

    expect(gameStatus.get()).toBe("dealt");
    expect(Math.abs(timeLeftMs.get() - (duration - 5_100))).toBeLessThanOrEqual(150);
    engine.setTimedMode(false);
  });

  it("expires a timed run with the timeout reason when its clock reaches zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00.000Z"));
    vi.stubGlobal("window", {});
    const { engine, gameStatus, timeLeftMs, failReason } = createHarness();
    engine.setTimedMode(true);
    engine.startLevel(1);

    const duration = timeLeftMs.get();
    expect(duration).toBeGreaterThan(0);
    vi.setSystemTime(Date.now() + duration);
    vi.advanceTimersByTime(100);

    expect(gameStatus.get()).toBe("expired");
    expect(timeLeftMs.get()).toBe(0);
    expect(failReason.get()).toBe("timeout");
    engine.setTimedMode(false);
  });

  it("expires a jammed run when the tray fills after remove and undo are exhausted", () => {
    vi.stubGlobal("window", {});
    const { engine, items, tray, powerups, gameStatus, failReason } = createHarness();
    engine.startLevel(3);
    tray.set([0, 1, 2, 3, 4, 5, null]);
    powerups.set({ ...powerups.get(), remove: 0, undo: 0 });
    items.set([{ id: 999_999, kind: 6, px: 0, py: 1, pz: 0 }]);

    engine.extract(999_999);

    expect(tray.get()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(gameStatus.get()).toBe("expired");
    expect(failReason.get()).toBe("trayFull");
  });

  it("does not apply win or failure progression twice after reaching a terminal state", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {});
    const won = createHarness();
    won.progress.set({
      ...EMPTY_PROGRESS,
      highestUnlockedLevel: 2,
      lastPlayedLevel: 2,
      level: 2,
      levels: {},
      best: {},
      geese: [],
    });
    won.engine.startLevel(2);
    won.engine.debugWin!();
    const progressAfterWin = won.progress.get();

    expect(progressAfterWin.wins).toBe(1);
    expect(progressAfterWin.levels[2]?.clears).toBe(1);
    expect(progressAfterWin.highestUnlockedLevel).toBe(3);
    expect(progressAfterWin.geese).toEqual([0]);
    expect(won.unlockNotice.get()).toBe(0);
    won.engine.debugWin!();
    expect(won.progress.get()).toEqual(progressAfterWin);
    expect(won.unlockNotice.get()).toBe(0);

    const failed = createHarness();
    failed.engine.startLevel(1);
    failed.engine.debugLose!("timeout");
    const progressAfterLoss = failed.progress.get();
    expect(progressAfterLoss.levels[1]?.failures).toBe(1);
    failed.engine.debugLose!("trayFull");
    expect(failed.progress.get()).toEqual(progressAfterLoss);
    expect(failed.failReason.get()).toBe("timeout");
  });

  it("deletes the active-run snapshot as soon as a run fails", async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", {});
    vi.resetModules();
    const { createGuestEngine: freshFactory } = await import("./guest-engine");
    const { engine, resumeAvailable } = createHarness(freshFactory);
    engine.startLevel(3);
    vi.advanceTimersByTime(200);
    expect(storage.values.has("zhuada-e:run:v1")).toBe(true);
    expect(resumeAvailable.get()).toBe(true);

    engine.debugLose!("timeout");

    expect(storage.values.has("zhuada-e:run:v1")).toBe(false);
    expect(resumeAvailable.get()).toBe(false);
  });

  describe("R6 Frenzy (combo climax)", () => {
    function groupByKind(list: ItemInstance[]): Map<number, ItemInstance[]> {
      const m = new Map<number, ItemInstance[]>();
      for (const it of list) {
        const g = m.get(it.kind) ?? [];
        g.push(it);
        m.set(it.kind, g);
      }
      return m;
    }
    function firstKindWith(map: Map<number, ItemInstance[]>, min: number): number {
      const found = [...map.entries()].find(([, g]) => g.length >= min);
      if (!found) throw new Error("no kind with enough copies in the active box");
      return found[0];
    }
    /** A kind with ≥4 in the box — after a 3-clear it still has a copy for the
     *  Frenzy pull to grab, so the pull is guaranteed to land (no refund). */
    function kindWithSpare(items: ReturnType<typeof createHarness>["items"]): number {
      const map = groupByKind(items.get());
      const ready = [...map.entries()].find(([, group]) => group.length >= 4);
      if (ready) return ready[0];
      // The 48-kind opening intentionally shows one triple per visible
      // identity. Add a controlled fourth active copy so this unit test proves
      // charge consumption instead of depending on which kind a random refill
      // happened to surface.
      const kind = firstKindWith(map, 3);
      const source = map.get(kind)![0]!;
      const nextId = 1_000_000 + items.get().length;
      items.set([...items.get(), { ...source, id: nextId }]);
      return kind;
    }
    /** Clear one triple of `kind` (three grabs of the same kind). */
    function clearTriple(engine: ReturnType<typeof createHarness>["engine"], items: ReturnType<typeof createHarness>["items"], kind: number): void {
      for (const it of groupByKind(items.get()).get(kind)!.slice(0, 3)) engine.extract(it.id);
    }

    it("arms two free-pull charges at the combo trigger and flashes a burst", () => {
      vi.stubGlobal("window", {});
      const { engine, items, tray, frenzyCharges, frenzyFx } = createHarness();
      engine.startLevel(15);
      // Synchronous grabs stay inside the combo window, so 5 clears build a
      // real 5-combo; the 5th clear is the climax that arms Frenzy.
      for (let m = 0; m < 5; m += 1) {
        clearTriple(engine, items, firstKindWith(groupByKind(items.get()), 3));
      }
      expect(frenzyCharges.get()).toBe(2); // FRENZY_CHARGES
      expect(frenzyFx.get()).toBeGreaterThan(0); // at least the arm burst
      // The 5th clear itself did NOT auto-pull (no charges were armed yet).
      expect(tray.get().every((slot) => slot === null)).toBe(true);
    });

    it("an armed match auto-pulls the cleared kind and spends one charge", () => {
      vi.stubGlobal("window", {});
      const { engine, items, frenzyCharges, frenzyFx } = createHarness();
      engine.startLevel(15);
      for (let m = 0; m < 5; m += 1) {
        clearTriple(engine, items, firstKindWith(groupByKind(items.get()), 3));
      }
      expect(frenzyCharges.get()).toBe(2); // armed

      // 6th clear is armed → it pulls the cleared kind and spends one charge.
      // Use a kind with a spare copy so the pull is guaranteed to land.
      const pullKind = kindWithSpare(items);
      const fxBefore = frenzyFx.get();
      clearTriple(engine, items, pullKind);
      expect(frenzyCharges.get()).toBe(1); // one charge spent
      // frenzyFx only bumps when a pull actually lands a copy (a refund does
      // not bump it), so this proves the auto-pull succeeded, not just queued.
      expect(frenzyFx.get()).toBe(fxBefore + 1);
    });

    it("re-arms on the next climax after both charges are spent", () => {
      vi.stubGlobal("window", {});
      const { engine, items, frenzyCharges } = createHarness();
      engine.startLevel(15);
      for (let m = 0; m < 5; m += 1) {
        clearTriple(engine, items, firstKindWith(groupByKind(items.get()), 3));
      }
      expect(frenzyCharges.get()).toBe(2); // armed on the 5th clear

      // Spend both charges. Prefer kinds with a spare copy so each pull lands
      // and actually decrements the charge; loop until fully depleted.
      let guard = 24;
      while (frenzyCharges.get() > 0 && guard-- > 0) {
        clearTriple(engine, items, kindWithSpare(items));
      }
      expect(frenzyCharges.get()).toBe(0); // both charges spent

      // The next climax (combo still high, charges back to 0) re-arms a fresh pair.
      clearTriple(engine, items, firstKindWith(groupByKind(items.get()), 3));
      expect(frenzyCharges.get()).toBe(2);
    });
  });

  describe("R4 daily sign-in / streak", () => {
    function stubStorage() {
      const values = new Map<string, string>();
      const storage = {
        getItem: (k: string) => values.get(k) ?? null,
        setItem: (k: string, v: string) => { values.set(k, v); },
        removeItem: (k: string) => { values.delete(k); },
        values,
      };
      vi.stubGlobal("localStorage", storage);
      return storage;
    }

    it("loads a claimable view on enter() when nothing was claimed today", () => {
      stubStorage();
      const h = createHarness();
      h.dailyState.set({ ...EMPTY_DAILY });
      h.engine.enter();
      expect(h.dailyClaimable.get()).toBe(true);
    });

    it("claimDaily grants powerups, flips claimable, and persists", () => {
      stubStorage();
      const h = createHarness();
      h.dailyState.set({ ...EMPTY_DAILY });
      h.dailyClaimable.set(true);
      h.engine.enter();
      const before = h.powerups.get().hint;
      h.engine.claimDaily();
      expect(h.dailyClaimable.get()).toBe(false);
      // Day-1 base grants +1 hint (and the others) on top of the per-run grant.
      expect(h.powerups.get().hint).toBe(before + 1);
      expect(h.dailyState.get().streak).toBe(1);
      expect(h.dailyState.get().lastClaimDate).not.toBe("");
    });

    it("folds the daily bonus into the per-run powerup grant", () => {
      stubStorage();
      const h = createHarness();
      // Simulate an already-claimed day with a known bonus.
      h.dailyState.set({
        ...EMPTY_DAILY,
        streak: 3,
        lastClaimDate: "2000-01-01",
        dailyBonus: { shuffle: 0, hint: 2, remove: 0, undo: 0, addTime: 0 },
      });
      h.engine.startLevel(1);
      // Base GRANT_HINT (3) + daily bonus (2) = 5.
      expect(h.powerups.get().hint).toBe(5);
    });

    it("startDailyChallenge seeds a deterministic, playable run", () => {
      stubStorage();
      const h2 = createHarness();
      h2.engine.startDailyChallenge();
      const dailyLayout = h2.items.get().map((it) => it.kind).join(",");
      expect(dailyLayout.length).toBeGreaterThan(0);
      // The date seed is deterministic: re-running reproduces the SAME layout.
      h2.engine.startDailyChallenge();
      expect(h2.items.get().map((it) => it.kind).join(",")).toBe(dailyLayout);
    });
  });

  describe("R3 goose passive bonuses", () => {
    function findTripleOf(list: ItemInstance[]): number[] {
      const groups = new Map<number, number[]>();
      for (const it of list) {
        const g = groups.get(it.kind) ?? [];
        g.push(it.id);
        groups.set(it.kind, g);
      }
      for (const ids of groups.values()) if (ids.length >= 3) return ids.slice(0, 3);
      return [];
    }

    it("folds collected-geese power-ups into the per-run grant", () => {
      vi.stubGlobal("window", {});
      const base = createHarness();
      base.engine.startLevel(1);
      const baseHint = base.powerups.get().hint;
      const baseRemove = base.powerups.get().remove;
      const baseUndo = base.powerups.get().undo;
      const baseShuffle = base.powerups.get().shuffle;

      const { engine, powerups, progress } = createHarness();
      progress.set({ ...progress.get(), geese: [0, 1, 4] }); // +hint, +remove, +undo
      engine.startLevel(1);

      expect(powerups.get().hint).toBe(baseHint + 1);
      expect(powerups.get().remove).toBe(baseRemove + 1);
      expect(powerups.get().undo).toBe(baseUndo + 1);
      // Untouched levers stay at the base grant.
      expect(powerups.get().shuffle).toBe(baseShuffle);
      expect(powerups.get().addTime).toBe(0); // untimed default → no add-time base
    });

    it("shortens the shake cooldown with the pond goose", () => {
      vi.useFakeTimers();
      vi.stubGlobal("window", {});
      vi.setSystemTime(new Date(2_000_000));
      const base = createHarness();
      base.engine.startLevel(1);
      base.engine.shake();
      const cdBase = base.shakeReadyAt.get() - 2_000_000; // SHAKE_CD_MS = 5000

      const { engine, shakeReadyAt, progress } = createHarness();
      progress.set({ ...progress.get(), geese: [2] }); // −1s cooldown
      engine.startLevel(1);
      engine.shake();
      const cdPond = shakeReadyAt.get() - 2_000_000; // 4000

      expect(cdBase).toBe(5000);
      expect(cdPond).toBe(4000);
    });

    it("breaks the combo chain across a 2300ms gap without the farm goose", () => {
      vi.useFakeTimers();
      vi.stubGlobal("window", {});
      vi.setSystemTime(new Date(1_000_000));
      const { engine, items, comboCount, progress } = createHarness();
      progress.set({ ...progress.get(), geese: [] });
      engine.startLevel(1);
      // Three triples, each 2300ms apart. The base window is 2200ms, so each
      // triple's match lands AFTER the window → the chain resets every time.
      for (let n = 0; n < 3; n += 1) {
        for (const id of findTripleOf(items.get())) engine.extract(id);
        expect(comboCount.get()).toBe(1); // one isolated match = combo 1
        if (n < 2) vi.setSystemTime(new Date(1_000_000 + (n + 1) * 2300));
      }
      // Every gap exceeded the base window → never chained.
      expect(comboCount.get()).toBe(1);
    });

    it("keeps the chain alive across 2300ms gaps with the farm goose (+200ms window)", () => {
      vi.useFakeTimers();
      vi.stubGlobal("window", {});
      vi.setSystemTime(new Date(1_000_000));
      const { engine, items, comboCount, progress } = createHarness();
      progress.set({ ...progress.get(), geese: [3] }); // +200ms → 2400ms window
      engine.startLevel(1);
      // Same 2300ms gaps, but the extended window keeps each match inside the
      // chain window → the combo climbs 1, 2, 3.
      for (let n = 0; n < 3; n += 1) {
        for (const id of findTripleOf(items.get())) engine.extract(id);
        if (n < 2) vi.setSystemTime(new Date(1_000_000 + (n + 1) * 2300));
      }
      expect(comboCount.get()).toBe(3);
    });
  });

  describe("R7 goose passive bonuses (content expansion)", () => {
    function findTripleOf(list: ItemInstance[]): number[] {
      const groups = new Map<number, number[]>();
      for (const it of list) {
        const g = groups.get(it.kind) ?? [];
        g.push(it.id);
        groups.set(it.kind, g);
      }
      for (const ids of groups.values()) if (ids.length >= 3) return ids.slice(0, 3);
      return [];
    }

    it("folds the volcano goose shuffle bonus into the per-run grant", () => {
      vi.stubGlobal("window", {});
      const base = createHarness();
      base.engine.startLevel(1);
      const baseShuffle = base.powerups.get().shuffle; // GRANT_SHUFFLE = 1

      const { engine, powerups, progress } = createHarness();
      progress.set({ ...progress.get(), geese: [6] }); // +1 shuffle
      engine.startLevel(1);
      expect(powerups.get().shuffle).toBe(baseShuffle + 1);
      // Other levers stay at the base grant.
      expect(powerups.get().hint).toBe(base.powerups.get().hint);
    });

    it("applies the cloud goose score bonus to a match", () => {
      vi.stubGlobal("window", {});
      const base = createHarness();
      base.engine.startLevel(1);
      for (const id of findTripleOf(base.items.get())) base.engine.extract(id);
      const baseScore = base.score.get(); // 10

      const { engine, items, score, progress } = createHarness();
      progress.set({ ...progress.get(), geese: [7] }); // +5%
      engine.startLevel(1);
      for (const id of findTripleOf(items.get())) engine.extract(id);
      const cloudScore = score.get(); // 11

      expect(baseScore).toBe(10);
      expect(cloudScore).toBe(11);
    });

    it("does not arm frenzy at combo 4 without the abyss goose", () => {
      vi.useFakeTimers();
      vi.stubGlobal("window", {});
      vi.setSystemTime(new Date(1_000_000));
      const { engine, items, frenzyCharges, progress } = createHarness();
      progress.set({ ...progress.get(), geese: [] });
      engine.startLevel(1);
      for (let n = 0; n < 4; n += 1) {
        for (const id of findTripleOf(items.get())) engine.extract(id);
        if (n < 3) vi.setSystemTime(new Date(1_000_000 + (n + 1) * 200));
      }
      expect(frenzyCharges.get()).toBe(0);
    });

    it("arms frenzy one combo earlier with the abyss goose", () => {
      vi.useFakeTimers();
      vi.stubGlobal("window", {});
      vi.setSystemTime(new Date(1_000_000));
      const { engine, items, frenzyCharges, progress } = createHarness();
      progress.set({ ...progress.get(), geese: [8] }); // trigger 5 → 4
      engine.startLevel(1);
      for (let n = 0; n < 4; n += 1) {
        for (const id of findTripleOf(items.get())) engine.extract(id);
        if (n < 3) vi.setSystemTime(new Date(1_000_000 + (n + 1) * 200));
      }
      expect(frenzyCharges.get()).toBeGreaterThan(0);
    });
  });
});
