/**
 * Shared test setup for all miniapps
 * Provides mocked SDK utilities and common test helpers
 */

import { vi } from "vitest";

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
