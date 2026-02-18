// Explorer Search Edge Function
// Searches transactions, addresses, contracts in the indexer database

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { getEnv } from "../_shared/env.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { error, json } from "../_shared/response.ts";

async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const rl = await requireRateLimit(req, "explorer-search");
  if (rl) return rl;

  try {
    const url = new URL(req.url);
    const rawQuery = url.searchParams.get("q")?.trim();

    if (!rawQuery) {
      return error(400, "Query required", "BAD_REQUEST", req);
    }

    // Validate and sanitize input
    const query = rawQuery.slice(0, 128);
    if (!/^(0x[0-9a-fA-F]+|N[A-Za-z0-9]+)$/.test(query)) {
      return error(400, "Invalid query format", "BAD_REQUEST", req);
    }

    // Use INDEXER Supabase credentials (isolated)
    const supabaseUrl = getEnv("INDEXER_SUPABASE_URL");
    const supabaseKey = getEnv("INDEXER_SUPABASE_SERVICE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return error(500, "Indexer not configured", "CONFIG_ERROR", req);
    }

    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    const searchType = detectSearchType(query);
    let result;

    switch (searchType) {
      case "transaction":
        result = await searchTransaction(supabase, query);
        break;
      case "address":
        result = await searchAddress(supabase, query);
        break;
      case "contract":
        result = await searchContract(supabase, query);
        break;
      default:
        result = await searchAll(supabase, query);
    }

    return json(result, {}, req);
  } catch (err) {
    console.error("explorer-search error:", err instanceof Error ? err.message : "unknown error");
    return error(500, "Search failed", "INTERNAL_ERROR", req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}

export { handler };

function detectSearchType(query: string): string {
  if (/^0x[0-9a-fA-F]{64}$/.test(query)) return "transaction";
  if (/^N[A-Za-z0-9]{33}$/.test(query)) return "address";
  if (/^0x[0-9a-fA-F]{40}$/.test(query)) return "contract";
  return "unknown";
}

async function searchTransaction(supabase: SupabaseClient, hash: string) {
  const { data: tx } = await supabase.from("indexer_transactions").select("*").eq("hash", hash).single();

  if (!tx) return { type: "transaction", found: false };

  const [traces, calls, syscalls] = await Promise.all([
    supabase
      .from("indexer_opcode_traces")
      .select("*")
      .eq("tx_hash", hash)
      .order("step_index")
      .then(({ data }) => data || [])
      .catch(() => []),
    supabase
      .from("indexer_contract_calls")
      .select("*")
      .eq("tx_hash", hash)
      .order("call_index")
      .then(({ data }) => data || [])
      .catch(() => []),
    supabase
      .from("indexer_syscalls")
      .select("*")
      .eq("tx_hash", hash)
      .order("call_index")
      .then(({ data }) => data || [])
      .catch(() => []),
  ]);

  return {
    type: "transaction",
    found: true,
    data: { ...tx, opcode_traces: traces, contract_calls: calls, syscalls: syscalls },
  };
}

async function searchAddress(supabase: SupabaseClient, address: string) {
  const { data: txs, count } = await supabase
    .from("indexer_address_txs")
    .select("tx_hash, role, block_time", { count: "exact" })
    .eq("address", address)
    .order("block_time", { ascending: false })
    .limit(50);

  return { type: "address", found: (count || 0) > 0, address, tx_count: count, transactions: txs || [] };
}

async function searchContract(supabase: SupabaseClient, contractHash: string) {
  const { data: calls, count } = await supabase
    .from("indexer_contract_calls")
    .select("tx_hash, method, gas_consumed, success", { count: "exact" })
    .eq("contract_hash", contractHash)
    .order("id", { ascending: false })
    .limit(50);

  return {
    type: "contract",
    found: (count || 0) > 0,
    contract_hash: contractHash,
    call_count: count,
    calls: calls || [],
  };
}

async function searchAll(supabase: SupabaseClient, query: string) {
  // Try transaction first
  const txResult = await searchTransaction(supabase, query);
  if (txResult.found) return txResult;

  // Try address
  const addrResult = await searchAddress(supabase, query);
  if (addrResult.found) return addrResult;

  return { type: "unknown", found: false, query };
}
