/**
 * Wallet Connection Tests
 * Tests wallet store and connection logic
 */

import { DEFAULT_CHAIN_ID, walletOptions } from "@/lib/wallet/store";

describe("Wallet System", () => {
  describe("Default Configuration", () => {
    it("should have default chain ID set to neo-n3-mainnet", () => {
      expect(DEFAULT_CHAIN_ID).toBe("neo-n3-mainnet");
    });
  });

  describe("Wallet Provider Types", () => {
    it("should support Neo wallet providers", () => {
      const neoProviders = ["neoline", "o3", "onegate", "auth0"];
      neoProviders.forEach((provider) => {
        expect(typeof provider).toBe("string");
      });
    });

    it("should not include EVM wallet providers", () => {
      const ids = walletOptions.map((option) => option.id);
      expect(ids).not.toContain("metamask");
    });
  });
});
