import { SuikaEngine, isValidSuikaSnapshot } from "./suika-engine";
import type { SuikaSnapshot } from "./suika-engine";

export interface FruitStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  remove?(key: string): void;
}

export const SUIKA_RUN_STORAGE_KEY = "run:suika:v1";

export function restoreSuikaEngine(storage: FruitStorage, now = Date.now()): SuikaEngine | null {
  try {
    const raw = storage.get<unknown>(SUIKA_RUN_STORAGE_KEY, null);
    if (!isValidSuikaSnapshot(raw)) return null;
    return SuikaEngine.restore(raw, 0, now);
  } catch {
    return null;
  }
}

export function persistSuikaRun(storage: FruitStorage, snapshot: SuikaSnapshot): boolean {
  try {
    storage.set(SUIKA_RUN_STORAGE_KEY, snapshot);
    return true;
  } catch {
    return false;
  }
}

export function clearSuikaRun(storage: FruitStorage): void {
  try {
    storage.remove?.(SUIKA_RUN_STORAGE_KEY);
  } catch {
    // A blocked storage surface must not block a fresh local round.
  }
}
