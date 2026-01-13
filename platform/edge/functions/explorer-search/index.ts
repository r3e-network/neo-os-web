// Explorer Search Edge Function
// Searches transactions, addresses, contracts in the indexer database

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getChainConfig } from "../_shared/chains.ts";

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
    const chainId = url.searchParams.get("chain_id")?.trim().toLowerCase() || "neo-n3-mainnet";
    const chain = getChainConfig(chainId);
    if (!chain) {
      return new Response(JSON.stringify({ error: `Unknown chain_id: ${chainId}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!query) {
      return new Response(JSON.stringify({ error: "Query required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result;

    if (chain.type === "evm") {
      const rpcUrl = chain.rpc_urls?.[0];
      if (!rpcUrl) {
        return new Response(JSON.stringify({ error: `chain ${chainId} has no rpc_urls` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const searchType = detectSearchType(query, chain.type);
      switch (searchType) {
        case "transaction":
          result = await searchEvmTransaction(rpcUrl, query);
          break;
        case "address":
        case "contract":
          result = await searchEvmAddress(rpcUrl, query);
          break;
        default:
          result = { type: "unknown", found: false, query };
      }
    } else {
      // Use INDEXER Supabase credentials (isolated)
      const supabaseUrl = Deno.env.get("INDEXER_SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("INDEXER_SUPABASE_SERVICE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      const neoNetwork = chain.is_testnet ? "testnet" : "mainnet";

      const searchType = detectSearchType(query, chain.type);
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

function detectSearchType(query: string, chainType: "neo-n3" | "evm"): string {
  if (query.startsWith("0x") && query.length === 66) return "transaction";
  if (chainType === "neo-n3" && query.startsWith("N") && query.length === 34) return "address";
  if (query.startsWith("0x") && query.length === 42) {
    return chainType === "neo-n3" ? "contract" : "address";
  }
  return "unknown";
}

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status}`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }
  return data.result as T;
}

async function searchEvmTransaction(rpcUrl: string, hash: string) {
  const receipt = await rpcCall<Record<string, unknown> | null>(rpcUrl, "eth_getTransactionReceipt", [hash]);
  if (!receipt) return { type: "transaction", found: false };
  return { type: "transaction", found: true, data: receipt };
}

async function searchEvmAddress(rpcUrl: string, address: string) {
  const [balance, code] = await Promise.all([
    rpcCall<string>(rpcUrl, "eth_getBalance", [address, "latest"]),
    rpcCall<string>(rpcUrl, "eth_getCode", [address, "latest"]),
  ]);
  const isContract = Boolean(code && code !== "0x");
  return {
    type: isContract ? "contract" : "address",
    found: true,
    address,
    balance,
    code: isContract ? code : undefined,
  };
}

async function searchTransaction(supabase: any, hash: string, network: string) {
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

async function searchAddress(supabase: any, address: string, network: string) {
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

async function searchContract(supabase: any, contractAddress: string) {
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

async function searchAll(supabase: any, query: string, network: string) {
  // Try transaction first
  const txResult = await searchTransaction(supabase, query, network);
  if (txResult.found) return txResult;

  // Try address
  const addrResult = await searchAddress(supabase, query, network);
  if (addrResult.found) return addrResult;

  return { type: "unknown", found: false, query };
}
