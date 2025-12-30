import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";
import { getGasBalance } from "../_shared/neo-rpc.ts";

const DAILY_LIMIT = 0.1;
const ELIGIBILITY_THRESHOLD = 0.1;

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

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
    return error(500, `failed to check quota: ${quotaErr.message}`, "DB_ERROR", req);
  }

  const usedToday = parseFloat(quota?.used_amount ?? "0");
  const remaining = Math.max(0, DAILY_LIMIT - usedToday);

  // Query on-chain GAS balance
  let gasBalance = 0;
  try {
    const balanceStr = await getGasBalance(walletCheck.address);
    gasBalance = parseFloat(balanceStr);
  } catch (e) {
    return error(500, `failed to query balance: ${(e as Error).message}`, "RPC_ERROR", req);
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
    req,
  );
}

if (import.meta.main) {
  Deno.serve(handler);
}
