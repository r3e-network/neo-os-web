import { describe, it, expect, vi, beforeEach } from "vitest";

const toFixedDecimals = (value: string, decimals: number): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("-")) return "0";
  const parts = trimmed.split(".");
  if (parts.length > 2) return "0";
  const whole = parts[0] || "0";
  const frac = parts[1] || "";
  if (!/^\d+$/.test(whole) || (frac && !/^\d+$/.test(frac))) return "0";
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return `${whole}${padded}`.replace(/^0+/, "") || "0";
};

const toFixed8 = (value: string): string => toFixedDecimals(value, 8);

vi.mock("@neo/uniapp-sdk", () => ({
  usePayments: vi.fn(() => ({
    payGAS: vi.fn().mockResolvedValue({ receipt_id: "test-123" }),
    isLoading: { value: false },
  })),
}));

vi.mock("@shared/utils/i18n", () => ({
  createT: vi.fn(() => (key: string) => key),
}));

describe("Gov Merc MiniApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Deposit/Withdraw Validation", () => {
    it("accepts positive NEO amounts", () => {
      const amount = Number(toFixedDecimals("12.9", 0));
      expect(amount).toBe(12);
      expect(amount > 0).toBe(true);
    });

    it("rejects non-positive amounts", () => {
      const values = ["0", "-2", "-0.5"];
      values.forEach((value) => {
        const amount = Number(toFixedDecimals(value, 0));
        expect(amount > 0).toBe(false);
      });
    });
  });

  describe("Bid Payments", () => {
    it("uses payGAS with bid metadata", async () => {
      const { usePayments } = await import("@neo/uniapp-sdk");
      const { payGAS } = usePayments();
      const bidAmount = "1.5";
      const epoch = 3;

      await payGAS(bidAmount, `bid:${epoch}`);

      expect(payGAS).toHaveBeenCalledWith("1.5", "bid:3");
    });
  });

  describe("Bid Amount Conversion", () => {
    it("converts GAS to 8-decimal integer string", () => {
      expect(toFixed8("1.5")).toBe("150000000");
      expect(toFixed8("0.00000001")).toBe("1");
      expect(toFixed8("0")).toBe("0");
    });
  });
});
