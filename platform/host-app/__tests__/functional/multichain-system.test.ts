/**
 * Multi-Chain Support Tests
 * Tests chain resolution and contract lookup
 */

import {
  getContractForChain,
  isChainSupported,
  getAllSupportedChains,
  resolveChainIdForApp,
  getEntryUrlForChain,
  normalizeSupportedChains,
  normalizeChainContracts,
} from "@/lib/miniapp";
import { BUILTIN_APPS } from "@/lib/builtin-apps";
import type { MiniAppInfo } from "@/components/types";
import type { ChainId } from "@/lib/chains/types";

describe("Multi-Chain Support", () => {
  describe("Chain Contract Lookup", () => {
    it("should return null for null chainId", () => {
      const app = BUILTIN_APPS[0];
      expect(getContractForChain(app, null)).toBeNull();
    });

    it("should return contract address for supported chain", () => {
      const appWithContracts = BUILTIN_APPS.find((a) => a.chainContracts && Object.keys(a.chainContracts).length > 0);
      if (appWithContracts) {
        const chainId = Object.keys(appWithContracts.chainContracts!)[0];
        const contract = getContractForChain(appWithContracts, chainId as ChainId);
        expect(contract).toBeTruthy();
      }
    });
  });

  describe("Chain Support Check", () => {
    it("should return true for explicitly supported chains", () => {
      const appWithChains = BUILTIN_APPS.find((a) => a.supportedChains && a.supportedChains.length > 0);
      if (appWithChains) {
        const chainId = appWithChains.supportedChains![0];
        expect(isChainSupported(appWithChains, chainId)).toBe(true);
      }
    });

    it("should return false for unsupported chains", () => {
      const app = BUILTIN_APPS[0];
      expect(isChainSupported(app, "fake-chain-id" as unknown as ChainId)).toBe(false);
    });
  });

  describe("Get All Supported Chains", () => {
    it("should return array of supported chains", () => {
      const appWithChains = BUILTIN_APPS.find((a) => a.supportedChains && a.supportedChains.length > 0);
      if (appWithChains) {
        const chains = getAllSupportedChains(appWithChains);
        expect(Array.isArray(chains)).toBe(true);
        expect(chains.length).toBeGreaterThan(0);
      }
    });

    it("should return empty array for apps without chain support", () => {
      const mockApp: MiniAppInfo = {
        app_id: "test",
        name: "Test",
        description: "",
        icon: "🧪",
        category: "utility",
        entry_url: "/test.html",
        supportedChains: [],
        status: null,
        permissions: {
          payments: false,
          governance: false,
          rng: false,
          datafeed: false,
          confidential: false,
          automation: false,
        },
        limits: null,
        news_integration: null,
        stats_display: null,
      };
      const chains = getAllSupportedChains(mockApp);
      expect(chains).toEqual([]);
    });
  });

  describe("Chain ID Resolution", () => {
    it("should return requested chain if supported", () => {
      const appWithChains = BUILTIN_APPS.find((a) => a.supportedChains && a.supportedChains.length > 0);
      if (appWithChains) {
        const chainId = appWithChains.supportedChains![0];
        expect(resolveChainIdForApp(appWithChains, chainId)).toBe(chainId);
      }
    });

    it("should fallback to first supported chain", () => {
      const appWithChains = BUILTIN_APPS.find((a) => a.supportedChains && a.supportedChains.length > 0);
      if (appWithChains) {
        const result = resolveChainIdForApp(appWithChains, "unsupported-chain" as unknown as ChainId);
        expect(appWithChains.supportedChains).toContain(result);
      }
    });
  });

  describe("Chain-Specific Entry URL", () => {
    it("should return app entry_url as fallback", () => {
      const app = BUILTIN_APPS[0];
      const url = getEntryUrlForChain(app);
      expect(url).toBe(app.entry_url);
    });
  });

  describe("Normalization Functions", () => {
    it("should normalize valid chain IDs", () => {
      const result = normalizeSupportedChains(["neo-n3-mainnet", "neo-n3-testnet"]);
      expect(result).toEqual(["neo-n3-mainnet", "neo-n3-testnet"]);
    });

    it("filters out non-neo chain IDs", () => {
      const result = normalizeSupportedChains(["neo-n3-mainnet", "unsupported-chain"]);
      expect(result).toEqual(["neo-n3-mainnet"]);
    });

    it("should filter invalid chain IDs", () => {
      const result = normalizeSupportedChains(["neo-n3-mainnet", "invalid", "neo-n3-testnet"]);
      expect(result).toEqual(["neo-n3-mainnet", "neo-n3-testnet"]);
    });

    it("should return undefined for empty array", () => {
      const result = normalizeSupportedChains([]);
      expect(result).toBeUndefined();
    });

    it("should normalize chain contracts", () => {
      const result = normalizeChainContracts({
        "neo-n3-mainnet": { address: "0x123", active: true },
      });
      expect(result).toBeDefined();
      expect(result?.["neo-n3-mainnet"]?.address).toBe("0x123");
    });
  });
});
