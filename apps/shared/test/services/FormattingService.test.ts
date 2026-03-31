import { describe, expect, it } from "vitest";
import { FormattingService } from "@shared/services/FormattingService";

describe("FormattingService", () => {
  const fmt = new FormattingService();

  describe("gas()", () => {
    it("should format GAS values from raw units (1e8)", () => {
      // 1.5 GAS = 150000000 raw units
      expect(fmt.gas(150000000n)).toBe("1.5");
      expect(fmt.gas(150000000)).toBe("1.5");
      expect(fmt.gas("150000000")).toBe("1.5");
    });

    it("should handle zero values", () => {
      expect(fmt.gas(0n)).toBe("0");
      expect(fmt.gas(0)).toBe("0");
      expect(fmt.gas("0")).toBe("0");
    });

    it("should format large numbers", () => {
      // 1000 GAS
      expect(fmt.gas(100000000000n)).toBe("1000");
      // 999999.12345678 GAS
      expect(fmt.gas(99999912345678n)).toBe("999999.1234");
    });

    it("should format fractional values", () => {
      // 0.00000001 GAS (1 raw unit)
      expect(fmt.gas(1n, 8)).toBe("0.00000001");
      // 0.5 GAS
      expect(fmt.gas(50000000n)).toBe("0.5");
    });

    it("should respect decimals parameter", () => {
      // 1.23456789 GAS
      expect(fmt.gas(123456789n, 2)).toBe("1.23");
      expect(fmt.gas(123456789n, 8)).toBe("1.23456789");
    });

    it("should handle whole GAS amounts with no fractional remainder", () => {
      // Exactly 10 GAS
      expect(fmt.gas(1000000000n)).toBe("10");
    });
  });

  describe("number()", () => {
    it("should format numbers with default 2 decimals", () => {
      expect(fmt.number(1234.5678)).toBe("1,234.57");
    });

    it("should format zero", () => {
      expect(fmt.number(0)).toBe("0.00");
    });

    it("should format string input", () => {
      expect(fmt.number("1234.5")).toBe("1,234.50");
    });

    it("should handle non-finite values", () => {
      expect(fmt.number(NaN)).toBe("0");
      expect(fmt.number(Infinity)).toBe("0");
    });
  });

  describe("fromFixed8()", () => {
    it("should convert raw units to decimal number", () => {
      expect(fmt.fromFixed8(100000000)).toBe(1);
      expect(fmt.fromFixed8(150000000)).toBe(1.5);
      expect(fmt.fromFixed8(0)).toBe(0);
    });

    it("should handle bigint input", () => {
      expect(fmt.fromFixed8(100000000n)).toBe(1);
    });

    it("should handle string input", () => {
      expect(fmt.fromFixed8("250000000")).toBe(2.5);
    });
  });

  describe("toFixed8()", () => {
    it("should convert decimal to raw units string", () => {
      expect(fmt.toFixed8("1")).toBe("100000000");
      expect(fmt.toFixed8("1.5")).toBe("150000000");
      expect(fmt.toFixed8("0.00000001")).toBe("1");
    });

    it("should handle zero", () => {
      expect(fmt.toFixed8("0")).toBe("0");
    });

    it("should handle numeric input", () => {
      expect(fmt.toFixed8(2)).toBe("200000000");
    });
  });

  describe("compact()", () => {
    it("should format thousands as K", () => {
      expect(fmt.compact(1500)).toBe("1.5K");
    });

    it("should format millions as M", () => {
      expect(fmt.compact(2500000)).toBe("2.5M");
    });

    it("should format billions as B", () => {
      expect(fmt.compact(1000000000)).toBe("1B");
    });

    it("should not format small numbers", () => {
      expect(fmt.compact(999)).toBe("999");
    });

    it("should handle zero", () => {
      expect(fmt.compact(0)).toBe("0");
    });
  });

  describe("address()", () => {
    it("should truncate long addresses", () => {
      const addr = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
      expect(fmt.address(addr)).toBe("NNLi44...rNEs");
    });

    it("should return empty string for undefined", () => {
      expect(fmt.address(undefined)).toBe("");
    });

    it("should return short addresses unchanged", () => {
      expect(fmt.address("short")).toBe("short");
    });
  });

  describe("hash()", () => {
    it("should truncate long hashes", () => {
      const hash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      expect(fmt.hash(hash)).toBe("0xabcd...7890");
    });

    it("should return empty string for empty input", () => {
      expect(fmt.hash("")).toBe("");
    });
  });
});
