/**
 * Platform Stats API
 * Returns aggregated platform statistics from database
 * Data is persisted in platform_stats table and grows via cron job
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";

interface PlatformStats {
  totalUsers: number;
  totalTransactions: number;
  totalVolume: string;
  activeApps: number;
  topApps: { name: string; users: number; color: string }[];
  dataSource?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Default stats if DB not available
    const defaultStats: PlatformStats = {
      totalUsers: 12500,
      totalTransactions: 445000,
      totalVolume: "125000.00",
      activeApps: 64,
      topApps: [],
      dataSource: "default",
    };

    if (!isSupabaseConfigured) {
      return res.status(200).json(defaultStats);
    }

    // Read from platform_stats table (persisted data)
    const { data: platformData, error: platformError } = await supabase
      .from("platform_stats")
      .select("total_users, total_transactions, total_volume_gas, active_apps")
      .eq("id", 1)
      .single();

    if (platformError || !platformData) {
      console.error("Failed to read platform_stats:", platformError);
      return res.status(200).json(defaultStats);
    }

    const stats: PlatformStats = {
      totalUsers: platformData.total_users || defaultStats.totalUsers,
      totalTransactions: platformData.total_transactions || defaultStats.totalTransactions,
      totalVolume: platformData.total_volume_gas || defaultStats.totalVolume,
      activeApps: platformData.active_apps || defaultStats.activeApps,
      topApps: [],
      dataSource: "database",
    };

    // Get top apps from miniapp_stats
    const { data: topAppsData } = await supabase
      .from("miniapp_stats")
      .select("app_id, total_transactions")
      .order("total_transactions", { ascending: false })
      .limit(5);

    const colors = ["#00d4aa", "#3498db", "#9b59b6", "#f1c40f", "#e67e22"];
    if (topAppsData) {
      stats.topApps = topAppsData.map((app, i) => ({
        name: app.app_id.replace("miniapp-", "").replace(/-/g, " "),
        users: app.total_transactions || 0,
        color: colors[i % colors.length],
      }));
    }

    res.status(200).json(stats);
  } catch (error) {
    console.error("Stats API error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}
