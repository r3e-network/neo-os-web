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

vi.mock("@shared/utils/i18n", () => ({
  createT: () => (key: string) => key,
}));

describe("Heritage Trust - Legacy Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Form Validation", () => {
    it("validates required fields", () => {
      const trust = {
        name: "Family Legacy",
        beneficiary: "NXXx...abc123",
        neoValue: "10",
        gasValue: "0",
      };

      const neoAmount = Number(toFixedDecimals(trust.neoValue, 0));
      const gasAmount = Number.parseFloat(trust.gasValue);
      const isValid =
        trust.name.trim() &&
        trust.beneficiary.trim() &&
        (neoAmount > 0 || (Number.isFinite(gasAmount) && gasAmount > 0));

      expect(isValid).toBe(true);
    });

    it("accepts GAS-only principal", () => {
      const trust = {
        name: "Gas Trust",
        beneficiary: "NXXx...abc123",
        neoValue: "0",
        gasValue: "12.5",
      };

      const neoAmount = Number(toFixedDecimals(trust.neoValue, 0));
      const gasAmount = Number.parseFloat(trust.gasValue);
      const isValid =
        trust.name.trim() &&
        trust.beneficiary.trim() &&
        (neoAmount > 0 || (Number.isFinite(gasAmount) && gasAmount > 0));

      expect(isValid).toBe(true);
    });

    it("rejects missing fields or zero value", () => {
      const testCases = [
        { name: "", beneficiary: "NXXx", neoValue: "10", gasValue: "0" },
        { name: "Trust", beneficiary: "", neoValue: "10", gasValue: "0" },
        { name: "Trust", beneficiary: "NXXx", neoValue: "0", gasValue: "0" },
      ];

      testCases.forEach((trust) => {
        const neoAmount = Number(toFixedDecimals(trust.neoValue, 0));
        const gasAmount = Number.parseFloat(trust.gasValue);
        const isValid =
          trust.name.trim() &&
          trust.beneficiary.trim() &&
          (neoAmount > 0 || (Number.isFinite(gasAmount) && gasAmount > 0));
        expect(isValid).toBeFalsy();
      });
    });
  });

  describe("Trust Status", () => {
    it("marks trust executable when active and deadline passed", () => {
      const active = true;
      const now = Date.now();
      const deadlineMs = now - 1000;
      const canExecute = active && deadlineMs > 0 && deadlineMs <= now;

      expect(canExecute).toBe(true);
    });

    it("does not allow execution before deadline", () => {
      const active = true;
      const now = Date.now();
      const deadlineMs = now + 86_400_000;
      const canExecute = active && deadlineMs > 0 && deadlineMs <= now;

      expect(canExecute).toBe(false);
    });
  });

  describe("NEO Amount Handling", () => {
    it("floors fractional input to integer NEO", () => {
      const neoValue = "5.9";
      const neoAmount = Number(toFixedDecimals(neoValue, 0));
      expect(neoAmount).toBe(5);
    });
  });
});
