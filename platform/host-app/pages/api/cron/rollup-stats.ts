/**
 * Stats Rollup Cron Job
 * Aggregates chain data into miniapp_stats table
 * Schedule: Every 10 minutes via Vercel Cron
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import { getContractStats, CONTRACTS } from "../../../lib/chain";

// All apps with deployed contracts
const DEPLOYED_APPS = [
  { appId: "miniapp-lottery", contract: CONTRACTS.lottery },
  { appId: "miniapp-coinflip", contract: CONTRACTS.coinFlip },
  { appId: "miniapp-dicegame", contract: CONTRACTS.diceGame },
  { appId: "miniapp-neocrash", contract: CONTRACTS.neoCrash },
  { appId: "miniapp-secretvote", contract: CONTRACTS.secretVote },
  { appId: "miniapp-predictionmarket", contract: CONTRACTS.predictionMarket },
  { appId: "miniapp-flashloan", contract: CONTRACTS.flashLoan },
  { appId: "miniapp-redenvelope", contract: CONTRACTS.redEnvelope },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret for security
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isSupabaseConfigured) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  const results: { appId: string; success: boolean; error?: string }[] = [];

  for (const app of DEPLOYED_APPS) {
    try {
      const stats = await getContractStats(app.contract, "testnet");

      await supabase.from("miniapp_stats").upsert(
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

      results.push({ appId: app.appId, success: true });
    } catch (error) {
      results.push({
        appId: app.appId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  res.status(200).json({
    message: `Rollup complete: ${successCount}/${DEPLOYED_APPS.length} apps updated`,
    results,
    timestamp: new Date().toISOString(),
  });
}
