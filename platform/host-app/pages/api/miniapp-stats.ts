/**
 * MiniApp Stats API
 * Returns per-app statistics via database-side aggregation (migration 049).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { warnOnce } from "@/lib/log-once";
import { standardLimit } from "@/lib/rate-limit";
import { canonicalizeMiniAppId } from "@/lib/miniapp-id";
import { isMissingSupabaseSchemaObject } from "@/lib/supabase-errors";
import { getServerSupabaseClient } from "@/lib/server-supabase";

interface AppStats {
  app_id: string;
  total_users: number;
  total_transactions: number;
  total_gas_used: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  const appIdFilter =
    canonicalizeMiniAppId((req.query.app_id as string | undefined) || "") ||
    null;

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    res.status(200).json({ stats: [] });
    return;
  }

  try {
    const { data, error } = await supabase.rpc("miniapp_stats_aggregate", {
      p_app_id: appIdFilter,
    });

    if (error) {
      if (isMissingSupabaseSchemaObject(error)) {
        warnOnce(
          "miniapp-stats-rpc-missing",
          "miniapp_stats_aggregate RPC not available; returning empty miniapp stats.",
        );
        res.status(200).json({ stats: [] });
        return;
      }
      logger.error(
        "miniapp_stats_aggregate RPC failed:",
        error instanceof Error ? error.message : String(error),
      );
      return apiError.internal(res, "Failed to fetch stats");
    }

    const stats: AppStats[] = (data || []).map(
      (row: Record<string, unknown>) => ({
        app_id: canonicalizeMiniAppId(row.app_id) || String(row.app_id || ""),
        total_users: Number(row.total_users || 0),
        total_transactions: Number(row.total_transactions || 0),
        total_gas_used: Number(row.total_gas_used || 0).toFixed(2),
      }),
    );

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ stats });
    return;
  } catch (error) {
    logger.error(
      "MiniApp stats error:",
      error instanceof Error ? error.message : "unknown error",
    );
    return apiError.internal(res, "Failed to fetch stats");
  }
}
