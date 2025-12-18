import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireScope } from "../_shared/scopes.ts";
import { ensureUserRow, requireAuth, requirePrimaryWallet, supabaseServiceClient } from "../_shared/supabase.ts";

// Lists secret metadata for the authenticated user (no values).
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return error(405, "method not allowed", "METHOD_NOT_ALLOWED");

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const scopeCheck = requireScope(auth, "secrets-list");
  if (scopeCheck) return scopeCheck;
  const walletCheck = await requirePrimaryWallet(auth.userId);
  if (walletCheck instanceof Response) return walletCheck;

  const ensured = await ensureUserRow(auth);
  if (ensured instanceof Response) return ensured;

  const supabase = supabaseServiceClient();
  const { data, error: listErr } = await supabase
    .from("secrets")
    .select("id,name,version,created_at,updated_at")
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false });

  if (listErr) return error(500, `failed to list secrets: ${listErr.message}`, "DB_ERROR");
  return json({ secrets: data ?? [] });
});
