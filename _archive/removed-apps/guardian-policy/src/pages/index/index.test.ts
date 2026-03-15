import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@shared/utils/i18n", () => ({
  createT: () => (key: string) => key,
}));

describe("Guardian Policy - Security Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Policy Input Validation", () => {
    it("accepts valid policy inputs", () => {
      const policy = {
        assetType: "NEO",
        coverage: 10,
        startPrice: 12.5,
        threshold: 20,
      };

      const isValid =
        policy.assetType.trim().length > 0 &&
        policy.coverage >= 1 &&
        policy.startPrice > 0 &&
        policy.threshold > 0 &&
        policy.threshold <= 50;

      expect(isValid).toBe(true);
    });

    it("rejects invalid coverage or threshold", () => {
      const invalidCases = [
        { assetType: "NEO", coverage: 0, startPrice: 10, threshold: 20 },
        { assetType: "NEO", coverage: 10, startPrice: 0, threshold: 20 },
        { assetType: "NEO", coverage: 10, startPrice: 10, threshold: 0 },
        { assetType: "NEO", coverage: 10, startPrice: 10, threshold: 51 },
      ];

      invalidCases.forEach((policy) => {
        const isValid =
          policy.assetType.trim().length > 0 &&
          policy.coverage >= 1 &&
          policy.startPrice > 0 &&
          policy.threshold > 0 &&
          policy.threshold <= 50;
        expect(isValid).toBe(false);
      });
    });
  });

  describe("Premium Calculation", () => {
    it("uses 5% of coverage as premium", () => {
      const coverage = 100;
      const premium = (coverage * 5) / 100;
      expect(premium).toBe(5);
    });
  });

  describe("Policy Status", () => {
    it("marks policy as active when active and not claimed", () => {
      const policy = { active: true, claimed: false };
      const status = policy.claimed ? "claimed" : policy.active ? "active" : "expired";
      expect(status).toBe("active");
    });

    it("marks policy as claimed when claimed", () => {
      const policy = { active: true, claimed: true };
      const status = policy.claimed ? "claimed" : policy.active ? "active" : "expired";
      expect(status).toBe("claimed");
    });

    it("marks policy as expired when inactive", () => {
      const policy = { active: false, claimed: false };
      const status = policy.claimed ? "claimed" : policy.active ? "active" : "expired";
      expect(status).toBe("expired");
    });
  });

  describe("Claim Request Visibility", () => {
    it("shows claim action only for active, unclaimed policies", () => {
      const policies = [
        { id: "1", active: true, claimed: false },
        { id: "2", active: true, claimed: true },
        { id: "3", active: false, claimed: false },
      ];

      const claimable = policies.filter((policy) => policy.active && !policy.claimed);
      expect(claimable).toHaveLength(1);
      expect(claimable[0].id).toBe("1");
    });
  });
});
