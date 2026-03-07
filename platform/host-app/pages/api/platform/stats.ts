/**
 * Platform Stats API
 * Returns aggregated platform statistics via database-side RPC (migration 050).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { relaxedLimit } from "@/lib/rate-limit";
import { warnOnce } from "@/lib/log-once";
import { canonicalizeMiniAppId } from "@/lib/miniapp-id";
import { isMissingSupabaseSchemaObject } from "@/lib/supabase-errors";

function getPlatformTxCount(): number {
  return parseInt(process.env.PLATFORM_TX_COUNT || "444981", 10);
}

const colors = ["#00d4aa", "#3498db", "#9b59b6", "#f1c40f", "#e67e22"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (relaxedLimit(req, res)) return;

  const base = {
    totalUsers: 0,
    totalTransactions: getPlatformTxCount(),
    totalVolume: "0",
    activeApps: 62,
    topApps: [] as { name: string; users: number; color: string }[],
  };

  if (!isSupabaseConfigured) {
    return res.status(200).json(base);
  }

  try {
    const { data, error } = await supabase.rpc("platform_stats_aggregate");

    if (error) {
      if (isMissingSupabaseSchemaObject(error)) {
        warnOnce("platform-stats-rpc-missing", "platform_stats_aggregate RPC not available; returning fallback platform stats.");
        return res.status(200).json(base);
      }
      logger.error("platform_stats_aggregate RPC failed:", error.message);
      return res.status(200).json(base);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      base.totalUsers = Number(row.unique_users || 0);
      base.totalVolume = Number(row.total_volume || 0).toFixed(2);
      const apps = (row.top_apps || []) as { name: string; users: number }[];
      base.topApps = apps.map((a, i) => ({
        name: (canonicalizeMiniAppId(a.name) || String(a.name || ""))
          .replace("miniapp-", "")
          .replace(/-/g, " "),
        users: Number(a.users || 0),
        color: colors[i % colors.length],
      }));
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json(base);
  } catch (error) {
    logger.error("Stats API error:", error instanceof Error ? error.message : "unknown error");
    return apiError.internal(res, "Failed to fetch stats");
  }
}
