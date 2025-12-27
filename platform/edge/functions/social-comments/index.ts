import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { getCommentVoteCounts } from "../_shared/community.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") {
    return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
  }

  const url = new URL(req.url);
  const appId = url.searchParams.get("app_id")?.trim();
  const parentId = url.searchParams.get("parent_id");
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");

  if (!appId) {
    return error(400, "app_id is required", "MISSING_APP_ID", req);
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
  if (err) return error(500, "failed to fetch comments", "DB_ERROR", req);

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
    req,
  );
}

Deno.serve(handler);
