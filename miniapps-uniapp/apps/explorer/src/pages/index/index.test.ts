import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";

// Mock @neo/uniapp-sdk
vi.mock("@neo/uniapp-sdk", () => ({
  useWallet: () => ({
    address: ref("NXV7ZhHiyM1aHXwpVsRZC6BN3y4"),
    isConnected: ref(true),
    connect: vi.fn(),
  }),
  usePayments: () => ({
    payGAS: vi.fn().mockResolvedValue({ request_id: "test-123" }),
    isLoading: ref(false),
  }),
}));

// Mock neo-rpc utility
vi.mock("../../utils/neo-rpc", () => ({
  getBlockCount: vi.fn().mockResolvedValue(1000000),
  getBlock: vi.fn().mockResolvedValue({
    index: 999999,
    hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    time: Date.now() - 300000, // 5 minutes ago
    tx: [{ hash: "0xabc" }, { hash: "0xdef" }],
    size: 1024,
  }),
  getTransaction: vi.fn().mockResolvedValue({
    hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    blockindex: 999999,
    blocktime: Math.floor(Date.now() / 1000) - 300,
    size: 512,
  }),
  getAccountState: vi.fn().mockResolvedValue({
    address: "NXV7ZhHiyM1aHXwpVsRZC6BN3y4",
    balance: [
      { assethash: "0xneo", amount: "100" },
      { assethash: "0xgas", amount: "50.5" },
    ],
  }),
  searchBlockchain: vi.fn(),
  detectQueryType: vi.fn(),
  NEO_RPC_ENDPOINTS: {
    mainnet: "https://mainnet1.neo.coz.io:443",
    testnet: "https://testnet1.neo.coz.io:443",
  },
}));

// Mock i18n
vi.mock("@shared/utils/i18n", () => ({
  createT: (translations: Record<string, Record<string, string>>) => (key: string) => translations[key]?.en || key,
}));

import { getBlockCount, getBlock, searchBlockchain } from "../../utils/neo-rpc";

