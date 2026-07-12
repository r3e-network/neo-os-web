import { afterEach, describe, expect, it, vi } from "vitest";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("sandbox-safe game storage", () => {
  it("uses native localStorage for standalone play", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", { parent: null });
    const module = await import("./game-storage");
    expect(await module.initializeGameStorage()).toBe("direct");
    module.gameStorage.setItem("zhuada-e:theme", "farm-kitchen");
    expect(storage.getItem("zhuada-e:theme")).toBe("farm-kitchen");
  });

  it("hydrates and writes through the host bridge when direct storage is blocked", async () => {
    vi.stubGlobal("localStorage", undefined);
    let listener: ((event: MessageEvent) => void) | undefined;
    const parent = { postMessage: vi.fn() };
    const fakeWindow = {
      parent,
      addEventListener: (_name: string, next: (event: MessageEvent) => void) => { listener = next; },
      removeEventListener: vi.fn(),
      setTimeout,
      clearTimeout,
    };
    vi.stubGlobal("window", fakeWindow);
    const module = await import("./game-storage");
    const ready = module.initializeGameStorage();
    const request = parent.postMessage.mock.calls[0]?.[0] as { requestId: string };
    listener?.({
      source: parent,
      data: {
        type: "neo-miniapp-storage:response",
        requestId: request.requestId,
        ok: true,
        values: { "zhuada-e:progress": "saved" },
      },
    } as unknown as MessageEvent);

    expect(await ready).toBe("bridged");
    expect(module.gameStorage.getItem("zhuada-e:progress")).toBe("saved");
    module.gameStorage.setItem("zhuada-e:theme", "night-market");
    expect(parent.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      op: "set",
      key: "zhuada-e:theme",
      value: "night-market",
    }), "*");
  });
});
