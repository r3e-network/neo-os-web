/**
 * framework/app-state — app.state observable atoms + the deprecated app.db
 * document-collection lane (RFC P0-1 residual index.ts split, moved verbatim
 * from index.ts).
 *
 * - `state.atom` / `state.persisted`: observables registered on the ctx state
 *   record (host debug/introspection); `persisted` round-trips through the
 *   `app.storage.local` lane under `state/<key>`.
 * - `db.collection`: named document collections over the hybrid storage lane
 *   (deprecated — 0 fleet consumers; kept for back-compat).
 */

import { createObservable, type Observable } from "./reactive";
import type {
  FrameworkDbSurface,
  FrameworkHybridStorageSurface,
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

export interface DbSurfaceDeps {
  /** The `app.storage.hybrid` lane backing every collection. */
  hybrid: FrameworkHybridStorageSurface;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Build the `app.db` surface (see module doc).
 *
 * @example
 * ```ts
 * const db = createDbSurface({ hybrid: storage.hybrid });
 * await db.collection<{ value: number }>("stats").set("total", { value: 1 });
 * ```
 */
export function createDbSurface(deps: DbSurfaceDeps): FrameworkDbSurface {
  const { hybrid } = deps;
  return {
    collection<T extends Record<string, unknown>>(name: string) {
      const prefix = `db/${name}/`;
      return {
        async get(id: string): Promise<T | null> {
          return hybrid.get<T>(`${prefix}${id}`, null);
        },
        async set(id: string, value: T): Promise<void> {
          await hybrid.set(`${prefix}${id}`, value);
        },
        async delete(id: string): Promise<void> {
          await hybrid.delete(`${prefix}${id}`);
        },
        async list(limit = 100): Promise<T[]> {
          const values = await hybrid.list(prefix, limit);
          return Object.values(values).filter(isRecord) as T[];
        },
      };
    },
  };
}
