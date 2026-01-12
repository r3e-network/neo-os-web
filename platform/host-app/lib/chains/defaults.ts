/**
 * Default Chain Configurations
 *
 * Pre-configured chain settings for Neo N3, NeoX, and Ethereum.
 * These serve as defaults and can be overridden by database configurations.
 */

import type { NeoN3ChainConfig, EVMChainConfig, ChainConfig } from "./types";

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
// NeoX Chains (EVM)
// ============================================================================

export const NEOX_MAINNET: EVMChainConfig = {
  id: "neox-mainnet",
  name: "NeoX",
  nameZh: "NeoX 主网",
  type: "evm",
  isTestnet: false,
  status: "active",
  icon: "/chains/neox.svg",
  color: "#00E599",
  nativeCurrency: {
    name: "GAS",
    symbol: "GAS",
    decimals: 18,
  },
  explorerUrl: "https://xexplorer.neo.org",
  blockTime: 4,
  chainId: 47763,
  rpcUrls: ["https://mainnet-1.rpc.banelabs.org"],
  wsUrls: ["wss://mainnet-1.rpc.banelabs.org/ws"],
  contracts: {
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const NEOX_TESTNET: EVMChainConfig = {
  id: "neox-testnet",
  name: "NeoX Testnet",
  nameZh: "NeoX 测试网",
  type: "evm",
  isTestnet: true,
  status: "active",
  icon: "/chains/neox.svg",
  color: "#00E599",
  nativeCurrency: {
    name: "GAS",
    symbol: "GAS",
    decimals: 18,
  },
  explorerUrl: "https://xt4scan.ngd.network",
  blockTime: 4,
  chainId: 12227332,
  rpcUrls: ["https://neoxt4seed1.ngd.network"],
  wsUrls: ["wss://neoxt4wss1.ngd.network"],
  contracts: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// Ethereum Chains
// ============================================================================

export const ETHEREUM_MAINNET: EVMChainConfig = {
  id: "ethereum-mainnet",
  name: "Ethereum",
  nameZh: "以太坊主网",
  type: "evm",
  isTestnet: false,
  status: "active",
  icon: "/chains/ethereum.svg",
  color: "#627EEA",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  explorerUrl: "https://etherscan.io",
  blockTime: 12,
  chainId: 1,
  rpcUrls: [
    `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || "demo"}`,
    "https://eth.llamarpc.com",
  ],
  contracts: {
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    ensRegistry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const ETHEREUM_SEPOLIA: EVMChainConfig = {
  id: "ethereum-sepolia",
  name: "Ethereum Sepolia",
  nameZh: "以太坊 Sepolia 测试网",
  type: "evm",
  isTestnet: true,
  status: "active",
  icon: "/chains/ethereum.svg",
  color: "#627EEA",
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  explorerUrl: "https://sepolia.etherscan.io",
  blockTime: 12,
  chainId: 11155111,
  rpcUrls: [`https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || "demo"}`, "https://rpc.sepolia.org"],
  contracts: {
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// Polygon Chains
// ============================================================================

export const POLYGON_MAINNET: EVMChainConfig = {
  id: "polygon-mainnet",
  name: "Polygon",
  nameZh: "Polygon 主网",
  type: "evm",
  isTestnet: false,
  status: "active",
  icon: "/chains/polygon.svg",
  color: "#8247E5",
  nativeCurrency: {
    name: "MATIC",
    symbol: "MATIC",
    decimals: 18,
  },
  explorerUrl: "https://polygonscan.com",
  blockTime: 2,
  chainId: 137,
  rpcUrls: [
    `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || "demo"}`,
    "https://polygon-rpc.com",
  ],
  contracts: {
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const POLYGON_AMOY: EVMChainConfig = {
  id: "polygon-amoy",
  name: "Polygon Amoy",
  nameZh: "Polygon Amoy 测试网",
  type: "evm",
  isTestnet: true,
  status: "active",
  icon: "/chains/polygon.svg",
  color: "#8247E5",
  nativeCurrency: {
    name: "MATIC",
    symbol: "MATIC",
    decimals: 18,
  },
  explorerUrl: "https://amoy.polygonscan.com",
  blockTime: 2,
  chainId: 80002,
  rpcUrls: [
    `https://polygon-amoy.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || "demo"}`,
    "https://rpc-amoy.polygon.technology",
  ],
  contracts: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// BSC Chains
// ============================================================================

export const BSC_MAINNET: EVMChainConfig = {
  id: "bsc-mainnet",
  name: "BNB Smart Chain",
  nameZh: "币安智能链",
  type: "evm",
  isTestnet: false,
  status: "active",
  icon: "/chains/bsc.svg",
  color: "#F0B90B",
  nativeCurrency: {
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
  },
  explorerUrl: "https://bscscan.com",
  blockTime: 3,
  chainId: 56,
  rpcUrls: [
    `https://bnb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || "demo"}`,
    "https://bsc-dataseed.binance.org",
  ],
  contracts: {
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const BSC_TESTNET: EVMChainConfig = {
  id: "bsc-testnet",
  name: "BSC Testnet",
  nameZh: "币安智能链测试网",
  type: "evm",
  isTestnet: true,
  status: "active",
  icon: "/chains/bsc.svg",
  color: "#F0B90B",
  nativeCurrency: {
    name: "tBNB",
    symbol: "tBNB",
    decimals: 18,
  },
  explorerUrl: "https://testnet.bscscan.com",
  blockTime: 3,
  chainId: 97,
  rpcUrls: [
    `https://bnb-testnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || "demo"}`,
    "https://data-seed-prebsc-1-s1.binance.org:8545",
  ],
  contracts: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// Default Chain Registry
// ============================================================================

export const DEFAULT_CHAINS: ChainConfig[] = [
  NEO_N3_MAINNET,
  NEO_N3_TESTNET,
  NEOX_MAINNET,
  NEOX_TESTNET,
  ETHEREUM_MAINNET,
  ETHEREUM_SEPOLIA,
  POLYGON_MAINNET,
  POLYGON_AMOY,
  BSC_MAINNET,
  BSC_TESTNET,
];

export const DEFAULT_CHAIN_MAP: Record<string, ChainConfig> = Object.fromEntries(
  DEFAULT_CHAINS.map((chain) => [chain.id, chain]),
);
