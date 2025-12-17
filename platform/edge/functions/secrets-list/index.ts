import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { ensureUserRow, requireUser, supabaseServiceClient } from "../_shared/supabase.ts";

// Lists secret metadata for the authenticated user (no values).
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return error(405, "method not allowed", "METHOD_NOT_ALLOWED");

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

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

