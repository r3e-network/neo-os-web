/**
 * Stats Rollup Cron Job
 * Aggregates chain data into miniapp_stats table
 * Schedule: Every 10 minutes via Vercel Cron
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getContractStats, getContractAddress } from "@/lib/chains/contract-queries";
import { getChainRegistry } from "@/lib/chains/registry";
import type { ChainId } from "@/lib/chains/types";
import { createHandler } from "@/lib/api";

// Map app IDs to contract names
const APP_CONTRACT_NAMES: Record<string, string> = {
  "miniapp-lottery": "lottery",
  "miniapp-coinflip": "coinFlip",
  "miniapp-dicegame": "diceGame",
  "miniapp-neo-crash": "neoCrash",
  "miniapp-secretvote": "secretVote",
  "miniapp-predictionmarket": "predictionMarket",
  "miniapp-flashloan": "flashLoan",
  "miniapp-redenvelope": "redEnvelope",
};

// All apps with deployed contracts
const DEPLOYED_APPS = Object.keys(APP_CONTRACT_NAMES);

/** Validate chain ID using registry */
function validateChainId(value: string | undefined): ChainId | null {
  if (!value) return null;
  const registry = getChainRegistry();
  const chain = registry.getChain(value as ChainId);
  return chain ? chain.id : null;
}

export default createHandler({
  auth: "cron",
  methods: {
    POST: async (req: NextApiRequest, res: NextApiResponse, ctx) => {
      // Get active chains from registry dynamically
      const registry = getChainRegistry();
      const allActiveChains = registry.getActiveChains().map((c) => c.id);

      // Support chain_id parameter or process all active chains
      const rawChainId = (req.query.chain_id as string) || (req.query.network as string);
      const chainIdParam = validateChainId(rawChainId);
      const chainsToProcess = chainIdParam ? [chainIdParam] : allActiveChains;

      const results: { appId: string; chainId: ChainId; success: boolean; error?: string }[] = [];

      for (const chainId of chainsToProcess) {
        for (const appId of DEPLOYED_APPS) {
          try {
            const contractName = APP_CONTRACT_NAMES[appId];
            const contractAddress = getContractAddress(contractName, chainId);

            if (!contractAddress) {
              continue; // Skip apps without contract on this chain
            }

            const stats = await getContractStats(contractAddress, chainId);

            await ctx.db.from("miniapp_stats").upsert(
              {
                app_id: appId,
                chain_id: chainId,
                total_unique_users: stats.uniqueUsers,
                total_transactions: stats.totalTransactions,
                total_volume_gas: stats.totalValueLocked,
                last_rollup_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "app_id,chain_id" },
            );

            results.push({ appId, chainId, success: true });
          } catch (error) {
            results.push({
              appId,
              chainId,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      }

      const successCount = results.filter((r) => r.success).length;

      res.status(200).json({
        message: `Rollup complete: ${successCount}/${results.length} entries updated`,
        chainsProcessed: chainsToProcess,
        results,
        timestamp: new Date().toISOString(),
      });
    },
  },
});
