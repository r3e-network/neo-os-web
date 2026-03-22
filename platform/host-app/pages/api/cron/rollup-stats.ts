/**
 * Stats Rollup Cron Job
 * Aggregates chain data into miniapp_stats table
 * Schedule: Every 10 minutes via Vercel Cron
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import { getContractStats, FLAGSHIP_APPS } from "../../../lib/chain";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

const DEPLOYED_APPS = Object.entries(FLAGSHIP_APPS).map(([appId, meta]) => ({
  appId,
  contract: meta.contract,
}));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }

  // Verify cron secret (timing-safe to prevent oracle attacks)
  const cronSecret = String(process.env.CRON_SECRET || "");
  const authHeader = String(req.headers.authorization || "");
  const expected = `Bearer ${cronSecret}`;
  if (!cronSecret || authHeader.length !== expected.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
    return apiError.unauthorized(res, "Unauthorized");
  }

  if (!isSupabaseConfigured) {
    return apiError.internal(res, "Supabase not configured");
  }

  const results: { appId: string; success: boolean; error?: string }[] = [];

  for (const app of DEPLOYED_APPS) {
    try {
      const stats = await getContractStats(app.contract, "testnet", app.appId);

      const { error: upsertError } = await supabase.from("miniapp_stats").upsert(
        {
          app_id: app.appId,
          contract_hash: app.contract,
          total_unique_users: stats.uniqueUsers,
          total_transactions: stats.totalTransactions,
          total_volume_gas: stats.totalValueLocked,
          last_rollup_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "app_id" },
      );
      if (upsertError) throw upsertError;

      results.push({ appId: app.appId, success: true });
    } catch (error) {
      logger.warn(`rollup failed for ${app.appId}:`, error instanceof Error ? error.message : "unknown error");
      results.push({
        appId: app.appId,
        success: false,
        error: "rollup failed",
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  return res.status(200).json({
    message: `Rollup complete: ${successCount}/${DEPLOYED_APPS.length} apps updated`,
    results,
    timestamp: new Date().toISOString(),
  });
}
