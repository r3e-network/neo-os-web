import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { supabaseClient, requireAuth } from "../_shared/supabase.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const rl = await requireRateLimit(req, "emit-event", auth);
  if (rl) return rl;

  let body: { app_id?: string; event_name?: string; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "INVALID_BODY", req);
  }

  const { app_id, event_name, data } = body;
  if (!app_id || !event_name) {
    return error(400, "app_id and event_name required", "MISSING_FIELDS", req);
  }

  const supabase = supabaseClient();
  const { error: dbErr } = await supabase.from("contract_events").insert({
    app_id,
    event_name,
    event_data: data || {},
    created_at: new Date().toISOString(),
  });

  if (dbErr) {
    return error(500, dbErr.message, "DB_ERROR", req);
  }

  return json({ success: true, app_id, event_name }, req);
}

Deno.serve(handler);
