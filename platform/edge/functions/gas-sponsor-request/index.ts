import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";
import { getGasBalance } from "../_shared/neo-rpc.ts";
import { transferGas } from "../_shared/txproxy.ts";

const DAILY_LIMIT = 0.1;
const MAX_PER_REQUEST = 0.05;
const ELIGIBILITY_THRESHOLD = 0.1;

type RequestBody = {
  amount: string;
};

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "gas-sponsor-request", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "gas-sponsor-request");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "BAD_JSON", req);
  }

  const amount = parseFloat(body.amount ?? "0");
  if (isNaN(amount) || amount <= 0) {
    return error(400, "amount must be positive", "INVALID_AMOUNT", req);
  }
  if (amount > MAX_PER_REQUEST) {
    return error(400, `max ${MAX_PER_REQUEST} GAS per request`, "AMOUNT_EXCEEDED", req);
  }

  const supabase = supabaseServiceClient();

  // Check current quota
  const today = new Date().toISOString().split("T")[0];
  const { data: quota } = await supabase
    .from("gas_sponsor_quotas")
    .select("used_amount")
    .eq("user_id", auth.userId)
    .eq("date", today)
    .maybeSingle();

  const usedToday = parseFloat(quota?.used_amount ?? "0");
  const remaining = DAILY_LIMIT - usedToday;

  if (amount > remaining) {
    return error(400, "exceeds daily quota", "QUOTA_EXCEEDED", req);
  }

  // Query on-chain GAS balance
  let gasBalance = 0;
  try {
    const balanceStr = await getGasBalance(walletCheck.address);
    gasBalance = parseFloat(balanceStr);
  } catch (e) {
    return error(500, `failed to query balance: ${(e as Error).message}`, "RPC_ERROR", req);
  }

  if (gasBalance >= ELIGIBILITY_THRESHOLD) {
    return error(403, "not eligible - balance too high", "NOT_ELIGIBLE", req);
  }

  // Bump quota
  const { error: bumpErr } = await supabase.rpc("gas_sponsor_bump_quota", {
    p_user_id: auth.userId,
    p_amount: amount,
  });
  if (bumpErr) {
    return error(500, `quota update failed: ${bumpErr.message}`, "DB_ERROR", req);
  }

  // Create request record
  const requestId = crypto.randomUUID();
  const { error: insertErr } = await supabase.from("gas_sponsor_requests").insert({
    id: requestId,
    user_id: auth.userId,
    amount: amount,
    status: "processing",
  });

  if (insertErr) {
    return error(500, `request creation failed: ${insertErr.message}`, "DB_ERROR", req);
  }

  // Execute GAS transfer via TxProxy
  let txHash: string | null = null;
  try {
    const txResult = await transferGas(requestId, walletCheck.address, body.amount);
    txHash = txResult.tx_hash || null;

    // Update request status
    await supabase.from("gas_sponsor_requests").update({ status: "completed", tx_hash: txHash }).eq("id", requestId);
  } catch (e) {
    // Update request as failed
    await supabase
      .from("gas_sponsor_requests")
      .update({ status: "failed", error_message: (e as Error).message })
      .eq("id", requestId);

    return error(500, `transfer failed: ${(e as Error).message}`, "TRANSFER_ERROR", req);
  }

  return json(
    {
      request_id: requestId,
      amount: amount.toFixed(8),
      status: "completed",
      tx_hash: txHash,
    },
    {},
    req,
  );
}

if (import.meta.main) {
  Deno.serve(handler);
}