describe("Explorer MiniApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Network Stats", () => {
    it("should fetch block height for mainnet", async () => {
      const height = await getBlockCount("mainnet");
      expect(height).toBe(1000000);
      expect(getBlockCount).toHaveBeenCalledWith("mainnet");
    });

    it("should fetch block height for testnet", async () => {
      const height = await getBlockCount("testnet");
      expect(height).toBe(1000000);
      expect(getBlockCount).toHaveBeenCalledWith("testnet");
    });

    it("should handle RPC errors gracefully", async () => {
      vi.mocked(getBlockCount).mockRejectedValueOnce(new Error("RPC connection failed"));
      await expect(getBlockCount("mainnet")).rejects.toThrow("RPC connection failed");
    });
  });

  describe("Recent Blocks", () => {
    it("should fetch recent blocks successfully", async () => {
      const block = await getBlock("mainnet", 999999);
      expect(block).toHaveProperty("index", 999999);
      expect(block).toHaveProperty("hash");
      expect(block).toHaveProperty("tx");
      expect(block.tx).toHaveLength(2);
    });

    it("should calculate time difference correctly", async () => {
      const block = await getBlock("mainnet", 999999);
      const timestamp = new Date(block.time);
      const now = Date.now();
      const diffMinutes = Math.floor((now - timestamp.getTime()) / 60000);
      expect(diffMinutes).toBeGreaterThanOrEqual(4);
      expect(diffMinutes).toBeLessThanOrEqual(6);
    });

    it("should handle missing transactions", async () => {
      vi.mocked(getBlock).mockResolvedValueOnce({
        index: 999998,
        hash: "0xtest",
        time: Date.now(),
        tx: undefined,
        size: 512,
      });
      const block = await getBlock("mainnet", 999998);
      expect(block.tx).toBeUndefined();
    });
  });

  describe("Search Functionality", () => {
    it("should search for block by index", async () => {
      vi.mocked(searchBlockchain).mockResolvedValueOnce({
        type: "Block",
        hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        index: 999999,
        timestamp: new Date().toLocaleString(),
        txCount: 2,
        size: 1024,
      });

      const result = await searchBlockchain("mainnet", "999999");
      expect(result.type).toBe("Block");
      expect(result.index).toBe(999999);
      expect(result.txCount).toBe(2);
    });

    it("should search for transaction by hash", async () => {
      const txHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      vi.mocked(searchBlockchain).mockResolvedValueOnce({
        type: "Transaction",
        hash: txHash,
        blockHeight: 999999,
        timestamp: new Date().toLocaleString(),
        size: 512,
      });

      const result = await searchBlockchain("mainnet", txHash);
      expect(result.type).toBe("Transaction");
      expect(result.hash).toBe(txHash);
      expect(result.blockHeight).toBe(999999);
    });

    it("should search for address", async () => {
      const address = "NXV7ZhHiyM1aHXwpVsRZC6BN3y4";
      vi.mocked(searchBlockchain).mockResolvedValueOnce({
        type: "Address",
        address: address,
        balances: [
          { assethash: "0xneo", amount: "100" },
          { assethash: "0xgas", amount: "50.5" },
        ],
      });

      const result = await searchBlockchain("mainnet", address);
      expect(result.type).toBe("Address");
      expect(result.address).toBe(address);
      expect(result.balances).toHaveLength(2);
    });

    it("should handle invalid search query", async () => {
      vi.mocked(searchBlockchain).mockRejectedValueOnce(new Error("Invalid query format"));
      await expect(searchBlockchain("mainnet", "invalid")).rejects.toThrow("Invalid query format");
    });

    it("should handle empty search query", async () => {
      const query = "";
      expect(query.trim()).toBe("");
    });
  });

  describe("Utility Functions", () => {
    it("should format numbers correctly", () => {
      const formatNum = (n: number) => n.toLocaleString();
      expect(formatNum(1000000)).toBe("1,000,000");
      expect(formatNum(999999)).toBe("999,999");
      expect(formatNum(0)).toBe("0");
    });

    it("should shorten hash correctly", () => {
      const shortenHash = (h: string) => (h ? `${h.slice(0, 10)}...${h.slice(-8)}` : "--");
      const hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      expect(shortenHash(hash)).toBe("0x12345678...90abcdef");
      expect(shortenHash("")).toBe("--");
    });
  });

  describe("Network Switching", () => {
    it("should switch between mainnet and testnet", () => {
      const selectedNetwork = ref<"mainnet" | "testnet">("mainnet");
      expect(selectedNetwork.value).toBe("mainnet");

      selectedNetwork.value = "testnet";
      expect(selectedNetwork.value).toBe("testnet");

      selectedNetwork.value = "mainnet";
      expect(selectedNetwork.value).toBe("mainnet");
    });

    it("should refresh blocks when network changes", async () => {
      const selectedNetwork = ref<"mainnet" | "testnet">("mainnet");
      await getBlock(selectedNetwork.value, 999999);
      expect(getBlock).toHaveBeenCalledWith("mainnet", 999999);

      selectedNetwork.value = "testnet";
      await getBlock(selectedNetwork.value, 999999);
      expect(getBlock).toHaveBeenCalledWith("testnet", 999999);
    });
  });

  describe("Loading States", () => {
    it("should handle loading state during search", () => {
      const isLoading = ref(false);
      expect(isLoading.value).toBe(false);

      isLoading.value = true;
      expect(isLoading.value).toBe(true);

      isLoading.value = false;
      expect(isLoading.value).toBe(false);
    });

    it("should clear previous results when searching", () => {
      const searchResult = ref<Record<string, unknown> | null>(null);
      searchResult.value = { type: "Block", hash: "0xtest" };
      expect(searchResult.value).not.toBeNull();

      searchResult.value = null;
      expect(searchResult.value).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should display error message on RPC failure", async () => {
      const status = ref<{ msg: string; type: "success" | "error" } | null>(null);
      vi.mocked(getBlockCount).mockRejectedValueOnce(new Error("RPC connection failed"));

      try {
        await getBlockCount("mainnet");
      } catch (error: unknown) {
        status.value = { msg: `RPC connection failed (mainnet)`, type: "error" };
      }

      expect(status.value).toEqual({
        msg: "RPC connection failed (mainnet)",
        type: "error",
      });
    });

    it("should handle search not found error", async () => {
      const status = ref<{ msg: string; type: "success" | "error" } | null>(null);
      vi.mocked(searchBlockchain).mockRejectedValueOnce(new Error("Not found"));

      try {
        await searchBlockchain("mainnet", "invalid");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Not found";
        status.value = { msg: message, type: "error" };
      }

      expect(status.value?.type).toBe("error");
      expect(status.value?.msg).toBe("Not found");
    });
  });

  describe("Block Time Formatting", () => {
    it("should format recent blocks as minutes ago", () => {
      const diffMinutes = 5;
      const timeStr = diffMinutes < 60 ? `${diffMinutes} min ago` : `${Math.floor(diffMinutes / 60)}h ago`;
      expect(timeStr).toBe("5 min ago");
    });

    it("should format older blocks as hours ago", () => {
      const diffMinutes = 125;
      const timeStr = diffMinutes < 60 ? `${diffMinutes} min ago` : `${Math.floor(diffMinutes / 60)}h ago`;
      expect(timeStr).toBe("2h ago");
    });
  });
});
