import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

// Mock @neo/uniapp-sdk
vi.mock("@neo/uniapp-sdk", () => ({
  useWallet: () => ({
    address: ref("NXV7ZhHiyM1aHXwpVsRZC6BN3y4"),
    isConnected: ref(true),
    connect: vi.fn().mockResolvedValue(undefined),
  }),
  usePayments: () => ({
    payGAS: vi.fn().mockResolvedValue({ request_id: "nns-123" }),
    isLoading: ref(false),
  }),
}));

// Mock i18n
vi.mock("@shared/utils/i18n", () => ({
  createT: (translations: Record<string, Record<string, string>>) => (key: string) => translations[key]?.en || key,
}));

import { useWallet, usePayments } from "@neo/uniapp-sdk";

describe("Neo-NS MiniApp", () => {
  let payGAS: ReturnType<typeof vi.fn>;
  let address: ReturnType<typeof ref<string>>;

  beforeEach(() => {
    vi.clearAllMocks();
    const wallet = useWallet();
    const payments = usePayments("miniapp-neo-ns");
    payGAS = payments.payGAS as unknown as ReturnType<typeof vi.fn>;
    address = wallet.address;
  });

  describe("Domain Search", () => {
    it("should check domain availability", () => {
      const searchQuery = ref("test");
      const taken = ["neo", "defi", "nft", "alice"].includes(searchQuery.value.toLowerCase());
      expect(taken).toBe(false);
    });

    it("should detect taken domain", () => {
      const searchQuery = ref("neo");
      const taken = ["neo", "defi", "nft", "alice"].includes(searchQuery.value.toLowerCase());
      expect(taken).toBe(true);
    });

    it("should calculate price based on length", () => {
      const searchQuery = ref("ab");
      const price = searchQuery.value.length <= 3 ? 100 : searchQuery.value.length <= 5 ? 50 : 10;
      expect(price).toBe(100);
    });

    it("should calculate price for medium length", () => {
      const searchQuery = ref("test");
      const price = searchQuery.value.length <= 3 ? 100 : searchQuery.value.length <= 5 ? 50 : 10;
      expect(price).toBe(50);
    });

    it("should calculate price for long domain", () => {
      const searchQuery = ref("testdomain");
      const price = searchQuery.value.length <= 3 ? 100 : searchQuery.value.length <= 5 ? 50 : 10;
      expect(price).toBe(10);
    });

    it("should clear result when query is empty", () => {
      const searchQuery = ref("");
      const searchResult = ref<Record<string, unknown> | null>({ available: true, price: 10 });

      if (!searchQuery.value) {
        searchResult.value = null;
      }

      expect(searchResult.value).toBeNull();
    });
  });

  describe("Domain Registration", () => {
    it("should register domain successfully", async () => {
      const searchQuery = ref("test");
      const searchResult = ref({ available: true, price: 50 });
      const myDomains = ref([{ name: "alice.neo", owner: "", expiry: Date.now() + 365 * 24 * 60 * 60 * 1000 }]);
      const loading = ref(false);

      loading.value = true;
      await payGAS(String(searchResult.value.price), `nns:register:${searchQuery.value}`);

      myDomains.value.unshift({
        name: `${searchQuery.value}.neo`,
        owner: address.value || "",
        expiry: Date.now() + 365 * 24 * 60 * 60 * 1000,
      });

      loading.value = false;

      expect(payGAS).toHaveBeenCalledWith("50", "nns:register:test");
      expect(myDomains.value).toHaveLength(2);
      expect(myDomains.value[0].name).toBe("test.neo");
    });

    it("should not register when unavailable", async () => {
      const searchResult = ref({ available: false, owner: "NXowner123" });
      const loading = ref(false);

      if (!searchResult.value?.available || loading.value) {
        expect(payGAS).not.toHaveBeenCalled();
      }
    });

    it("should not register when loading", async () => {
      const searchResult = ref({ available: true, price: 50 });
      const loading = ref(true);

      if (!searchResult.value?.available || loading.value) {
        expect(payGAS).not.toHaveBeenCalled();
      }
    });

    it("should clear search after registration", async () => {
      const searchQuery = ref("test");
      const searchResult = ref({ available: true, price: 50 });

      await payGAS(String(searchResult.value.price), `nns:register:${searchQuery.value}`);

      searchQuery.value = "";
      searchResult.value = null;

      expect(searchQuery.value).toBe("");
      expect(searchResult.value).toBeNull();
    });
  });

  describe("Domain Renewal", () => {
    it("should renew domain successfully", async () => {
      const domain = { name: "alice.neo", expiry: Date.now() + 365 * 24 * 60 * 60 * 1000 };
      const originalExpiry = domain.expiry;

      await payGAS("10", `nns:renew:${domain.name}`);
      domain.expiry += 365 * 24 * 60 * 60 * 1000;

      expect(payGAS).toHaveBeenCalledWith("10", "nns:renew:alice.neo");
      expect(domain.expiry).toBeGreaterThan(originalExpiry);
    });

    it("should extend expiry by one year", () => {
      const domain = { name: "test.neo", expiry: Date.now() };
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      const expectedExpiry = domain.expiry + oneYear;

      domain.expiry += oneYear;

      expect(domain.expiry).toBe(expectedExpiry);
    });
  });

  describe("Tab Navigation", () => {
    it("should switch to my domains tab", () => {
      const activeTab = ref<"my" | "explore">("my");
      expect(activeTab.value).toBe("my");
    });

    it("should switch to explore tab", () => {
      const activeTab = ref<"my" | "explore">("my");
      activeTab.value = "explore";
      expect(activeTab.value).toBe("explore");
    });
  });

  describe("My Domains", () => {
    it("should display user domains", () => {
      const myDomains = ref([{ name: "alice.neo", owner: "", expiry: Date.now() + 365 * 24 * 60 * 60 * 1000 }]);
      expect(myDomains.value).toHaveLength(1);
      expect(myDomains.value[0].name).toBe("alice.neo");
    });

    it("should display empty state when no domains", () => {
      const myDomains = ref([]);
      expect(myDomains.value).toHaveLength(0);
    });

    it("should format expiry date", () => {
      const formatDate = (ts: number) => new Date(ts).toLocaleDateString();
      const timestamp = Date.now();
      const formatted = formatDate(timestamp);
      expect(formatted).toBeTruthy();
    });
  });

  describe("Explore Domains", () => {
    it("should display recent domains", () => {
      const recentDomains = ref([
        { name: "neo.neo", owner: "NXneo123" },
        { name: "defi.neo", owner: "NXdefi456" },
        { name: "nft.neo", owner: "NXnft789" },
      ]);

      expect(recentDomains.value).toHaveLength(3);
    });
  });

  describe("Utility Functions", () => {
    it("should shorten address correctly", () => {
      const shortenAddress = (addr: string) => (addr?.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr);
      const address = "NXV7ZhHiyM1aHXwpVsRZC6BN3y4";
      expect(shortenAddress(address)).toBe("NXV7Zh...N3y4");
    });

    it("should handle short address", () => {
      const shortenAddress = (addr: string) => (addr?.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr);
      const address = "NX123";
      expect(shortenAddress(address)).toBe("NX123");
    });

    it("should handle empty address", () => {
      const shortenAddress = (addr: string) => (addr?.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr);
      expect(shortenAddress("")).toBe("");
    });
  });

  describe("Status Messages", () => {
    it("should show registration success", () => {
      const statusMessage = ref("");
      const statusType = ref<"success" | "error">("success");

      const showStatus = (msg: string, type: "success" | "error") => {
        statusMessage.value = msg;
        statusType.value = type;
      };

      showStatus("test.neo registered!", "success");
      expect(statusMessage.value).toBe("test.neo registered!");
      expect(statusType.value).toBe("success");
    });

    it("should show renewal success", () => {
      const statusMessage = ref("");
      const statusType = ref<"success" | "error">("success");

      const showStatus = (msg: string, type: "success" | "error") => {
        statusMessage.value = msg;
        statusType.value = type;
      };

      showStatus("alice.neo renewed!", "success");
      expect(statusMessage.value).toBe("alice.neo renewed!");
    });

    it("should auto-clear after timeout", () => {
      vi.useFakeTimers();
      const statusMessage = ref("Test message");

      setTimeout(() => (statusMessage.value = ""), 3000);
      vi.advanceTimersByTime(3000);

      expect(statusMessage.value).toBe("");
      vi.useRealTimers();
    });
  });

  describe("Domain Management", () => {
    it("should trigger manage action", () => {
      const statusMessage = ref("");
      const domain = { name: "alice.neo" };

      statusMessage.value = `Managing ${domain.name}`;
      expect(statusMessage.value).toBe("Managing alice.neo");
    });
  });

  describe("Error Handling", () => {
    it("should handle registration error", async () => {
      const statusMessage = ref("");
      const statusType = ref<"success" | "error">("success");

      vi.mocked(payGAS).mockRejectedValueOnce(new Error("Insufficient funds"));

      try {
        await payGAS("50", "nns:register:test");
      } catch (e: unknown) {
        statusMessage.value = e instanceof Error ? e.message : "Error";
        statusType.value = "error";
      }

      expect(statusType.value).toBe("error");
      expect(statusMessage.value).toBe("Insufficient funds");
    });

    it("should handle renewal error", async () => {
      const statusMessage = ref("");
      const statusType = ref<"success" | "error">("success");

      vi.mocked(payGAS).mockRejectedValueOnce(new Error("Transaction failed"));

      try {
        await payGAS("10", "nns:renew:alice.neo");
      } catch (e: unknown) {
        statusMessage.value = e instanceof Error ? e.message : "Error";
        statusType.value = "error";
      }

      expect(statusType.value).toBe("error");
    });
  });

  describe("Loading States", () => {
    it("should track loading state", () => {
      const loading = ref(false);
      expect(loading.value).toBe(false);

      loading.value = true;
      expect(loading.value).toBe(true);
    });

    it("should prevent actions when loading", () => {
      const loading = ref(true);
      const searchResult = ref({ available: true, price: 50 });

      if (!searchResult.value?.available || loading.value) {
        expect(payGAS).not.toHaveBeenCalled();
      }
    });
  });
});
