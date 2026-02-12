// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { errorResponse } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";
import { getGasBalance } from "../_shared/neo-rpc.ts";

const DAILY_LIMIT = 0.1;
const ELIGIBILITY_THRESHOLD = 0.1;

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "gas-sponsor-check", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "gas-sponsor-check");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  const supabase = supabaseServiceClient();

  // Get today's quota usage
  const today = new Date().toISOString().split("T")[0];
  const { data: quota, error: quotaErr } = await supabase
    .from("gas_sponsor_quotas")
    .select("used_amount, request_count")
    .eq("user_id", auth.userId)
    .eq("date", today)
    .maybeSingle();

  if (quotaErr) {
    return errorResponse("SERVER_002", { message: `failed to check quota: ${quotaErr.message}` }, req);
  }

  const usedToday = parseFloat(quota?.used_amount ?? "0");
  const remaining = Math.max(0, DAILY_LIMIT - usedToday);

  // Query on-chain GAS balance
  let gasBalance = 0;
  try {
    const balanceStr = await getGasBalance(walletCheck.address);
    gasBalance = parseFloat(balanceStr);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return errorResponse("SERVER_001", { message: `failed to query balance: ${message}` }, req);
  }

  const eligible = gasBalance < ELIGIBILITY_THRESHOLD && remaining > 0;

  // Calculate reset time (midnight UTC)
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  return json(
    {
      eligible,
      gas_balance: gasBalance.toFixed(8),
      daily_limit: DAILY_LIMIT.toFixed(8),
      used_today: usedToday.toFixed(8),
      remaining: remaining.toFixed(8),
      resets_at: tomorrow.toISOString(),
    },
    {},
    req
  );
}

if (import.meta.main) {
  Deno.serve(handler);
}
