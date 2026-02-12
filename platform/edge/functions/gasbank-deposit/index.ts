// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { ensureUserRow, requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";

type CreateDepositRequest = {
  amount: number | string;
  from_address: string;
  tx_hash?: string;
};

// Creates a deposit request entry (verification/settlement runs elsewhere).
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "gasbank-deposit", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "gasbank-deposit");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  let body: CreateDepositRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  const fromAddress = String(body.from_address ?? "").trim();
  if (!fromAddress) return validationError("from_address", "from_address required", req);

  const rawAmount = String(body.amount ?? "").trim();
  if (!/^\d+$/.test(rawAmount)) return validationError("amount", "amount must be an integer string", req);
  const amount = BigInt(rawAmount);
  if (amount <= 0n) return validationError("amount", "amount must be > 0", req);

  const txHash = String(body.tx_hash ?? "").trim() || null;

  const ensured = await ensureUserRow(auth, {}, req);
  if (ensured instanceof Response) return ensured;

  const supabase = supabaseServiceClient();

  const { data: account, error: accErr } = await supabase
    .from("gasbank_accounts")
    .upsert({ user_id: auth.userId }, { onConflict: "user_id" })
    .select("id")
    .maybeSingle();
  if (accErr || !(account as Record<string, unknown>)?.id) {
    return errorResponse(
      "SERVER_002",
      { message: `failed to ensure gasbank account: ${accErr?.message ?? "unknown error"}` },
      req
    );
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: inserted, error: depErr } = await supabase
    .from("deposit_requests")
    .insert({
      user_id: auth.userId,
      account_id: (account as Record<string, unknown>).id,
      amount: amount.toString(),
      tx_hash: txHash,
      from_address: fromAddress,
      status: "pending",
      required_confirmations: 1,
      expires_at: expiresAt,
    })
    .select("*")
    .maybeSingle();

  if (depErr)
    return errorResponse("SERVER_002", { message: `failed to create deposit request: ${depErr.message}` }, req);

  return json({ deposit: inserted }, { status: 201 }, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
