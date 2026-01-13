import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { getNeoRpcUrl } from "../_shared/k8s-config.ts";
import { getChainConfig } from "../_shared/chains.ts";

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
    return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
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
  if (!chain) return error(400, "unknown chain_id", "INVALID_CHAIN", req);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "20"));

  if (chain.type === "evm") {
    return json(
      {
        address: walletCheck.address,
        chain_id: chainId,
        transactions: [],
        total: 0,
      },
      {},
      req,
    );
  }

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
    return error(500, "RPC request failed", "RPC_ERROR", req);
  }

  const data = await res.json();
  if (data.error) {
    return error(500, data.error.message, "RPC_ERROR", req);
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
      asset: getAssetSymbol(tx.assethash),
      amount: formatAmount(tx.amount, tx.assethash),
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
      asset: getAssetSymbol(tx.assethash),
      amount: formatAmount(tx.amount, tx.assethash),
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
    req,
  );
}

function getAssetSymbol(hash: string): string {
  const h = hash.toLowerCase();
  if (h === "0xd2a4cff31913016155e38e474a2c06d08be276cf") return "GAS";
  if (h === "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5") return "NEO";
  return hash.slice(0, 10) + "...";
}

function formatAmount(amount: string, hash: string): string {
  const h = hash.toLowerCase();
  const decimals = h === "0xd2a4cff31913016155e38e474a2c06d08be276cf" ? 8 : 0;
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
