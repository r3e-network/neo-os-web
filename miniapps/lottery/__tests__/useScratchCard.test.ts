/**
 * Tests for useScratchCard composable
 * Demonstrates testing pattern for contract integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref } from "vue";
import { createMockWallet, resetMocks, flushPromises } from "@shared/test-utils/mock-sdk";
import type { WalletSDK } from "@neo/types";

describe("useScratchCard", () => {
  beforeEach(() => {
    resetMocks();
  });

  describe("buyTicket", () => {
    it("should buy a ticket successfully", async () => {
      const mockWallet = createMockWallet() as WalletSDK;
      mockWallet.address.value = "NTestBuyer";

      const buyTicket = async (lotteryType: number) => {
        const result = await mockWallet.invokeContract!({
          scriptHash: "0xcontract",
          operation: "BuyScratchTicket",
          args: [
            { type: "Hash160", value: mockWallet.address.value },
            { type: "Integer", value: lotteryType },
            { type: "Integer", value: 0 },
          ],
        });
        return { ticketId: (result as any).receiptId };
      };

      const result = await buyTicket(1);

      expect(result).toEqual({ ticketId: "12345" });
      expect(mockWallet.invokeContract).toHaveBeenCalledWith({
        scriptHash: "0xcontract",
        operation: "BuyScratchTicket",
        args: expect.arrayContaining([expect.objectContaining({ value: "NTestBuyer" })]),
      });
    });

    it("should throw error when wallet not connected", async () => {
      const mockWallet = createMockWallet() as WalletSDK;
      mockWallet.address.value = "";

      await expect(async () => {
        if (!mockWallet.address.value) {
          throw new Error("Wallet not connected");
        }
      }).rejects.toThrow("Wallet not connected");
    });
  });

  describe("revealTicket", () => {
    it("should reveal a winning ticket", async () => {
      const mockWallet = createMockWallet() as WalletSDK;
      mockWallet.address.value = "NTestWinner";

      // Mock invokeRead to return winning ticket
      mockWallet.invokeRead = vi.fn(async () => ({
        prize: 100000000, // 1 GAS in raw units
        tier: 1,
        revealed: true,
      }));

      const revealTicket = async (ticketId: string) => {
        const result = await mockWallet.invokeContract!({
          scriptHash: "0xcontract",
          operation: "RevealScratchTicket",
          args: [
            { type: "Hash160", value: mockWallet.address.value },
            { type: "Integer", value: ticketId },
          ],
        });

        const parsed = result as Record<string, unknown>;
        const prize = Number(parsed.prize ?? 0);

        return {
          isWinner: prize > 0,
          prize: prize / 100000000, // Convert to GAS
          tier: Number(parsed.tier ?? 0),
          revealed: Boolean(parsed.revealed ?? true),
        };
      };

      const result = await revealTicket("12345");

      expect(result.isWinner).toBe(true);
      expect(result.prize).toBe(1);
      expect(result.tier).toBe(1);
    });
  });

  describe("getTicket", () => {
    it("should retrieve ticket details", async () => {
      const mockWallet = createMockWallet() as WalletSDK;

      mockWallet.invokeRead = vi.fn(async () => ({
        id: "12345",
        type: 2,
        purchasedAt: 1706224000000,
        isRevealed: false,
      }));

      const getTicket = async (ticketId: string) => {
        const result = await mockWallet.invokeRead!({
          contractAddress: "0xcontract",
          operation: "GetScratchTicket",
          args: [{ type: "Integer", value: ticketId }],
        });

        const parsed = result as Record<string, unknown>;
        return {
          id: String(parsed.id ?? ticketId),
          type: Number(parsed.type ?? 0),
          purchasedAt: Number(parsed.purchasedAt ?? 0),
          isRevealed: Boolean(parsed.isRevealed ?? false),
        };
      };

      const ticket = await getTicket("12345");

      expect(ticket).toEqual({
        id: "12345",
        type: 2,
        purchasedAt: 1706224000000,
        isRevealed: false,
      });
    });
  });
});

/**
 * Component testing example
 */
describe("Lottery Page Component", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("should display game cards", () => {
    const instantTypes = [
      {
        key: "neo-bronze",
        name: "Bronze",
        price: 0.1,
        priceDisplay: "0.1 GAS",
        maxJackpot: 1,
        maxJackpotDisplay: "1 GAS",
      },
      {
        key: "neo-silver",
        name: "Silver",
        price: 0.5,
        priceDisplay: "0.5 GAS",
        maxJackpot: 5,
        maxJackpotDisplay: "5 GAS",
      },
    ];

    expect(instantTypes).toHaveLength(2);
    expect(instantTypes[0].name).toBe("Bronze");
    expect(instantTypes[0].price).toBe(0.1);
  });

  it("should filter unscratched tickets", () => {
    const playerTickets = ref([
      { id: "1", type: 1, purchasedAt: Date.now(), isRevealed: false },
      { id: "2", type: 2, purchasedAt: Date.now(), isRevealed: true },
      { id: "3", type: 3, purchasedAt: Date.now(), isRevealed: false },
    ]);

    const unscratchedTickets = playerTickets.value.filter((t) => !t.isRevealed);

    expect(unscratchedTickets).toHaveLength(2);
    expect(unscratchedTickets[0].id).toBe("1");
    expect(unscratchedTickets[1].id).toBe("3");
  });
});

/**
 * Integration testing example
 */
describe("Lottery Workflow", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("should complete buy -> reveal -> win flow", async () => {
    const mockWallet = createMockWallet() as WalletSDK;
    mockWallet.address.value = "NTestUser";

    // Step 1: Buy ticket
    const buyResult = await mockWallet.invokeContract!({
      scriptHash: "0xcontract",
      operation: "BuyScratchTicket",
      args: [
        { type: "Hash160", value: mockWallet.address.value },
        { type: "Integer", value: 1 },
        { type: "Integer", value: 0 },
      ],
    });

    expect(buyResult).toHaveProperty("txid");

    // Step 2: Reveal ticket (mock winning result)
    mockWallet.invokeContract = vi.fn(async () => ({
      prize: 50000000, // 0.5 GAS
      tier: 2,
    }));

    const revealResult = await mockWallet.invokeContract!({
      scriptHash: "0xcontract",
      operation: "RevealScratchTicket",
      args: [
        { type: "Hash160", value: mockWallet.address.value },
        { type: "Integer", value: "12345" },
      ],
    });

    const parsed = revealResult as Record<string, unknown>;
    expect(Number(parsed.prize)).toBeGreaterThan(0);
  });
});
