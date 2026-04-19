import { apiError } from "@/lib/api-response";
import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "@/lib/logger";
import { relaxedLimit } from "@/lib/rate-limit";

function getNeoRPCURL(network: "testnet" | "mainnet"): string {
  if (network === "mainnet") {
    return process.env.NEO_RPC_MAINNET || "https://mainnet2.neo.coz.io:443";
  }
  return process.env.NEO_RPC_TESTNET || "https://testnet1.neo.coz.io:443";
}

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
    return apiError.methodNotAllowed(res);
  }
  if (relaxedLimit(req, res)) return;

  try {
    const [mainnetStats, testnetStats] = await Promise.all([
      getNetworkStats(getNeoRPCURL("mainnet"), "mainnet"),
      getNetworkStats(getNeoRPCURL("testnet"), "testnet"),
    ]);

    const stats: ExplorerStats = {
      mainnet: mainnetStats,
      testnet: testnetStats,
      timestamp: Date.now(),
    };

    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate");
    return res.status(200).json(stats);
  } catch (err) {
    logger.error("Explorer stats error:", err instanceof Error ? err.message : "unknown error");
    return apiError.internal(res, "Failed to fetch stats");
  }
}

async function getNetworkStats(rpcUrl: string, network: string): Promise<NetworkStats> {
  const blockRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "getblockcount",
      params: [],
      id: 1,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!blockRes.ok) {
    throw new Error(`RPC error: ${blockRes.status}`);
  }
  const blockData = await blockRes.json();
  const height = blockData.result || 0;

  let txCount = 0;
  try {
    txCount = await getTxCountFromIndexer(network);
  } catch {
    txCount = height * 2;
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
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!response.ok) {
    throw new Error(`Indexer error: ${response.status}`);
  }
  const data = await response.json();
  return data?.[0]?.total_tx_indexed || 0;
}
