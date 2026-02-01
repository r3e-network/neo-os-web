/**
 * Platform Supported Chain Configurations
 *
 * Pre-configured chain settings for Neo N3 mainnet and testnet.
 * These define which chains the platform can interact with.
 *
 * NOTE: MiniApp chain support is declared in each app's manifest (supportedChains).
 * This file only defines platform-level chain configurations, NOT default chains.
 */

import type { NeoN3ChainConfig, ChainConfig } from "./types";

// ============================================================================
// Neo N3 Chains
// ============================================================================

export const NEO_N3_MAINNET: NeoN3ChainConfig = {
  id: "neo-n3-mainnet",
  name: "Neo N3",
  nameZh: "Neo N3 主网",
  type: "neo-n3",
  isTestnet: false,
  status: "active",
  icon: "/chains/neo.svg",
  color: "#00E599",
  nativeCurrency: {
    name: "GAS",
    symbol: "GAS",
    decimals: 8,
  },
  explorerUrl: "https://explorer.onegate.space",
  blockTime: 15,
  networkMagic: 860833102,
  rpcUrls: ["https://mainnet1.neo.coz.io:443", "https://mainnet2.neo.coz.io:443", "https://neo1.neo.coz.io:443"],
  contracts: {
    neo: "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5",
    gas: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
    policy: "0xcc5e4edd9f5f8dba8bb65734541df7a1c081c67b",
    roleManagement: "0x49cf4e5378ffcd4dec034fd98a174c5491e395e2",
    oracle: "0xfe924b7cfe89ddd271abaf7210a80a7e11178758",
    nameService: "0x50ac1c37690cc2cfc594472833cf57505d5f46de",
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const NEO_N3_TESTNET: NeoN3ChainConfig = {
  id: "neo-n3-testnet",
  name: "Neo N3 Testnet",
  nameZh: "Neo N3 测试网",
  type: "neo-n3",
  isTestnet: true,
  status: "active",
  icon: "/chains/neo.svg",
  color: "#00E599",
  nativeCurrency: {
    name: "GAS",
    symbol: "GAS",
    decimals: 8,
  },
  explorerUrl: "https://testnet.explorer.onegate.space",
  blockTime: 15,
  networkMagic: 894710606,
  rpcUrls: ["https://testnet1.neo.coz.io:443", "https://testnet2.neo.coz.io:443"],
  contracts: {
    neo: "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5",
    gas: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
    policy: "0xcc5e4edd9f5f8dba8bb65734541df7a1c081c67b",
    roleManagement: "0x49cf4e5378ffcd4dec034fd98a174c5491e395e2",
    oracle: "0xfe924b7cfe89ddd271abaf7210a80a7e11178758",
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// Platform Supported Chain Configurations
// These are the chains the platform can interact with - NOT default chains
// MiniApp chain support is declared in each app's manifest (supportedChains)
// ============================================================================

export const SUPPORTED_CHAIN_CONFIGS: ChainConfig[] = [NEO_N3_MAINNET, NEO_N3_TESTNET];

export const CHAIN_CONFIG_MAP: Record<string, ChainConfig> = Object.fromEntries(
  SUPPORTED_CHAIN_CONFIGS.map((chain) => [chain.id, chain]),
);
