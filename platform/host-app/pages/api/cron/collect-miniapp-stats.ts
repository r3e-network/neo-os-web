import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import { rpcCall } from "../../../lib/miniapp-stats";

// Vercel cron or manual trigger
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret or allow manual trigger
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isSupabaseConfigured) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const network = (req.query.network as "testnet" | "mainnet") || "testnet";
  const results: { appId: string; success: boolean; error?: string }[] = [];

  try {
    // Get all registered miniapps
    const { data: apps } = await supabase.from("miniapp_registry").select("app_id, contract_hash");

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
          error: error instanceof Error ? error.message : "Unknown error",
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
    console.error("Cron error:", error);
    res.status(500).json({ error: "Collection failed" });
  }
}

async function collectAppStats(appId: string, contractHash: string, network: "testnet" | "mainnet") {
  // Update collection timestamp; blockchain data aggregation handled by indexer service
  await supabase.from("miniapp_stats").upsert(
    {
      app_id: appId,
      last_updated: Date.now(),
    },
    { onConflict: "app_id" },
  );
}
