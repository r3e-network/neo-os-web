import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNowMs, type UseNowMsOptions } from "../react/hooks/useNowMs";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

/**
 * `useNowMs` is the platform countdown clock: 13 PlayAreas replaced their
 * hand-rolled `useState(Date.now()) + setInterval` with it. These pin the
 * exact semantics those sites relied on — tick cadence, the enabled gate
 * freezing BOTH the interval and the anchor, and the immediate re-anchor on
 * enable/resetKey change (so a fresh deadline never renders against a stale
 * "now").
 */

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-16T00:00:00.000Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const T0 = Date.parse("2026-07-16T00:00:00.000Z");

function renderNowMs(stepMs: number, options?: UseNowMsOptions) {
  const seen: { nowMs: number } = { nowMs: Number.NaN };
  function Probe(props: { stepMs: number; options?: UseNowMsOptions }) {
    seen.nowMs = useNowMs(props.stepMs, props.options);
    return null;
  }
  const view = render(<Probe stepMs={stepMs} options={options} />);
  const rerender = (nextStepMs: number, nextOptions?: UseNowMsOptions) =>
    view.rerender(<Probe stepMs={nextStepMs} options={nextOptions} />);
  return { seen, rerender, unmount: view.unmount };
}

describe("useNowMs", () => {
  it("anchors to Date.now() at mount and ticks once per stepMs", () => {
    const { seen } = renderNowMs(1_000);
    expect(seen.nowMs).toBe(T0);

    act(() => {
      vi.advanceTimersByTime(999);
    });
    // Between ticks the value stays at the anchor — no continuous clock.
    expect(seen.nowMs).toBe(T0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(seen.nowMs).toBe(T0 + 1_000);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(seen.nowMs).toBe(T0 + 4_000);
  });

  it("stays frozen with no interval while enabled is false", () => {
    const { seen } = renderNowMs(1_000, { enabled: false });
    expect(seen.nowMs).toBe(T0);
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    // Neither ticked nor re-anchored: a disabled clock renders its mount value.
    expect(seen.nowMs).toBe(T0);
  });

  it("re-anchors immediately when enabled flips true, then resumes ticking", () => {
    const { seen, rerender } = renderNowMs(1_000, { enabled: false });

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(seen.nowMs).toBe(T0);

    act(() => {
      rerender(1_000, { enabled: true });
    });
    // The anchor must jump to the present synchronously with the enable —
    // before any interval fires — or the first frame renders 5s stale.
    expect(seen.nowMs).toBe(T0 + 5_000);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(seen.nowMs).toBe(T0 + 6_000);
  });

  it("re-anchors immediately on resetKey change without waiting for a tick", () => {
    const { seen, rerender } = renderNowMs(30_000, { enabled: true, resetKey: 111 });
    expect(seen.nowMs).toBe(T0);

    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    // Mid-interval: no tick yet, value still at anchor.
    expect(seen.nowMs).toBe(T0);

    act(() => {
      rerender(30_000, { enabled: true, resetKey: 222 });
    });
    expect(seen.nowMs).toBe(T0 + 12_000);

    // The interval restarted at the resetKey change, so the next tick lands a
    // full step after the re-anchor, not on the old cadence.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(seen.nowMs).toBe(T0 + 42_000);
  });

  it("clears its interval on unmount", () => {
    const { unmount } = renderNowMs(1_000);
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
