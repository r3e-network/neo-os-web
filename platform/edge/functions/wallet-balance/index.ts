import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet } from "../_shared/supabase.ts";
import { getNeoRpcUrl } from "../_shared/k8s-config.ts";

const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

interface Nep17Balance {
  assethash: string;
  amount: string;
  lastupdatedblock: number;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") {
    return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "wallet-balance", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "wallet-balance");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  // Query on-chain balances
  const rpcUrl = getNeoRpcUrl();
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
    return error(500, "RPC request failed", "RPC_ERROR", req);
  }

  const data = await res.json();
  if (data.error) {
    return error(500, data.error.message, "RPC_ERROR", req);
  }

  // Parse balances
  const balances: Nep17Balance[] = data.result?.balance || [];
  const result: Record<string, string> = {};

  for (const b of balances) {
    const hash = b.assethash.toLowerCase();
    const amount = BigInt(b.amount);
    const decimals = hash === GAS_HASH.toLowerCase() ? 8n : 0n;
    const divisor = 10n ** decimals;
    const intPart = amount / divisor;
    const fracPart = amount % divisor;

    let symbol = "UNKNOWN";
    if (hash === GAS_HASH.toLowerCase()) symbol = "GAS";
    else if (hash === NEO_HASH.toLowerCase()) symbol = "NEO";

    if (decimals > 0n) {
      result[symbol] = `${intPart}.${fracPart.toString().padStart(Number(decimals), "0")}`;
    } else {
      result[symbol] = intPart.toString();
    }
  }

  // Ensure GAS and NEO are always present
  if (!result.GAS) result.GAS = "0.00000000";
  if (!result.NEO) result.NEO = "0";

  return json({ address: walletCheck.address, balances: result }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
