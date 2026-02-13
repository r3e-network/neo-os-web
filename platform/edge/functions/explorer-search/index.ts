// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { getChainConfig } from "../_shared/chains.ts";
import { json } from "../_shared/response.ts";
import { validationError, notFoundError } from "../_shared/error-codes.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const handler = createHandler({ method: "GET", auth: false }, async ({ req, url }) => {
  const query = url.searchParams.get("q")?.trim();
  if (!query) return validationError("q", "query required", req);

  const chainId = url.searchParams.get("chain_id")?.trim().toLowerCase() || "neo-n3-mainnet";
  const chain = getChainConfig(chainId);
  if (!chain) return notFoundError("chain", req);

  // Use INDEXER Supabase credentials (isolated)
  const supabaseUrl = Deno.env.get("INDEXER_SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("INDEXER_SUPABASE_SERVICE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const neoNetwork = chain.is_testnet ? "testnet" : "mainnet";

  const searchType = detectSearchType(query);
  let result;
  switch (searchType) {
    case "transaction":
      result = await searchTransaction(supabase, query, neoNetwork);
      break;
    case "address":
      result = await searchAddress(supabase, query, neoNetwork);
      break;
    case "contract":
      result = await searchContract(supabase, query);
      break;
    default:
      result = await searchAll(supabase, query, neoNetwork);
  }

  return json(result, {}, req);
});

if (import.meta.main) {
  Deno.serve(handler);
}

function detectSearchType(query: string): string {
  if (query.startsWith("0x") && query.length === 66) return "transaction";
  if (query.startsWith("N") && query.length === 34) return "address";
  if (query.startsWith("0x") && query.length === 42) return "contract";
  return "unknown";
}

async function searchTransaction(supabase: SupabaseClient, hash: string, network: string) {
  let txQuery = supabase.from("indexer_transactions").select("*").eq("hash", hash);
  if (network) {
    txQuery = txQuery.eq("network", network);
  }
  const { data: tx } = await txQuery.single();

  if (!tx) return { type: "transaction", found: false };

  const { data: traces } = await supabase
    .from("indexer_opcode_traces")
    .select("*")
    .eq("tx_hash", hash)
    .order("step_index");

  const { data: calls } = await supabase
    .from("indexer_contract_calls")
    .select("*")
    .eq("tx_hash", hash)
    .order("call_index");

  const { data: syscalls } = await supabase
    .from("indexer_syscalls")
    .select("*")
    .eq("tx_hash", hash)
    .order("call_index");

  const mappedTraces = traces || [];
  const mappedCalls = calls || [];
  const mappedSyscalls = syscalls || [];

  return {
    type: "transaction",
    found: true,
    data: { ...tx, opcode_traces: mappedTraces, contract_calls: mappedCalls, syscalls: mappedSyscalls },
  };
}

async function searchAddress(supabase: SupabaseClient, address: string, network: string) {
  let txQuery = supabase
    .from("indexer_address_txs")
    .select("tx_hash, role, block_time", { count: "exact" })
    .eq("address", address)
    .order("block_time", { ascending: false })
    .limit(50);
  if (network) {
    txQuery = txQuery.eq("network", network);
  }
  const { data: txs, count } = await txQuery;

  return { type: "address", found: (count || 0) > 0, address, tx_count: count, transactions: txs || [] };
}

async function searchContract(supabase: SupabaseClient, contractAddress: string) {
  const { data: calls, count } = await supabase
    .from("indexer_contract_calls")
    .select("tx_hash, method, gas_consumed, success", { count: "exact" })
    .eq("contract_address", contractAddress)
    .order("id", { ascending: false })
    .limit(50);

  const mappedCalls = calls || [];

  return {
    type: "contract",
    found: (count || 0) > 0,
    contract_address: contractAddress,
    call_count: count,
    calls: mappedCalls,
  };
}

async function searchAll(supabase: SupabaseClient, query: string, network: string) {
  // Try transaction first
  const txResult = await searchTransaction(supabase, query, network);
  if (txResult.found) return txResult;

  // Try address
  const addrResult = await searchAddress(supabase, query, network);
  if (addrResult.found) return addrResult;

  return { type: "unknown", found: false, query };
}
