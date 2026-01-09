import type { NextApiRequest, NextApiResponse } from "next";

const NEO_RPC_TESTNET = "https://testnet1.neo.coz.io:443";
const NEO_RPC_MAINNET = "https://mainnet1.neo.coz.io:443";

interface Transaction {
  hash: string;
  vmState: string;
  blockTime: string | number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const network = (req.query.network as string) || "testnet";
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  let transactions: Transaction[] = [];

  // 1. Try Indexer
  try {
    const indexerUrl = process.env.INDEXER_SUPABASE_URL;
    const indexerKey = process.env.INDEXER_SUPABASE_SERVICE_KEY;

    if (indexerUrl && indexerKey) {
      const response = await fetch(
        `${indexerUrl}/rest/v1/indexer_transactions?network=eq.${network}&order=block_time.desc&limit=${limit}`,
        {
          headers: {
            apikey: indexerKey,
            Authorization: `Bearer ${indexerKey}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        // Map indexer columns to frontend expected keys
        transactions = data.map((tx: any) => ({
          hash: tx.hash,
          vmState: tx.vm_state,
          blockTime: tx.block_time,
        }));
      }
    }
  } catch (err) {
    console.warn("Indexer fetch failed, falling back to RPC:", err);
  }

  // 2. Fallback to RPC if no transactions found yet
  if (transactions.length === 0) {
    try {
      transactions = await fetchRecentTxsFromRPC(network, limit);
    } catch (rpcErr) {
      console.error("RPC fetch failed:", rpcErr);
      // Return empty list if both fail
    }
  }

  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate");
  return res.status(200).json({
    network,
    transactions,
    count: transactions.length,
  });
}

async function fetchRecentTxsFromRPC(network: string, limit: number): Promise<Transaction[]> {
  const rpcUrl = network === "mainnet" ? NEO_RPC_MAINNET : NEO_RPC_TESTNET;
  const list: Transaction[] = [];

  // Get current height
  const countRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "getblockcount", params: [], id: 1 }),
  });
  const countData = await countRes.json();
  const height = countData.result - 1;

  // Scan backwards
  // Limit scan to 5 blocks to avoid timeout
  const maxBlocksToCheck = 10;

  for (let i = 0; i < maxBlocksToCheck; i++) {
    if (list.length >= limit) break;
    const targetHeight = height - i;
    if (targetHeight < 0) break;

    const blockRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "getblock", params: [targetHeight, 1], id: 1 }),
    });
    const blockData = await blockRes.json();
    const block = blockData.result;

    if (block && block.tx && Array.isArray(block.tx)) {
      // Reverse to get newest first in the block
      const txs = [...block.tx].reverse();
      for (const tx of txs) {
        if (list.length >= limit) break;
        list.push({
          hash: tx.hash,
          vmState: "HALT", // Assumption for RPC fallback (getting actual state requires another call)
          blockTime: new Date(block.time * 1000).toISOString(),
        });
      }
    }
  }

  return list;
}
