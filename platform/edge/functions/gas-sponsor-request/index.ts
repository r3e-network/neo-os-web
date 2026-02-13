// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
import "../_shared/deno.d.ts";

import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";
import { getGasBalance } from "../_shared/neo-rpc.ts";
import { transferGas } from "../_shared/txproxy.ts";
import { createHandler } from "../_shared/handler.ts";

const DAILY_LIMIT = 0.1;
const MAX_PER_REQUEST = 0.05;
const ELIGIBILITY_THRESHOLD = 0.1;

type RequestBody = {
  amount: string;
};

export const handler = createHandler(
  { method: "POST", rateLimit: "gas-sponsor-request", scope: "gas-sponsor-request", requireWallet: true },
  async ({ req, auth, wallet }) => {
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse("BAD_JSON", undefined, req);
    }

    const amount = parseFloat(body.amount ?? "0");
    if (isNaN(amount) || amount <= 0) {
      return validationError("amount", "amount must be positive", req);
    }
    if (amount > MAX_PER_REQUEST) {
      return validationError("amount", `max ${MAX_PER_REQUEST} GAS per request`, req);
    }

    const supabase = supabaseServiceClient();

    // SECURITY FIX: Use atomic quota check and update to prevent race conditions
    // The RPC function gas_sponsor_atomic_claim performs:
    // 1. SELECT FOR UPDATE on the quota row (row-level lock)
    // 2. Check if used_amount + requested_amount <= daily_limit
    // 3. UPDATE the quota if allowed
    // 4. Return success/failure atomically
    const { data: claimResult, error: claimErr } = await supabase.rpc("gas_sponsor_atomic_claim", {
      p_user_id: auth.userId,
      p_amount: amount,
      p_daily_limit: DAILY_LIMIT,
    });

    if (claimErr) {
      return errorResponse("SERVER_002", { message: `quota check failed: ${claimErr.message}` }, req);
    }

    // RPC returns { success: boolean, remaining: number, message?: string }
    const claim = claimResult as { success: boolean; remaining: number; message?: string } | null;
    if (!claim?.success) {
      const msg = claim?.message || "exceeds daily quota";
      return errorResponse("VAL_009", { message: msg, daily_limit: DAILY_LIMIT }, req);
    }

    // Query on-chain GAS balance
    let gasBalance = 0;
    try {
      const balanceStr = await getGasBalance(wallet.address);
      gasBalance = parseFloat(balanceStr);
    } catch (e: unknown) {
      // Rollback quota claim on failure
      await supabase.rpc("gas_sponsor_rollback_claim", {
        p_user_id: auth.userId,
        p_amount: amount,
      });
      const message = e instanceof Error ? e.message : String(e);
      return errorResponse("SERVER_001", { message: `failed to query balance: ${message}` }, req);
    }

    if (gasBalance >= ELIGIBILITY_THRESHOLD) {
      // Rollback quota claim - user is not eligible
      await supabase.rpc("gas_sponsor_rollback_claim", {
        p_user_id: auth.userId,
        p_amount: amount,
      });
      return errorResponse("AUTH_004", { message: "not eligible - balance too high" }, req);
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
      // Rollback quota claim on failure
      await supabase.rpc("gas_sponsor_rollback_claim", {
        p_user_id: auth.userId,
        p_amount: amount,
      });
      return errorResponse("SERVER_002", { message: `request creation failed: ${insertErr.message}` }, req);
    }

    // Execute GAS transfer via TxProxy
    let txHash: string | null = null;
    try {
      const txResult = await transferGas(requestId, wallet.address, body.amount);
      txHash = txResult.tx_hash || null;

      // Update request status
      await supabase.from("gas_sponsor_requests").update({ status: "completed", tx_hash: txHash }).eq("id", requestId);
    } catch (e: unknown) {
      // Update request as failed (but quota already consumed - this is intentional to prevent abuse)
      const message = e instanceof Error ? e.message : String(e);
      await supabase
        .from("gas_sponsor_requests")
        .update({ status: "failed", error_message: message })
        .eq("id", requestId);

      return errorResponse("SERVER_001", { message: `transfer failed: ${message}` }, req);
    }

    return json(
      {
        request_id: requestId,
        amount: amount.toFixed(8),
        status: "completed",
        tx_hash: txHash,
        remaining_quota: claim.remaining.toFixed(8),
      },
      {},
      req
    );
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
