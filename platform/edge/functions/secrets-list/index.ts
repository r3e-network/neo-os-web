// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse } from "../_shared/error-codes.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";

// Lists secret metadata for the authenticated user (no values).
export const handler = createHandler(
  {
    method: "GET",
    auth: "user",
    rateLimit: "secrets-list",
    hostScope: "secrets-list",
    requireWallet: true,
    ensureUser: true,
  },
  async ({ req, auth }) => {
    const supabase = supabaseServiceClient();

    const { data, error: listErr } = await supabase
      .from("secrets")
      .select("id,name,version,created_at,updated_at")
      .eq("user_id", auth.userId)
      .order("updated_at", { ascending: false });

    if (listErr) return errorResponse("SERVER_002", { message: `failed to list secrets: ${listErr.message}` }, req);
    return json({ secrets: data ?? [] }, {}, req);
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
