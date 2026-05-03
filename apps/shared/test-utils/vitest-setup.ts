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

// Mock uni-app API
global.uni = {
  getStorageSync: vi.fn(() => null),
  setStorageSync: vi.fn(() => true),
  removeStorageSync: vi.fn(() => true),
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
  redirectTo: vi.fn(),
  switchTab: vi.fn(),
  request: vi.fn(),
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
  connectSocket: vi.fn(),
  onSocketOpen: vi.fn(),
  onSocketError: vi.fn(),
  sendSocketMessage: vi.fn(),
  closeSocket: vi.fn(),
  getSystemInfoSync: vi.fn(() => ({
    platform: "h5",
    system: "test",
    brand: "test",
    model: "test",
    screenWidth: 375,
    screenHeight: 667,
  })),
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
