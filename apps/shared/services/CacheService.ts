/**
 * CacheService - Memory + localStorage caching layer for miniapps.
 *
 * Provides app-scoped caching with TTL expiration, memory-first access,
 * and optional localStorage persistence for data that should survive
 * page reloads (e.g. user preferences, last-known balances).
 *
 * Each miniapp gets its own namespace via the appId prefix, preventing
 * key collisions across the 60+ miniapps in the platform.
 */

interface CacheEntry {
  data: unknown;
  expires: number;
}

const DEFAULT_TTL_MS = 30_000; // 30 seconds

export class CacheService {
  private memory: Map<string, CacheEntry>;
  private readonly prefix: string;

  constructor(appId: string) {
    this.prefix = `neo:${appId}:`;
    this.memory = new Map();
  }

  /**
   * Retrieve a cached value. Returns null if the key is missing or expired.
   */
  get<T>(key: string): T | null {
    const entry = this.memory.get(this.prefixed(key));
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.memory.delete(this.prefixed(key));
      return null;
    }
    return entry.data as T;
  }

  /**
   * Store a value in the memory cache with an optional TTL.
   */
  set(key: string, data: unknown, ttlMs: number = DEFAULT_TTL_MS): void {
    this.memory.set(this.prefixed(key), {
      data,
      expires: Date.now() + ttlMs,
    });
  }

  /**
   * Remove a single key from the memory cache and localStorage.
   */
  invalidate(key: string): void {
    this.memory.delete(this.prefixed(key));
    this.removeFromStorage(this.prefixed(key));
  }

  /**
   * Remove all entries for this app from the memory cache and localStorage.
   */
  invalidateAll(): void {
    // Clear memory entries with this app's prefix
    for (const k of this.memory.keys()) {
      if (k.startsWith(this.prefix)) {
        this.memory.delete(k);
      }
    }
    // Clear localStorage entries with this app's prefix
    this.clearStorageByPrefix();
  }

  /**
   * Persist a value to localStorage for cross-session survival.
   * Falls back silently if localStorage is unavailable (SSR, quota exceeded).
   */
  persist(key: string, data: unknown): void {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(this.prefixed(key), JSON.stringify(data));
    } catch {
      // localStorage may be full or unavailable — fail silently
    }
  }

  /**
   * Restore a value previously persisted to localStorage.
   * Returns null if the key does not exist or parsing fails.
   */
  restore<T>(key: string): T | null {
    try {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(this.prefixed(key));
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /**
   * Return the number of entries currently in the memory cache.
   */
  get size(): number {
    return this.memory.size;
  }

  /**
   * Destroy all memory state. Called during service teardown.
   */
  destroy(): void {
    this.memory.clear();
  }

  // -- private helpers -------------------------------------------------------

  private prefixed(key: string): string {
    return `${this.prefix}${key}`;
  }

  private removeFromStorage(prefixedKey: string): void {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.removeItem(prefixedKey);
    } catch {
      // ignore
    }
  }

  private clearStorageByPrefix(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          toRemove.push(k);
        }
      }
      for (const k of toRemove) {
        localStorage.removeItem(k);
      }
    } catch {
      // ignore
    }
  }
}
