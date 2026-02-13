// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";

type RevokeAPIKeyRequest = { id: string };

// Revokes an API key for the authenticated user.
export const handler = createHandler(
  { method: "POST", auth: "user_only", rateLimit: "api-keys-revoke", requireWallet: true, ensureUser: true },
  async ({ req, auth }) => {
    let body: RevokeAPIKeyRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("BAD_JSON", undefined, req);
    }

    const id = String(body.id ?? "").trim();
    if (!id) return validationError("id", "id required", req);

    const supabase = supabaseServiceClient();
    const { error: revokeErr } = await supabase
      .from("api_keys")
      .update({ revoked: true })
      .eq("id", id)
      .eq("user_id", auth.userId);

    if (revokeErr)
      return errorResponse("SERVER_002", { message: `failed to revoke api key: ${revokeErr.message}` }, req);

    return json({ status: "ok" }, {}, req);
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
