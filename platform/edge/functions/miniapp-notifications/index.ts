import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);

  // Rate limiting for public endpoint
  const rateLimited = await requireRateLimit(req, "miniapp-notifications");
  if (rateLimited) return rateLimited;

  const url = new URL(req.url);
  const appId = url.searchParams.get("app_id")?.trim();
  const limitRaw = url.searchParams.get("limit");
  let limit = 20;
  if (limitRaw) {
    const parsed = Number.parseInt(limitRaw, 10);
    if (!Number.isNaN(parsed)) {
      limit = parsed;
    }
  }
  limit = Math.min(Math.max(limit, 1), 100);

  const supabase = supabaseClient();
  let query = supabase
    .from("miniapp_notifications")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (appId) {
    query = query.eq("app_id", appId);
  }

  const { data, error: err } = await query;
  if (err) return error(500, err.message, "DB_ERROR", req);

  return json({ notifications: data }, req);
}

Deno.serve(handler);
