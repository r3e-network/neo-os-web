// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse } from "../_shared/error-codes.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";

// Returns the user's gasbank account (creates if missing).
export const handler = createHandler(
  {
    method: "GET",
    auth: "user",
    rateLimit: "gasbank-account",
    scope: "gasbank-account",
    requireWallet: true,
    ensureUser: true,
  },
  async ({ req, auth }) => {
    const supabase = supabaseServiceClient();

    const { data: existing, error: getErr } = await supabase
      .from("gasbank_accounts")
      .select("id,user_id,balance,reserved,created_at,updated_at")
      .eq("user_id", auth.userId)
      .limit(1);
    if (getErr)
      return errorResponse("SERVER_002", { message: `failed to load gasbank account: ${getErr.message}` }, req);

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
);

if (import.meta.main) {
  Deno.serve(handler);
}
