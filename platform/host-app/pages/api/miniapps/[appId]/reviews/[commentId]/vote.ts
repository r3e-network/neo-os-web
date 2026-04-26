import { apiError } from "@/lib/api-response";
import type { NextApiRequest, NextApiResponse } from "next";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";
import {
  getServerSupabaseClient,
  hasServiceRoleSupabase,
} from "@/lib/server-supabase";
import {
  isValidWalletAddress,
  resolveUserIdFromWallet,
} from "@/lib/wallet-user";
import { requireWalletAuth } from "@/lib/require-wallet-auth";

const VALID_VOTE_TYPES = new Set(["upvote", "downvote"]);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;
  const { appId, commentId } = req.query;

  if (
    !appId ||
    !commentId ||
    typeof appId !== "string" ||
    typeof commentId !== "string"
  ) {
    return apiError.badRequest(res, "Missing appId or commentId");
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(appId)) {
    return apiError.badRequest(res, "Invalid appId format");
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      commentId,
    )
  ) {
    return apiError.badRequest(res, "Invalid commentId format");
  }

  if (req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }
  if (!hasServiceRoleSupabase()) {
    return apiError.configError(
      res,
      "SUPABASE_SERVICE_ROLE_KEY is required for voting",
    );
  }

  let authedWallet: string | null;
  try {
    authedWallet = await requireWalletAuth(req, res);
  } catch (err) {
    logger.error(
      "requireWalletAuth error:",
      err instanceof Error ? err.message : String(err),
    );
    return apiError.internal(res, "Authentication failed");
  }
  if (!authedWallet) return;

  const { wallet, vote_type } = req.body;

  if (
    !isValidWalletAddress(wallet) ||
    typeof vote_type !== "string" ||
    !VALID_VOTE_TYPES.has(vote_type)
  ) {
    return apiError.badRequest(res, "Invalid vote data");
  }
  if (wallet !== authedWallet) {
    return apiError.forbidden(res, "Wallet mismatch");
  }

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(
      res,
      "Supabase service role client unavailable",
    );
  }

  const userId = await resolveUserIdFromWallet(supabase, wallet, {
    createIfMissing: true,
  });
  if (!userId) {
    return apiError.internal(res, "Failed to resolve user");
  }

  const { data: comment, error: commentError } = await supabase
    .from("social_comments")
    .select("id,app_id")
    .eq("id", commentId)
    .is("deleted_at", null)
    .single();

  if (commentError || !comment) {
    return apiError.notFound(res, "Comment not found");
  }
  if (comment.app_id !== appId) {
    return apiError.badRequest(res, "Comment belongs to different app");
  }

  const { data: existingVote, error: voteLookupError } = await supabase
    .from("social_comment_votes")
    .select("id,vote_type")
    .eq("comment_id", commentId)
    .eq("voter_user_id", userId)
    .maybeSingle();

  if (voteLookupError) {
    logger.error("Vote lookup failed:", voteLookupError.message);
    return apiError.internal(res, "Failed to submit vote");
  }

  if (existingVote?.vote_type === vote_type) {
    // Toggle off — second concurrent delete is a benign no-op
    const { error } = await supabase
      .from("social_comment_votes")
      .delete()
      .eq("id", existingVote.id);
    if (error) {
      logger.error(
        "Vote delete failed:",
        error instanceof Error ? error.message : String(error),
      );
      return apiError.internal(res, "Failed to submit vote");
    }
  } else {
    // Upsert handles both insert and update atomically, eliminating TOCTOU race
    const { error } = await supabase
      .from("social_comment_votes")
      .upsert(
        { comment_id: commentId, voter_user_id: userId, vote_type },
        { onConflict: "comment_id,voter_user_id" },
      );
    if (error) {
      logger.error(
        "Vote upsert failed:",
        error instanceof Error ? error.message : String(error),
      );
      return apiError.internal(res, "Failed to submit vote");
    }
  }

  const { data: voteRows } = await supabase
    .from("social_comment_votes")
    .select("vote_type")
    .eq("comment_id", commentId)
    .limit(10000);

  let upvotes = 0;
  let downvotes = 0;
  for (const vote of voteRows || []) {
    if (vote.vote_type === "upvote") upvotes += 1;
    if (vote.vote_type === "downvote") downvotes += 1;
  }

  res.setHeader("Cache-Control", "no-store, private");
  res.status(200).json({ success: true, upvotes, downvotes });
  return;
}

export default withCsrfProtection(handler);
