/**
 * @jest-environment node
 */
import { isValidWalletAddress, isValidAppId, sanitizeString } from "@/lib/security/validation";

describe("Validation Utils", () => {
  describe("isValidWalletAddress", () => {
    it("accepts valid Neo N3 addresses", () => {
      expect(isValidWalletAddress("NXV7ZhHiyM1aHXwpVsRZC6BEaDQhNn2Lgh")).toBe(true);
    });

    it("rejects invalid addresses", () => {
      expect(isValidWalletAddress("")).toBe(false);
      expect(isValidWalletAddress("invalid")).toBe(false);
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
