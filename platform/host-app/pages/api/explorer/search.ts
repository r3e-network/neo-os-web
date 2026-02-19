import { apiError } from "@/lib/api-response";
import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";

// Explorer Search API - proxies to Edge Function or queries indexer directly
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  const { q } = req.query;
  if (!q || typeof q !== "string") {
    return apiError.badRequest(res, "Query parameter 'q' required");
  }

  // Validate and sanitize search input
  const query = q.trim().slice(0, 128);
  if (!query) {
    return apiError.badRequest(res, "Query parameter 'q' required");
  }
  // Only allow hex hashes (0x...) and Neo N3 addresses (N...), bounded length
  if (query.length > 256 || !/^(0x[0-9a-fA-F]+|N[A-Za-z0-9]+)$/.test(query)) {
    return apiError.badRequest(res, "Invalid search query format");
  }

  try {
    // Use INDEXER Supabase credentials (isolated from main platform)
    const indexerUrl = process.env.INDEXER_SUPABASE_URL;
    const indexerKey = process.env.INDEXER_SUPABASE_SERVICE_KEY;

    if (!indexerUrl || !indexerKey) {
      return apiError.internal(res, "Indexer not configured");
    }

    const searchType = detectSearchType(query);
    let result;

    switch (searchType) {
      case "transaction":
        result = await searchTransaction(indexerUrl, indexerKey, query);
        break;
      case "address":
        result = await searchAddress(indexerUrl, indexerKey, query);
        break;
      case "contract":
        result = await searchContract(indexerUrl, indexerKey, query);
        break;
      default:
        result = await searchAll(indexerUrl, indexerKey, query);
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Explorer search error:", error instanceof Error ? error.message : "unknown error");
    return apiError.internal(res, "Search failed");
  }
}

function detectSearchType(query: string): string {
  if (query.startsWith("0x") && query.length === 66) return "transaction";
  if (query.startsWith("N") && query.length === 34) return "address";
  if (query.startsWith("0x") && query.length === 42) return "contract";
  return "unknown";
}

async function supabaseQuery(url: string, key: string, table: string, params: string): Promise<unknown[]> {
  const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function searchTransaction(url: string, key: string, hash: string) {
  const safeHash = encodeURIComponent(hash);
  const tx = await supabaseQuery(url, key, "indexer_transactions", `hash=eq.${safeHash}&limit=1`);
  if (!tx || tx.length === 0) return { type: "transaction", found: false };

  const [traces, calls, syscalls] = await Promise.all([
    supabaseQuery(url, key, "indexer_opcode_traces", `tx_hash=eq.${safeHash}&order=step_index&limit=500`),
    supabaseQuery(url, key, "indexer_contract_calls", `tx_hash=eq.${safeHash}&order=call_index&limit=200`),
    supabaseQuery(url, key, "indexer_syscalls", `tx_hash=eq.${safeHash}&order=call_index&limit=200`),
  ]);

  return {
    type: "transaction",
    found: true,
    data: { ...(tx[0] as Record<string, unknown>), opcode_traces: traces || [], contract_calls: calls || [], syscalls: syscalls || [] },
  };
}

async function searchAddress(url: string, key: string, address: string) {
  const safeAddress = encodeURIComponent(address);
  const txs = await supabaseQuery(
    url,
    key,
    "indexer_address_txs",
    `address=eq.${safeAddress}&order=block_time.desc&limit=50`,
  );
  const count = txs?.length || 0;
  return { type: "address", found: count > 0, address, tx_count: count, transactions: txs || [] };
}

async function searchContract(url: string, key: string, contractHash: string) {
  const safeHash = encodeURIComponent(contractHash);
  const calls = await supabaseQuery(
    url,
    key,
    "indexer_contract_calls",
    `contract_hash=eq.${safeHash}&order=id.desc&limit=50`,
  );
  const count = calls?.length || 0;
  return { type: "contract", found: count > 0, contract_hash: contractHash, call_count: count, calls: calls || [] };
}

async function searchAll(url: string, key: string, query: string) {
  const txResult = await searchTransaction(url, key, query);
  if (txResult.found) return txResult;
  const addrResult = await searchAddress(url, key, query);
  if (addrResult.found) return addrResult;
  return { type: "unknown", found: false, query };
}
