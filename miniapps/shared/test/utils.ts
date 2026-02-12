/**
 * Shared Test Utilities for Miniapps
 *
 * Provides common testing utilities, mocks, and helpers
 * for unit and integration testing of miniapps.
 *
 * @example
 * ```ts
 * import { mockWallet, renderWithSetup, waitForEvent } from "@shared/test/utils";
 * ```
 */

import { vi, beforeEach, expect } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";

// ============================================================
// MOCKS
// ============================================================

/**
 * Mock wallet SDK for testing
 *
 * @example
 * ```ts
 * const wallet = mockWallet({
 *   address: "Nxyz...",
 *   chainType: "neo-n3"
 * });
 * ```
 */
export function mockWallet(
  options: {
    address?: string;
    chainType?: "neo-n3";
    connected?: boolean;
  } = {}
) {
  const { address = "NTestWalletAddress1234567890", chainType = "neo-n3", connected = true } = options;

  const mockConnect = vi.fn().mockResolvedValue(undefined);
  const mockInvokeContract = vi.fn().mockResolvedValue({
    txid: "0x" + Math.random().toString(16).slice(2),
  });
  const mockInvokeRead = vi.fn().mockResolvedValue(null);
  const mockGetContractAddress = vi
    .fn()
    .mockResolvedValue("0x" + Math.random().toString(16).slice(2).padStart(40, "0"));
  const mockSwitchToAppChain = vi.fn().mockResolvedValue(undefined);

  return {
    address: ref(connected ? address : null),
    chainType: ref(chainType),
    connect: mockConnect,
    invokeContract: mockInvokeContract,
    invokeRead: mockInvokeRead,
    getContractAddress: mockGetContractAddress,
    switchToAppChain: mockSwitchToAppChain,

    // Test helpers
    __mocks: {
      connect: mockConnect,
      invokeContract: mockInvokeContract,
      invokeRead: mockInvokeRead,
      getContractAddress: mockGetContractAddress,
      switchToAppChain: mockSwitchToAppChain,
    },
  };
}

/**
 * Mock payments SDK for testing
 *
 * @example
 * ```ts
 * const payments = mockPayments({
 *   receiptId: "test-receipt-123"
 * });
 * ```
 */
export function mockPayments(
  options: {
    receiptId?: string;
    isLoading?: boolean;
  } = {}
) {
  const { receiptId = "test-receipt-" + Math.random().toString(36), isLoading = false } = options;

  const mockPayGAS = vi.fn().mockResolvedValue({
    request_id: "test-request-" + Math.random().toString(36),
    receipt_id: receiptId,
  });

  return {
    payGAS: mockPayGAS,
    isLoading: ref(isLoading),

    __mocks: {
      payGAS: mockPayGAS,
    },
  };
}

/**
 * Mock events SDK for testing
 *
 * @example
 * ```ts
 * const events = mockEvents({
 *   events: [{ event_name: "TestEvent", tx_hash: "0x123" }]
 * });
 * ```
 */
export function mockEvents(
  options: {
    events?: Array<{ event_name: string; tx_hash: string; state: unknown[] }>;
  } = {}
) {
  const { events = [] } = options;

  const mockList = vi.fn().mockResolvedValue({ events });

  return {
    list: mockList,

    __mocks: {
      list: mockList,
    },
  };
}

/**
 * Mock i18n for testing
 *
 * @example
 * ```ts
 * const i18n = mockI18n({
 *   messages: { title: { en: "Test", zh: "测试" } }
 * });
 * ```
 */
export function mockI18n(
  options: {
    messages?: Record<string, { en: string; zh: string }>;
    language?: "en" | "zh";
  } = {}
) {
  const { messages = {}, language = "en" } = options;

  const mockT = vi.fn((key: string) => {
    const msg = messages[key];
    return msg ? msg[language] || msg.en : key;
  });

  return {
    t: mockT,
    language: ref(language),

    __mocks: {
      t: mockT,
    },
  };
}

// ============================================================
// COMPONENT RENDERING
// ============================================================

/**
 * Render a component with standard setup
 *
 * @example
 * ```ts
 * const { wrapper } = renderWithSetup({
 *   wallet: mockWallet(),
 *   i18n: mockI18n()
 * });
 *
 * const wrapper = mount(MyComponent, { wrapper });
 * ```
 */
export function renderWithSetup(
  mocks: {
    wallet?: ReturnType<typeof mockWallet>;
    payments?: ReturnType<typeof mockPayments>;
    events?: ReturnType<typeof mockEvents>;
    i18n?: ReturnType<typeof mockI18n>;
  } = {}
) {
  const { wallet = mockWallet(), payments = mockPayments(), events = mockEvents(), i18n = mockI18n() } = mocks;

  // Setup global mocks
  vi.mock("@neo/uniapp-sdk", () => ({
    useWallet: () => wallet,
    usePayments: () => payments,
    useEvents: () => events,
  }));

  vi.mock("@/composables/useI18n", () => ({
    useI18n: () => i18n,
  }));

  return {
    wallet,
    payments,
    events,
    i18n,
  };
}

