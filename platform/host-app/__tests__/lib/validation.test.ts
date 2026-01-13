/**
 * @jest-environment node
 */
import {
  isValidWalletAddress,
  isValidNeoAddress,
  isValidEVMAddress,
  detectAddressChainType,
  isValidAppId,
  sanitizeString,
} from "@/lib/security/validation";

describe("Validation Utils", () => {
  describe("isValidNeoAddress", () => {
    it("accepts valid Neo N3 addresses", () => {
      expect(isValidNeoAddress("NXV7ZhHiyM1aHXwpVsRZC6BEaDQhNn2Lgh")).toBe(true);
    });

    it("rejects invalid Neo addresses", () => {
      expect(isValidNeoAddress("")).toBe(false);
      expect(isValidNeoAddress("invalid")).toBe(false);
      expect(isValidNeoAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(false);
    });
  });

  describe("isValidEVMAddress", () => {
    it("accepts valid EVM addresses", () => {
      expect(isValidEVMAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(true);
      expect(isValidEVMAddress("0xABCDEF1234567890ABCDEF1234567890ABCDEF12")).toBe(true);
    });

    it("rejects invalid EVM addresses", () => {
      expect(isValidEVMAddress("")).toBe(false);
      expect(isValidEVMAddress("invalid")).toBe(false);
      expect(isValidEVMAddress("NXV7ZhHiyM1aHXwpVsRZC6BEaDQhNn2Lgh")).toBe(false);
      expect(isValidEVMAddress("0x123")).toBe(false);
    });
  });

  describe("isValidWalletAddress", () => {
    it("accepts valid Neo N3 addresses", () => {
      expect(isValidWalletAddress("NXV7ZhHiyM1aHXwpVsRZC6BEaDQhNn2Lgh")).toBe(true);
    });

    it("accepts valid EVM addresses", () => {
      expect(isValidWalletAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(true);
    });

    it("validates by chain type", () => {
      expect(isValidWalletAddress("NXV7ZhHiyM1aHXwpVsRZC6BEaDQhNn2Lgh", "neo-n3")).toBe(true);
      expect(isValidWalletAddress("0x1234567890abcdef1234567890abcdef12345678", "evm")).toBe(true);
      expect(isValidWalletAddress("NXV7ZhHiyM1aHXwpVsRZC6BEaDQhNn2Lgh", "evm")).toBe(false);
      expect(isValidWalletAddress("0x1234567890abcdef1234567890abcdef12345678", "neo-n3")).toBe(false);
    });

    it("rejects invalid addresses", () => {
      expect(isValidWalletAddress("")).toBe(false);
      expect(isValidWalletAddress("invalid")).toBe(false);
    });
  });

  describe("detectAddressChainType", () => {
    it("detects Neo N3 addresses", () => {
      expect(detectAddressChainType("NXV7ZhHiyM1aHXwpVsRZC6BEaDQhNn2Lgh")).toBe("neo-n3");
    });

    it("detects EVM addresses", () => {
      expect(detectAddressChainType("0x1234567890abcdef1234567890abcdef12345678")).toBe("evm");
    });

    it("returns null for invalid addresses", () => {
      expect(detectAddressChainType("")).toBe(null);
      expect(detectAddressChainType("invalid")).toBe(null);
    });
  });

  describe("isValidAppId", () => {
    it("accepts valid app IDs", () => {
      expect(isValidAppId("my-app-123")).toBe(true);
    });

    it("rejects invalid app IDs", () => {
      expect(isValidAppId("")).toBe(false);
    });
  });

  describe("sanitizeString", () => {
    it("trims and limits length", () => {
      expect(sanitizeString("  test  ", 10)).toBe("test");
    });
  });
});
