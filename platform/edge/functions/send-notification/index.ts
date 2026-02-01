// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { supabaseClient, requireAuth } from "../_shared/supabase.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";

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
    return errorResponse("METHOD_NOT_ALLOWED", undefined, req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const rl = await requireRateLimit(req, "send-notification", auth);
  if (rl) return rl;

  let body: NotificationBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  const { app_id, title, message, priority, is_pinned } = body;

  if (!app_id || !title || !message) {
    return validationError("app_id,title,message", "app_id, title, message required", req);
  }

  const supabase = supabaseClient();
  const { error: dbErr } = await supabase.from("miniapp_notifications").insert({
    app_id,
    title,
    message,
    priority: priority || 0,
    is_pinned: is_pinned || false,
    created_at: new Date().toISOString(),
  });

  if (dbErr) {
    return errorResponse("SERVER_002", { message: dbErr.message }, req);
  }

  return json({ success: true, app_id, title }, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
