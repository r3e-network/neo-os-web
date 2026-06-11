import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { combineBusy } from "../utils/observables";

describe("combineBusy", () => {
  it("is true while ANY source is true", () => {
    const a = createObservable(false);
    const b = createObservable(false);
    const busy = combineBusy(a, b);

    expect(busy.get()).toBe(false);
    a.set(true);
    expect(busy.get()).toBe(true);
    a.set(false);
    b.set(true);
    expect(busy.get()).toBe(true);
    b.set(false);
    expect(busy.get()).toBe(false);
  });

  it("notifies subscribers on every source change and unsubscribes all", () => {
    const a = createObservable(false);
    const b = createObservable(false);
    const busy = combineBusy(a, b);

    const listener = vi.fn();
    const unsubscribe = busy.subscribe(listener);

    a.set(true);
    b.set(true);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    a.set(false);
    b.set(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("ignores set() — the combined value is derived", () => {
    const a = createObservable(true);
    const busy = combineBusy(a);
    busy.set(false);
    expect(busy.get()).toBe(true);
  });
});
