/**
 * Alchemy RPC Configuration
 *
 * Generates Alchemy RPC URLs for supported chains.
 */

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

// Alchemy network slugs
const ALCHEMY_NETWORKS: Record<string, string> = {
  "ethereum-mainnet": "eth-mainnet",
  "ethereum-sepolia": "eth-sepolia",
  "polygon-mainnet": "polygon-mainnet",
  "polygon-amoy": "polygon-amoy",
  "bsc-mainnet": "bnb-mainnet",
  "bsc-testnet": "bnb-testnet",
};

export function getAlchemyRpcUrl(chainId: string): string | null {
  const network = ALCHEMY_NETWORKS[chainId];
  if (!network || !ALCHEMY_API_KEY) return null;
  return `https://${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
}

export function getAlchemyWsUrl(chainId: string): string | null {
  const network = ALCHEMY_NETWORKS[chainId];
  if (!network || !ALCHEMY_API_KEY) return null;
  return `wss://${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
}

export function isAlchemySupported(chainId: string): boolean {
  return chainId in ALCHEMY_NETWORKS && !!ALCHEMY_API_KEY;
}
