import { getEnv } from "./env.ts";

export type ChainType = "neo-n3" | "evm";

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
  },
  {
    id: "neox-mainnet",
    name: "NeoX",
    name_zh: "NeoX 主网",
    type: "evm",
    is_testnet: false,
    status: "active",
    rpc_urls: ["https://mainnet-1.rpc.banelabs.org"],
    chain_id: 47763,
  },
  {
    id: "neox-testnet",
    name: "NeoX Testnet",
    name_zh: "NeoX 测试网",
    type: "evm",
    is_testnet: true,
    status: "active",
    rpc_urls: ["https://neoxt4seed1.ngd.network"],
    chain_id: 12227332,
  },
  {
    id: "ethereum-mainnet",
    name: "Ethereum",
    name_zh: "以太坊主网",
    type: "evm",
    is_testnet: false,
    status: "active",
    rpc_urls: ["https://eth.llamarpc.com"],
    chain_id: 1,
  },
  {
    id: "ethereum-sepolia",
    name: "Ethereum Sepolia",
    name_zh: "以太坊 Sepolia 测试网",
    type: "evm",
    is_testnet: true,
    status: "active",
    rpc_urls: ["https://rpc.sepolia.org"],
    chain_id: 11155111,
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

export function isEvmChain(chainId: string): boolean {
  return getChainConfig(chainId)?.type === "evm";
}
