import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { supabaseServiceClient, requireAuth } from "../_shared/supabase.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { isAppOwnerOrAdmin } from "../_shared/apps.ts";

interface NotificationBody {
  app_id?: string;
  title?: string;
  message?: string;
  priority?: number;
  is_pinned?: boolean;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const rl = await requireRateLimit(req, "send-notification", auth);
  if (rl) return rl;

  let body: NotificationBody;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON", "INVALID_BODY", req);
  }

  const { app_id, title, message, priority, is_pinned } = body;

  if (!app_id || !title || !message) {
    return error(400, "app_id, title, message required", "MISSING_FIELDS", req);
  }

  const supabase = supabaseServiceClient();
  const ownerCheck = await isAppOwnerOrAdmin(supabase, app_id, auth.userId);
  if (!ownerCheck) {
    return errorResponse("AUTH_004", { message: "app owner or admin required" }, req);
  }
  const { error: dbErr } = await supabase.from("miniapp_notifications").insert({
    app_id,
    title,
    message,
    priority: priority || 0,
    is_pinned: is_pinned || false,
    created_at: new Date().toISOString(),
  });

  if (dbErr) {
    return error(500, dbErr.message, "DB_ERROR", req);
  }

  return json({ success: true, app_id, title }, req);
}

Deno.serve(handler);
