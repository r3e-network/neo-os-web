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

// Returns the user's gasbank account (creates if missing).
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "gasbank-account", auth);
  if (rl) return rl;
  const scopeCheck = requireScope(req, auth, "gasbank-account");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  const ensured = await ensureUserRow(auth, {}, req);
  if (ensured instanceof Response) return ensured;

  const supabase = supabaseServiceClient();

  const { data: existing, error: getErr } = await supabase
    .from("gasbank_accounts")
    .select("id,user_id,balance,reserved,created_at,updated_at")
    .eq("user_id", auth.userId)
    .limit(1);
  if (getErr) return errorResponse("SERVER_002", { message: `failed to load gasbank account: ${getErr.message}` }, req);

  if (existing && existing.length > 0) return json({ account: existing[0] }, {}, req);

  const { data: created, error: createErr } = await supabase
    .from("gasbank_accounts")
    .insert({ user_id: auth.userId })
    .select("id,user_id,balance,reserved,created_at,updated_at")
    .maybeSingle();
  if (createErr)
    return errorResponse("SERVER_002", { message: `failed to create gasbank account: ${createErr.message}` }, req);

  return json({ account: created }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
