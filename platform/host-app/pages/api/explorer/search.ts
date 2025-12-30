import type { NextApiRequest, NextApiResponse } from "next";

// Explorer Search API - proxies to Edge Function or queries indexer directly
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { q } = req.query;
  if (!q || typeof q !== "string") {
    return res.status(400).json({ error: "Query parameter 'q' required" });
  }

  try {
    // Use INDEXER Supabase credentials (isolated from main platform)
    const indexerUrl = process.env.INDEXER_SUPABASE_URL;
    const indexerKey = process.env.INDEXER_SUPABASE_SERVICE_KEY;

    if (!indexerUrl || !indexerKey) {
      return res.status(500).json({ error: "Indexer not configured" });
    }

    const searchType = detectSearchType(q);
    let result;

    switch (searchType) {
      case "transaction":
        result = await searchTransaction(indexerUrl, indexerKey, q);
        break;
      case "address":
        result = await searchAddress(indexerUrl, indexerKey, q);
        break;
      case "contract":
        result = await searchContract(indexerUrl, indexerKey, q);
        break;
      default:
        result = await searchAll(indexerUrl, indexerKey, q);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Explorer search error:", error);
    return res.status(500).json({ error: "Search failed" });
  }
}

function detectSearchType(query: string): string {
  if (query.startsWith("0x") && query.length === 66) return "transaction";
  if (query.startsWith("N") && query.length === 34) return "address";
  if (query.startsWith("0x") && query.length === 42) return "contract";
  return "unknown";
}

async function supabaseQuery(url: string, key: string, table: string, params: string) {
  const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  return response.json();
}

async function searchTransaction(url: string, key: string, hash: string) {
  const tx = await supabaseQuery(url, key, "indexer_transactions", `hash=eq.${hash}&limit=1`);
  if (!tx || tx.length === 0) return { type: "transaction", found: false };

  const [traces, calls, syscalls] = await Promise.all([
    supabaseQuery(url, key, "indexer_opcode_traces", `tx_hash=eq.${hash}&order=step_index`),
    supabaseQuery(url, key, "indexer_contract_calls", `tx_hash=eq.${hash}&order=call_index`),
    supabaseQuery(url, key, "indexer_syscalls", `tx_hash=eq.${hash}&order=call_index`),
  ]);

  return {
    type: "transaction",
    found: true,
    data: { ...tx[0], opcode_traces: traces || [], contract_calls: calls || [], syscalls: syscalls || [] },
  };
}

async function searchAddress(url: string, key: string, address: string) {
  const txs = await supabaseQuery(
    url,
    key,
    "indexer_address_txs",
    `address=eq.${address}&order=block_time.desc&limit=50`,
  );
  const count = txs?.length || 0;
  return { type: "address", found: count > 0, address, tx_count: count, transactions: txs || [] };
}

async function searchContract(url: string, key: string, contractHash: string) {
  const calls = await supabaseQuery(
    url,
    key,
    "indexer_contract_calls",
    `contract_hash=eq.${contractHash}&order=id.desc&limit=50`,
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
