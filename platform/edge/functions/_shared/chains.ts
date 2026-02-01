import { getEnv } from "./env.ts";

export type ChainType = "neo-n3";

export type NativeCurrency = {
  name: string;
  symbol: string;
  decimals: number;
};

export type ChainConfig = {
  id: string;
  name: string;
  name_zh?: string;
  type: ChainType;
  is_testnet: boolean;
  status?: string;
  icon?: string;
  color?: string;
  native_currency?: NativeCurrency;
  explorer_url?: string;
  block_time?: number;
  network_magic?: number;
  chain_id?: number;
  rpc_urls: string[];
  ws_urls?: string[];
  contracts?: Record<string, string>;
};

type ChainConfigDoc = { chains: ChainConfig[] };

const DEFAULT_CHAINS: ChainConfig[] = [
  {
    id: "neo-n3-mainnet",
    name: "Neo N3",
    name_zh: "Neo N3 主网",
    type: "neo-n3",
    is_testnet: false,
    status: "active",
    rpc_urls: ["https://mainnet1.neo.coz.io:443", "https://mainnet2.neo.coz.io:443"],
    network_magic: 860833102,
    native_currency: { name: "Gas", symbol: "GAS", decimals: 8 },
    contracts: {
      // Native contracts (computed from name)
      gas: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      neo: "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5",
    },
  },
  {
    id: "neo-n3-testnet",
    name: "Neo N3 Testnet",
    name_zh: "Neo N3 测试网",
    type: "neo-n3",
    is_testnet: true,
    status: "active",
    rpc_urls: ["https://testnet1.neo.coz.io:443", "https://testnet2.neo.coz.io:443"],
    network_magic: 894710606,
    native_currency: { name: "Gas", symbol: "GAS", decimals: 8 },
    contracts: {
      gas: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      neo: "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5",
    },
  },
];

let cachedChains: ChainConfig[] | null = null;

function loadFromEnv(): ChainConfig[] | null {
  const inline = getEnv("CHAINS_CONFIG_JSON");
  if (inline) {
    const parsed = JSON.parse(inline) as ChainConfigDoc | ChainConfig[];
    return Array.isArray(parsed) ? parsed : parsed.chains;
  }
  return null;
}

export function getChains(): ChainConfig[] {
  if (cachedChains) return cachedChains;
  const fromEnv = loadFromEnv();
  cachedChains = (fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_CHAINS).filter(Boolean);
  return cachedChains;
}

export function getChainConfig(chainId: string): ChainConfig | undefined {
  return getChains().find((chain) => chain.id === chainId);
}

export function isNeoChain(chainId: string): boolean {
  return getChainConfig(chainId)?.type === "neo-n3";
}

/**
 * Get native contract address for a chain (GAS, NEO, etc.)
 * @param chainId Chain identifier
 * @param contractType Contract type (e.g., "gas", "neo")
 * @returns Contract address or undefined
 */
export function getNativeContractAddress(chainId: string, contractType: "gas" | "neo"): string | undefined {
  return getChainConfig(chainId)?.contracts?.[contractType];
}
