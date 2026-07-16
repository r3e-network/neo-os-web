/**
 * framework/storage-surface — app.storage local/remote lanes
 * (RFC P0-1 §2 step 5, moved verbatim from index.ts).
 *
 * - `local`: synchronous namespaced localStorage (prefix `neo:<appId>:` by
 *   default — apps with pre-framework keys inject their legacy prefix so
 *   stored user data is never orphaned).
 * - `remote`: async OS storage; graceful no-ops when the host has none.
 */

import { localStorageAvailable } from "./utils/safe-storage";
import type {
  FrameworkLocalStorageSurface,
  FrameworkRemoteStorageSurface,
  FrameworkStorageSurface,
  MiniAppFrameworkOS,
} from "./types";

export interface StorageSurfaceDeps {
  /** Full key prefix for the local lane (e.g. `neo:<appId>:`). */
  prefix: string;
  /** Live accessor for the OS storage service (hosts can hydrate late). */
  osStorage: () => MiniAppFrameworkOS["storage"] | undefined;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Build the `app.storage` surface (see module doc).
 *
 * @example
 * ```ts
 * const storage = createStorageSurface({ prefix: "neo:my-app:", osStorage: () => os.storage });
 * storage.local.set("settings", { sound: true });
 * ```
 */
export function createStorageSurface(deps: StorageSurfaceDeps): FrameworkStorageSurface {
  const { prefix } = deps;
  const localKey = (key: string) => `${prefix}${key}`;

  const local: FrameworkLocalStorageSurface = {
    get<T>(key: string, fallback: T | null = null): T | null {
      return parseJson<T | null>(localStorageAvailable()?.getItem(localKey(key)) ?? null, fallback);
    },
    set(key: string, value: unknown): void {
      localStorageAvailable()?.setItem(localKey(key), JSON.stringify(value));
    },
    delete(key: string): void {
      localStorageAvailable()?.removeItem(localKey(key));
    },
    list(listPrefix: string): Record<string, unknown> {
      const store = localStorageAvailable();
      const out: Record<string, unknown> = {};
      if (!store) return out;
      const fullPrefix = localKey(listPrefix);
      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index);
        if (!key?.startsWith(fullPrefix)) continue;
        out[key.slice(prefix.length)] = parseJson(store.getItem(key), null);
      }
      return out;
    },
  };

  const remote: FrameworkRemoteStorageSurface = {
    async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
      const osStorage = deps.osStorage();
      if (!osStorage) return fallback;
      const value = await osStorage.get(key);
      return value === undefined || value === null ? fallback : value as T;
    },
    async set(key: string, value: unknown): Promise<void> {
      const osStorage = deps.osStorage();
      if (!osStorage) return;
      await osStorage.set(key, value);
    },
    async delete(key: string): Promise<void> {
      const osStorage = deps.osStorage();
      if (!osStorage) return;
      await osStorage.delete(key);
    },
    async list(listPrefix: string, limit = 100): Promise<Record<string, unknown>> {
      const osStorage = deps.osStorage();
      if (!osStorage) return {};
      return osStorage.list(listPrefix, limit);
    },
  };

  return { local, remote };
}
