/**
 * useNowMs — React hook for a wall-clock "now" that ticks on an interval
 *
 * Platform replacement for the hand-rolled `useState(Date.now())` +
 * `setInterval` countdown clock every PlayArea used to carry. The value
 * re-anchors to `Date.now()` immediately whenever the clock is enabled,
 * `resetKey` changes, or `stepMs` changes, so the first rendered value after
 * a fresh deadline is never inflated by a stale anchor.
 *
 * Deliberately NO visibility pause: none of the fleet call sites had one, so
 * adding it here would change countdown behavior in background tabs.
 *
 * `resetKey` must be a primitive (or otherwise referentially stable) value —
 * an inline array/object literal is a new identity every render and would
 * re-run the effect (re-anchor + restart the interval) on every render.
 * Combine multiple inputs with a template string instead.
 *
 * @example
 * ```tsx
 * // Bare 1s clock (always ticking while mounted)
 * const now = useNowMs(1_000);
 *
 * // Countdown clock that only ticks during a run and re-anchors when a
 * // fresh deadline arrives
 * const nowMs = useNowMs(1_000, {
 *   enabled: gameStatus === "dealt",
 *   resetKey: deadline,
 * });
 * const remainingMs = deadline > 0 ? Math.max(0, deadline - nowMs) : 0;
 * ```
 */

import { useEffect, useState } from "react";

export interface UseNowMsOptions {
  /**
   * When false the clock is frozen: no interval runs and no re-anchor
   * happens until it flips back to true. Defaults to true.
   */
  enabled?: boolean;
  /**
   * Change to force an immediate re-anchor (e.g. a deadline timestamp, or a
   * `${status}|${deadline}` composite when several inputs should restart the
   * clock). Must be primitive/stable — inline array/object literals re-run
   * the effect every render.
   */
  resetKey?: unknown;
}

export function useNowMs(stepMs: number, options: UseNowMsOptions = {}): number {
  const { enabled = true, resetKey } = options;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    // Re-anchor immediately so the first value after an enable/resetKey/
    // stepMs change reflects the present, not the previous anchor.
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), stepMs);
    return () => window.clearInterval(timer);
  }, [enabled, resetKey, stepMs]);

  return nowMs;
}
