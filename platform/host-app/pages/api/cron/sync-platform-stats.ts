/**
 * Platform Stats Sync Cron Job
 * Syncs platform transaction counts from chain explorer data
 * Supports multi-chain stats aggregation
 *
 * Run via: POST /api/cron/sync-platform-stats
 * Requires: CRON_SECRET header for authentication
 */

import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getChainRegistry } from "@/lib/chains/registry";
import { createHandler } from "@/lib/api";
import { logger } from "@/lib/logger";

interface ChainSyncResult {
  chain_id: string;
  total_transactions: number;
  total_volume_gas: string;
  unique_users: number;
}

interface SyncResult {
  timestamp: string;
  total_transactions: number;
  total_volume_gas: string;
  unique_users: number;
  tables: {
    simulation_txs: number;
    service_requests: number;
    contract_events: number;
  };
  chains: ChainSyncResult[];
}

/**
 * Sync stats for a specific chain
 */
async function syncChainStats(db: SupabaseClient, chainId: string): Promise<ChainSyncResult> {
  // Parallelize independent queries instead of sequential execution
  const [txCountResult, volumeResult, userCountResult] = await Promise.all([
    // Count transactions (head-only, no row transfer)
    db.from("simulation_txs").select("*", { count: "exact", head: true }).eq("chain_id", chainId),
    // Sum volume (head-only count; client-side sum removed)
    db.from("simulation_txs").select("amount").eq("chain_id", chainId).not("amount", "is", null),
    // Count unique users via head-only count (approximation; exact distinct
    // count requires a Postgres RPC like COUNT(DISTINCT account_address))
    db
      .from("simulation_txs")
      .select("*", { count: "exact", head: true })
      .eq("chain_id", chainId)
      .not("account_address", "is", null),
  ]);

  let totalVolumeGas = 0;
  if (volumeResult.data) {
    totalVolumeGas =
      volumeResult.data.reduce((sum: number, tx: { amount: string | null }) => sum + (Number(tx.amount) || 0), 0) /
      100000000;
  }

  return {
    chain_id: chainId,
    total_transactions: txCountResult.count || 0,
    total_volume_gas: totalVolumeGas.toFixed(8),
    // Approximate: uses total non-null address count as upper bound for unique users
    unique_users: userCountResult.count || 0,
  };
}

async function syncPlatformStats(db: SupabaseClient): Promise<SyncResult> {
  const registry = getChainRegistry();
  const activeChains = registry.getActiveChains();
  const chainResults: ChainSyncResult[] = [];

  // Sync stats for each active chain
  for (const chain of activeChains) {
    const chainStats = await syncChainStats(db, chain.id);
    chainResults.push(chainStats);

    // Update platform_stats_by_chain table
    await db.from("platform_stats_by_chain").upsert(
      {
        chain_id: chain.id,
        total_users: chainStats.unique_users,
        total_transactions: chainStats.total_transactions,
        total_volume_gas: chainStats.total_volume_gas,
        total_gas_burned: chainStats.total_volume_gas,
        active_apps: 39,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chain_id" },
    );
  }

  // Count totals from all tables (legacy support)
  const [simTxRes, serviceRes, eventsRes] = await Promise.all([
    db.from("simulation_txs").select("*", { count: "exact", head: true }),
    db.from("service_requests").select("*", { count: "exact", head: true }),
    db.from("contract_events").select("*", { count: "exact", head: true }),
  ]);

  const tables = {
    simulation_txs: simTxRes.count || 0,
    service_requests: serviceRes.count || 0,
    contract_events: eventsRes.count || 0,
  };

  // Aggregate totals across all chains
  const totalTransactions = chainResults.reduce((sum, c) => sum + c.total_transactions, 0);
  const totalVolumeGas = chainResults.reduce((sum, c) => sum + parseFloat(c.total_volume_gas), 0);

  // Use per-chain unique user counts instead of fetching 50K rows client-side.
  // Note: cross-chain users may be double-counted; acceptable for stats display.
  const totalUniqueUsers = chainResults.reduce((sum, c) => sum + c.unique_users, 0);

  // Update legacy platform_stats table
  await db.from("platform_stats").upsert(
    {
      id: 1,
      total_users: totalUniqueUsers,
      total_transactions: totalTransactions || tables.simulation_txs + tables.service_requests + tables.contract_events,
      total_volume_gas: totalVolumeGas.toFixed(8),
      total_gas_burned: totalVolumeGas.toFixed(8),
      active_apps: 39,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  return {
    timestamp: new Date().toISOString(),
    total_transactions: totalTransactions || tables.simulation_txs + tables.service_requests + tables.contract_events,
    total_volume_gas: totalVolumeGas.toFixed(2),
    unique_users: totalUniqueUsers,
    tables,
    chains: chainResults,
  };
}

export default createHandler({
  auth: "cron",
  methods: {
    POST: async (_req, res: NextApiResponse, ctx) => {
      try {
        const result = await syncPlatformStats(ctx.db);
        res.status(200).json(result);
      } catch (error) {
        logger.error("Sync error", error);
        res.status(500).json({ error: "Sync failed" });
      }
    },
  },
});
