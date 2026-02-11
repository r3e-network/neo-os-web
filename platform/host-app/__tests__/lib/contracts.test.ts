/**
 * @jest-environment node
 */

import { normalizeContracts } from "@/lib/contracts";

describe("normalizeContracts", () => {
  describe("invalid inputs", () => {
    it("returns empty object for null", () => {
      expect(normalizeContracts(null)).toEqual({});
    });

    it("returns empty object for undefined", () => {
      expect(normalizeContracts(undefined)).toEqual({});
    });

    it("returns empty object for string", () => {
      expect(normalizeContracts("not-an-object")).toEqual({});
    });

    it("returns empty object for array", () => {
      expect(normalizeContracts([1, 2, 3])).toEqual({});
    });

    it("returns empty object for number", () => {
      expect(normalizeContracts(42)).toEqual({});
    });
  });

  describe("shorthand string values", () => {
    it("converts string value to address object", () => {
      const result = normalizeContracts({
        "neo-n3-mainnet": "0xabc123",
      });
      expect(result).toEqual({
        "neo-n3-mainnet": { address: "0xabc123" },
      });
    });

    it("handles multiple chain entries", () => {
      const result = normalizeContracts({
        "neo-n3-mainnet": "0xabc",
        "neo-n3-testnet": "0xdef",
      });
      expect(result).toEqual({
        "neo-n3-mainnet": { address: "0xabc" },
        "neo-n3-testnet": { address: "0xdef" },
      });
    });
  });

  describe("full object values", () => {
    it("extracts address, active, and entry_url", () => {
      const result = normalizeContracts({
        "neo-n3-mainnet": {
          address: "0xabc",
          active: true,
          entry_url: "https://example.com",
        },
      });
      expect(result).toEqual({
        "neo-n3-mainnet": {
          address: "0xabc",
          active: true,
          entry_url: "https://example.com",
        },
      });
    });

    it("normalizes entryUrl to entry_url", () => {
      const result = normalizeContracts({
        "neo-n3-mainnet": {
          address: "0xabc",
          entryUrl: "https://example.com",
        },
      });
      expect(result).toEqual({
        "neo-n3-mainnet": {
          address: "0xabc",
          entry_url: "https://example.com",
        },
      });
    });

    it("omits non-string address", () => {
      const result = normalizeContracts({
        "neo-n3-mainnet": { address: 123, active: true },
      });
      expect(result).toEqual({
        "neo-n3-mainnet": { active: true },
      });
    });

    it("omits non-boolean active", () => {
      const result = normalizeContracts({
        "neo-n3-mainnet": { address: "0xabc", active: "yes" },
      });
      expect(result).toEqual({
        "neo-n3-mainnet": { address: "0xabc" },
      });
    });

    it("handles active=false explicitly", () => {
      const result = normalizeContracts({
        "neo-n3-mainnet": { address: "0xabc", active: false },
      });
      expect(result).toEqual({
        "neo-n3-mainnet": { address: "0xabc", active: false },
      });
    });

    it("skips array values in chain entries", () => {
      const result = normalizeContracts({
        "neo-n3-mainnet": [1, 2, 3],
      });
      expect(result).toEqual({});
    });

    it("skips null chain entries", () => {
      const result = normalizeContracts({
        "neo-n3-mainnet": null,
      });
      expect(result).toEqual({});
    });
  });
});
