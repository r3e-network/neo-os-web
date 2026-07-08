/**
 * SafeStorage - Defensive localStorage wrappers.
 *
 * Sandboxed iframes (sandbox="allow-scripts" without allow-same-origin)
 * throw a SecurityError on every localStorage access — the property
 * exists but the getter throws, so optional chaining doesn't help.
 * Quota exhaustion and disabled storage also throw. Wrap every read,
 * write, and remove in try/catch and fail to a sensible default.
 *
 * Use these from miniapp code instead of touching localStorage directly.
 *
 * Canonical home of the helpers formerly duplicated in
 * apps/shared/utils/safe-storage.ts (and the private `localStorageAvailable`
 * re-impl in framework/index.ts) — shared re-exports from here.
 */

/**
 * Return the ambient localStorage, or null when it is unavailable
 * (non-browser runtime, sandboxed iframe, disabled storage). Use this when a
 * caller needs the raw Storage object — e.g. to enumerate keys — and is
 * prepared to handle its absence.
 */
export function localStorageAvailable(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function safeReadStorage(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // sandboxed iframe, disabled storage, or quota error — fall through
  }
  return null;
}

export function safeWriteStorage(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

export function safeRemoveStorage(key: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export function safeReadJSON<T>(key: string): T | null {
  const raw = safeReadStorage(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function safeWriteJSON<T>(key: string, value: T): void {
  try {
    safeWriteStorage(key, JSON.stringify(value));
  } catch {
    // serialization or storage error — ignore
  }
}
