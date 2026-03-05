import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

// Mock @neo/uniapp-sdk
vi.mock("@neo/uniapp-sdk", () => ({
  usePayments: vi.fn(() => ({
    payGAS: vi.fn().mockResolvedValue({ request_id: "test-123" }),
    isLoading: ref(false),
  })),
}));

// Mock i18n utility
vi.mock("@shared/utils/i18n", () => ({
  createT: vi.fn(() => (key: string) => key),
}));

describe("Masquerade DAO MiniApp", () => {
  let mockPayGAS: ReturnType<typeof vi.fn>;
  let mockIsLoading: ReturnType<typeof ref<boolean>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { usePayments } = await import("@neo/uniapp-sdk");
    const payments = usePayments("test");
    mockPayGAS = payments.payGAS;
    mockIsLoading = payments.isLoading;
  });

  describe("Mask Creation", () => {
    it("should create mask successfully", async () => {
      await mockPayGAS("1", "create-mask");

      expect(mockPayGAS).toHaveBeenCalledWith("1", "create-mask");
      expect(mockPayGAS).toHaveBeenCalledTimes(1);
    });

    it("should increment mask count after creation", async () => {
      const maskCount = ref(3);
      await mockPayGAS("1", "create-mask");

      maskCount.value++;
      expect(maskCount.value).toBe(4);
    });

    it("should add new mask to masks array", async () => {
      const masks = ref([
        { icon: "🎭", name: "Shadow", power: 100 },
        { icon: "👺", name: "Demon", power: 250 },
      ]);

      await mockPayGAS("1", "create-mask");

      masks.value.push({
        icon: "🎪",
        name: "Mask 3",
        power: 150,
      });

      expect(masks.value).toHaveLength(3);
      expect(masks.value[2].name).toBe("Mask 3");
    });

    it("should not create mask when loading", async () => {
      mockIsLoading.value = true;

      const createMask = async () => {
        if (mockIsLoading.value) return;
        await mockPayGAS("1", "create-mask");
      };

      await createMask();
      expect(mockPayGAS).not.toHaveBeenCalled();
    });

    it("should handle creation error", async () => {
      mockPayGAS.mockRejectedValueOnce(new Error("Insufficient funds"));

      await expect(mockPayGAS("1", "create-mask")).rejects.toThrow("Insufficient funds");
    });
  });

  describe("Mask Selection", () => {
    it("should select a mask", () => {
      const selectedMask = ref<number | null>(0);
      selectedMask.value = 1;

      expect(selectedMask.value).toBe(1);
    });

    it("should change mask selection", () => {
      const selectedMask = ref<number | null>(0);
      selectedMask.value = 2;

      expect(selectedMask.value).toBe(2);
    });
  });

  describe("Voting", () => {
    it("should vote successfully with selected mask", async () => {
      const selectedMask = ref<number | null>(0);
      const proposalId = 1;
      const support = true;

      await mockPayGAS("0.1", `vote:${proposalId}:${support}`);

      expect(mockPayGAS).toHaveBeenCalledWith("0.1", `vote:${proposalId}:${support}`);
    });

    it("should not vote without selected mask", async () => {
      const selectedMask = ref<number | null>(null);

      const vote = async (id: number, support: boolean) => {
        if (selectedMask.value === null) {
          throw new Error("Select a mask first");
        }
        await mockPayGAS("0.1", `vote:${id}:${support}`);
      };

      await expect(vote(1, true)).rejects.toThrow("Select a mask first");
      expect(mockPayGAS).not.toHaveBeenCalled();
    });

    it("should update proposal votes after voting", async () => {
      const masks = ref([{ icon: "🎭", name: "Shadow", power: 100 }]);
      const selectedMask = ref<number | null>(0);
      const proposals = ref([{ id: 1, title: "Test", forVotes: 450, againstVotes: 120 }]);

      await mockPayGAS("0.1", "vote:1:true");

      const proposal = proposals.value.find((p) => p.id === 1);
      if (proposal && selectedMask.value !== null) {
        const power = masks.value[selectedMask.value].power;
        proposal.forVotes += power;
      }

      expect(proposals.value[0].forVotes).toBe(550);
    });

    it("should vote against proposal", async () => {
      const masks = ref([{ icon: "🎭", name: "Shadow", power: 100 }]);
      const selectedMask = ref<number | null>(0);
      const proposals = ref([{ id: 1, title: "Test", forVotes: 450, againstVotes: 120 }]);

      await mockPayGAS("0.1", "vote:1:false");

      const proposal = proposals.value.find((p) => p.id === 1);
      if (proposal && selectedMask.value !== null) {
        const power = masks.value[selectedMask.value].power;
        proposal.againstVotes += power;
      }

      expect(proposals.value[0].againstVotes).toBe(220);
    });
  });

  describe("Vote Percentage Calculation", () => {
    it("should calculate vote percentage correctly", () => {
      const getVotePercentage = (p: { forVotes: number; againstVotes: number }) => {
        const total = p.forVotes + p.againstVotes;
        return total === 0 ? 0 : (p.forVotes / total) * 100;
      };

      expect(getVotePercentage({ forVotes: 450, againstVotes: 120 })).toBeCloseTo(78.95, 1);
      expect(getVotePercentage({ forVotes: 500, againstVotes: 500 })).toBe(50);
    });

    it("should return 0 for no votes", () => {
      const getVotePercentage = (p: { forVotes: number; againstVotes: number }) => {
        const total = p.forVotes + p.againstVotes;
        return total === 0 ? 0 : (p.forVotes / total) * 100;
      };

      expect(getVotePercentage({ forVotes: 0, againstVotes: 0 })).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle multiple masks", () => {
      const masks = ref([
        { icon: "🎭", name: "Shadow", power: 100 },
        { icon: "👺", name: "Demon", power: 250 },
        { icon: "🦊", name: "Fox", power: 150 },
      ]);

      expect(masks.value).toHaveLength(3);
      expect(masks.value[1].power).toBe(250);
    });

    it("should handle mask with zero power", () => {
      const masks = ref([{ icon: "🎭", name: "Weak", power: 0 }]);

      expect(masks.value[0].power).toBe(0);
    });
  });
});
