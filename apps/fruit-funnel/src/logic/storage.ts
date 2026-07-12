import { FruitFunnelEngine, isValidFruitSnapshot } from "./fruit-engine";
import type { FruitSnapshot } from "./fruit-engine";

export interface FruitStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  remove?(key: string): void;
}

export const FRUIT_RUN_STORAGE_KEY = "run:v1";

export function restoreFruitEngine(storage: FruitStorage, now = Date.now()): FruitFunnelEngine | null {
  try {
    const raw = storage.get<unknown>(FRUIT_RUN_STORAGE_KEY, null);
    if (!isValidFruitSnapshot(raw)) return null;
    return FruitFunnelEngine.restore(raw, now);
  } catch {
    return null;
  }
}

export function persistFruitRun(storage: FruitStorage, snapshot: FruitSnapshot): boolean {
  try {
    storage.set(FRUIT_RUN_STORAGE_KEY, snapshot);
    return true;
  } catch {
    return false;
  }
}

export function clearFruitRun(storage: FruitStorage): void {
  try {
    storage.remove?.(FRUIT_RUN_STORAGE_KEY);
  } catch {
    // A blocked storage surface must not block a fresh local round.
  }
}
