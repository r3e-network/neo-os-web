// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

import { handleCorsPreflight } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, notFoundError } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { getNeoRpcUrl } from "../_shared/k8s-config.ts";
import { getChainConfig, getNativeContractAddress } from "../_shared/chains.ts";

interface Nep17Balance {
  assethash: string;
  amount: string;
  lastupdatedblock: number;
}

function formatUnits(value: bigint, decimals: number): string {
  if (decimals <= 0) return value.toString();
  const divisor = 10n ** BigInt(decimals);
  const intPart = value / divisor;
  const fracPart = value % divisor;
  const fracStr = fracPart.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr ? `${intPart}.${fracStr}` : intPart.toString();
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") {
    return errorResponse("METHOD_NOT_ALLOWED", undefined, req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "wallet-balance", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "wallet-balance");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  const url = new URL(req.url);
  const chainId = url.searchParams.get("chain_id")?.trim() || "neo-n3-mainnet";
  const chain = getChainConfig(chainId);
  if (!chain) return notFoundError("chain", req);

  if (chain.type === "evm") {
    const rpcUrl = chain.rpc_urls?.[0];
    if (!rpcUrl) return errorResponse("SERVER_001", { message: "RPC endpoint not configured" }, req);
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [walletCheck.address, "latest"],
      }),
    });

    if (!res.ok) {
      return errorResponse("SERVER_002", { message: "RPC request failed" }, req);
    }

    const data = await res.json();
    if (data.error) {
      return errorResponse("SERVER_002", { message: data.error.message }, req);
    }

    const raw = String(data.result || "0x0");
    const wei = BigInt(raw);
    const decimals = chain.native_currency?.decimals ?? 18;
    const symbol = chain.native_currency?.symbol ?? "ETH";
    const balance = formatUnits(wei, decimals);

    return json({ address: walletCheck.address, chain_id: chainId, balances: { [symbol]: balance } }, {}, req);
  }

  // Query on-chain balances
  const rpcUrl = chain.rpc_urls?.[0] || getNeoRpcUrl();
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getnep17balances",
      params: [walletCheck.address],
    }),
  });

  if (!res.ok) {
    return errorResponse("SERVER_002", { message: "RPC request failed" }, req);
  }

  const data = await res.json();
  if (data.error) {
    return errorResponse("SERVER_002", { message: data.error.message }, req);
  }

  // Parse balances
  const balances: Nep17Balance[] = data.result?.balance || [];
  const result: Record<string, string> = {};

  // Get native contract addresses for this chain
  const gasHash = getNativeContractAddress(chainId, "gas")?.toLowerCase();
  const neoHash = getNativeContractAddress(chainId, "neo")?.toLowerCase();

  for (const b of balances) {
    const hash = b.assethash.toLowerCase();
    const amount = BigInt(b.amount);
    const decimals = hash === gasHash ? 8n : 0n;
    const divisor = 10n ** decimals;
    const intPart = amount / divisor;
    const fracPart = amount % divisor;

    let symbol = "UNKNOWN";
    if (hash === gasHash) symbol = "GAS";
    else if (hash === neoHash) symbol = "NEO";

    if (decimals > 0n) {
      result[symbol] = `${intPart}.${fracPart.toString().padStart(Number(decimals), "0")}`;
    } else {
      result[symbol] = intPart.toString();
    }
  }

  // Ensure GAS and NEO are always present
  if (!result.GAS) result.GAS = "0.00000000";
  if (!result.NEO) result.NEO = "0";

  return json({ address: walletCheck.address, chain_id: chainId, balances: result }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
