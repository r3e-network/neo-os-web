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
import { ensureUserRow, requirePrimaryWallet, requireUser, supabaseServiceClient } from "../_shared/supabase.ts";

type RevokeAPIKeyRequest = { id: string };

// Revokes an API key for the authenticated user.
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "api-keys-revoke", auth);
  if (rl) return rl;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  let body: RevokeAPIKeyRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  const id = String(body.id ?? "").trim();
  if (!id) return validationError("id", "id required", req);

  const ensured = await ensureUserRow(auth, {}, req);
  if (ensured instanceof Response) return ensured;

  const supabase = supabaseServiceClient();
  const { error: revokeErr } = await supabase
    .from("api_keys")
    .update({ revoked: true })
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (revokeErr) return errorResponse("SERVER_002", { message: `failed to revoke api key: ${revokeErr.message}` }, req);

  return json({ status: "ok" }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
