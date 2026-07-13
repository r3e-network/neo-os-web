import { afterEach, describe, expect, it, vi } from "vitest";

const HAPTICS_KEY = "zhuada-e:haptics-off";

function makeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => { map.set(key, String(value)); },
    removeItem: (key: string) => { map.delete(key); },
    clear: () => { map.clear(); },
    key: () => null,
    get length() { return map.size; },
  } as Storage;
}

async function freshHaptics(opts: {
  storedOff?: boolean;
  unsupported?: boolean;
  throws?: boolean;
} = {}) {
  const calls: unknown[] = [];
  const storage = makeStorage(opts.storedOff ? { [HAPTICS_KEY]: "1" } : {});
  const vibrate = vi.fn((pattern: VibratePattern) => {
    calls.push(pattern);
    if (opts.throws) throw new Error("gesture required");
    return true;
  });

  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("navigator", opts.unsupported ? {} : { vibrate });
  vi.resetModules();
  const mod = await import("./haptics");
  return { haptics: mod.haptics, calls, storage, vibrate };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("haptics feedback engine", () => {
  it("maps every gameplay cue to the intended vibration pattern", async () => {
    const { haptics, calls } = await freshHaptics();

    haptics.play("pick");
    haptics.play("match");
    haptics.play("win");
    haptics.play("jam");
    haptics.play("fail");
    haptics.play("shake");

    expect(calls).toEqual([
      10,
      30,
      [30, 50, 80],
      [55, 35, 90],
      100,
      [18, 35, 28],
    ]);
  });

  it("persists the off state and cancels any in-flight vibration when disabled", async () => {
    const { haptics, calls, storage } = await freshHaptics();

    haptics.setEnabled(false);
    haptics.play("pick");

    expect(haptics.enabled).toBe(false);
    expect(storage.getItem(HAPTICS_KEY)).toBe("1");
    expect(calls).toEqual([0]);
  });

  it("restores a stored off preference before gameplay starts", async () => {
    const { haptics, calls } = await freshHaptics({ storedOff: true });

    expect(haptics.enabled).toBe(false);
    expect(haptics.qaSnapshot()).toEqual({ supported: true, enabled: false });
    haptics.play("win");
    expect(calls).toEqual([]);
  });

  it("silently degrades on unsupported browsers such as iOS Safari", async () => {
    const { haptics } = await freshHaptics({ unsupported: true });

    expect(haptics.supported).toBe(false);
    expect(haptics.qaSnapshot()).toEqual({ supported: false, enabled: true });
    expect(() => haptics.play("shake")).not.toThrow();
    expect(() => haptics.setEnabled(false)).not.toThrow();
  });

  it("never lets a browser vibration exception break gameplay", async () => {
    const { haptics } = await freshHaptics({ throws: true });

    expect(() => haptics.play("match")).not.toThrow();
    expect(() => haptics.setEnabled(false)).not.toThrow();
  });
});
