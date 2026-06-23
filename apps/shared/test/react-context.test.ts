import { describe, expect, it, vi } from "vitest";
import {
  createDerived,
  createObservable,
  refToObservable,
  withValueCompat,
} from "@shared/react/context";

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

  it("forwards notifications from wrapped ref-compatible observables", () => {
    const source = withValueCompat(createObservable<string | null>(null));
    const wrapped = refToObservable(source);
    const snapshots: Array<string | null> = [];
    const listener = vi.fn(() => {
      snapshots.push(wrapped.get());
    });

    const unsubscribe = wrapped.subscribe(listener);

    source.value = "NHostWallet";
    expect(listener).toHaveBeenCalledTimes(1);
    expect(wrapped.get()).toBe("NHostWallet");

    source.set("NSecondHostWallet");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(snapshots).toEqual(["NHostWallet", "NSecondHostWallet"]);

    unsubscribe();
    source.value = null;

    expect(listener).toHaveBeenCalledTimes(2);
    expect(wrapped.get()).toBe(null);
  });

  it("passes through native observables", () => {
    const source = createObservable("ready");

    expect(refToObservable(source)).toBe(source);
  });
});
