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
import { ensureUserRow, requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";

// Lists gasbank transaction history for the authenticated user.
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "gasbank-transactions", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "gasbank-transactions");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  const ensured = await ensureUserRow(auth, {}, req);
  if (ensured instanceof Response) return ensured;

  const supabase = supabaseServiceClient();

  try {
    const { data: accounts, error: accErr } = await supabase
      .from("gasbank_accounts")
      .select("id")
      .eq("user_id", auth.userId)
      .limit(1);
    if (accErr)
      return errorResponse("SERVER_002", { message: `failed to load gasbank account: ${accErr.message}` }, req);
    if (!accounts || accounts.length === 0) return json({ transactions: [] }, {}, req);

    const accountId = String(accounts[0]?.id ?? "").trim();
    if (!accountId) return json({ transactions: [] }, {}, req);

    const { data, error: listErr } = await supabase
      .from("gasbank_transactions")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (listErr)
      return errorResponse("SERVER_002", { message: `failed to list transactions: ${listErr.message}` }, req);
    return json({ transactions: data ?? [] }, {}, req);
  } catch (err) {
    console.error("Gasbank transactions error:", err);
    return errorResponse("SERVER_001", { message: (err as Error).message }, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
