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

interface TransferRecord {
  timestamp: number;
  assethash: string;
  transferaddress: string;
  amount: string;
  blockindex: number;
  txhash: string;
}

interface TransactionItem {
  tx_hash: string;
  block: number;
  timestamp: string;
  asset: string;
  amount: string;
  direction: "in" | "out";
  counterparty: string;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") {
    return errorResponse("METHOD_NOT_ALLOWED", undefined, req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "wallet-transactions", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "wallet-transactions");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  // Parse query params
  const url = new URL(req.url);
  const chainId = url.searchParams.get("chain_id")?.trim() || "neo-n3-mainnet";
  const chain = getChainConfig(chainId);
  if (!chain) return notFoundError("chain", req);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "20"));

  try {
    // Query transaction history via RPC
    const rpcUrl = chain.rpc_urls?.[0] || getNeoRpcUrl();
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getnep17transfers",
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

    // Combine sent and received transfers
    const sent: TransferRecord[] = data.result?.sent || [];
    const received: TransferRecord[] = data.result?.received || [];

    const transactions: TransactionItem[] = [];

    // Process sent transactions
    for (const tx of sent) {
      transactions.push({
        tx_hash: tx.txhash,
        block: tx.blockindex,
        timestamp: new Date(tx.timestamp * 1000).toISOString(),
        asset: getAssetSymbol(tx.assethash, chainId),
        amount: formatAmount(tx.amount, tx.assethash, chainId),
        direction: "out",
        counterparty: tx.transferaddress || "Contract",
      });
    }

    // Process received transactions
    for (const tx of received) {
      transactions.push({
        tx_hash: tx.txhash,
        block: tx.blockindex,
        timestamp: new Date(tx.timestamp * 1000).toISOString(),
        asset: getAssetSymbol(tx.assethash, chainId),
        amount: formatAmount(tx.amount, tx.assethash, chainId),
        direction: "in",
        counterparty: tx.transferaddress || "Contract",
      });
    }

    // Sort by timestamp descending and limit
    transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return json(
      {
        address: walletCheck.address,
        chain_id: chainId,
        transactions: transactions.slice(0, limit),
        total: transactions.length,
      },
      {},
      req
    );
  } catch (err) {
    console.error("Wallet transactions error:", err);
    return errorResponse("SERVER_001", { message: (err as Error).message }, req);
  }
}

function getAssetSymbol(hash: string, chainId: string): string {
  const h = hash.toLowerCase();
  const gasHash = getNativeContractAddress(chainId, "gas")?.toLowerCase();
  const neoHash = getNativeContractAddress(chainId, "neo")?.toLowerCase();
  if (h === gasHash) return "GAS";
  if (h === neoHash) return "NEO";
  return hash.slice(0, 10) + "...";
}

function formatAmount(amount: string, hash: string, chainId: string): string {
  const h = hash.toLowerCase();
  const gasHash = getNativeContractAddress(chainId, "gas")?.toLowerCase();
  const decimals = h === gasHash ? 8 : 0;
  if (decimals === 0) return amount;

  const val = BigInt(amount);
  const div = 10n ** BigInt(decimals);
  const int = val / div;
  const frac = val % div;
  return `${int}.${frac.toString().padStart(decimals, "0")}`;
}

if (import.meta.main) {
  Deno.serve(handler);
}