/**
 * Create a wrapper with providers
 *
 * @example
 * ```ts
 * const wrapper = createWrapper();
 * const mounted = mount(Component, { wrapper });
 * ```
 */
export function createWrapper() {
  return {
    // Add any global providers here
  };
}

// ============================================================
// ASYNC HELPERS
// ============================================================

/**
 * Wait for a condition to be true
 *
 * @example
 * ```ts
 * await waitFor(() => wrapper.vm.isLoading === false);
 * ```
 */
export async function waitFor(
  condition: () => boolean,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Wait for next tick
 *
 * @example
 * ```ts
 * await nextTick();
 * expect(wrapper.vm.count).toBe(1);
 * ```
 */
export async function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Wait for async updates
 *
 * @example
 * ```ts
 * await flushPromises();
 * expect(mockFn).toHaveBeenCalled();
 * ```
 */
export async function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 100));
}

// ============================================================
// ASSERTION HELPERS
// ============================================================

/**
 * Assert that an element contains text
 *
 * @example
 * ```ts
 * expectText(wrapper, ".status", "Success");
 * ```
 */
export function expectText(wrapper: ReturnType<typeof mount>, selector: string, text: string) {
  const element = wrapper.find(selector);
  expect(element.exists()).toBe(true);
  expect(element.text()).toContain(text);
}

/**
 * Assert that an element exists
 *
 * @example
 * ```ts
 * expectElement(wrapper, ".submit-button");
 * ```
 */
export function expectElement(wrapper: ReturnType<typeof mount>, selector: string) {
  const element = wrapper.find(selector);
  expect(element.exists()).toBe(true);
}

/**
 * Assert that an element is disabled
 *
 * @example
 * ```ts
 * expectDisabled(wrapper, ".submit-button");
 * ```
 */
export function expectDisabled(wrapper: ReturnType<typeof mount>, selector: string) {
  const element = wrapper.find(selector);
  expect(element.exists()).toBe(true);
  expect(element.attributes("disabled")).toBeDefined();
}

// ============================================================
// DATA FIXTURES
// ============================================================

/**
 * Create mock transaction data
 *
 * @example
 * ```ts
 * const tx = mockTx({ txid: "0x123", amount: "1.5" });
 * ```
 */
export function mockTx(
  options: {
    txid?: string;
    from?: string;
    to?: string;
    amount?: string;
    asset?: string;
  } = {}
) {
  const {
    txid = "0x" + Math.random().toString(16).slice(2).padStart(64, "0"),
    from = "N" + "1".repeat(32) + " blockchain",
    to = "N" + "2".repeat(32) + " " + "blockchain",
    amount = "1.0",
    asset = "GAS",
  } = options;

  return {
    txid,
    from,
    to,
    amount,
    asset,
    timestamp: Date.now(),
    block: 1000 + Math.floor(Math.random() * 1000),
  };
}

/**
 * Create mock event data
 *
 * @example
 * ```ts
 * const event = mockEvent({ event_name: "BetPlaced" });
 * ```
 */
export function mockEvent(
  options: {
    event_name?: string;
    tx_hash?: string;
    state?: unknown[];
  } = {}
) {
  const {
    event_name = "TestEvent",
    tx_hash = "0x" + Math.random().toString(16).slice(2).padStart(64, "0"),
    state = [],
  } = options;

  return {
    event_name,
    tx_hash,
    state,
    timestamp: Date.now(),
    notifications: [],
  };
}

// ============================================================
// TEST SETUP
// ============================================================

/**
 * Setup common test mocks
 *
 * Call this in beforeEach() to set up all mocks
 *
 * @example
 * ```ts
 * describe("MyFeature", () => {
 *   beforeEach(() => {
 *     setupMocks();
 *   });
 * });
 * ```
 */
export function setupMocks() {
  vi.clearAllMocks();

  // Setup wallet mock
  vi.mock("@neo/uniapp-sdk", () => ({
    useWallet: () => mockWallet(),
    usePayments: () => mockPayments(),
    useEvents: () => mockEvents(),
  }));

  // Setup i18n mock
  vi.mock("@/composables/useI18n", () => ({
    useI18n: () => mockI18n(),
  }));
}

/**
 * Clear all mocks
 *
 * Call this in afterEach() to clean up
 *
 * @example
 * ```ts
 * afterEach(() => {
 *   cleanupMocks();
 * });
 * ```
 */
export function cleanupMocks() {
  vi.restoreAllMocks();
}
