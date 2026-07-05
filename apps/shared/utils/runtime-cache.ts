/**
 * Cross-app cache helpers backed by localStorage.
 *
 * Use these for data that is genuinely shared across miniapps (e.g. the
 * Morpheus runtime catalog). For app-scoped cache (per-miniapp state with
 * automatic prefixing), use the CacheService instance on PlatformServices.
 */

import { safeReadJSON, safeWriteJSON, safeRemoveStorage } from "./safe-storage";

export function readCachedJSON<T>(key: string): T | null {
  return safeReadJSON<T>(key);
}

export function writeCachedJSON<T>(key: string, value: T): void {
  safeWriteJSON(key, value);
}

export function clearCachedValue(key: string): void {
  safeRemoveStorage(key);
}
