// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireHostScope } from "../_shared/scopes.ts";
import { ensureUserRow, requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";

type DeleteSecretRequest = {
  name: string;
};

// Deletes a secret and its permissions for the authenticated user.
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "secrets-delete", auth);
  if (rl) return rl;
  const scopeCheck = requireHostScope(req, auth, "secrets-delete");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId, req);
  if (walletCheck instanceof Response) return walletCheck;

  const ensured = await ensureUserRow(auth, {}, req);
  if (ensured instanceof Response) return ensured;

  let body: DeleteSecretRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  const name = String(body.name ?? "").trim();
  if (!name) return validationError("name", "name required", req);

  const supabase = supabaseServiceClient();

  // Best-effort: drop policies first.
  await supabase.from("secret_policies").delete().eq("user_id", auth.userId).eq("secret_name", name);

  const { error: delErr, count } = await supabase
    .from("secrets")
    .delete({ count: "exact" })
    .eq("user_id", auth.userId)
    .eq("name", name);

  if (delErr) return errorResponse("SERVER_002", { message: `failed to delete secret: ${delErr.message}` }, req);
  if (!count) return notFoundError("secret", req);

  return json({ status: "ok" }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
