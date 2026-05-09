/**
 * Platform Stats API
 * Returns aggregated platform statistics via database-side RPC (migration 050).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { relaxedLimit } from "@/lib/rate-limit";
import { warnOnce } from "@/lib/log-once";
import { canonicalizeMiniAppId } from "@/lib/miniapp-id";
import { isMissingSupabaseSchemaObject } from "@/lib/supabase-errors";
import { loadMiniAppDefinitions } from "@/lib/miniapp-definitions";
import { getServerSupabaseClient } from "@/lib/server-supabase";

const colors = ["#00d4aa", "#3498db", "#9b59b6", "#f1c40f", "#e67e22"];

async function getBundledActiveAppCount(): Promise<number | null> {
  try {
    const apps = await loadMiniAppDefinitions();
    return apps.filter((app) => {
      const status = String(app.status || "active").toLowerCase();
      return !["archived", "disabled", "removed", "deprecated"].includes(status);
    }).length;
  } catch (error) {
    logger.warn(
      "Unable to load bundled miniapp definitions for platform stats:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (relaxedLimit(req, res)) return;

  const bundledActiveApps = await getBundledActiveAppCount();
  const base = {
    totalUsers: 0,
    totalTransactions: null as number | null,
    totalVolume: "0",
    activeApps: bundledActiveApps,
    topApps: [] as { name: string; users: number; color: string }[],
    sources: {
      totalUsers: "unavailable",
      totalTransactions: "unavailable",
      totalVolume: "unavailable",
      activeApps: bundledActiveApps === null ? "unavailable" : "bundled_definitions",
      topApps: "unavailable",
    },
  };

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    res.status(200).json(base);
    return;
  }

  try {
    const { data, error } = await supabase.rpc("platform_stats_aggregate");

    if (error) {
      if (isMissingSupabaseSchemaObject(error)) {
        warnOnce(
          "platform-stats-rpc-missing",
          "platform_stats_aggregate RPC not available; returning platform stats with unavailable live totals.",
        );
        res.status(200).json(base);
        return;
      }
      logger.error(
        "platform_stats_aggregate RPC failed:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(200).json(base);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      base.totalUsers = Number(row.unique_users || 0);
      base.sources.totalUsers = "supabase_rpc";
      const txCount = Number(row.total_transactions);
      if (Number.isFinite(txCount)) {
        base.totalTransactions = txCount;
        base.sources.totalTransactions = "supabase_rpc";
      }
      base.totalVolume = Number(row.total_volume || 0).toFixed(2);
      base.sources.totalVolume = "supabase_rpc";
      const activeApps = Number(row.active_apps);
      if (Number.isFinite(activeApps) && activeApps > 0) {
        base.activeApps = activeApps;
        base.sources.activeApps = "supabase_rpc";
      }
      const apps = (row.top_apps || []) as { name: string; users: number }[];
      base.topApps = apps.map((a, i) => ({
        name: (canonicalizeMiniAppId(a.name) || String(a.name || ""))
          .replace("miniapp-", "")
          .replace(/-/g, " "),
        users: Number(a.users || 0),
        color: colors[i % colors.length],
      }));
      base.sources.topApps = base.topApps.length > 0 ? "supabase_rpc" : "unavailable";
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json(base);
    return;
  } catch (error) {
    logger.error(
      "Stats API error:",
      error instanceof Error ? error.message : "unknown error",
    );
    return apiError.internal(res, "Failed to fetch stats");
  }
}
