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
import { ensureUserRow, requirePrimaryWallet, requireUser, supabaseServiceClient } from "../_shared/supabase.ts";

// Lists API keys for the authenticated user (never returns the raw key).
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "api-keys-list", auth);
  if (rl) return rl;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  const ensured = await ensureUserRow(auth, {}, req);
  if (ensured instanceof Response) return ensured;

  const supabase = supabaseServiceClient();
  const { data, error: listErr } = await supabase
    .from("api_keys")
    .select("id,name,prefix,scopes,description,created_at,last_used,expires_at,revoked")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (listErr) return errorResponse("SERVER_002", { message: `failed to list api keys: ${listErr.message}` }, req);
  return json({ api_keys: data ?? [] }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
