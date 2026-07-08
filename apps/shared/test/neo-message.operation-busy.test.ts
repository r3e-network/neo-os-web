import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../react";
import {
  createRevealOperations,
  operationBusyFlag,
} from "../../neo-message/src/operation-busy";

/**
 * The hand-rolled isLoading/isSending flags and the busyIds addBusy/removeBusy
 * array migrated onto app.operations. These tests drive the wiring against the
 * REAL framework operations surface and assert the user-visible contracts are
 * unchanged: flags flip exactly around the wrapped work, one slow reveal never
 * disables another row's button, and busy always clears — even on failure.
 */

function makeApp() {
  const chain = {
    address: createObservable<string | null>(null),
    ensureWallet: vi.fn(async () => ""),
    read: vi.fn(async () => null),
    invoke: vi.fn(),
    invokeWithPayment: vi.fn(),
  };
  return createMiniAppFramework(
    { services: { chain }, t: (key: string) => key } as never,
    { appId: "miniapp-neo-message" },
  );
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("neo-message operationBusyFlag", () => {
  it("is true exactly while the operation runs and notifies subscribers on each flip", async () => {
    const app = makeApp();
    const op = app.operations.create("loadMessages");
    const busy = operationBusyFlag(op);
    const flips: boolean[] = [];
    busy.subscribe(() => flips.push(busy.get()));

    expect(busy.get()).toBe(false);

    const gate = deferred();
    const run = op.run(() => gate.promise);
    expect(busy.get()).toBe(true);

    gate.resolve();
    await run;
    expect(busy.get()).toBe(false);
    // One notification when the run starts, one when it settles — the same
    // two updates the old isLoading.set(true)/set(false) pair produced.
    expect(flips).toEqual([true, false]);
  });

  it("ignores set() — the operation state is the single source of truth", () => {
    const app = makeApp();
    const busy = operationBusyFlag(app.operations.create("loadMessages"));

    busy.set(true);

    expect(busy.get()).toBe(false);
  });
});

describe("neo-message createRevealOperations", () => {
  it("keeps other rows enabled while one reveal is in flight", async () => {
    const app = makeApp();
    const reveals = createRevealOperations((key) => app.operations.create(key));

    const first = deferred();
    const second = deferred();
    const run1 = reveals.opFor("1").run(() => first.promise);
    const run2 = reveals.opFor("2").run(() => second.promise);
    expect(reveals.busyIds.get()).toEqual(["1", "2"]);

    first.resolve();
    await run1;
    // Row 1 finished; row 2's slow poll still marks only row 2 busy.
    expect(reveals.busyIds.get()).toEqual(["2"]);

    second.resolve();
    await run2;
    expect(reveals.busyIds.get()).toEqual([]);
  });

  it("clears busy even when the wrapped work fails", async () => {
    const app = makeApp();
    const reveals = createRevealOperations((key) => app.operations.create(key));

    await reveals.opFor("9").run(async () => {
      throw new Error("boom");
    });

    expect(reveals.busyIds.get()).toEqual([]);
  });

  it("reuses a single operation per row id", () => {
    const app = makeApp();
    const reveals = createRevealOperations((key) => app.operations.create(key));

    expect(reveals.opFor("5")).toBe(reveals.opFor("5"));
  });
});
