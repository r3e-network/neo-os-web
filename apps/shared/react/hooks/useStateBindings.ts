/**
 * useStateBindings — React hook for typed state accessors
 *
 * React equivalent of the Vue composable in composables/useStateBindings.ts.
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

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { ObservableState, Observable } from "../context";

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
export function useStateBindings(state: ObservableState) {
  // Create a combined subscribe function that listens to all observables
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const unsubs: Array<() => void> = [];
      for (const observable of Object.values(state)) {
        unsubs.push(observable.subscribe(onStoreChange));
      }
      return () => {
        unsubs.forEach((unsub) => unsub());
      };
    },
    [state],
  );

  // Snapshot is a revision counter — increments on any change to trigger re-render.
  // We use a simple counter because React compares snapshots with Object.is().
  const revisionRef = { current: 0 };
  const getSnapshot = useCallback(() => {
    // Re-read to trigger recompute; the actual values are read via accessors
    for (const observable of Object.values(state)) {
      observable.get();
    }
    return revisionRef.current;
  }, [state]);

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
    const str = (key: string, fallback = ""): string =>
      String(state[key]?.get() ?? fallback);

    /** Read a boolean value (defaults to false) */
    const bool = (key: string): boolean =>
      Boolean(state[key]?.get() ?? false);

    /** Read a number value (defaults to 0) */
    const num = (key: string, fallback = 0): number =>
      Number(state[key]?.get() ?? fallback);

    /** Read a raw value with a typed cast */
    const val = <T,>(key: string, fallback: T | null = null): T | null =>
      (state[key]?.get() ?? fallback) as T | null;

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
