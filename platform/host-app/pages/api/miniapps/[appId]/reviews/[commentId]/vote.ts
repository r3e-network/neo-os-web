import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { commentId } = req.query;

  if (!commentId || typeof commentId !== "string") {
    return res.status(400).json({ error: "Missing commentId" });
  }

  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured" });
  }

  if (req.method === "POST") {
    return submitVote(commentId, req, res);
  }

  if (req.method === "DELETE") {
    return removeVote(commentId, req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function submitVote(commentId: string, req: NextApiRequest, res: NextApiResponse) {
  const { wallet, vote_type } = req.body;

  if (!wallet || !["upvote", "downvote"].includes(vote_type)) {
    return res.status(400).json({ error: "Invalid vote data" });
  }

  // Check existing vote
  const { data: existing } = await supabase
    .from("comment_votes")
    .select("vote_type")
    .eq("comment_id", parseInt(commentId))
    .eq("wallet_address", wallet)
    .single();

  // Toggle: if same vote type, remove it
  if (existing?.vote_type === vote_type) {
    const { error } = await supabase
      .from("comment_votes")
      .delete()
      .eq("comment_id", parseInt(commentId))
      .eq("wallet_address", wallet);

    if (error) {
      return res.status(500).json({ error: "Failed to remove vote" });
    }
    return res.status(200).json({ success: true, action: "removed" });
  }

  // Upsert vote
  const { error } = await supabase.from("comment_votes").upsert(
    {
      comment_id: parseInt(commentId),
      wallet_address: wallet,
      vote_type,
    },
    { onConflict: "comment_id,wallet_address" },
  );

  if (error) {
    console.error("Failed to submit vote:", error);
    return res.status(500).json({ error: "Failed to submit vote" });
  }

  return res.status(200).json({ success: true, action: existing ? "changed" : "added" });
}

async function removeVote(commentId: string, req: NextApiRequest, res: NextApiResponse) {
  const wallet = req.headers["x-wallet-address"] as string;

  if (!wallet) {
    return res.status(401).json({ error: "Wallet address required" });
  }

  const { error } = await supabase
    .from("comment_votes")
    .delete()
    .eq("comment_id", parseInt(commentId))
    .eq("wallet_address", wallet);

  if (error) {
    console.error("Failed to remove vote:", error);
    return res.status(500).json({ error: "Failed to remove vote" });
  }

  return res.status(200).json({ success: true });
}
