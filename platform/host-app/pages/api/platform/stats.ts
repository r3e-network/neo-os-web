/**
 * Platform Stats API
 * Returns aggregated platform statistics from database
 * Data is persisted in platform_stats table and grows via cron job
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import { getNeoBurgerStats } from "../../../lib/neoburger";

interface PlatformStats {
  totalUsers: number;
  totalTransactions: number;
  totalVolume: string;
  totalGasBurned: string;
  stakingApr: string;
  activeApps: number;
  topApps: { name: string; users: number; color: string }[];
  dataSource?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Require Supabase configuration - no fallback data
    if (!isSupabaseConfigured) {
      return res.status(503).json({ error: "Database not configured" });
    }

    // Try platform_stats first
    const { data: platformData, error: platformError } = await supabase
      .from("platform_stats")
      .select("total_users, total_transactions, total_volume_gas, total_gas_burned, active_apps")
      .eq("id", 1)
      .single();

    // Fetch staking APR from NeoBurger
    let stakingApr = "0";
    try {
      const neoBurgerStats = await getNeoBurgerStats("mainnet");
      stakingApr = neoBurgerStats.apr;
    } catch (e) {
      console.warn("Failed to fetch NeoBurger APR:", e);
    }

    let stats: PlatformStats;

    if (!platformError && platformData) {
      // Use platform_stats if available
      stats = {
        totalUsers: platformData.total_users || 0,
        totalTransactions: platformData.total_transactions || 0,
        totalVolume: platformData.total_volume_gas || "0",
        totalGasBurned: platformData.total_gas_burned || "0",
        stakingApr,
        activeApps: platformData.active_apps || 0,
        topApps: [],
        dataSource: "database",
      };
    } else {
      // Fallback: Aggregate from miniapp_stats table
      console.log("platform_stats not available, aggregating from miniapp_stats");
      const { data: aggregateData } = await supabase
        .from("miniapp_stats")
        .select("total_unique_users, total_transactions, total_volume_gas");

      if (aggregateData && aggregateData.length > 0) {
        const totals = aggregateData.reduce(
          (acc, row) => ({
            users: acc.users + (row.total_unique_users || 0),
            txs: acc.txs + (row.total_transactions || 0),
            volume: acc.volume + parseFloat(row.total_volume_gas || "0"),
          }),
          { users: 0, txs: 0, volume: 0 },
        );

        stats = {
          totalUsers: totals.users,
          totalTransactions: totals.txs,
          totalVolume: totals.volume.toFixed(2),
          totalGasBurned: "0",
          stakingApr,
          activeApps: aggregateData.length,
          topApps: [],
          dataSource: "miniapp_stats",
        };
      } else {
        // No data available - return error
        return res.status(503).json({ error: "No stats data available" });
      }
    }

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
