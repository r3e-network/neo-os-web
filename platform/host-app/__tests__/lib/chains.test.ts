/**
 * @jest-environment node
 */

import { NEO_NETWORK_MAGIC, isNeoN3Chain, isNeoTransactionRequest } from "@/lib/chains/types";
import { NEO_N3_MAINNET, NEO_N3_TESTNET, SUPPORTED_CHAIN_CONFIGS, CHAIN_CONFIG_MAP } from "@/lib/chains/defaults";
import {
  chainRegistry,
  getChainRegistry,
  getNativeContract,
  getNeoContract,
  getGasContract,
} from "@/lib/chains/registry";
import { CONTRACTS, getContractAddress, isContractOnChain, getContractChains } from "@/lib/chains/contract-queries";

describe("chains", () => {
  // ---- types.ts ----
  describe("types", () => {
    it("defines network magic for mainnet and testnet", () => {
      expect(NEO_NETWORK_MAGIC["neo-n3-mainnet"]).toBe(860833102);
      expect(NEO_NETWORK_MAGIC["neo-n3-testnet"]).toBe(894710606);
    });

    it("isNeoN3Chain returns true for neo-n3 type", () => {
      expect(isNeoN3Chain(NEO_N3_MAINNET)).toBe(true);
    });

    it("isNeoTransactionRequest detects Neo tx shape", () => {
      const neoTx = {
        chainId: "neo-n3-mainnet" as const,
        from: "NAddr",
        scriptHash: "0xabc",
        operation: "transfer",
        args: [],
      };
      expect(isNeoTransactionRequest(neoTx)).toBe(true);
    });
  });

  // ---- defaults.ts ----
  describe("defaults", () => {
    it("NEO_N3_MAINNET has correct id and type", () => {
      expect(NEO_N3_MAINNET.id).toBe("neo-n3-mainnet");
      expect(NEO_N3_MAINNET.type).toBe("neo-n3");
      expect(NEO_N3_MAINNET.isTestnet).toBe(false);
    });

    it("NEO_N3_TESTNET has correct id and type", () => {
      expect(NEO_N3_TESTNET.id).toBe("neo-n3-testnet");
      expect(NEO_N3_TESTNET.type).toBe("neo-n3");
      expect(NEO_N3_TESTNET.isTestnet).toBe(true);
    });

    it("SUPPORTED_CHAIN_CONFIGS contains both chains", () => {
      expect(SUPPORTED_CHAIN_CONFIGS).toHaveLength(2);
      const ids = SUPPORTED_CHAIN_CONFIGS.map((c) => c.id);
      expect(ids).toContain("neo-n3-mainnet");
      expect(ids).toContain("neo-n3-testnet");
    });

    it("CHAIN_CONFIG_MAP is keyed by chain id", () => {
      expect(CHAIN_CONFIG_MAP["neo-n3-mainnet"]).toBeDefined();
      expect(CHAIN_CONFIG_MAP["neo-n3-testnet"]).toBeDefined();
      expect(CHAIN_CONFIG_MAP["neo-n3-mainnet"].id).toBe("neo-n3-mainnet");
    });

    it("mainnet has rpcUrls configured", () => {
      expect(NEO_N3_MAINNET.rpcUrls.length).toBeGreaterThan(0);
    });

    it("mainnet has native contract addresses", () => {
      expect(NEO_N3_MAINNET.contracts.neo).toBeTruthy();
      expect(NEO_N3_MAINNET.contracts.gas).toBeTruthy();
    });
  });

  // ---- registry.ts ----
  describe("registry", () => {
    it("getChainRegistry returns the singleton", () => {
      expect(getChainRegistry()).toBe(chainRegistry);
    });

    it("getChains returns all registered chains", () => {
      const chains = chainRegistry.getChains();
      expect(chains.length).toBeGreaterThanOrEqual(2);
    });

    it("getChain returns config by id", () => {
      const mainnet = chainRegistry.getChain("neo-n3-mainnet");
      expect(mainnet).toBeDefined();
      expect(mainnet!.id).toBe("neo-n3-mainnet");
    });

    it("getChain returns undefined for unknown id", () => {
      const result = chainRegistry.getChain("unknown-chain" as any);
      expect(result).toBeUndefined();
    });

    it("getChainsByType filters by type", () => {
      const neoChains = chainRegistry.getChainsByType("neo-n3");
      expect(neoChains.length).toBeGreaterThanOrEqual(2);
      neoChains.forEach((c) => expect(c.type).toBe("neo-n3"));
    });

    it("getActiveChains returns only active chains", () => {
      const active = chainRegistry.getActiveChains();
      active.forEach((c) => expect(c.status).toBe("active"));
    });

    it("getMainnetChains excludes testnets", () => {
      const mainnets = chainRegistry.getMainnetChains();
      mainnets.forEach((c) => expect(c.isTestnet).toBe(false));
    });

    it("getTestnetChains returns only testnets", () => {
      const testnets = chainRegistry.getTestnetChains();
      testnets.forEach((c) => expect(c.isTestnet).toBe(true));
    });

    it("getNativeContract returns contract address", () => {
      const neo = getNativeContract("neo-n3-mainnet", "neo");
      expect(neo).toBe(NEO_N3_MAINNET.contracts.neo);
    });

    it("getNativeContract returns undefined for unknown chain", () => {
      expect(getNativeContract("bad" as any, "neo")).toBeUndefined();
    });

    it("getNeoContract shortcut works", () => {
      expect(getNeoContract("neo-n3-mainnet")).toBe(NEO_N3_MAINNET.contracts.neo);
    });

    it("getGasContract shortcut works", () => {
      expect(getGasContract("neo-n3-mainnet")).toBe(NEO_N3_MAINNET.contracts.gas);
    });
  });

  // ---- contract-queries.ts ----
  describe("contract-queries", () => {
    it("CONTRACTS map has expected entries", () => {
      expect(CONTRACTS.lottery).toBeDefined();
      expect(CONTRACTS.coinFlip).toBeDefined();
      expect(CONTRACTS.redEnvelope).toBeDefined();
    });

    it("getContractAddress returns address for known contract+chain", () => {
      const addr = getContractAddress("lottery", "neo-n3-mainnet");
      expect(addr).toBeTruthy();
      expect(typeof addr).toBe("string");
    });

    it("getContractAddress returns null for unknown contract", () => {
      expect(getContractAddress("nonexistent", "neo-n3-mainnet")).toBeNull();
    });

    it("getContractAddress returns null for wrong chain", () => {
      // diceGame only on testnet
      expect(getContractAddress("diceGame", "neo-n3-mainnet")).toBeNull();
    });

    it("isContractOnChain returns true when deployed", () => {
      expect(isContractOnChain("lottery", "neo-n3-mainnet")).toBe(true);
    });

    it("isContractOnChain returns false when not deployed", () => {
      expect(isContractOnChain("diceGame", "neo-n3-mainnet")).toBe(false);
    });

    it("getContractChains returns all chains for a contract", () => {
      const chains = getContractChains("lottery");
      expect(chains).toContain("neo-n3-mainnet");
      expect(chains).toContain("neo-n3-testnet");
    });

    it("getContractChains returns empty for unknown contract", () => {
      expect(getContractChains("nonexistent")).toEqual([]);
    });
  });
});
