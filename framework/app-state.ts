/**
 * framework/app-state — app.state observable atoms (RFC P0-1 residual
 * index.ts split, moved verbatim from index.ts).
 *
 * - `state.atom` / `state.persisted`: observables registered on the ctx state
 *   record (host debug/introspection); `persisted` round-trips through the
 *   `app.storage.local` lane under `state/<key>`.
 */

import { createObservable, type Observable } from "./reactive";
import type {
  FrameworkLocalStorageSurface,
  FrameworkStateSurface,
} from "./types";

export interface StateSurfaceDeps {
  /** The `app.storage.local` lane backing `state.persisted`. */
  local: FrameworkLocalStorageSurface;
  /** The ctx record atoms are registered on (mutated in place, like before). */
  stateHost: { state?: Record<string, Observable> };
}

/**
 * Build the `app.state` surface (see module doc).
 *
 * @example
 * ```ts
 * const state = createStateSurface({ local: storage.local, stateHost: ctx });
 * const score = state.persisted("score", 0);
 * ```
 */
export function createStateSurface(deps: StateSurfaceDeps): FrameworkStateSurface {
  const { local, stateHost } = deps;
  return {
    atom<T>(key: string, initial: T): Observable<T> {
      const value = createObservable(initial);
      stateHost.state ??= {};
      stateHost.state[key] = value;
      return value;
    },
    persisted<T>(key: string, initial: T): Observable<T> {
      const storageKey = `state/${key}`;
      const value = createObservable(local.get<T>(storageKey, initial) as T);
      value.subscribe(() => local.set(storageKey, value.get()));
      stateHost.state ??= {};
      stateHost.state[key] = value;
      return value;
    },
    snapshot(values: Record<string, Observable>): Record<string, unknown> {
      return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.get()]));
    },
  };
}
