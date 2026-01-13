/**
 * Platform Stats API
 * Returns aggregated platform statistics from database
 * Data is persisted in platform_stats table and grows via cron job
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import { getNeoBurgerStats } from "../../../lib/neoburger";
// Chain ID must be provided by caller - no environment defaults
import miniappsData from "../../../data/miniapps.json";

// Calculate total apps from miniapps.json
function getTotalAppsCount(): number {
  let count = 0;
  for (const category of Object.values(miniappsData)) {
    if (Array.isArray(category)) {
      count += category.length;
    }
  }
  return count;
}

interface PlatformStats {
  totalUsers: number;
  totalTransactions: number;
  totalVolume: string;
  totalGasBurned: string;
  stakingApr: string;
  activeApps: number;
  topApps: { name: string; transactions: number; color: string }[];
  dataSource?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Chain ID is optional - if not provided, return aggregate stats across all chains
  const chainId = req.query.chain_id as string | undefined;

  try {
    // Require Supabase configuration - no fallback data
    if (!isSupabaseConfigured) {
      return res.status(503).json({ error: "Database not configured" });
    }

    // Try platform_stats_by_chain first for chain-specific stats
    const { data: chainData } = await supabase
      .from("platform_stats_by_chain")
      .select("total_users, total_transactions, total_volume_gas, total_gas_burned, active_apps")
      .eq("chain_id", chainId)
      .single();

    // Fallback to legacy platform_stats if chain-specific not available
    const { data: platformData, error: platformError } = chainData
      ? { data: chainData, error: null }
      : await supabase
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
        activeApps: getTotalAppsCount(),
        topApps: [],
        dataSource: "database",
      };
    } else {
      // Fallback: Aggregate from miniapp_stats table
      console.log("platform_stats not available, aggregating from miniapp_stats");
      let aggregateQuery = supabase.from("miniapp_stats").select("*");
      if (chainId) {
        aggregateQuery = aggregateQuery.eq("chain_id", chainId);
      }
      const { data: aggregateData } = await aggregateQuery;

      if (aggregateData && aggregateData.length > 0) {
        const safeParseFloat = (val: string | null | undefined): number => {
          const num = parseFloat(val || "0");
          return Number.isNaN(num) ? 0 : num;
        };

        const totals = aggregateData.reduce(
          (acc, row) => ({
            users: acc.users + (row.total_unique_users || 0),
            txs: acc.txs + (row.total_transactions || 0),
            volume: acc.volume + safeParseFloat(row.total_volume_gas),
            gasBurned: acc.gasBurned + safeParseFloat(row.total_gas_used || row.total_volume_gas),
          }),
          { users: 0, txs: 0, volume: 0, gasBurned: 0 },
        );

        stats = {
          totalUsers: totals.users,
          totalTransactions: totals.txs,
          totalVolume: totals.volume.toFixed(2),
          totalGasBurned: totals.gasBurned.toFixed(2),
          stakingApr,
          activeApps: getTotalAppsCount(),
          topApps: [],
          dataSource: "miniapp_stats",
        };
      } else {
        // No data available - return error
        return res.status(503).json({ error: "No stats data available" });
      }
    }

    // Get top apps from miniapp_stats
    let topAppsQuery = supabase
      .from("miniapp_stats")
      .select("app_id, total_transactions")
      .order("total_transactions", { ascending: false })
      .limit(5);

    if (chainId) {
      topAppsQuery = topAppsQuery.eq("chain_id", chainId);
    }

    const { data: topAppsData } = await topAppsQuery;

    const colors = ["#9f9df3", "#f7aac7", "#f8d7c2", "#d8f2e2", "#d9ecff"];
    if (topAppsData) {
      stats.topApps = topAppsData.map((app, i) => ({
        name: app.app_id.replace("miniapp-", "").replace(/-/g, " "),
        transactions: app.total_transactions || 0,
        color: colors[i % colors.length],
      }));
    }

    res.status(200).json({ ...stats, chainId });
  } catch (error) {
    console.error("Stats API error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}
