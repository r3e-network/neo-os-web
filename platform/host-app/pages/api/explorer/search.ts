import { apiError } from "@/lib/api-response";
import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";

type Network = "mainnet" | "testnet";

function getNeoRPCURL(network: Network): string {
  if (network === "mainnet") {
    return process.env.NEO_RPC_MAINNET || "https://api.n3index.dev/mainnet";
  }
  return process.env.NEO_RPC_TESTNET || "https://api.n3index.dev/testnet";
}

// Explorer Search API - proxies to Edge Function or queries indexer directly
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  const { q } = req.query;
  if (!q || typeof q !== "string") {
    return apiError.badRequest(res, "Query parameter 'q' required");
  }

  const network: Network = req.query.network === "mainnet" ? "mainnet" : "testnet";

  // Validate and sanitize search input. Only chain-resolvable identifiers are
  // accepted: block heights, tx/block hashes, Neo addresses, and contract hashes.
  const query = q.trim().slice(0, 128);
  if (!query) {
    return apiError.badRequest(res, "Query parameter 'q' required");
  }
  if (
    query.length > 128 ||
    !/^(\d{1,10}|0x[0-9a-fA-F]{40}|0x[0-9a-fA-F]{64}|N[A-Za-z0-9]{20,40})$/.test(query)
  ) {
    return apiError.badRequest(res, "Invalid search query format");
  }

  try {
    // Use INDEXER Supabase credentials (isolated from main platform)
    const indexerUrl = process.env.INDEXER_SUPABASE_URL;
    const indexerKey = process.env.INDEXER_SUPABASE_SERVICE_KEY;

    const searchType = detectSearchType(query);
    let result;

    switch (searchType) {
      case "block":
        result = await searchBlock(network, query);
        break;
      case "hash":
        result = await searchTransaction(indexerUrl, indexerKey, network, query);
        if (!result.found) result = await searchBlock(network, query);
        break;
      case "address":
        if (!indexerUrl || !indexerKey) {
          result = {
            type: "address",
            found: false,
            network,
            address: query,
            source: "indexer_unavailable",
          };
          break;
        }
        result = await searchAddress(indexerUrl, indexerKey, query);
        break;
      case "contract":
        result = await searchContract(indexerUrl, indexerKey, network, query);
        break;
      default:
        result = { type: "unknown", found: false, network, query };
    }

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    res.status(200).json(result);
    return;
  } catch (error) {
    logger.error(
      "Explorer search error:",
      error instanceof Error ? error.message : "unknown error",
    );
    return apiError.internal(res, "Search failed");
  }
}

function detectSearchType(query: string): string {
  if (/^\d+$/.test(query)) return "block";
  if (query.startsWith("0x") && query.length === 66) return "hash";
  if (query.startsWith("N") && query.length === 34) return "address";
  if (query.startsWith("0x") && query.length === 42) return "contract";
  return "unknown";
}

async function rpcCall<T>(
  network: Network,
  method: string,
  params: unknown[],
): Promise<T> {
  const response = await fetch(getNeoRPCURL(network), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: 1,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`RPC error: ${response.status}`);
  }
  const payload = await response.json();
  if (payload?.error) {
    throw new Error(String(payload.error.message || payload.error.code || "RPC error"));
  }
  return payload?.result as T;
}

async function supabaseQuery(
  url: string,
  key: string,
  table: string,
  params: string,
): Promise<unknown[]> {
  const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return [];
  try {
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function searchBlock(network: Network, query: string) {
  const heightOrHash = /^\d+$/.test(query) ? Number(query) : query;
  try {
    const block = await rpcCall<Record<string, unknown>>(network, "getblock", [
      heightOrHash,
      true,
    ]);
    if (!block) return { type: "block", found: false, network, query };
    const txs = Array.isArray(block.tx) ? block.tx : [];
    return {
      type: "block",
      found: true,
      network,
      data: {
        ...block,
        tx_count: txs.length,
      },
    };
  } catch {
    return { type: "block", found: false, network, query };
  }
}

async function searchTransaction(
  url: string | undefined,
  key: string | undefined,
  network: Network,
  hash: string,
) {
  if (!url || !key) return searchTransactionRpc(network, hash);

  const safeHash = encodeURIComponent(hash);
  const tx = await supabaseQuery(
    url,
    key,
    "indexer_transactions",
    `hash=eq.${safeHash}&limit=1`,
  );
  if (!tx || tx.length === 0) return searchTransactionRpc(network, hash);

  const [traces, calls, syscalls] = await Promise.all([
    supabaseQuery(
      url,
      key,
      "indexer_opcode_traces",
      `tx_hash=eq.${safeHash}&order=step_index&limit=500`,
    ),
    supabaseQuery(
      url,
      key,
      "indexer_contract_calls",
      `tx_hash=eq.${safeHash}&order=call_index&limit=200`,
    ),
    supabaseQuery(
      url,
      key,
      "indexer_syscalls",
      `tx_hash=eq.${safeHash}&order=call_index&limit=200`,
    ),
  ]);

  return {
    type: "transaction",
    found: true,
    network,
    data: {
      ...(tx[0] as Record<string, unknown>),
      opcode_traces: traces || [],
      contract_calls: calls || [],
      syscalls: syscalls || [],
    },
  };
}

async function searchTransactionRpc(network: Network, hash: string) {
  try {
    const tx = await rpcCall<Record<string, unknown>>(network, "getrawtransaction", [
      hash,
      true,
    ]);
    if (!tx) return { type: "transaction", found: false, network };
    const signers = Array.isArray(tx.signers) ? tx.signers : [];
    const firstSigner = signers[0] as Record<string, unknown> | undefined;
    return {
      type: "transaction",
      found: true,
      network,
      data: {
        ...tx,
        sender: String(firstSigner?.account || ""),
        vm_state: String(tx.vmstate || tx.vm_state || ""),
        gas_consumed: String(tx.sysfee || tx.netfee || ""),
        block_index: Number(tx.blockindex || tx.block_index || 0),
        block_time: String(tx.blocktime || tx.block_time || ""),
        opcode_traces: [],
        contract_calls: [],
        syscalls: [],
      },
      source: "rpc",
    };
  } catch {
    return { type: "transaction", found: false, network };
  }
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
  return {
    type: "address",
    found: count > 0,
    address,
    tx_count: count,
    transactions: txs || [],
  };
}

async function searchContract(
  url: string | undefined,
  key: string | undefined,
  network: Network,
  contractHash: string,
) {
  if (!url || !key) return searchContractRpc(network, contractHash);

  const safeHash = encodeURIComponent(contractHash);
  const calls = await supabaseQuery(
    url,
    key,
    "indexer_contract_calls",
    `contract_hash=eq.${safeHash}&order=id.desc&limit=50`,
  );
  const count = calls?.length || 0;
  return {
    type: "contract",
    found: count > 0,
    network,
    contract_hash: contractHash,
    call_count: count,
    calls: calls || [],
  };
}

async function searchContractRpc(network: Network, contractHash: string) {
  try {
    const contract = await rpcCall<Record<string, unknown>>(network, "getcontractstate", [
      contractHash,
    ]);
    if (!contract) return { type: "contract", found: false, network, contract_hash: contractHash };
    return {
      type: "contract",
      found: true,
      network,
      contract_hash: contractHash,
      call_count: 0,
      calls: [],
      data: contract,
      source: "rpc",
    };
  } catch {
    return { type: "contract", found: false, network, contract_hash: contractHash };
  }
}
