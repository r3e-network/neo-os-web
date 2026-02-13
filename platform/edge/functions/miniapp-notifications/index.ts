// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { json } from "../_shared/response.ts";
import { errorResponse } from "../_shared/error-codes.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { createHandler } from "../_shared/handler.ts";

export const handler = createHandler(
  { method: "GET", auth: false, rateLimit: "miniapp-notifications" },
  async ({ req, url }) => {
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

    try {
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
      if (err) return errorResponse("SERVER_002", { message: err.message }, req);

      return json({ notifications: data }, req);
    } catch (err) {
      console.error("Miniapp notifications error:", err);
      return errorResponse("SERVER_001", { message: (err as Error).message }, req);
    }
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
