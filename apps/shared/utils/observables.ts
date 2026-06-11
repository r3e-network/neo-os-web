/**
 * Observable combinators shared by miniapp composables.
 *
 * Promoted from the byte-identical hand-rolled composite observables that
 * lived in miniapp composables (gov-merc, self-loan).
 */

import type { Observable } from "../react/context";

/**
 * Combine boolean observables into a read-only "busy" observable that is true
 * while ANY source is true. `set` is a no-op (derived value); subscribing
 * subscribes to every source and the returned unsubscribe releases all of
 * them.
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
