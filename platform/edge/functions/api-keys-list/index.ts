// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse } from "../_shared/error-codes.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";

// Lists API keys for the authenticated user (never returns the raw key).
export const handler = createHandler(
  { method: "GET", auth: "user_only", rateLimit: "api-keys-list", requireWallet: true, ensureUser: true },
  async ({ req, auth }) => {
    const supabase = supabaseServiceClient();

    const { data, error: listErr } = await supabase
      .from("api_keys")
      .select("id,name,prefix,scopes,description,created_at,last_used,expires_at,revoked")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false });

    if (listErr) return errorResponse("SERVER_002", { message: `failed to list api keys: ${listErr.message}` }, req);
    return json({ api_keys: data ?? [] }, {}, req);
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
