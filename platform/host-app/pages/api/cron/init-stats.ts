/**
 * Initialize Platform Stats
 * Sets reasonable initial values for miniapp_stats
 * Run once to seed the database with realistic data
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin, isSupabaseConfigured } from "../../../lib/supabase";

// Realistic initial stats per category
const INITIAL_STATS: Record<string, { users: number; txs: number; volume: number }> = {
  gaming: { users: 8000, txs: 45000, volume: 15000 },
  defi: { users: 5000, txs: 35000, volume: 50000 },
  social: { users: 6000, txs: 25000, volume: 8000 },
  governance: { users: 3000, txs: 15000, volume: 5000 },
  nft: { users: 4000, txs: 20000, volume: 12000 },
  utility: { users: 2000, txs: 10000, volume: 3000 },
};

// App to category mapping
const APP_CATEGORIES: Record<string, string> = {
  "miniapp-lottery": "gaming",
  "miniapp-coinflip": "gaming",
  "miniapp-dicegame": "gaming",
  "miniapp-scratchcard": "gaming",
  "miniapp-secretpoker": "gaming",
  "miniapp-neo-crash": "gaming",
  "miniapp-flashloan": "defi",
  "miniapp-neoburger": "defi",
  "miniapp-redenvelope": "social",
  "miniapp-dev-tipping": "social",
  "miniapp-govbooster": "governance",
  "miniapp-canvas": "nft",
  "miniapp-explorer": "utility",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow in development or with secret
  const isDev = process.env.NODE_ENV === "development";
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!isDev && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  try {
    // Get all miniapps
    const { data: apps, error } = await supabaseAdmin.from("miniapp_stats").select("id, app_id");

    if (error) throw error;
    if (!apps || apps.length === 0) {
      return res.status(404).json({ error: "No miniapps found" });
    }

    let updated = 0;
    for (const app of apps) {
      // Determine category
      const category = APP_CATEGORIES[app.app_id] || "utility";
      const baseStats = INITIAL_STATS[category] || INITIAL_STATS.utility;

      // Add some randomness (±30%)
      const variance = () => 0.7 + Math.random() * 0.6;
      const users = Math.floor(baseStats.users * variance());
      const txs = Math.floor(baseStats.txs * variance());
      const volume = (baseStats.volume * variance()).toFixed(2);

      const { error: updateError } = await supabaseAdmin
        .from("miniapp_stats")
        .update({
          total_unique_users: users,
          total_transactions: txs,
          total_volume_gas: volume,
          updated_at: new Date().toISOString(),
        })
        .eq("id", app.id);

      if (!updateError) updated++;
    }

    res.status(200).json({
      success: true,
      updated,
      total: apps.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Init stats error:", error);
    res.status(500).json({ error: "Failed to initialize stats" });
  }
}
