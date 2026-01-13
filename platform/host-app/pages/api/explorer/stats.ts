import type { NextApiRequest, NextApiResponse } from "next";
import { getChainRpcUrl } from "../../../lib/chain/rpc-client";
import { getChainRegistry } from "../../../lib/chains/registry";
import type { ChainId, ChainConfig } from "../../../lib/chains/types";
import { isNeoN3Chain } from "../../../lib/chains/types";

interface NetworkStats {
  height: number;
  txCount: number;
  chainType: "neo-n3" | "evm";
}

interface ExplorerStats {
  chains: Record<ChainId, NetworkStats>;
  timestamp: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get active chains from registry dynamically
    const registry = getChainRegistry();
    const activeChains = registry.getActiveChains();

    const chainStats = await Promise.all(
      activeChains.map(async (chainConfig) => {
        const stats = await getNetworkStats(chainConfig);
        return { chainId: chainConfig.id, stats };
      }),
    );

    const chains: Record<string, NetworkStats> = {};
    for (const { chainId, stats } of chainStats) {
      chains[chainId] = stats;
    }

    const stats: ExplorerStats = {
      chains: chains as Record<ChainId, NetworkStats>,
      timestamp: Date.now(),
    };

    // Cache for 15 seconds
    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate");
    return res.status(200).json(stats);
  } catch (err) {
    console.error("Explorer stats error:", err);
    return res.status(500).json({
      error: "Failed to fetch stats",
      details: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

async function getNetworkStats(chainConfig: ChainConfig): Promise<NetworkStats> {
  const chainId = chainConfig.id;
  const rpcUrl = getChainRpcUrl(chainId);
  const isNeo = isNeoN3Chain(chainConfig);

  // Get block height based on chain type
  let height = 0;
  try {
    if (isNeo) {
      const blockRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "getblockcount",
          params: [],
          id: 1,
        }),
      });
      const blockData = await blockRes.json();
      height = blockData.result || 0;
    } else {
      // EVM chain
      const blockRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        }),
      });
      const blockData = await blockRes.json();
      height = parseInt(blockData.result || "0x0", 16);
    }
  } catch (err) {
    console.error(`Failed to fetch block count for ${chainId}:`, err);
  }

  // Get tx count from indexer if available
  let txCount = 0;
  try {
    txCount = await getTxCountFromIndexer(chainConfig);
  } catch {
    // Ignore error, will fall back
  }

  // Fallback: estimate from block height if indexer fails or returns 0
  if (txCount === 0 && height > 0) {
    // Different estimates for different chain types
    const avgTxPerBlock = isNeo ? 3.5 : 150; // EVM chains typically have more tx/block
    txCount = Math.floor(height * avgTxPerBlock);
  }

  return {
    height,
    txCount,
    chainType: isNeo ? "neo-n3" : "evm",
  };
}

async function getTxCountFromIndexer(chainConfig: ChainConfig): Promise<number> {
  if (!isNeoN3Chain(chainConfig)) {
    return 0;
  }
  const indexerUrl = process.env.INDEXER_SUPABASE_URL;
  const indexerKey = process.env.INDEXER_SUPABASE_SERVICE_KEY;

  if (!indexerUrl || !indexerKey) {
    console.warn("Indexer not configured, returning 0 for tx count");
    return 0; // Return 0 to trigger fallback calculation
  }

  const network = chainConfig.isTestnet ? "testnet" : "mainnet";

  try {
    const response = await fetch(
      `${indexerUrl}/rest/v1/indexer_sync_state?network=eq.${network}&select=total_tx_indexed`,
      {
        headers: {
          apikey: indexerKey,
          Authorization: `Bearer ${indexerKey}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Indexer API returned ${response.status}`);
    }

    const data = await response.json();
    return data?.[0]?.total_tx_indexed || 0;
  } catch (e) {
    console.warn(`Failed to fetch tx count from indexer for ${chainConfig.id}:`, e);
    return 0;
  }
}
