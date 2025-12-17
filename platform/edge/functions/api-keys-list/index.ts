import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { ensureUserRow, requirePrimaryWallet, requireUser, supabaseServiceClient } from "../_shared/supabase.ts";

// Lists API keys for the authenticated user (never returns the raw key).
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return error(405, "method not allowed", "METHOD_NOT_ALLOWED");

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const walletCheck = await requirePrimaryWallet(auth.userId);
  if (walletCheck instanceof Response) return walletCheck;

  const ensured = await ensureUserRow(auth);
  if (ensured instanceof Response) return ensured;

  const supabase = supabaseServiceClient();
  const { data, error: listErr } = await supabase
    .from("api_keys")
    .select("id,name,prefix,scopes,description,created_at,last_used,expires_at,revoked")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (listErr) return error(500, `failed to list api keys: ${listErr.message}`, "DB_ERROR");
  return json({ api_keys: data ?? [] });
});

