/**
 * In-memory cache with TTL support
 * Wraps lru-cache for production-grade LRU eviction
 */

import { LRUCache } from "lru-cache";

class MemoryCache {
  // lru-cache v11 constrains V extends {} — use `object | string | number | boolean`
  private cache: LRUCache<string, object | string | number | boolean>;

  constructor(maxSize = 1000) {
    this.cache = new LRUCache<string, object | string | number | boolean>({
      max: maxSize,
      allowStale: false,
    });
  }

  get<T>(key: string): T | null {
    const value = this.cache.get(key);
    return value === undefined ? null : (value as T);
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, data as object | string | number | boolean, { ttl: ttlMs });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  destroy(): void {
    this.cache.clear();
  }
}

export const apiCache = new MemoryCache();

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  SHORT: 30 * 1000, // 30 seconds
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
} as const;
