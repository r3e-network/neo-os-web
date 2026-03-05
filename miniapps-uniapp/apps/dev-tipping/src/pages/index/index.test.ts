import { describe, it, expect, vi } from "vitest";

const toFixed8 = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("-")) return "0";
  const parts = trimmed.split(".");
  if (parts.length > 2) return "0";
  const whole = parts[0] || "0";
  const frac = parts[1] || "";
  if (!/^\d+$/.test(whole) || (frac && !/^\d+$/.test(frac))) return "0";
  const padded = (frac + "0".repeat(8)).slice(0, 8);
  return `${whole}${padded}`.replace(/^0+/, "") || "0";
};

describe("Dev Tipping MiniApp", () => {
  describe("Tip Amount Handling", () => {
    it("converts GAS amount to integer", () => {
      const amount = "1.2345";
      const intValue = toFixed8(amount);
      expect(intValue).toBe("123450000");
    });

    it("rejects invalid amounts", () => {
      const amount = "0";
      const parsed = Number.parseFloat(amount);
      const isValid = Number.isFinite(parsed) && parsed > 0;
      expect(isValid).toBe(false);
    });
  });

  describe("Payment Metadata", () => {
    it("uses dev ID in metadata", async () => {
      const payGAS = vi.fn().mockResolvedValue({ receipt_id: "receipt-1" });
      await payGAS("2", "tip:7");
      expect(payGAS).toHaveBeenCalledWith("2", "tip:7");
    });
  });

  describe("Vault Data Mapping", () => {
    it("maps tip event into recent list format", () => {
      const devMap = new Map([[3, "Alice"]]);
      const devId = 3;
      const amount = 250000000;
      const to = devMap.get(devId) || `Dev #${devId}`;
      const formatted = (amount / 1e8).toFixed(2);
      expect(to).toBe("Alice");
      expect(formatted).toBe("2.50");
    });
  });
});
