import { describe, expect, it, vi } from "vitest";
import { createObservable } from "@shared/react";
import {
  SESSION_STORAGE_KEY,
  STATS_STORAGE_KEY,
  createGuestEngine,
  restoreSession,
} from "../src/logic/guest-engine";
import type { GuestStorage, ScrewSortStats } from "../src/logic/guest-engine";
import { createSession } from "../src/logic/screw-engine";

function memoryStorage(): GuestStorage & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  return {
    values,
    get<T>(key: string, fallback?: T | null): T | null {
      return values.has(key) ? values.get(key) as T : (fallback ?? null);
    },
    set<T>(key: string, value: T): void {
      values.set(key, value);
    },
    delete(key: string): void {
      values.delete(key);
    },
  };
}

function harness(storage = memoryStorage()) {
  const session = createObservable(createSession("boot"));
  const stats = createObservable<ScrewSortStats>({ wins: 0, bestMoves: 0, bestStars: 0, lastSeed: "" });
  const lastStatus = createObservable("");
  const setStatus = vi.fn();
  const submitScore = vi.fn(async () => undefined);
  const engine = createGuestEngine({
    session,
    stats,
    lastStatus,
    storage,
    t: (key) => key,
    setStatus,
    submitScore,
  });
  return { engine, session, stats, lastStatus, setStatus, submitScore, storage };
}

