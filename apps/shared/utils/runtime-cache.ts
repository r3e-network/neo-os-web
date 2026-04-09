type UniLike = {
  getStorageSync?: (key: string) => unknown;
  setStorageSync?: (key: string, value: string) => unknown;
  removeStorageSync?: (key: string) => unknown;
};

type CacheEnvelope<T> = {
  value: T;
  updatedAt: number;
  expiresAt?: number;
};

function getUni(): UniLike | null {
  const g = globalThis as { uni?: UniLike };
  return g?.uni || null;
}

function safeNow(): number {
  return Date.now();
}

function readRaw(key: string): string | null {
  try {
    const uni = getUni();
    if (uni?.getStorageSync) {
      const value = uni.getStorageSync(key);
      return typeof value === "string" ? value : value == null ? null : String(value);
    }
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore storage read failures
  }
  return null;
}

function writeRaw(key: string, value: string): void {
  try {
    const uni = getUni();
    if (uni?.setStorageSync) {
      uni.setStorageSync(key, value);
      return;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore storage write failures
  }
}

function removeRaw(key: string): void {
  try {
    const uni = getUni();
    if (uni?.removeStorageSync) {
      uni.removeStorageSync(key);
      return;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore storage remove failures
  }
}

export function readCachedJSON<T>(key: string): T | null {
  const raw = readRaw(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeCachedJSON<T>(key: string, value: T): void {
  writeRaw(key, JSON.stringify(value));
}

export function clearCachedValue(key: string): void {
  removeRaw(key);
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
