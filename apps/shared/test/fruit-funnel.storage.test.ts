import { describe, expect, it, vi } from "vitest";

import { FruitFunnelEngine } from "../../fruit-funnel/src/logic/fruit-engine";
import {
  FRUIT_RUN_STORAGE_KEY,
  clearFruitRun,
  persistFruitRun,
  restoreFruitEngine,
} from "../../fruit-funnel/src/logic/storage";

describe("Fruit Funnel storage recovery", () => {
  it("restores a valid active run paused", () => {
    const snapshot = FruitFunnelEngine.fresh(42, 1, 1_000).snapshot(2_000);
    const storage = {
      get: vi.fn(() => snapshot),
      set: vi.fn(),
      remove: vi.fn(),
    };
    const restored = restoreFruitEngine(storage, 999_000);
    expect(storage.get).toHaveBeenCalledWith(FRUIT_RUN_STORAGE_KEY, null);
    expect(restored?.snapshot(999_000).phase).toBe("paused");
  });

  it("fails closed for malformed snapshots and blocked reads", () => {
    expect(restoreFruitEngine({ get: () => ({ version: 1 }), set: () => undefined })).toBeNull();
    expect(restoreFruitEngine({ get: () => { throw new Error("blocked"); }, set: () => undefined })).toBeNull();
  });

  it("reports failed writes and tolerates blocked removal", () => {
    const snapshot = FruitFunnelEngine.fresh(7, 1, 1_000).snapshot(1_000);
    expect(persistFruitRun({ get: () => null, set: () => { throw new Error("quota"); } }, snapshot)).toBe(false);
    expect(() => clearFruitRun({
      get: () => null,
      set: () => undefined,
      remove: () => { throw new Error("blocked"); },
    })).not.toThrow();
  });
});
