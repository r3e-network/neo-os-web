import { afterEach, describe, expect, it, vi } from "vitest";

interface RulesEnvironment {
  dev: boolean;
  deviceQa?: string;
  search: string;
}

async function loadRules({ dev, deviceQa, search }: RulesEnvironment) {
  vi.stubEnv("DEV", dev);
  vi.stubEnv("VITE_DEVICE_QA", deviceQa);
  vi.stubGlobal("window", { location: { search } });
  vi.resetModules();
  return import("./game-rules");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("query-string tuning safety", () => {
  it("ignores every tuning parameter in a production build", async () => {
    const rules = await loadRules({
      dev: false,
      search: "?score=9999&combo=60000&bonus=1000&timebonus=100&gravity=-4",
    });

    expect(rules.SCORE_PER_MATCH).toBe(10);
    expect(rules.COMBO_WINDOW_MS).toBe(2200);
    expect(rules.COMBO_BONUS_PER_STEP).toBe(8);
    expect(rules.TIME_BONUS_PER_SEC).toBe(2);
    expect(rules.tuneGravity()).toBe(-18);
    expect(rules.tuneGravity(-23)).toBe(-23);
  });

  it("also ignores tuning parameters in the production device-QA build", async () => {
    const rules = await loadRules({
      dev: false,
      deviceQa: "1",
      search: "?deviceQa=1&score=10000&bonus=1000&gravity=-4",
    });

    expect(rules.SCORE_PER_MATCH).toBe(10);
    expect(rules.COMBO_BONUS_PER_STEP).toBe(8);
    expect(rules.tuneGravity()).toBe(-18);
  });

  it("keeps valid URL overrides available in local development", async () => {
    const rules = await loadRules({
      dev: true,
      search: "?score=42&combo=3100&bonus=12&timebonus=4&gravity=-16",
    });

    expect(rules.SCORE_PER_MATCH).toBe(42);
    expect(rules.COMBO_WINDOW_MS).toBe(3100);
    expect(rules.COMBO_BONUS_PER_STEP).toBe(12);
    expect(rules.TIME_BONUS_PER_SEC).toBe(4);
    expect(rules.tuneGravity()).toBe(-16);
  });
});
