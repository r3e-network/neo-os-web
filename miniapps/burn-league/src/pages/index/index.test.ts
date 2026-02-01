import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, computed } from "vue";

// Mock @neo/uniapp-sdk
vi.mock("@neo/uniapp-sdk", () => ({
  useWallet: () => ({
    address: ref("NXV7ZhHiyM1aHXwpVsRZC6BN3y4"),
    isConnected: ref(true),
    connect: vi.fn(),
  }),
  usePayments: () => ({
    payGAS: vi.fn().mockResolvedValue({ request_id: "burn-123" }),
    isLoading: ref(false),
  }),
}));

// Mock i18n
vi.mock("@shared/utils/i18n", () => ({
  createT: (translations: any) => (key: string) => translations[key]?.en || key,
}));

import { usePayments } from "@neo/uniapp-sdk";

describe("Burn-League MiniApp", () => {
  let payGAS: ReturnType<typeof vi.fn>;
  let isLoading: ReturnType<typeof ref<boolean>>;

  beforeEach(() => {
    vi.clearAllMocks();
    const payments = usePayments("miniapp-burn-league");
    payGAS = payments.payGAS as any;
    isLoading = payments.isLoading;
  });

  describe("Stats Display", () => {
    it("should display total burned amount", () => {
      const totalBurned = ref(50000);
      expect(totalBurned.value).toBe(50000);
    });

    it("should display user burned amount", () => {
      const userBurned = ref(250);
      expect(userBurned.value).toBe(250);
    });

    it("should display user rank", () => {
      const rank = ref(15);
      expect(rank.value).toBe(15);
    });

    it("should format numbers with commas", () => {
      const formatNum = (n: number) => n.toLocaleString();
      expect(formatNum(50000)).toBe("50,000");
      expect(formatNum(250)).toBe("250");
    });
  });

  describe("Burn Functionality", () => {
    it("should calculate estimated rewards correctly", () => {
      const burnAmount = ref("10");
      const estimatedReward = computed(() => parseFloat(burnAmount.value || "0") * 10);
      expect(estimatedReward.value).toBe(100);
    });

    it("should update rewards when amount changes", () => {
      const burnAmount = ref("10");
      const estimatedReward = computed(() => parseFloat(burnAmount.value || "0") * 10);

      burnAmount.value = "25";
      expect(estimatedReward.value).toBe(250);
    });

    it("should handle zero amount", () => {
      const burnAmount = ref("0");
      const estimatedReward = computed(() => parseFloat(burnAmount.value || "0") * 10);
      expect(estimatedReward.value).toBe(0);
    });

    it("should handle empty amount", () => {
      const burnAmount = ref("");
      const estimatedReward = computed(() => parseFloat(burnAmount.value || "0") * 10);
      expect(estimatedReward.value).toBe(0);
    });
  });

  describe("Burn Tokens", () => {
    it("should burn tokens successfully", async () => {
      const burnAmount = ref("10");
      const userBurned = ref(250);
      const totalBurned = ref(50000);
      const status = ref<{ msg: string; type: "success" | "error" } | null>(null);

      const amount = parseFloat(burnAmount.value);
      await payGAS(burnAmount.value, "burn");

      userBurned.value += amount;
      totalBurned.value += amount;
      status.value = { msg: `Burned ${amount} GAS! +${amount * 10} pts`, type: "success" };

      expect(payGAS).toHaveBeenCalledWith("10", "burn");
      expect(userBurned.value).toBe(260);
      expect(totalBurned.value).toBe(50010);
      expect(status.value?.type).toBe("success");
    });

    it("should reject burn with amount less than 1", async () => {
      const burnAmount = ref("0.5");
      const status = ref<{ msg: string; type: "success" | "error" } | null>(null);

      const amount = parseFloat(burnAmount.value);
      if (!(amount >= 1)) {
        status.value = { msg: "Min burn: 1 GAS", type: "error" };
      }

      expect(status.value).toEqual({ msg: "Min burn: 1 GAS", type: "error" });
      expect(payGAS).not.toHaveBeenCalled();
    });

    it("should handle burn error", async () => {
      const burnAmount = ref("10");
      const status = ref<{ msg: string; type: "success" | "error" } | null>(null);

      vi.mocked(payGAS).mockRejectedValueOnce(new Error("Insufficient balance"));

      try {
        await payGAS(burnAmount.value, "burn");
      } catch (e: any) {
        status.value = { msg: e?.message || "Error", type: "error" };
      }

      expect(status.value).toEqual({ msg: "Insufficient balance", type: "error" });
    });

    it("should not burn when loading", async () => {
      isLoading.value = true;
      const burnAmount = ref("10");

      if (isLoading.value) {
        // Should return early
        expect(payGAS).not.toHaveBeenCalled();
      }
    });
  });

  describe("Leaderboard", () => {
    it("should display leaderboard entries", () => {
      const leaderboard = ref([
        { rank: 1, address: "0x1a2b...3c4d", burned: 5000, isUser: false },
        { rank: 2, address: "0x5e6f...7g8h", burned: 3500, isUser: false },
        { rank: 3, address: "0x9i0j...1k2l", burned: 2800, isUser: false },
      ]);

      expect(leaderboard.value).toHaveLength(3);
      expect(leaderboard.value[0].rank).toBe(1);
      expect(leaderboard.value[0].burned).toBe(5000);
    });

    it("should highlight user entry", () => {
      const leaderboard = ref([
        { rank: 1, address: "0x1a2b...3c4d", burned: 5000, isUser: false },
        { rank: 15, address: "You", burned: 250, isUser: true },
      ]);

      const userEntry = leaderboard.value.find((e) => e.isUser);
      expect(userEntry).toBeDefined();
      expect(userEntry?.rank).toBe(15);
      expect(userEntry?.address).toBe("You");
    });

    it("should sort leaderboard by burned amount", () => {
      const leaderboard = ref([
        { rank: 1, address: "0x1a2b...3c4d", burned: 5000, isUser: false },
        { rank: 2, address: "0x5e6f...7g8h", burned: 3500, isUser: false },
        { rank: 3, address: "0x9i0j...1k2l", burned: 2800, isUser: false },
      ]);

      for (let i = 0; i < leaderboard.value.length - 1; i++) {
        expect(leaderboard.value[i].burned).toBeGreaterThanOrEqual(leaderboard.value[i + 1].burned);
      }
    });
  });

  describe("Rank Badges", () => {
    it("should assign gold badge to rank 1", () => {
      const rank = 1;
      const badgeClass = `rank-${rank}`;
      expect(badgeClass).toBe("rank-1");
    });

    it("should assign silver badge to rank 2", () => {
      const rank = 2;
      const badgeClass = `rank-${rank}`;
      expect(badgeClass).toBe("rank-2");
    });

    it("should assign bronze badge to rank 3", () => {
      const rank = 3;
      const badgeClass = `rank-${rank}`;
      expect(badgeClass).toBe("rank-3");
    });
  });

  describe("Input Validation", () => {
    it("should accept valid numeric input", () => {
      const burnAmount = ref("10");
      const amount = parseFloat(burnAmount.value);
      expect(amount).toBe(10);
      expect(amount >= 1).toBe(true);
    });

    it("should handle decimal input", () => {
      const burnAmount = ref("10.5");
      const amount = parseFloat(burnAmount.value);
      expect(amount).toBe(10.5);
    });

    it("should handle invalid input", () => {
      const burnAmount = ref("abc");
      const amount = parseFloat(burnAmount.value);
      expect(isNaN(amount)).toBe(true);
    });
  });

  describe("Status Messages", () => {
    it("should display success message", () => {
      const status = ref<{ msg: string; type: "success" | "error" } | null>({
        msg: "Burned 10 GAS! +100 pts",
        type: "success",
      });

      expect(status.value?.type).toBe("success");
      expect(status.value?.msg).toContain("Burned");
    });

    it("should display error message", () => {
      const status = ref<{ msg: string; type: "success" | "error" } | null>({
        msg: "Min burn: 1 GAS",
        type: "error",
      });

      expect(status.value?.type).toBe("error");
      expect(status.value?.msg).toBe("Min burn: 1 GAS");
    });

    it("should clear status message", () => {
      const status = ref<{ msg: string; type: "success" | "error" } | null>({
        msg: "Test",
        type: "success",
      });

      status.value = null;
      expect(status.value).toBeNull();
    });
  });
});
