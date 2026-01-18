/**
 * Get all MiniApp stats for card display
 * Returns users, transactions, and views for each app from Supabase
 * Performance: In-memory cache with 3-minute TTL
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";

interface AppCardStats {
  users: number;
  transactions: number;
  views: number;
}

// Cache configuration
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
let cardStatsCache: { data: Record<string, AppCardStats>; timestamp: number } | null = null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ stats: Record<string, AppCardStats>; cached?: boolean } | { error: string }>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isSupabaseConfigured) {
    return res.status(500).json({ error: "Database not configured" });
  }

  // Check cache first
  if (cardStatsCache && Date.now() - cardStatsCache.timestamp < CACHE_TTL_MS) {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({ stats: cardStatsCache.data, cached: true });
  }

  const stats: Record<string, AppCardStats> = {};

  try {
    const { data, error } = await supabase
      .from("miniapp_stats_summary")
      .select("app_id, total_unique_users, total_transactions, view_count");

    if (error) {
      console.error("Miniapp card stats query error:", error);
      return res.status(500).json({ error: "Failed to fetch stats" });
    }

    if (data) {
      // Aggregate stats across all chains for each app
      for (const row of data) {
        if (!stats[row.app_id]) {
          stats[row.app_id] = { users: 0, transactions: 0, views: 0 };
        }
        // Sum values across all chains
        stats[row.app_id].users += row.total_unique_users || 0;
        stats[row.app_id].transactions += row.total_transactions || 0;
        stats[row.app_id].views += row.view_count || 0;
      }
    }

    // Update cache
    cardStatsCache = { data: stats, timestamp: Date.now() };

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    res.status(200).json({ stats });
  } catch (error) {
    console.error("Miniapp card stats error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
