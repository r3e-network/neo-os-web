/**
 * Mock SDK utilities for testing
 * Provides mock implementations of @neo/uniapp-sdk composables
 */

import { ref, Ref } from "vue";
import type { WalletSDK } from "@neo/types";

// Mock wallet state
const mockAddress = ref("NTestWalletAddress123456789");
const mockChainType = ref("neo-n3-mainnet");

/**
 * Create a mock useWallet composable
 */
export function createMockWallet(): Partial<WalletSDK> {
  return {
    address: mockAddress,
    chainType: mockChainType,
    connect: vi.fn(async () => {
      mockAddress.value = "NTestConnectedWallet";
      return true;
    }),
    disconnect: vi.fn(() => {
      mockAddress.value = "";
    }),
    invokeRead: vi.fn(async ({ scriptHash, operation, args }) => {
      // Mock read contract responses
      if (operation === "GetScratchTicket") {
        return {
          id: args?.[0],
          type: 1,
          purchasedAt: Date.now(),
          isRevealed: false,
        };
      }
      return {};
    }),
    invokeContract: vi.fn(async ({ scriptHash, operation, args }) => {
      // Mock write contract responses
      return {
        txid: "0xmocktransactionid",
        receiptId: "12345",
      };
    }),
    getContractAddress: vi.fn(async () => "0x0000000000000000000000000000000000000000"),
  };
}

/**
 * Create a mock usePayments composable
 */
export function createMockPayments() {
  return {
    payGAS: vi.fn(async (amount: number, memo?: string) => {
      return {
        txid: "0xmockpaymenttx",
        amount,
        memo,
      };
    }),
    isLoading: ref(false),
    error: ref(null),
  };
}

/**
 * Create a mock useRNG composable
 */
export function createMockRNG() {
  return {
    requestRandom: vi.fn(async () => ({
      randomness: Math.random().toString(),
      requestId: "mock-request-id",
    })),
    isLoading: ref(false),
  };
}

/**
 * Create a mock useDatafeed composable
 */
export function createMockDatafeed() {
  return {
    getPrice: vi.fn((symbol: string) => ({
      symbol,
      usd: symbol === "NEO" ? 50 : 5,
      change24h: 2.5,
    })),
    getPrices: vi.fn(() => ({
      neo: { usd: 50, change24h: 2.5 },
      gas: { usd: 5, change24h: 1.2 },
    })),
    getNetworkStats: vi.fn(() => ({
      height: 1000000,
      tps: 5,
      nodes: 10,
    })),
  };
}

/**
 * Create a mock useEvents composable
 */
export function createMockEvents() {
  return {
    emit: vi.fn(async (type: string, data: unknown) => ({
      success: true,
      eventId: "mock-event-id",
    })),
    list: vi.fn(async (filters?: unknown) => [{ id: "1", type: "test", data: {}, timestamp: Date.now() }]),
  };
}

/**
 * Create complete mock SDK for testing
 */
export function createMockSDK() {
  return {
    useWallet: createMockWallet,
    usePayments: createMockPayments,
    useRNG: createMockRNG,
    useDatafeed: createMockDatafeed,
    useEvents: createMockEvents,
  };
}

/**
 * Helper to reset all mocks between tests
 */
export function resetMocks() {
  vi.clearAllMocks();
  mockAddress.value = "NTestWalletAddress123456789";
  mockChainType.value = "neo-n3-mainnet";
}

/**
 * Helper to create mock contract state
 */
export function createMockContractState<T>(initialState: T) {
  return ref(initialState);
}

/**
 * Helper to wait for async operations in tests
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
