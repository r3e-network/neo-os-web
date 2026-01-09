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
import { supabaseAdmin, isSupabaseConfigured } from "../../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret for security (skip in development)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  try {
    // Random increments within specified ranges
    const userIncrement = Math.floor(Math.random() * 2) + 1; // 1-2
    const txIncrement = Math.floor(Math.random() * 11) + 10; // 10-20
    const gasIncrement = (Math.random() * 0.5 + 0.1).toFixed(4); // 0.1-0.6 GAS

    // Get all miniapps and distribute increments
    const { data: apps } = await supabaseAdmin
      .from("miniapp_stats")
      .select(
        "id, total_unique_users, total_transactions, total_gas_used, active_users_daily, active_users_weekly, transactions_daily, transactions_weekly",
      )
      .limit(10);

    if (apps && apps.length > 0) {
      // Pick a random app to increment
      const randomApp = apps[Math.floor(Math.random() * apps.length)];

      await supabaseAdmin
        .from("miniapp_stats")
        .update({
          total_unique_users: (randomApp.total_unique_users || 0) + userIncrement,
          total_transactions: (randomApp.total_transactions || 0) + txIncrement,
          total_gas_used: ((parseFloat(randomApp.total_gas_used) || 0) + parseFloat(gasIncrement)).toFixed(4),
          active_users_daily: (randomApp.active_users_daily || 0) + userIncrement,
          active_users_weekly: (randomApp.active_users_weekly || 0) + userIncrement,
          transactions_daily: (randomApp.transactions_daily || 0) + txIncrement,
          transactions_weekly: (randomApp.transactions_weekly || 0) + txIncrement,
          updated_at: new Date().toISOString(),
        })
        .eq("id", randomApp.id);
    }

    res.status(200).json({
      success: true,
      increments: { users: userIncrement, transactions: txIncrement, gas: gasIncrement },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Stats growth error:", error);
    res.status(500).json({ error: "Failed to update stats" });
  }
}
