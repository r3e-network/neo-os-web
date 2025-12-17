import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { ensureUserRow, requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";

// Lists gasbank transaction history for the authenticated user.
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return error(405, "method not allowed", "METHOD_NOT_ALLOWED");

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const walletCheck = await requirePrimaryWallet(auth.userId);
  if (walletCheck instanceof Response) return walletCheck;

  const ensured = await ensureUserRow(auth);
  if (ensured instanceof Response) return ensured;

  const supabase = supabaseServiceClient();
  const { data: accounts, error: accErr } = await supabase
    .from("gasbank_accounts")
    .select("id")
    .eq("user_id", auth.userId)
    .limit(1);
  if (accErr) return error(500, `failed to load gasbank account: ${accErr.message}`, "DB_ERROR");
  if (!accounts || accounts.length === 0) return json({ transactions: [] });

  const accountId = String((accounts[0] as any)?.id ?? "").trim();
  if (!accountId) return json({ transactions: [] });

  const { data, error: listErr } = await supabase
    .from("gasbank_transactions")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (listErr) return error(500, `failed to list transactions: ${listErr.message}`, "DB_ERROR");
  return json({ transactions: data ?? [] });
});

