import { apiError } from "@/lib/api-response";
import type { NextApiRequest, NextApiResponse } from "next";
import { withCsrfProtection } from "@/lib/csrf";

// Shared store reference (in production, use database)
const votesStore: Map<string, Map<string, "upvote" | "downvote">> = new Map();

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { appId, commentId } = req.query;

  if (!appId || !commentId || typeof appId !== "string" || typeof commentId !== "string") {
    return apiError.badRequest(res, "Missing appId or commentId");
  }

  if (req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }

  const { wallet, vote_type } = req.body;

  if (!wallet || typeof wallet !== "string" || !["upvote", "downvote"].includes(vote_type)) {
    return apiError.badRequest(res, "Invalid vote data");
  }

  if (!/^N[A-Za-z0-9]{33}$/.test(wallet)) {
    return apiError.badRequest(res, "Invalid wallet address");
  }

  const voteKey = `${appId}:${commentId}`;
  if (!votesStore.has(voteKey)) {
    votesStore.set(voteKey, new Map());
  }

  const commentVotes = votesStore.get(voteKey)!;
  const existingVote = commentVotes.get(wallet);

  // Toggle vote if same type, otherwise update
  if (existingVote === vote_type) {
    commentVotes.delete(wallet);
  } else {
    commentVotes.set(wallet, vote_type);
  }

  return res.status(200).json({ success: true });
}

export default withCsrfProtection(handler);
