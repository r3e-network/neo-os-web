// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse } from "../_shared/error-codes.ts";
import { supabaseServiceClient } from "../_shared/supabase.ts";

// Lists gasbank transaction history for the authenticated user.
export const handler = createHandler(
  {
    method: "GET",
    auth: "user",
    rateLimit: "gasbank-transactions",
    scope: "gasbank-transactions",
    requireWallet: true,
    ensureUser: true,
  },
  async ({ req, auth }) => {
    const supabase = supabaseServiceClient();

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
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
