import { describe, expect, it, vi } from "vitest";

import { SuikaEngine } from "../../fruit-funnel/src/logic/suika-engine";
import {
  SUIKA_RUN_STORAGE_KEY,
  clearSuikaRun,
  persistSuikaRun,
  restoreSuikaEngine,
} from "../../fruit-funnel/src/logic/storage";

describe("Fruit Funnel Suika storage recovery", () => {
  it("restores a valid active run paused", () => {
    const snapshot = SuikaEngine.fresh(42, 4, 1_000).snapshot(2_000);
    const storage = {
      get: vi.fn(() => snapshot),
      set: vi.fn(),
      remove: vi.fn(),
    };
    const restored = restoreSuikaEngine(storage, 999_000);
    expect(storage.get).toHaveBeenCalledWith(SUIKA_RUN_STORAGE_KEY, null);
    expect(restored?.snapshot(999_000).phase).toBe("paused");
  });

  it("fails closed for malformed snapshots and blocked reads", () => {
    expect(restoreSuikaEngine({ get: () => ({ version: 1 }), set: () => undefined })).toBeNull();
    expect(
      restoreSuikaEngine({
        get: () => {
          throw new Error("blocked");
        },
        set: () => undefined,
      }),
    ).toBeNull();
  });

  it("reports failed writes and tolerates blocked removal", () => {
    const snapshot = SuikaEngine.fresh(7, 0, 1_000).snapshot(1_000);
    expect(persistSuikaRun({ get: () => null, set: () => undefined }, snapshot)).toBe(true);
    expect(
      persistSuikaRun(
        {
          get: () => null,
          set: () => {
            throw new Error("quota");
          },
        },
        snapshot,
      ),
    ).toBe(false);
    expect(() =>
      clearSuikaRun({
        get: () => null,
        set: () => undefined,
        remove: () => {
          throw new Error("blocked");
        },
      }),
    ).not.toThrow();
  });
});
