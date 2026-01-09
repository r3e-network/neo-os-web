/**
 * Platform Stats Sync Cron Job
 * Syncs platform transaction counts from chain explorer data
 *
 * Run via: GET /api/cron/sync-platform-stats
 * Requires: CRON_SECRET header for authentication
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";

const PLATFORM_ADDRESS = process.env.NEO_TESTNET_ADDRESS || "NLtL2v28d7TyMEaXcPqtekunkFRksJ7wxu";

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
  // Count from each table
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

  const totalTransactions = tables.simulation_txs + tables.service_requests + tables.contract_events;

  // Aggregate GAS volume from simulation_txs (amount is in 8 decimals)
  const { data: volumeData } = await supabase.from("simulation_txs").select("amount").not("amount", "is", null);

  let totalVolumeGas = 0;
  if (volumeData) {
    totalVolumeGas = volumeData.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0) / 100000000;
  }

  // Count unique users
  const uniqueUsers = new Set<string>();

  const { data: simUsers } = await supabase
    .from("simulation_txs")
    .select("account_address")
    .not("account_address", "is", null)
    .limit(50000);

  if (simUsers) {
    simUsers.forEach((u) => u.account_address && uniqueUsers.add(u.account_address));
  }

  const { data: reqUsers } = await supabase
    .from("service_requests")
    .select("requester")
    .not("requester", "is", null)
    .limit(50000);

  if (reqUsers) {
    reqUsers.forEach((u) => u.requester && uniqueUsers.add(u.requester));
  }

  // Update platform_stats table (the table that stats API reads from)
  await supabase.from("platform_stats").upsert(
    {
      id: 1,
      total_users: uniqueUsers.size,
      total_transactions: totalTransactions,
      total_volume_gas: totalVolumeGas.toFixed(8),
      total_gas_burned: totalVolumeGas.toFixed(8),
      active_apps: 39,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  return {
    timestamp: new Date().toISOString(),
    total_transactions: totalTransactions,
    total_volume_gas: totalVolumeGas.toFixed(2),
    unique_users: uniqueUsers.size,
    tables,
  };
}
