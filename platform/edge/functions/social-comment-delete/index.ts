// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { requireAuth, supabaseClient } from "../_shared/supabase.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "DELETE") {
    return errorResponse("METHOD_NOT_ALLOWED", undefined, req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const commentId = url.searchParams.get("id")?.trim();

  if (!commentId) {
    return validationError("id", "id is required", req);
  }

  const supabase = supabaseClient();
  const userId = auth.userId;

  try {
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
  } catch (err) {
    console.error("Comment delete error:", err);
    return errorResponse("SERVER_001", { message: (err as Error).message }, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
