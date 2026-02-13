// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { supabaseClient } from "../_shared/supabase.ts";

interface NotificationBody {
  app_id?: string;
  title?: string;
  message?: string;
  priority?: number;
  is_pinned?: boolean;
}

export const handler = createHandler(
  { method: "POST", auth: "user", rateLimit: "send-notification" },
  async ({ req, auth }) => {
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
);

if (import.meta.main) {
  Deno.serve(handler);
}
