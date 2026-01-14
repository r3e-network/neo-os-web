/**
 * API: Hall of Fame Vote
 * POST /api/hall-of-fame/vote
 *
 * Records a vote for an entrant after GAS payment is confirmed
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";

interface VoteRequest {
  entrantId: string;
  voter?: string;
  amount?: number;
}

interface VoteResponse {
  success: boolean;
  newScore?: number;
  error?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<VoteResponse>) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  if (!isSupabaseConfigured) {
    return res.status(503).json({ success: false, error: "Database not configured" });
  }

  const { entrantId, voter, amount = 1 } = req.body as VoteRequest;

  if (!entrantId) {
    return res.status(400).json({ success: false, error: "entrantId is required" });
  }

  // Validate amount (1 GAS = 100 score points)
  const scoreIncrement = Math.max(1, Math.floor(Number(amount) * 100));

  try {
    // Update the entrant's score
    const { data, error } = await supabase.rpc("increment_hall_of_fame_score", {
      p_entrant_id: entrantId,
      p_increment: scoreIncrement,
    });

    if (error) {
      // Fallback: fetch current score and update directly
      const { data: current, error: currentError } = await supabase
        .from("hall_of_fame_entries")
        .select("score")
        .eq("id", entrantId)
        .single();

      if (currentError || !current) {
        console.error("Failed to read current score:", currentError);
        return res.status(500).json({ success: false, error: "Failed to record vote" });
      }

      const newScore = (current.score || 0) + scoreIncrement;
      const { data: updated, error: updateError } = await supabase
        .from("hall_of_fame_entries")
        .update({ score: newScore })
        .eq("id", entrantId)
        .select("score")
        .single();

      if (updateError) {
        console.error("Failed to update score:", updateError);
        return res.status(500).json({ success: false, error: "Failed to record vote" });
      }

      // Record the vote in history
      await supabase.from("hall_of_fame_votes").insert({
        entrant_id: entrantId,
        voter_address: voter || null,
        amount: amount,
        score_added: scoreIncrement,
      });

      return res.status(200).json({ success: true, newScore: updated?.score ?? newScore });
    }

    // Record the vote in history
    await supabase.from("hall_of_fame_votes").insert({
      entrant_id: entrantId,
      voter_address: voter || null,
      amount: amount,
      score_added: scoreIncrement,
    });

    // Invalidate local leaderboard cache (simple approach for single-instance)
    // Note: In a real distributed system, we'd use Redis or similar
    try {
      const leaderboardModule = require("./leaderboard");
      if (leaderboardModule && typeof leaderboardModule.invalidateCache === "function") {
        leaderboardModule.invalidateCache();
      }
    } catch (e) {
      // Ignore if module not found or other error - cache will expire naturally
    }

    return res.status(200).json({ success: true, newScore: data });
  } catch (err) {
    console.error("Vote error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}
