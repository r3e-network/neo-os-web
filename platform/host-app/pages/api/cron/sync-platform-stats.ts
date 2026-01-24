/**
 * Platform Stats Sync Cron Job
 * Syncs platform transaction counts from chain explorer data
 * Supports multi-chain stats aggregation
 *
 * Run via: GET /api/cron/sync-platform-stats
 * Requires: CRON_SECRET header for authentication
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import { getChainRegistry } from "../../../lib/chains/registry";

const PLATFORM_ADDRESS = process.env.NEO_TESTNET_ADDRESS || "NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isSupabaseConfigured) {
    return res.status(500).json({ error: "Database not configured" });
  }

  try {
    const result = await syncPlatformStats();
    res.status(200).json(result);
  } catch (error) {
    console.error("Sync error:", error);
    res.status(500).json({ error: "Sync failed" });
  }
}

async function syncPlatformStats(): Promise<SyncResult> {
  const registry = getChainRegistry();
  const activeChains = registry.getActiveChains();
  const chainResults: ChainSyncResult[] = [];

  // Sync stats for each active chain
  for (const chain of activeChains) {
    const chainStats = await syncChainStats(chain.id);
    chainResults.push(chainStats);

    // Update platform_stats_by_chain table
    await supabase.from("platform_stats_by_chain").upsert(
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
    supabase.from("simulation_txs").select("*", { count: "exact", head: true }),
    supabase.from("service_requests").select("*", { count: "exact", head: true }),
    supabase.from("contract_events").select("*", { count: "exact", head: true }),
  ]);

  const tables = {
    simulation_txs: simTxRes.count || 0,
    service_requests: serviceRes.count || 0,
    contract_events: eventsRes.count || 0,
  };

  // Aggregate totals across all chains
  const totalTransactions = chainResults.reduce((sum, c) => sum + c.total_transactions, 0);
  const totalVolumeGas = chainResults.reduce((sum, c) => sum + parseFloat(c.total_volume_gas), 0);
  const allUsers = new Set<string>();

  // Get all unique users across chains
  const { data: simUsers } = await supabase
    .from("simulation_txs")
    .select("account_address")
    .not("account_address", "is", null)
    .limit(50000);

  if (simUsers) {
    simUsers.forEach((u) => u.account_address && allUsers.add(u.account_address));
  }

  // Update legacy platform_stats table
  await supabase.from("platform_stats").upsert(
    {
      id: 1,
      total_users: allUsers.size,
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
    unique_users: allUsers.size,
    tables,
    chains: chainResults,
  };
}

/**
 * Sync stats for a specific chain
 */
async function syncChainStats(chainId: string): Promise<ChainSyncResult> {
  // Count transactions for this chain
  const { count: txCount } = await supabase
    .from("simulation_txs")
    .select("*", { count: "exact", head: true })
    .eq("chain_id", chainId);

  // Get volume for this chain
  const { data: volumeData } = await supabase
    .from("simulation_txs")
    .select("amount")
    .eq("chain_id", chainId)
    .not("amount", "is", null);

  let totalVolumeGas = 0;
  if (volumeData) {
    totalVolumeGas = volumeData.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0) / 100000000;
  }

  // Count unique users for this chain
  const uniqueUsers = new Set<string>();
  const { data: simUsers } = await supabase
    .from("simulation_txs")
    .select("account_address")
    .eq("chain_id", chainId)
    .not("account_address", "is", null)
    .limit(50000);

  if (simUsers) {
    simUsers.forEach((u) => u.account_address && uniqueUsers.add(u.account_address));
  }

  return {
    chain_id: chainId,
    total_transactions: txCount || 0,
    total_volume_gas: totalVolumeGas.toFixed(8),
    unique_users: uniqueUsers.size,
  };
}
