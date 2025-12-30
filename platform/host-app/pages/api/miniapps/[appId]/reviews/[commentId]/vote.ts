import type { NextApiRequest, NextApiResponse } from "next";

// Shared store reference (in production, use database)
const votesStore: Map<string, Map<string, "upvote" | "downvote">> = new Map();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { appId, commentId } = req.query;

  if (!appId || !commentId || typeof appId !== "string" || typeof commentId !== "string") {
    return res.status(400).json({ error: "Missing appId or commentId" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { wallet, vote_type } = req.body;

  if (!wallet || !["upvote", "downvote"].includes(vote_type)) {
    return res.status(400).json({ error: "Invalid vote data" });
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
