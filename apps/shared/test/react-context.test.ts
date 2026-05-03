import { describe, expect, it, vi } from "vitest";
import { createDerived, createObservable } from "@shared/react/context";

describe("react context observables", () => {
  it("allows derived values without explicit dependencies", () => {
    const derived = createDerived(() => "ready");
    const listener = vi.fn();

    const unsubscribe = derived.subscribe(listener);

    expect(derived.get()).toBe("ready");
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("notifies derived subscribers when dependencies change", () => {
    const source = createObservable(1);
    const derived = createDerived(() => source.get() + 1, [source]);
    const listener = vi.fn();

    const unsubscribe = derived.subscribe(listener);
    source.set(2);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(derived.get()).toBe(3);

    unsubscribe();
  });
});
