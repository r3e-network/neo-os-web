// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { supabaseClient } from "../_shared/supabase.ts";

export const handler = createHandler({ method: "DELETE", auth: "user" }, async ({ req, auth }) => {
  const url = new URL(req.url);
  const commentId = url.searchParams.get("id")?.trim();

  if (!commentId) {
    return validationError("id", "id is required", req);
  }

  const supabase = supabaseClient();
  const userId = auth.userId;

  // Verify comment exists and belongs to user
  const { data: comment, error: fetchErr } = await supabase
    .from("social_comments")
    .select("id, author_user_id")
    .eq("id", commentId)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !comment) {
    return notFoundError("comment", req);
  }

  if (comment.author_user_id !== userId) {
    return errorResponse("AUTH_004", { message: "not authorized to delete" }, req);
  }

  // Soft delete
  const { error: deleteErr } = await supabase
    .from("social_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);

  if (deleteErr) {
    return errorResponse("SERVER_002", { message: "failed to delete comment" }, req);
  }

  return json({ success: true }, {}, req);
});

if (import.meta.main) {
  Deno.serve(handler);
}
