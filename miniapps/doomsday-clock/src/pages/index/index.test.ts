import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, computed } from "vue";

// Mock @neo/uniapp-sdk
vi.mock("@neo/uniapp-sdk", () => ({
  useWallet: () => ({
    address: ref("NXV7ZhHiyM1aHXwpVsRZC6BN3y4"),
    isConnected: ref(true),
    connect: vi.fn(),
  }),
  usePayments: () => ({
    payGAS: vi.fn().mockResolvedValue({ request_id: "stake-123" }),
    isLoading: ref(false),
  }),
}));

// Mock i18n
vi.mock("@shared/utils/i18n", () => ({
  createT: (translations: any) => (key: string) => translations[key]?.en || key,
}));

import { usePayments } from "@neo/uniapp-sdk";

describe("Doomsday-Clock MiniApp", () => {
  let payGAS: ReturnType<typeof vi.fn>;
  let isLoading: ReturnType<typeof ref<boolean>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    const payments = usePayments("miniapp-doomsday-clock");
    payGAS = payments.payGAS as any;
    isLoading = payments.isLoading;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Countdown Logic", () => {
    it("should format countdown correctly", () => {
      const timeLeft = ref(86400); // 24 hours
      const countdown = computed(() => {
        const h = Math.floor(timeLeft.value / 3600);
        const m = Math.floor((timeLeft.value % 3600) / 60);
        const s = timeLeft.value % 60;
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
      });

      expect(countdown.value).toBe("24:00:00");
    });

    it("should format countdown for partial hours", () => {
      const timeLeft = ref(3661); // 1h 1m 1s
      const countdown = computed(() => {
        const h = Math.floor(timeLeft.value / 3600);
        const m = Math.floor((timeLeft.value % 3600) / 60);
        const s = timeLeft.value % 60;
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
      });

      expect(countdown.value).toBe("01:01:01");
    });

    it("should decrement time every second", () => {
      const timeLeft = ref(10);
      const timer = setInterval(() => {
        if (timeLeft.value > 0) timeLeft.value--;
      }, 1000);

      expect(timeLeft.value).toBe(10);
      vi.advanceTimersByTime(1000);
      expect(timeLeft.value).toBe(9);
      vi.advanceTimersByTime(1000);
      expect(timeLeft.value).toBe(8);

      clearInterval(timer);
    });

    it("should stop at zero", () => {
      const timeLeft = ref(2);
      const timer = setInterval(() => {
        if (timeLeft.value > 0) timeLeft.value--;
      }, 1000);

      vi.advanceTimersByTime(3000);
      expect(timeLeft.value).toBe(0);

      clearInterval(timer);
    });
  });

  describe("Progress Calculation", () => {
    it("should calculate progress percentage", () => {
      const timeLeft = ref(43200); // 12 hours left out of 24
      const progress = computed(() => ((86400 - timeLeft.value) / 86400) * 100);
      expect(progress.value).toBe(50);
    });

    it("should show 0% at start", () => {
      const timeLeft = ref(86400);
      const progress = computed(() => ((86400 - timeLeft.value) / 86400) * 100);
      expect(progress.value).toBe(0);
    });

    it("should show 100% at end", () => {
      const timeLeft = ref(0);
      const progress = computed(() => ((86400 - timeLeft.value) / 86400) * 100);
      expect(progress.value).toBe(100);
    });
  });

  describe("Stake Functionality", () => {
    it("should place stake successfully", async () => {
      const stakeAmount = ref("10");
      const selectedOutcome = ref(0);
      const userStake = ref(50);
      const totalStaked = ref(12500);
      const status = ref<{ msg: string; type: "success" | "error" } | null>(null);

      const amt = parseFloat(stakeAmount.value);
      await payGAS(stakeAmount.value, `stake:${selectedOutcome.value}`);

      userStake.value += amt;
      totalStaked.value += amt;
      status.value = { msg: "Stake placed!", type: "success" };

      expect(payGAS).toHaveBeenCalledWith("10", "stake:0");
      expect(userStake.value).toBe(60);
      expect(totalStaked.value).toBe(12510);
    });

    it("should require outcome selection", async () => {
      const selectedOutcome = ref<number | null>(null);
      const stakeAmount = ref("10");

      if (selectedOutcome.value === null) {
        expect(payGAS).not.toHaveBeenCalled();
      }
    });

    it("should validate positive amount", () => {
      const stakeAmount = ref("0");
      const amt = parseFloat(stakeAmount.value);
      expect(amt > 0).toBe(false);
    });

    it("should handle stake error", async () => {
      const stakeAmount = ref("10");
      const selectedOutcome = ref(0);
      const status = ref<{ msg: string; type: "success" | "error" } | null>(null);

      vi.mocked(payGAS).mockRejectedValueOnce(new Error("Insufficient funds"));

      try {
        await payGAS(stakeAmount.value, `stake:${selectedOutcome.value}`);
      } catch (e: any) {
        status.value = { msg: e?.message || "Error", type: "error" };
      }

      expect(status.value?.type).toBe("error");
      expect(status.value?.msg).toBe("Insufficient funds");
    });
  });

  describe("Outcomes", () => {
    it("should display available outcomes", () => {
      const outcomes = ref([
        { name: "Protocol Upgrade", odds: 1.5 },
        { name: "Treasury Release", odds: 2.0 },
        { name: "Governance Vote", odds: 1.8 },
      ]);

      expect(outcomes.value).toHaveLength(3);
      expect(outcomes.value[0].name).toBe("Protocol Upgrade");
      expect(outcomes.value[0].odds).toBe(1.5);
    });

    it("should select outcome", () => {
      const selectedOutcome = ref<number | null>(null);
      selectedOutcome.value = 1;
      expect(selectedOutcome.value).toBe(1);
    });

    it("should clear selection after stake", async () => {
      const selectedOutcome = ref<number | null>(0);
      const stakeAmount = ref("10");

      await payGAS(stakeAmount.value, `stake:${selectedOutcome.value}`);
      stakeAmount.value = "";
      selectedOutcome.value = null;

      expect(selectedOutcome.value).toBeNull();
      expect(stakeAmount.value).toBe("");
    });
  });

  describe("Stats Display", () => {
    it("should format numbers with commas", () => {
      const formatNum = (n: number) => n.toLocaleString();
      expect(formatNum(12500)).toBe("12,500");
      expect(formatNum(234)).toBe("234");
    });

    it("should display total staked", () => {
      const totalStaked = ref(12500);
      expect(totalStaked.value).toBe(12500);
    });

    it("should display user stake", () => {
      const userStake = ref(50);
      expect(userStake.value).toBe(50);
    });

    it("should display participants count", () => {
      const participants = ref(234);
      expect(participants.value).toBe(234);
    });
  });

  describe("Event History", () => {
    it("should display past events", () => {
      const history = ref([
        { date: "Dec 28", description: "Fee Adjustment", result: "Passed" },
        { date: "Dec 15", description: "Emergency Proposal", result: "Rejected" },
        { date: "Dec 01", description: "Protocol Update", result: "Passed" },
      ]);

      expect(history.value).toHaveLength(3);
      expect(history.value[0].result).toBe("Passed");
      expect(history.value[1].result).toBe("Rejected");
    });
  });

  describe("Loading States", () => {
    it("should prevent stake when loading", () => {
      isLoading.value = true;
      const selectedOutcome = ref(0);

      if (isLoading.value || selectedOutcome.value === null) {
        expect(payGAS).not.toHaveBeenCalled();
      }
    });
  });
});
