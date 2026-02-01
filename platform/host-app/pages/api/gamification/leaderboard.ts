import type { NextApiRequest, NextApiResponse } from "next";
import type { LeaderboardEntry } from "@/components/features/gamification/types";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  // Check if Supabase is configured
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch leaderboard data from Supabase
    const { data, error, count } = await supabase
      .from("user_leaderboard")
      .select("*", { count: "exact" })
      .order("xp", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Failed to fetch leaderboard" });
    }

    // Transform to LeaderboardEntry format
    const entries: LeaderboardEntry[] = (data || []).map((row, index) => ({
      rank: offset + index + 1,
      wallet: formatWallet(row.wallet),
      xp: row.xp || 0,
      level: row.level || 1,
      badges: row.badges || 0,
    }));

    const total = count || 0;

    return res.status(200).json({
      entries,
      total,
      hasMore: offset + limit < total,
    });
  } catch (err) {
    console.error("Leaderboard API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** Format wallet address for display */
function formatWallet(wallet: string): string {
  if (!wallet || wallet.length < 10) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}
