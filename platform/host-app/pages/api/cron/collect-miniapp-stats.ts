import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// Vercel cron or manual trigger
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }

  // Verify cron secret (timing-safe to prevent oracle attacks)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return apiError.unauthorized(res, "Unauthorized");
  }
  const authHeader = String(req.headers.authorization || "");
  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
    return apiError.unauthorized(res, "Unauthorized");
  }

  if (!isSupabaseConfigured) {
    return apiError.internal(res, "Database not configured");
  }

  const network = (req.query.network as "testnet" | "mainnet") || "testnet";
  const results: { appId: string; success: boolean; error?: string }[] = [];

  try {
    // Get all active miniapps from canonical registry
    const { data: apps, error: queryError } = await supabase
      .from("miniapps")
      .select("app_id, contract_hash")
      .eq("status", "active");

    if (queryError) {
      logger.error("Failed to fetch miniapps:", queryError);
      return apiError.internal(res, "Failed to fetch miniapps");
    }

    if (!apps?.length) {
      return res.status(200).json({ message: "No apps to process", results });
    }

    for (const app of apps) {
      try {
        await collectAppStats(app.app_id, app.contract_hash, network);
        results.push({ appId: app.app_id, success: true });
      } catch (error) {
        results.push({
          appId: app.app_id,
          success: false,
          error: "collection failed",
        });
      }
    }

    res.status(200).json({
      message: `Processed ${results.length} apps`,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    logger.error("Cron error:", error);
    return apiError.internal(res, "Collection failed");
  }
}

async function collectAppStats(appId: string, contractHash: string, network: "testnet" | "mainnet") {
  const { error } = await supabase.from("miniapp_stats").upsert(
    { app_id: appId, last_updated: Date.now() },
    { onConflict: "app_id" },
  );
  if (error) throw new Error(`upsert failed: ${error.message}`);
}
