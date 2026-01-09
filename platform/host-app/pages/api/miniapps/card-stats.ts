/**
 * Get all MiniApp stats for card display
 * Returns users, transactions, and views for each app from Supabase
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";

interface AppCardStats {
  users: number;
  transactions: number;
  views: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ stats: Record<string, AppCardStats> } | { error: string }>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stats: Record<string, AppCardStats> = {};

  if (!isSupabaseConfigured) {
    return res.status(500).json({ error: "Database not configured" });
  }

  try {
    const { data, error } = await supabase
      .from("miniapp_stats_summary")
      .select("app_id, total_unique_users, total_transactions, view_count");

    if (error) {
      console.error("Miniapp card stats query error:", error);
      return res.status(500).json({ error: "Failed to fetch stats" });
    }

    if (data) {
      for (const row of data) {
        stats[row.app_id] = {
          users: row.total_unique_users || 0,
          transactions: row.total_transactions || 0,
          views: row.view_count || 0,
        };
      }
    }

    res.status(200).json({ stats });
  } catch (error) {
    console.error("Miniapp card stats error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
