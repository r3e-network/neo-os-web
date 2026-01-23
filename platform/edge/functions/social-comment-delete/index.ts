import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireAuth, supabaseServiceClient } from "../_shared/supabase.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "DELETE") {
    return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const commentId = url.searchParams.get("id")?.trim();

  if (!commentId) {
    return error(400, "id is required", "MISSING_ID", req);
  }

  const supabase = supabaseServiceClient();
  const userId = auth.userId;

  // Verify comment exists and belongs to user
  const { data: comment, error: fetchErr } = await supabase
    .from("social_comments")
    .select("id, author_user_id")
    .eq("id", commentId)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !comment) {
    return error(404, "comment not found", "NOT_FOUND", req);
  }

  if (comment.author_user_id !== userId) {
    return error(403, "not authorized to delete", "FORBIDDEN", req);
  }

  // Soft delete
  const { error: deleteErr } = await supabase
    .from("social_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);

  if (deleteErr) {
    return error(500, "failed to delete comment", "DB_ERROR", req);
  }

  return json({ success: true }, {}, req);
}

Deno.serve(handler);
