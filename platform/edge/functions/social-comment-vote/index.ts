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
import { requireAuth, supabaseClient } from "../_shared/supabase.ts";
import { checkSpamLimit, logSpamAction } from "../_shared/community.ts";

interface VoteRequest {
  comment_id: string;
  vote_type: "upvote" | "downvote";
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", undefined, req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body: VoteRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  const { comment_id, vote_type } = body;

  if (!comment_id?.trim()) {
    return validationError("comment_id", "comment_id is required", req);
  }
  if (!["upvote", "downvote"].includes(vote_type)) {
    return validationError("vote_type", "vote_type must be upvote or downvote", req);
  }

  const supabase = supabaseClient();
  const userId = auth.user.id;

  // Check spam limit for voting
  const spamCheck = await checkSpamLimit(supabase, userId, "vote", undefined, req);
  if (spamCheck instanceof Response) return spamCheck;

  // Verify comment exists
  const { data: comment, error: commentErr } = await supabase
    .from("social_comments")
    .select("id")
    .eq("id", comment_id)
    .is("deleted_at", null)
    .single();

  if (commentErr || !comment) {
    return errorResponse("NOT_FOUND_001", { resource: "comment" }, req);
  }

  // Upsert vote (update if exists, insert if not)
  const { error: voteErr } = await supabase
    .from("social_comment_votes")
    .upsert({ comment_id, voter_user_id: userId, vote_type }, { onConflict: "comment_id,voter_user_id" });

  if (voteErr) {
    return errorResponse("SERVER_002", { message: "failed to record vote" }, req);
  }

  // Log spam action
  await logSpamAction(supabase, userId, "vote");

  // Get updated counts
  const { data: votes } = await supabase.from("social_comment_votes").select("vote_type").eq("comment_id", comment_id);

  const upvotes = (votes || []).filter((v) => v.vote_type === "upvote").length;
  const downvotes = (votes || []).filter((v) => v.vote_type === "downvote").length;

  return json({ success: true, upvotes, downvotes }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
