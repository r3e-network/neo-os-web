/**
 * @jest-environment node
 */
import {
  isValidWalletAddress,
  isValidNeoAddress,
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

  describe("isValidWalletAddress", () => {
    it("accepts valid Neo N3 addresses", () => {
      expect(isValidWalletAddress("NXV7ZhHiyM1aHXwpVsRZC6BEaDQhNn2Lgh")).toBe(true);
    });

    it("validates by chain type", () => {
      expect(isValidWalletAddress("NXV7ZhHiyM1aHXwpVsRZC6BEaDQhNn2Lgh", "neo-n3")).toBe(true);
    });

    it("rejects invalid addresses", () => {
      expect(isValidWalletAddress("")).toBe(false);
      expect(isValidWalletAddress("invalid")).toBe(false);
    });

    it("rejects EVM addresses", () => {
      expect(isValidWalletAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(false);
    });
  });

  describe("detectAddressChainType", () => {
    it("detects Neo N3 addresses", () => {
      expect(detectAddressChainType("NXV7ZhHiyM1aHXwpVsRZC6BEaDQhNn2Lgh")).toBe("neo-n3");
    });

    it("returns null for invalid addresses", () => {
      expect(detectAddressChainType("")).toBe(null);
      expect(detectAddressChainType("invalid")).toBe(null);
    });

    it("returns null for EVM addresses", () => {
      expect(detectAddressChainType("0x1234567890abcdef1234567890abcdef12345678")).toBe(null);
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

describe("isValidUUID", () => {
  const { isValidUUID } = require("@/lib/security/validation");
  
  it("accepts valid UUIDs", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidUUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
  });

  it("rejects invalid UUIDs", () => {
    expect(isValidUUID("")).toBe(false);
    expect(isValidUUID("invalid")).toBe(false);
    expect(isValidUUID("550e8400-e29b-41d4-a716")).toBe(false);
  });
});

describe("isValidUrl", () => {
  const { isValidUrl } = require("@/lib/security/validation");
  
  it("accepts valid URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://localhost:3000/path")).toBe(true);
  });

  it("rejects invalid URLs", () => {
    expect(isValidUrl("")).toBe(false);
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("ftp://example.com")).toBe(false);
  });
});

describe("isValidAmount", () => {
  const { isValidAmount } = require("@/lib/security/validation");
  
  it("accepts valid amounts", () => {
    expect(isValidAmount("100")).toBe(true);
    expect(isValidAmount("0.001")).toBe(true);
    expect(isValidAmount("0")).toBe(true);
  });

  it("rejects invalid amounts", () => {
    expect(isValidAmount("")).toBe(false);
    expect(isValidAmount("-100")).toBe(false);
    expect(isValidAmount("abc")).toBe(false);
  });
});

describe("sanitizeHtml", () => {
  const { sanitizeHtml } = require("@/lib/security/validation");
  
  it("escapes HTML entities", () => {
    expect(sanitizeHtml("<script>")).toBe("&lt;script&gt;");
    expect(sanitizeHtml("a & b")).toBe("a &amp; b");
    expect(sanitizeHtml('"test"')).toBe("&quot;test&quot;");
  });
});
