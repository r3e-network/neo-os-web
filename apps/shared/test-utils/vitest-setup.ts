/**
 * Shared test setup for all miniapps
 * Provides mocked SDK utilities and common test helpers
 */

import { vi } from "vitest";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: vi.fn(() => store.clear()),
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
  };
}

function ensureLocalStorage(): void {
  try {
    const probeKey = "__neo_vitest_storage_probe__";
    globalThis.localStorage.setItem(probeKey, "1");
    globalThis.localStorage.removeItem(probeKey);
  } catch {
    const storage = createMemoryStorage();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
    if (typeof window !== "undefined") {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: storage,
      });
    }
  }
}

ensureLocalStorage();

function ensureResizeObserver(): void {
  if (typeof globalThis.ResizeObserver !== "undefined") return;

  class TestResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: TestResizeObserver,
  });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: TestResizeObserver,
    });
  }
}

ensureResizeObserver();

const canvasContextState: Record<string | symbol, unknown> = {
  canvas: null,
  fillStyle: "#000",
  globalCompositeOperation: "source-over",
  getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
  measureText: (text: string) => ({ width: text.length * 8 }),
};

const canvasContext2d = new Proxy(canvasContextState, {
  get(target, property) {
    if (property in target) {
      return target[property];
    }
    return () => undefined;
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  },
});

function ensureCanvasContext(): void {
  if (typeof HTMLCanvasElement === "undefined") return;

  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value(type: string) {
      if (type === "2d") {
        canvasContextState.canvas = this;
        return canvasContext2d;
      }
      return null;
    },
  });
}

ensureCanvasContext();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
