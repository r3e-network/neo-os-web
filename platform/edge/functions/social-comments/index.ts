// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { supabaseClient, tryGetUser } from "../_shared/supabase.ts";
import { getCommentVoteCounts } from "../_shared/community.ts";

export const handler = createHandler(
  { method: "GET", auth: false, rateLimit: "social-comments" },
  async ({ req, url }) => {
    const appId = url.searchParams.get("app_id")?.trim();
    const parentId = url.searchParams.get("parent_id");
    const limitRaw = url.searchParams.get("limit");
    const offsetRaw = url.searchParams.get("offset");

    if (!appId) {
      return validationError("app_id", "app_id is required", req);
    }

    let limit = 20;
    if (limitRaw) {
      const parsed = Number.parseInt(limitRaw, 10);
      if (!Number.isNaN(parsed)) limit = parsed;
    }
    limit = Math.min(Math.max(limit, 1), 100);

    let offset = 0;
    if (offsetRaw) {
      const parsed = Number.parseInt(offsetRaw, 10);
      if (!Number.isNaN(parsed)) offset = Math.max(parsed, 0);
    }

    const supabase = supabaseClient();

    // Build query
    let query = supabase
      .from("social_comments")
      .select("*", { count: "exact" })
      .eq("app_id", appId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by parent_id
    if (parentId === "null" || parentId === "") {
      query = query.is("parent_id", null);
    } else if (parentId) {
      query = query.eq("parent_id", parentId);
    }

    const { data, error: err, count } = await query;
    if (err) return errorResponse("SERVER_002", { message: "failed to fetch comments" }, req);

    // Get vote counts
    const commentIds = (data || []).map((c) => c.id);
    const voteCounts = await getCommentVoteCounts(supabase, commentIds);

    // Get reply counts
    const { data: replyCounts } = await supabase
      .from("social_comments")
      .select("parent_id")
      .in("parent_id", commentIds)
      .is("deleted_at", null);

    const replyCountMap = new Map<string, number>();
    for (const r of replyCounts || []) {
      const current = replyCountMap.get(r.parent_id) || 0;
      replyCountMap.set(r.parent_id, current + 1);
    }

    // Enrich comments
    const comments = (data || []).map((c) => ({
      ...c,
      upvotes: voteCounts.get(c.id)?.upvotes || 0,
      downvotes: voteCounts.get(c.id)?.downvotes || 0,
      reply_count: replyCountMap.get(c.id) || 0,
    }));

    return json(
      {
        comments,
        total: count || 0,
        has_more: offset + limit < (count || 0),
      },
      {},
      req
    );
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
