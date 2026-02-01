import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import { getChainRegistry } from "../../../lib/chains/registry";
import type { ChainId } from "../../../lib/chains/types";

/** Validate chain ID using registry */
function validateChainId(value: string | undefined): ChainId | null {
  if (!value) return null;
  const registry = getChainRegistry();
  const chain = registry.getChain(value as ChainId);
  return chain ? chain.id : null;
}

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

  // Get active chains from registry dynamically
  const registry = getChainRegistry();
  const allActiveChains = registry.getActiveChains().map((c) => c.id);

  // Support chain_id parameter or process all active chains
  const rawChainId = (req.query.chain_id as string) || (req.query.network as string);
  const chainIdParam = validateChainId(rawChainId);
  const chainsToProcess = chainIdParam ? [chainIdParam] : allActiveChains;

  const results: { appId: string; chainId: ChainId; success: boolean; error?: string }[] = [];

  try {
    // Get all registered miniapps
    const { data: apps } = await supabase
      .from("miniapp_registry")
      .select("app_id, supported_chains, contracts");

    if (!apps?.length) {
      return res.status(200).json({ message: "No apps to process", results });
    }

    // Process each app for each chain
    for (const chainId of chainsToProcess) {
      for (const app of apps) {
        const supportedChains = Array.isArray(app.supported_chains) ? app.supported_chains : [];
        const contracts = app.contracts && typeof app.contracts === "object" ? app.contracts : {};
        if (!supportedChains.includes(chainId) && !(chainId in contracts)) {
          continue;
        }
        try {
          await collectAppStats(app.app_id, chainId);
          results.push({ appId: app.app_id, chainId, success: true });
        } catch (error) {
          results.push({
            appId: app.app_id,
            chainId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    res.status(200).json({
      message: `Processed ${results.length} app-chain combinations`,
      chainsProcessed: chainsToProcess,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    console.error("Cron error:", error);
    res.status(500).json({ error: "Collection failed" });
  }
}

async function collectAppStats(appId: string, chainId: ChainId) {
  // Update collection timestamp; blockchain data aggregation handled by indexer service
  await supabase.from("miniapp_stats").upsert(
    {
      app_id: appId,
      chain_id: chainId,
      last_updated: Date.now(),
    },
    { onConflict: "app_id,chain_id" },
  );
}
