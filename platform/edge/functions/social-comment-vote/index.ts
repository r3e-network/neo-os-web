import { handleCorsPreflight } from "../_shared/cors.ts";
import { readJsonBody } from "../_shared/request.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { error, json } from "../_shared/response.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, supabaseServiceClient } from "../_shared/supabase.ts";
import { checkSpamLimit, logSpamAction } from "../_shared/community.ts";

interface VoteRequest {
  comment_id: string;
  vote_type: "upvote" | "downvote";
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const scopeCheck = requireScope(req, auth, "social");
  if (scopeCheck) return scopeCheck;
  const rl = await requireRateLimit(req, "social-comment-vote", auth);
  if (rl) return rl;

  const bodyOrErr = await readJsonBody<VoteRequest>(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  const { comment_id, vote_type } = body;

  if (!comment_id?.trim()) {
    return error(400, "comment_id is required", "MISSING_COMMENT_ID", req);
  }
  if (!["upvote", "downvote"].includes(vote_type)) {
    return error(400, "vote_type must be upvote or downvote", "INVALID_VOTE_TYPE", req);
  }

  const supabase = supabaseServiceClient();
  const userId = auth.userId;

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
    return error(404, "comment not found", "COMMENT_NOT_FOUND", req);
  }

  // Upsert vote (update if exists, insert if not)
  const { error: voteErr } = await supabase
    .from("social_comment_votes")
    .upsert({ comment_id, voter_user_id: userId, vote_type }, { onConflict: "comment_id,voter_user_id" });

  if (voteErr) {
    return error(500, "failed to record vote", "DB_ERROR", req);
  }

  // Log spam action
  await logSpamAction(supabase, userId, "vote");

  // Get updated counts
  const { count: upvotes } = await supabase.from("social_comment_votes").select("id", { count: "exact", head: true }).eq("comment_id", comment_id).eq("vote_type", "upvote");
  const { count: downvotes } = await supabase.from("social_comment_votes").select("id", { count: "exact", head: true }).eq("comment_id", comment_id).eq("vote_type", "downvote");

  return json({ success: true, upvotes: upvotes ?? 0, downvotes: downvotes ?? 0 }, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
