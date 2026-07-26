import React from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { createObservable, type ObservableState } from "../react/context";
import { useStateBindings } from "../react/hooks/useStateBindings";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

/**
 * `useStateBindings` is how ~42 apps read their observables into a view, and it
 * had no direct test. These pin the one thing every accessor must agree on:
 * what a fallback means.
 *
 * `undefined` is not a hypothetical here — it is how an app says "not read
 * yet", the state `pendingKey` (apps/shared/types/miniapp-manifest.ts) exists
 * to render. Every accessor must survive it.
 */
function readBindings(state: ObservableState) {
  const seen: Record<string, unknown> = {};
  function Probe() {
    const { str, num, bool, val } = useStateBindings(state);
    seen.str = str("value", "fallback-copy");
    seen.strNoFallback = str("value");
    seen.num = num("value", 7);
    seen.numNoFallback = num("value");
    seen.bool = bool("value");
    seen.val = val("value");
    seen.valNullFallback = val<number>("value", null);
    seen.valFallback = val<number>("value", 11);
    return null;
  }
  render(<Probe />);
  return seen;
}

describe("useStateBindings accessors", () => {
  it("honours the fallback when an observable holds undefined", () => {
    const seen = readBindings({ value: createObservable(undefined) } as ObservableState);

    // The regression this pins: readStateValue returns an observable's value
    // RAW (its own `?? fallback` only covers a missing key), so `num` reached
    // Number(undefined) and rendered NaN — in the exact state apps use to mean
    // "nothing known". A fallback that abandons its caller is not a fallback.
    expect(seen.num).toBe(7);
    expect(Number.isNaN(seen.num)).toBe(false);
    expect(seen.numNoFallback).toBe(0);

    // str already guarded; pinned so the two accessors cannot drift apart again.
    expect(seen.str).toBe("fallback-copy");
    expect(seen.strNoFallback).toBe("");
    expect(seen.bool).toBe(false);

    // val stays RAW when no fallback is offered: callers reach for it precisely
    // to see the true state (explorer/graveyard adopted it to dodge the NaN
    // above), and an explicit `null` fallback keeps asking for that raw view.
    expect(seen.val).toBeUndefined();
    expect(seen.valNullFallback).toBeUndefined();

    // But a caller who DID name a fallback gets it, exactly like str/num. This
    // is the same defect those two were fixed for: `readStateValue` only
    // applies its fallback to a missing key, so an observable holding
    // `undefined` handed the raw `undefined` back to a caller who had already
    // said what "nothing known" should read as. Sites then repaired it a second
    // time with `?? 0` at the call site — a fallback duplicated because the
    // first one was ignored.
    expect(seen.valFallback).toBe(11);
  });

  it("honours the fallback when an observable holds null", () => {
    const seen = readBindings({ value: createObservable(null) } as ObservableState);

    expect(seen.num).toBe(7);
    expect(seen.str).toBe("fallback-copy");
    expect(seen.bool).toBe(false);
    expect(seen.valFallback).toBe(11);
    expect(seen.valNullFallback).toBeNull();
  });

  it("passes real values through, including a settled zero", () => {
    const zero = readBindings({ value: createObservable(0) } as ObservableState);

    // A zero the app actually set is an answer, not an absence: it must never
    // be swallowed by the fallback, or a real balance of 0 reads as "unknown".
    expect(zero.num).toBe(0);
    expect(zero.str).toBe("0");
    expect(zero.val).toBe(0);
    // The same rule binds `val`: a settled 0 outranks the fallback, or a real
    // balance of 0 reads as "unknown" through this accessor too.
    expect(zero.valFallback).toBe(0);

    const real = readBindings({ value: createObservable(42) } as ObservableState);
    expect(real.num).toBe(42);
    expect(real.str).toBe("42");
  });

  it("falls back when the key is absent from state entirely", () => {
    const seen = readBindings({} as ObservableState);

    expect(seen.num).toBe(7);
    expect(seen.str).toBe("fallback-copy");
    expect(seen.bool).toBe(false);
    expect(seen.valFallback).toBe(11);
  });

  it("keeps a named fallback out of the way of falsy-but-real values", () => {
    function probe<T>(raw: unknown, fallback: T): T {
      let out!: T;
      function Probe() {
        const { val } = useStateBindings({ value: createObservable(raw) } as ObservableState);
        out = val<T>("value", fallback);
        return null;
      }
      render(<Probe />);
      return out;
    }

    // `false` and `""` are answers an app can settle on, so only nullish may
    // reach the fallback — the same boundary str/num draw with `value == null`.
    expect(probe(false, true)).toBe(false);
    expect(probe("", "fallback-copy")).toBe("");
    expect(probe(undefined, true)).toBe(true);
  });
});
