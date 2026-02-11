import type { NextApiRequest, NextApiResponse } from "next";
import { getChainRpcUrl } from "@/lib/chains/rpc-functions";
import { getChainRegistry } from "@/lib/chains/registry";
import type { ChainId, ChainConfig } from "@/lib/chains/types";

interface Transaction {
  hash: string;
  vmState: string;
  blockTime: string | number;
  chainType: "neo-n3";
}

interface IndexerTransaction {
  hash: string;
  vm_state: string;
  block_time: string | number;
}

/** Validate chain ID using registry */
function validateChainId(value: string | undefined): ChainId | null {
  if (!value) return null;
  const registry = getChainRegistry();
  const chain = registry.getChain(value as ChainId);
  return chain ? chain.id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawChainId = (req.query.chain_id as string) || (req.query.network as string);
  const chainId = validateChainId(rawChainId);

  if (!chainId) {
    const registry = getChainRegistry();
    const availableChains = registry.getActiveChains().map((c) => c.id);
    return res.status(400).json({
      error: "Invalid or missing chain_id",
      availableChains,
    });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const registry = getChainRegistry();
  const chainConfig = registry.getChain(chainId)!;

  let transactions: Transaction[] = [];

  // 1. Try Indexer
  try {
    const indexerUrl = process.env.INDEXER_SUPABASE_URL;
    const indexerKey = process.env.INDEXER_SUPABASE_SERVICE_KEY;

    if (indexerUrl && indexerKey) {
      const network = chainConfig.isTestnet ? "testnet" : "mainnet";
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
        transactions = data.map((tx: IndexerTransaction) => ({
          hash: tx.hash,
          vmState: tx.vm_state,
          blockTime: tx.block_time,
          chainType: "neo-n3",
        }));
      }
    }
  } catch (err) {
    console.warn("Indexer fetch failed, falling back to RPC:", err);
  }

  // 2. Fallback to RPC if no transactions found yet
  if (transactions.length === 0) {
    try {
      transactions = await fetchRecentTxsFromRPC(chainConfig, limit);
    } catch (rpcErr) {
      console.error("RPC fetch failed:", rpcErr);
    }
  }

  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate");
  return res.status(200).json({
    chainId,
    chainType: "neo-n3",
    transactions,
    count: transactions.length,
  });
}

async function fetchRecentTxsFromRPC(chainConfig: ChainConfig, limit: number): Promise<Transaction[]> {
  const chainId = chainConfig.id;
  const rpcUrl = getChainRpcUrl(chainId);
  return fetchNeoN3RecentTxs(rpcUrl, limit);
}

/** Fetch recent transactions from Neo N3 chain */
async function fetchNeoN3RecentTxs(rpcUrl: string, limit: number): Promise<Transaction[]> {
  const list: Transaction[] = [];

  // Get current height
  const countRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "getblockcount", params: [], id: 1 }),
  });
  const countData = await countRes.json();
  const height = countData.result - 1;

  // Scan backwards - limit to 10 blocks to avoid timeout
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
      const txs = [...block.tx].reverse();
      for (const tx of txs) {
        if (list.length >= limit) break;
        list.push({
          hash: tx.hash,
          vmState: "HALT",
          blockTime: new Date(block.time * 1000).toISOString(),
          chainType: "neo-n3",
        });
      }
    }
  }

  return list;
}
