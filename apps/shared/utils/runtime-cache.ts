/**
 * Cross-app cache helpers backed by localStorage.
 *
 * Use these for data that is genuinely shared across miniapps (e.g. the
 * Morpheus runtime catalog). For app-scoped cache (per-miniapp state with
 * automatic prefixing), use the CacheService instance on PlatformServices.
 */

import { safeReadJSON, safeWriteJSON, safeRemoveStorage } from "./safe-storage";

type CacheEnvelope<T> = {
  value: T;
  updatedAt: number;
  expiresAt?: number;
};

function safeNow(): number {
  return Date.now();
}

export function readCachedJSON<T>(key: string): T | null {
  return safeReadJSON<T>(key);
}

export function writeCachedJSON<T>(key: string, value: T): void {
  safeWriteJSON(key, value);
}

export function clearCachedValue(key: string): void {
  safeRemoveStorage(key);
}

export function readTimedCache<T>(key: string): CacheEnvelope<T> | null {
  const payload = readCachedJSON<CacheEnvelope<T>>(key);
  if (!payload || typeof payload !== "object" || typeof payload.updatedAt !== "number") return null;
  if (typeof payload.expiresAt === "number" && payload.expiresAt <= safeNow()) {
    clearCachedValue(key);
    return null;
  }
  return payload;
}

export function readTimedCacheValue<T>(key: string): T | null {
  return readTimedCache<T>(key)?.value ?? null;
}

export function writeTimedCache<T>(key: string, value: T, ttlMs?: number): CacheEnvelope<T> {
  const updatedAt = safeNow();
  const payload: CacheEnvelope<T> = {
    value,
    updatedAt,
    ...(typeof ttlMs === "number" && ttlMs > 0 ? { expiresAt: updatedAt + ttlMs } : {}),
  };
  writeCachedJSON(key, payload);
  return payload;
}
