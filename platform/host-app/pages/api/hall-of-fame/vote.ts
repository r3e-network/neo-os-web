/**
 * API: Hall of Fame Vote
 * POST /api/hall-of-fame/vote
 *
 * Records a vote for an entrant after GAS payment is confirmed
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { writeRateLimiter, withRateLimit } from "@/lib/security/ratelimit";
import { requireWalletAuth } from "@/lib/security/wallet-auth";
import { logger } from "@/lib/logger";

interface VoteRequest {
  entrantId: string;
  amount?: number;
}

interface VoteResponse {
  success: boolean;
  newScore?: number;
  error?: string;
}

export default withRateLimit(
  writeRateLimiter,
  async function handler(req: NextApiRequest, res: NextApiResponse<VoteResponse>) {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ success: false, error: "Database not configured" });
    }

    // SECURITY: Verify wallet ownership via cryptographic signature
    const auth = requireWalletAuth(req.headers);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const { entrantId, amount = 1 } = req.body as VoteRequest;

    if (!entrantId) {
      return res.status(400).json({ success: false, error: "entrantId is required" });
    }

    // Validate amount (1 GAS = 100 score points)
    const scoreIncrement = Math.max(1, Math.floor(Number(amount) * 100));

    try {
      // Atomically increment the entrant's score via Postgres function.
      // This avoids the TOCTOU race of read-then-write.
      const { data, error } = await supabaseAdmin!.rpc("increment_hall_of_fame_score", {
        p_entrant_id: entrantId,
        p_increment: scoreIncrement,
      });

      if (error) {
        logger.error("Failed to increment score", error);
        return res.status(500).json({ success: false, error: "Failed to record vote" });
      }

      // Record the vote in history
      await supabaseAdmin!.from("hall_of_fame_votes").insert({
        entrant_id: entrantId,
        voter_address: auth.address,
        amount: amount,
        score_added: scoreIncrement,
      });

      return res.status(200).json({ success: true, newScore: data ?? undefined });
    } catch (err) {
      logger.error("Vote error", err);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  },
);
