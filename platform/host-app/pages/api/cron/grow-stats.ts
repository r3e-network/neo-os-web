/**
 * Platform Stats Growth Cron Job
 * Increments platform-wide statistics periodically
 * Schedule: Every 15 seconds (simulated growth)
 *
 * Growth rates:
 * - Users: 1-2 per 15 seconds
 * - Transactions: 10-20 per 15 seconds
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret for security
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isSupabaseConfigured) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  try {
    // Random increments within specified ranges
    const userIncrement = Math.floor(Math.random() * 2) + 1; // 1-2
    const txIncrement = Math.floor(Math.random() * 11) + 10; // 10-20

    // Update platform_stats with increments
    const { data, error } = await supabase.rpc("increment_platform_stats", {
      user_inc: userIncrement,
      tx_inc: txIncrement,
    });

    if (error) {
      // Fallback: direct update if RPC not available
      const { data: current } = await supabase
        .from("platform_stats")
        .select("total_users, total_transactions")
        .eq("id", 1)
        .single();

      if (current) {
        await supabase
          .from("platform_stats")
          .update({
            total_users: current.total_users + userIncrement,
            total_transactions: current.total_transactions + txIncrement,
            last_updated_at: new Date().toISOString(),
          })
          .eq("id", 1);
      }
    }

    res.status(200).json({
      success: true,
      increments: { users: userIncrement, transactions: txIncrement },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Stats growth error:", error);
    res.status(500).json({ error: "Failed to update stats" });
  }
}
