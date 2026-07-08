export interface Observable<T = unknown> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

export function createObservable<T>(initial: T): Observable<T> {
  let current = initial;
  const listeners = new Set<() => void>();

  return {
    get() {
      return current;
    },
    set(value: T) {
      if (Object.is(current, value)) return;
      current = value;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Combine boolean observables into a read-only "busy" observable that is true
 * while ANY source is true. `set` is a no-op (derived value); subscribing
 * subscribes to every source and the returned unsubscribe releases all of
 * them.
 *
 * Promoted from the byte-identical hand-rolled composite observables that
 * lived in miniapp composables (gov-merc, self-loan); canonical home of
 * apps/shared/utils/observables.ts — shared re-exports from here.
 */
export function combineBusy(
  ...sources: Observable<boolean>[]
): Observable<boolean> {
  return {
    get: () => sources.some((source) => source.get()),
    set: () => {},
    subscribe(listener: () => void) {
      const unsubs = sources.map((source) => source.subscribe(listener));
      return () => {
        unsubs.forEach((unsub) => unsub());
      };
    },
  };
}
