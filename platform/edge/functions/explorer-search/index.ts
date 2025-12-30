// Explorer Search Edge Function
// Searches transactions, addresses, contracts in the indexer database

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q")?.trim();

    if (!query) {
      return new Response(JSON.stringify({ error: "Query required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use INDEXER Supabase credentials (isolated)
    const supabaseUrl = Deno.env.get("INDEXER_SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("INDEXER_SUPABASE_SERVICE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function detectSearchType(query: string): string {
  if (query.startsWith("0x") && query.length === 66) return "transaction";
  if (query.startsWith("N") && query.length === 34) return "address";
  if (query.startsWith("0x") && query.length === 42) return "contract";
  return "unknown";
}

async function searchTransaction(supabase: any, hash: string) {
  const { data: tx } = await supabase.from("indexer_transactions").select("*").eq("hash", hash).single();

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

  return {
    type: "transaction",
    found: true,
    data: { ...tx, opcode_traces: traces || [], contract_calls: calls || [], syscalls: syscalls || [] },
  };
}

async function searchAddress(supabase: any, address: string) {
  const { data: txs, count } = await supabase
    .from("indexer_address_txs")
    .select("tx_hash, role, block_time", { count: "exact" })
    .eq("address", address)
    .order("block_time", { ascending: false })
    .limit(50);

  return { type: "address", found: (count || 0) > 0, address, tx_count: count, transactions: txs || [] };
}

async function searchContract(supabase: any, contractHash: string) {
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

async function searchAll(supabase: any, query: string) {
  // Try transaction first
  const txResult = await searchTransaction(supabase, query);
  if (txResult.found) return txResult;

  // Try address
  const addrResult = await searchAddress(supabase, query);
  if (addrResult.found) return addrResult;

  return { type: "unknown", found: false, query };
}
