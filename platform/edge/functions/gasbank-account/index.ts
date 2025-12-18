import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireScope } from "../_shared/scopes.ts";
import { ensureUserRow, requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";

// Returns the user's gasbank account (creates if missing).
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return error(405, "method not allowed", "METHOD_NOT_ALLOWED");

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const scopeCheck = requireScope(auth, "gasbank-account");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId);
  if (walletCheck instanceof Response) return walletCheck;

  const ensured = await ensureUserRow(auth);
  if (ensured instanceof Response) return ensured;

  const supabase = supabaseServiceClient();

  const { data: existing, error: getErr } = await supabase
    .from("gasbank_accounts")
    .select("id,user_id,balance,reserved,created_at,updated_at")
    .eq("user_id", auth.userId)
    .limit(1);
  if (getErr) return error(500, `failed to load gasbank account: ${getErr.message}`, "DB_ERROR");

  if (existing && existing.length > 0) return json({ account: existing[0] });

  const { data: created, error: createErr } = await supabase
    .from("gasbank_accounts")
    .insert({ user_id: auth.userId })
    .select("id,user_id,balance,reserved,created_at,updated_at")
    .maybeSingle();
  if (createErr) return error(500, `failed to create gasbank account: ${createErr.message}`, "DB_ERROR");

  return json({ account: created });
});
