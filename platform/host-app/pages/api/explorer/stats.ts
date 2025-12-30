import type { NextApiRequest, NextApiResponse } from "next";

const NEO_RPC_TESTNET = "https://testnet1.neo.coz.io:443";
const NEO_RPC_MAINNET = "https://mainnet1.neo.coz.io:443";

interface NetworkStats {
  height: number;
  txCount: number;
}

interface ExplorerStats {
  mainnet: NetworkStats;
  testnet: NetworkStats;
  timestamp: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [mainnetStats, testnetStats] = await Promise.all([
      getNetworkStats(NEO_RPC_MAINNET, "mainnet"),
      getNetworkStats(NEO_RPC_TESTNET, "testnet"),
    ]);

    const stats: ExplorerStats = {
      mainnet: mainnetStats,
      testnet: testnetStats,
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

async function getNetworkStats(rpcUrl: string, network: string): Promise<NetworkStats> {
  // Get block count
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
  const height = blockData.result || 0;

  // Get tx count from indexer if available
  let txCount = 0;
  try {
    txCount = await getTxCountFromIndexer(network);
  } catch {
    // Fallback: estimate from block height
    txCount = height * 2; // rough estimate
  }

  return { height, txCount };
}

async function getTxCountFromIndexer(network: string): Promise<number> {
  const indexerUrl = process.env.INDEXER_SUPABASE_URL;
  const indexerKey = process.env.INDEXER_SUPABASE_SERVICE_KEY;

  if (!indexerUrl || !indexerKey) {
    throw new Error("Indexer not configured");
  }

  const response = await fetch(
    `${indexerUrl}/rest/v1/indexer_sync_state?network=eq.${network}&select=total_tx_indexed`,
    {
      headers: {
        apikey: indexerKey,
        Authorization: `Bearer ${indexerKey}`,
      },
    },
  );

  const data = await response.json();
  return data?.[0]?.total_tx_indexed || 0;
}
