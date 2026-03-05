import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@shared/utils/i18n", () => ({
  createT: () => (key: string) => key,
}));

describe("Flash Loan - Status Monitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Amount Conversion", () => {
    it("converts integer amounts to GAS with 8 decimals", () => {
      const toGas = (value: number) => value / 1e8;

      expect(toGas(100000000)).toBe(1);
      expect(toGas(2500000000)).toBe(25);
    });
  });

  describe("Loan Status Mapping", () => {
    const statusFromFlags = (executed: boolean, success: boolean) =>
      executed ? (success ? "success" : "failed") : "pending";

    it("marks pending when not executed", () => {
      expect(statusFromFlags(false, false)).toBe("pending");
    });

    it("marks success when executed and successful", () => {
      expect(statusFromFlags(true, true)).toBe("success");
    });

    it("marks failed when executed but unsuccessful", () => {
      expect(statusFromFlags(true, false)).toBe("failed");
    });
  });

  describe("Loan Stats Aggregation", () => {
    it("aggregates totals from executed loans", () => {
      const loans = [
        { amount: 10, fee: 0.009 },
        { amount: 5, fee: 0.0045 },
      ];

      const totalVolume = loans.reduce((sum, loan) => sum + loan.amount, 0);
      const totalFees = loans.reduce((sum, loan) => sum + loan.fee, 0);

      expect(totalVolume).toBe(15);
      expect(totalFees).toBeCloseTo(0.0135, 6);
    });
  });
});
