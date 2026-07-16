/**
 * useStateBindings — React hook for typed state accessors
 *
 * Returns accessor functions that read current observable values synchronously.
 *
 * The hook subscribes to ALL observables in the state record and triggers a
 * re-render when any value changes. The accessor functions (str, bool, num, val)
 * read current values directly from observables — no additional hook calls needed.
 *
 * @example
 * ```tsx
 * function PlayArea({ state }: { state: ObservableState }) {
 *   const { str, bool, num, val } = useStateBindings(state);
 *   return (
 *     <div>
 *       <h1>{str("title")}</h1>
 *       {bool("active") && <Badge />}
 *       <span>Score: {num("score")}</span>
 *     </div>
 *   );
 * }
 * ```
 */

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import type { ObservableState, Observable } from "../context";

type StateRecord = ObservableState | Record<string, unknown>;

function isObservable(value: unknown): value is Observable {
  return typeof (value as Observable | undefined)?.get === "function";
}

function isSubscribable(value: unknown): value is Pick<Observable, "subscribe"> {
  return typeof (value as Observable | undefined)?.subscribe === "function";
}

function readStateValue(state: StateRecord, key: string, fallback: unknown): unknown {
  const value = (state as Record<string, unknown>)[key];
  return isObservable(value) ? value.get() : value ?? fallback;
}

// ============================================================================
// useStateBindings
// ============================================================================

/**
 * Subscribe to all observables in a state record and provide typed accessors.
 *
 * This hook creates a combined subscription across all keys in the state
 * record. When any observable fires, the component re-renders. The returned
 * accessor functions read current values synchronously from the observables.
 */
export function useStateBindings(state: StateRecord) {
  // Create a combined subscribe function that listens to all observables
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const unsubs: Array<() => void> = [];
      for (const observable of Object.values(state)) {
        if (isSubscribable(observable)) {
          unsubs.push(observable.subscribe(onStoreChange));
        }
      }
      return () => {
        unsubs.forEach((unsub) => unsub());
      };
    },
    [state],
  );

  // Snapshot is a revision counter — increments on any change to trigger re-render.
  // We use a simple counter because React compares snapshots with Object.is().
  // useRef keeps the counter stable across renders so getSnapshot reliably
  // observes increments made by subscribeCombined's wrapped change handler.
  const revisionRef = useRef(0);
  // The snapshot is purely the revision counter (compared by React with
  // Object.is). It increments in subscribeCombined's wrapped handler whenever
  // any observable fires — the only thing that should trigger a re-render. We
  // deliberately do NOT re-read observables here: their values are read live
  // via the accessor functions (str/num/bool/val) during render, so re-reading
  // every observable in getSnapshot only recomputes every derived value on
  // every render (and every React sync check) with no effect on the compared
  // snapshot. Dropping the loop avoids that O(observables) waste per render.
  const getSnapshot = useCallback(() => revisionRef.current, []);

  // Subscribe to changes — the subscribe callback increments our revision
  const subscribeCombined = useCallback(
    (onStoreChange: () => void) => {
      const wrappedOnChange = () => {
        revisionRef.current++;
        onStoreChange();
      };
      return subscribe(wrappedOnChange);
    },
    [subscribe],
  );

  useSyncExternalStore(subscribeCombined, getSnapshot, getSnapshot);

  // Build accessor functions that read current values from observables
  return useMemo(() => {
    /** Read a string value (defaults to "") */
    const str = (key: string, fallback = ""): string => {
      const value = readStateValue(state, key, fallback);
      return value == null ? fallback : String(value);
    };

    /** Read a boolean value (defaults to false) */
    const bool = (key: string): boolean =>
      Boolean(readStateValue(state, key, false));

    /**
     * Read a number value (defaults to `fallback`).
     *
     * The nullish guard mirrors `str` above, and is the difference between a
     * fallback and a lie. `readStateValue` returns an observable's value RAW —
     * its own `?? fallback` only covers a missing key — so an observable
     * holding `undefined` reached `Number()` directly and rendered `NaN`.
     * `undefined` is how an app says "not read yet" (see `pendingKey` in
     * apps/shared/types/miniapp-manifest.ts), so the state every app uses to
     * mean "nothing known" was the one state this accessor could not survive.
     * `val` keeps returning the raw value on purpose: callers reach for it
     * precisely to see the true state, and pass their own default with `??`.
     */
    const num = (key: string, fallback = 0): number => {
      const value = readStateValue(state, key, fallback);
      return value == null ? fallback : Number(value);
    };

    /** Read a raw value with a typed cast */
    const val = <T,>(key: string, fallback: T | null = null): T | null =>
      readStateValue(state, key, fallback) as T | null;

    return { str, bool, num, val };
  }, [state]);
}

// ============================================================================
// useObservable
// ============================================================================

/**
 * Subscribe to a single observable and return its current value.
 * Useful when you need a single value without the full useStateBindings API.
 *
 * @example
 * ```tsx
 * const count = useObservable(countObservable);
 * ```
 */
export function useObservable<T>(observable: Observable<T>): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => observable.subscribe(onStoreChange),
    [observable],
  );

  const getSnapshot = useCallback(() => observable.get(), [observable]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
