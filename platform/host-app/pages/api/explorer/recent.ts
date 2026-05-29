import { apiError } from "@/lib/api-response";
import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "@/lib/logger";
import { normalizeNeoNetwork } from "@/lib/neo-network";
import { handlePublicReadCors } from "@/lib/public-read-cors";
import { relaxedLimit } from "@/lib/rate-limit";
import { neoRpcCall, type Network } from "@/lib/explorer-rpc";

type RpcBlock = {
  hash?: unknown;
  index?: unknown;
  time?: unknown;
  tx?: unknown;
};
type RpcTransaction = Record<string, unknown> & {
  hash?: unknown;
  tx_hash?: unknown;
  vm_state?: unknown;
  vmState?: unknown;
};

const RPC_TIMEOUT_MS = 5000;

function normalizeBlockTime(value: unknown): string | null {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const millis = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  return new Date(millis).toISOString();
}

async function fetchRecentTransactionsFromRpc(
  network: Network,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  const blockCount = await neoRpcCall<number>(network, "getblockcount", [], { timeoutMs: RPC_TIMEOUT_MS });
  const latestHeight = Math.max(0, Number(blockCount || 0) - 1);
  const scanCount = Math.min(Math.max(limit * 2, 1), 8, latestHeight + 1);
  const heights = Array.from({ length: scanCount }, (_, index) => latestHeight - index);
  const blocks = await Promise.all(
    heights.map((height) =>
      neoRpcCall<RpcBlock>(network, "getblock", [height, true], { timeoutMs: RPC_TIMEOUT_MS }).catch((error: unknown) => {
        logger.warn(
          `Explorer recent RPC block ${height} failed:`,
          error instanceof Error ? error.message : String(error),
        );
        return null;
      }),
    ),
  );

  const transactions: Array<Record<string, unknown>> = [];
  for (const block of blocks) {
    if (!block || !Array.isArray(block.tx)) continue;
    const blockIndex = Number(block.index);
    const blockHash = typeof block.hash === "string" ? block.hash : "";
    const blockTime = normalizeBlockTime(block.time);
    for (const rawTx of block.tx) {
      if (!rawTx || typeof rawTx !== "object") continue;
      const tx = rawTx as RpcTransaction;
      const hash = typeof tx.hash === "string"
        ? tx.hash
        : typeof tx.tx_hash === "string"
          ? tx.tx_hash
          : "";
      if (!hash) continue;
      transactions.push({
        ...tx,
        hash,
        tx_hash: hash,
        vm_state: tx.vm_state ?? tx.vmState ?? "state unavailable",
        block_index: Number.isFinite(blockIndex) ? blockIndex : undefined,
        block_hash: blockHash || undefined,
        block_time: blockTime || undefined,
        source: "rpc",
      });
      if (transactions.length >= limit) return transactions;
    }
  }

  return transactions;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (handlePublicReadCors(req, res)) return;

  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (relaxedLimit(req, res)) return;

  const network = normalizeNeoNetwork(req.query.network);
  if (!network) {
    return apiError.badRequest(res, "network must be mainnet or testnet");
  }
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  try {
    const indexerUrl = process.env.INDEXER_SUPABASE_URL;
    const indexerKey = process.env.INDEXER_SUPABASE_SERVICE_KEY;

    if (!indexerUrl || !indexerKey) {
      const transactions = await fetchRecentTransactionsFromRpc(network, limit).catch((error: unknown) => {
        logger.warn(
          "Recent transactions RPC fallback failed:",
          error instanceof Error ? error.message : String(error),
        );
        return [];
      });
      res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
      res.status(200).json({
        network,
        source: transactions.length > 0 ? "rpc" : "unavailable",
        transactions,
        count: transactions.length,
      });
      return;
    }

    const response = await fetch(
      `${indexerUrl}/rest/v1/indexer_transactions?network=eq.${encodeURIComponent(network)}&order=block_time.desc&limit=${limit}`,
      {
        headers: {
          apikey: indexerKey,
          Authorization: `Bearer ${indexerKey}`,
        },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      const transactions = await fetchRecentTransactionsFromRpc(network, limit).catch((error: unknown) => {
        logger.warn(
          "Recent transactions RPC fallback after indexer failure failed:",
          error instanceof Error ? error.message : String(error),
        );
        return [];
      });
      res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
      res.status(200).json({
        network,
        source: transactions.length > 0 ? "rpc" : "unavailable",
        transactions,
        count: transactions.length,
      });
      return;
    }
    const transactions = await response.json();

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate");
    res.status(200).json({
      network,
      source: "indexer",
      transactions: transactions || [],
      count: transactions?.length || 0,
    });
    return;
  } catch (err) {
    logger.error(
      "Recent transactions error:",
      err instanceof Error ? err.message : "unknown error",
    );
    return apiError.internal(res, "Failed to fetch transactions");
  }
}
