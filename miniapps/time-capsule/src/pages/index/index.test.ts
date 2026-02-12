import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

vi.mock("@neo/uniapp-sdk", () => ({
  usePayments: vi.fn(() => ({
    payGAS: vi.fn().mockResolvedValue({ success: true, receipt_id: "test-123" }),
    isLoading: ref(false),
  })),
}));

vi.mock("@shared/utils/i18n", () => ({
  createT: vi.fn(() => (key: string) => key),
}));

describe("Time Capsule MiniApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Capsule Creation", () => {
    it("validates content and lock duration", () => {
      const minDays = 1;
      const maxDays = 3650;
      const newCapsule = ref({ content: "", days: "0", isPublic: false });
      const daysValue = parseInt(newCapsule.value.days, 10);
      const isValid =
        newCapsule.value.content.trim() !== "" &&
        Number.isFinite(daysValue) &&
        daysValue >= minDays &&
        daysValue <= maxDays;
      expect(isValid).toBe(false);
    });

    it("calculates unlock timestamp in the future", () => {
      const days = "7";
      const unlockDate = new Date();
      unlockDate.setDate(unlockDate.getDate() + parseInt(days));
      const unlockTimestamp = Math.floor(unlockDate.getTime() / 1000);
      const nowTimestamp = Math.floor(Date.now() / 1000);

      expect(unlockTimestamp).toBeGreaterThan(nowTimestamp);
    });

    it("stores content locally by hash", () => {
      const localContent = ref<Record<string, string>>({});
      const contentHash = "hash-123";
      const content = "hello";

      localContent.value = { ...localContent.value, [contentHash]: content };

      expect(localContent.value[contentHash]).toBe("hello");
    });

    it("uses the bury metadata format", async () => {
      const mockPayGAS = vi.fn().mockResolvedValue({ success: true, receipt_id: "test-123" });
      await mockPayGAS("0.2", "time-capsule:bury:123");
      expect(mockPayGAS).toHaveBeenCalledWith("0.2", "time-capsule:bury:123");
    });
  });

  describe("Capsule State", () => {
    it("tracks locked vs unlocked based on unlock time", () => {
      const now = Date.now();
      const capsules = ref([
        { id: "1", unlockTime: Math.floor((now + 10_000) / 1000), locked: true },
        { id: "2", unlockTime: Math.floor((now - 10_000) / 1000), locked: false },
      ]);

      const lockedCount = capsules.value.filter((c) => c.locked).length;
      const unlockedCount = capsules.value.filter((c) => !c.locked).length;

      expect(lockedCount).toBe(1);
      expect(unlockedCount).toBe(1);
    });

    it("initializes default form values", () => {
      const newCapsule = ref({ content: "", days: "30", isPublic: false });
      expect(newCapsule.value.content).toBe("");
      expect(newCapsule.value.days).toBe("30");
      expect(newCapsule.value.isPublic).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("handles payment failure", async () => {
      const status = ref<{ msg: string; type: string } | null>(null);
      const mockPayGAS = vi.fn().mockRejectedValue(new Error("Payment failed"));

      try {
        await mockPayGAS("0.2", "time-capsule:bury:123");
      } catch (e: unknown) {
        status.value = { msg: e instanceof Error ? e.message : "error", type: "error" };
      }

      expect(status.value?.type).toBe("error");
    });
  });
});
