// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse } from "../_shared/error-codes.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";

// Lists deposit requests for the authenticated user.
export const handler = createHandler(
  {
    method: "GET",
    auth: "user",
    rateLimit: "gasbank-deposits",
    scope: "gasbank-deposits",
    requireWallet: true,
    ensureUser: true,
  },
  async ({ req, auth }) => {
    const supabase = supabaseServiceClient();

    const { data, error: listErr } = await supabase
      .from("deposit_requests")
      .select("*")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (listErr) return errorResponse("SERVER_002", { message: `failed to list deposits: ${listErr.message}` }, req);
    return json({ deposits: data ?? [] }, {}, req);
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
