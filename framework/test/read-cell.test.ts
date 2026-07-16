/**
 * createReadCell — the platform-owned "have we asked yet?" signal.
 *
 * These tests pin the cell's contract so fleet adoption can trust it:
 * - value stays undefined until the FIRST successful read (pendingKey lane)
 * - the throw path SETTLES to "error" (never sticks at "loading")
 * - concurrency is last-write-wins via a monotonic epoch; reset() joins the
 *   epoch, so it also invalidates in-flight publishes
 * - a settled empty result (null / []) is a real published value, never
 *   confused with "not read yet"
 * - sync loaders publish synchronously (guard-ordering compatibility for the
 *   fleet's sync storage probes)
 */

import { describe, expect, it } from "vitest";
import { createReadCell } from "../reactive";

/** A loader whose settlement the test controls. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createReadCell", () => {
  it("starts idle with an undefined value (not read yet, not an answer)", () => {
    const cell = createReadCell(async () => 1);
    expect(cell.status.get()).toBe("idle");
    expect(cell.value.get()).toBeUndefined();
  });

  it("flips to loading while in flight, then publishes value + ready", async () => {
    const gate = deferred<number[]>();
    const cell = createReadCell(() => gate.promise);
    const loading = cell.load();
    expect(cell.status.get()).toBe("loading");
    expect(cell.value.get()).toBeUndefined();
    gate.resolve([7]);
    await expect(loading).resolves.toEqual([7]);
    expect(cell.status.get()).toBe("ready");
    expect(cell.value.get()).toEqual([7]);
  });

  it("settles the async throw path to error and keeps value undefined", async () => {
    const cell = createReadCell<number>(async () => {
      throw new Error("rpc down");
    });
    await expect(cell.load()).rejects.toThrow("rpc down");
    expect(cell.status.get()).toBe("error");
    // A failed FIRST read is still "not read yet" for the value lane.
    expect(cell.value.get()).toBeUndefined();
  });

  it("settles a SYNC throw to error too (loader that throws before returning a promise)", async () => {
    const cell = createReadCell<number>(() => {
      throw new Error("sync boom");
    });
    await expect(cell.load()).rejects.toThrow("sync boom");
    expect(cell.status.get()).toBe("error");
    expect(cell.value.get()).toBeUndefined();
  });

  it("keeps the last good value when a later read fails (stale-but-real stays renderable)", async () => {
    let fail = false;
    const cell = createReadCell<string>(async () => {
      if (fail) throw new Error("later failure");
      return "good";
    });
    await cell.load();
    fail = true;
    await expect(cell.load()).rejects.toThrow("later failure");
    expect(cell.status.get()).toBe("error");
    expect(cell.value.get()).toBe("good");
  });

  it("publishes a settled null / empty result as a real answer (never 'not read yet')", async () => {
    const nullable = createReadCell<string | null>(async () => null);
    await nullable.load();
    expect(nullable.value.get()).toBeNull();
    expect(nullable.status.get()).toBe("ready");

    const empty = createReadCell<number[]>(async () => []);
    await empty.load();
    expect(empty.value.get()).toEqual([]);
    expect(empty.status.get()).toBe("ready");
  });

  it("last-write-wins: a superseded load never clobbers the newer result", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const gates = [first, second];
    const cell = createReadCell(() => gates.shift()!.promise);

    const p1 = cell.load();
    const p2 = cell.load();
    // The NEWER call resolves first…
    second.resolve("new");
    await p2;
    expect(cell.value.get()).toBe("new");
    expect(cell.status.get()).toBe("ready");
    // …then the stale call lands late. Its own promise resolves with its own
    // result, but the cell must NOT interleave the stale data back in.
    first.resolve("stale");
    await expect(p1).resolves.toBe("stale");
    expect(cell.value.get()).toBe("new");
    expect(cell.status.get()).toBe("ready");
  });

  it("a superseded load's late FAILURE cannot flip a settled ready back to error", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const gates = [first, second];
    const cell = createReadCell(() => gates.shift()!.promise);

    const p1 = cell.load();
    const p2 = cell.load();
    second.resolve("current");
    await p2;
    first.reject(new Error("stale failure"));
    await expect(p1).rejects.toThrow("stale failure");
    expect(cell.status.get()).toBe("ready");
    expect(cell.value.get()).toBe("current");
  });

  it("reset() returns to idle + undefined", async () => {
    const cell = createReadCell(async () => 42);
    await cell.load();
    cell.reset();
    expect(cell.status.get()).toBe("idle");
    expect(cell.value.get()).toBeUndefined();
  });

  it("reset() invalidates an in-flight load (the fleet's identityRevision guard)", async () => {
    const gate = deferred<string>();
    const cell = createReadCell(() => gate.promise);
    const inFlight = cell.load();
    cell.reset();
    gate.resolve("stale identity");
    await expect(inFlight).resolves.toBe("stale identity");
    // The stale publish was dropped: still the reset state.
    expect(cell.status.get()).toBe("idle");
    expect(cell.value.get()).toBeUndefined();
  });

  it("a SYNC loader publishes synchronously — no microtask gap for guard ordering", () => {
    const cell = createReadCell(() => ["sync"]);
    void cell.load();
    // No await: the settled state must already be observable.
    expect(cell.status.get()).toBe("ready");
    expect(cell.value.get()).toEqual(["sync"]);
  });

  it("notifies value and status subscribers on publish", async () => {
    const cell = createReadCell(async () => "notified");
    const seenValues: Array<string | undefined> = [];
    const seenStatuses: string[] = [];
    cell.value.subscribe(() => seenValues.push(cell.value.get()));
    cell.status.subscribe(() => seenStatuses.push(cell.status.get()));
    await cell.load();
    expect(seenValues).toEqual(["notified"]);
    expect(seenStatuses).toEqual(["loading", "ready"]);
  });

  it("supports the owner write-back lane: value.set after a verified write", async () => {
    const cell = createReadCell<number[]>(async () => [1]);
    await cell.load();
    // The owning composable just round-tripped a write; it may publish the
    // new truth directly (timestamp-proof persistProofs pattern).
    cell.value.set([1, 2]);
    expect(cell.value.get()).toEqual([1, 2]);
    expect(cell.status.get()).toBe("ready");
  });
});