describe("screw-sort local guest engine", () => {
  it("plays the constructive solution, persists the win, and submits only an off-chain score", async () => {
    const app = harness();
    app.engine.startGame("guest-win");
    const solution = [...app.session.get().level.solutionOrder];
    for (const screwId of solution) expect(app.engine.selectScrew(screwId)).toBe(true);

    expect(app.session.get().core.status).toBe("won");
    expect(app.stats.get()).toMatchObject({ wins: 1, bestMoves: 36, lastSeed: "guest-win" });
    expect(app.storage.values.has(SESSION_STORAGE_KEY)).toBe(true);
    expect(app.storage.values.has(STATS_STORAGE_KEY)).toBe(true);
    await vi.waitFor(() => expect(app.submitScore).toHaveBeenCalledOnce());
    expect(app.setStatus).toHaveBeenLastCalledWith("statusWon", "success");
  });

  it("restores a valid local run and rejects a tampered snapshot", () => {
    const storage = memoryStorage();
    const first = harness(storage);
    first.engine.startGame("restore-me");
    first.engine.selectScrew(first.session.get().level.solutionOrder[0]!);

    const second = harness(storage);
    second.engine.enter();
    expect(second.session.get().level.seed).toBe("restore-me");
    expect(second.session.get().core.removedScrewIds).toHaveLength(1);
    expect(second.session.get().core.paused).toBe(true);

    const tampered = structuredClone(second.session.get());
    tampered.core.removedScrewIds.push("not-a-real-screw");
    expect(restoreSession(tampered)).toBeNull();
    storage.set(SESSION_STORAGE_KEY, tampered);

    const recovered = harness(storage);
    expect(() => recovered.engine.enter()).not.toThrow();
    expect(recovered.session.get().level.seed).toBe("restore-me");
    expect(recovered.session.get().core.removedScrewIds).toEqual([]);
  });

  it("rejects semantically impossible box, buffer, status, and trace states", () => {
    const base = createSession("semantic-guard");
    const firstMove = base.level.solutionOrder[0]!;
    const valid = structuredClone(base);
    const movedHarness = harness();
    movedHarness.engine.startGame("semantic-guard");
    movedHarness.engine.selectScrew(firstMove);
    const moved = structuredClone(movedHarness.session.get());
    expect(restoreSession(moved)).not.toBeNull();

    const impossibleCount = structuredClone(moved);
    impossibleCount.core.boxes[0]!.count = (impossibleCount.core.boxes[0]!.count + 1) % 3;
    expect(restoreSession(impossibleCount)).toBeNull();

    const impossibleWin = structuredClone(moved);
    impossibleWin.core.status = "won";
    expect(restoreSession(impossibleWin)).toBeNull();

    const impossibleBuffer = structuredClone(moved);
    impossibleBuffer.core.buffer.push({
      screwId: firstMove,
      color: impossibleBuffer.level.boards.flatMap((board) => board.screws)
        .find((screw) => screw.id === firstMove)!.color,
      lane: 0,
    });
    expect(restoreSession(impossibleBuffer)).toBeNull();

    const blockedTrace = structuredClone(valid);
    const blocked = blockedTrace.level.boards
      .flatMap((board) => board.screws)
      .find((screw) => screw.blockedBy.length > 0)!;
    blockedTrace.moveTrace = [blocked.id];
    blockedTrace.core.moves = 1;
    expect(restoreSession(blockedTrace)).toBeNull();

    const oversizedTrace = structuredClone(valid);
    oversizedTrace.moveTrace = Array.from(
      { length: 38 },
      () => valid.level.solutionOrder[0]!,
    );
    expect(restoreSession(oversizedTrace)).toBeNull();
  });

  it("keeps an overflowing run recoverable via undo (no hard fail)", () => {
    const app = harness();
    app.engine.startGame("fail-recover");
    const active = app.session.get();
    app.session.set({
      ...active,
      core: {
        ...active.core,
        boxes: active.core.boxes.map((box) => ({ ...box, queueIndex: 3 })),
      },
    });
    const top = app.session.get().level.solutionOrder.slice(0, 6);
    for (const screwId of top) app.engine.selectScrew(screwId);
    // Soft-fail: the tray overflows but the run stays playable, not "lost".
    expect(app.session.get().core.status).toBe("playing");
    expect(app.session.get().core.overflows).toBeGreaterThan(0);
    expect(app.engine.undo()).toBe(true);
    expect(app.session.get().core.status).toBe("playing");
  });

  it("keeps local play open and reports unavailable persistence when storage throws", () => {
    const storage: GuestStorage = {
      get<T>(): T | null {
        throw new Error("storage read blocked");
      },
      set<_T>(): void {
        throw new Error("storage write blocked");
      },
    };
    const app = harness(storage as ReturnType<typeof memoryStorage>);

    expect(() => app.engine.enter()).not.toThrow();
    const first = app.session.get().level.solutionOrder[0]!;
    expect(app.engine.selectScrew(first)).toBe(true);
    expect(app.session.get().core.revision).toBe(1);
    expect(app.setStatus).toHaveBeenCalledWith("statusStorageUnavailable", "warning");
  });

  it("detects a silent storage no-op before promising recovery", () => {
    const storage: GuestStorage = {
      get<T>(_key: string, fallback?: T | null): T | null {
        return fallback ?? null;
      },
      set<_T>(): void {
        // Mirrors the framework adapter when localStorage is unavailable.
      },
    };
    const app = harness(storage as ReturnType<typeof memoryStorage>);

    expect(() => app.engine.enter()).not.toThrow();
    const first = app.session.get().level.solutionOrder[0]!;
    expect(app.engine.selectScrew(first)).toBe(true);
    expect(app.session.get().core.revision).toBe(1);
    expect(app.setStatus).toHaveBeenCalledWith("statusStorageUnavailable", "warning");
  });

  it("keeps the local win and reports an unavailable practice leaderboard", async () => {
    const app = harness();
    app.submitScore.mockRejectedValueOnce(new Error("leaderboard offline"));
    app.engine.startGame("leaderboard-offline");
    for (const screwId of app.session.get().level.solutionOrder) {
      expect(app.engine.selectScrew(screwId)).toBe(true);
    }

    expect(app.session.get().core.status).toBe("won");
    await vi.waitFor(() => {
      expect(app.setStatus).toHaveBeenCalledWith("statusLeaderboardUnavailable", "warning");
    });
  });
});
