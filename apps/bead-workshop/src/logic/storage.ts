import { BeadEngine, isValidBeadSnapshot } from "./BeadEngine";
import type { BeadSnapshot } from "./types";

export interface BeadStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  remove?(key: string): void;
}

export const RUN_STORAGE_KEY = "run:v1";

export function restoreEngine(
  storage: BeadStorage,
  now = Date.now(),
): BeadEngine | null {
  try {
    const raw = storage.get<unknown>(RUN_STORAGE_KEY, null);
    if (!isValidBeadSnapshot(raw)) return null;
    return BeadEngine.restore(raw, now);
  } catch {
    return null;
  }
}

export function persistEngine(
  storage: BeadStorage,
  snapshot: BeadSnapshot,
): boolean {
  try {
    storage.set(RUN_STORAGE_KEY, snapshot);
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedEngine(storage: BeadStorage): void {
  try {
    storage.remove?.(RUN_STORAGE_KEY);
  } catch {
    // A blocked storage surface must never interrupt a local restart.
  }
}
