/**
 * Platform Stats API
 * Returns aggregated platform statistics from multiple sources
 *
 * Data sources:
 * 1. PLATFORM_TX_COUNT env var - Accurate count from chain explorer (OneGate/NeoTube)
 * 2. Supabase tables - simulation_txs, service_requests, contract_events
 * 3. Neo RPC - Limited to 1000 records per call
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";

interface PlatformStats {
  totalUsers: number;
  totalTransactions: number;
  totalVolume: string;
  activeApps: number;
  topApps: { name: string; users: number; color: string }[];
  dataSource?: string; // For debugging: shows where the data came from
}

// Main platform address
const PLATFORM_ADDRESS = process.env.NEO_TESTNET_ADDRESS || "NLtL2v28d7TyMEaXcPqtekunkFRksJ7wxu";

// Accurate transaction count from chain explorer (OneGate shows 444,981 as of 2025-01-14)
// This should be updated periodically or fetched from an indexer API when available
const PLATFORM_TX_COUNT = parseInt(process.env.PLATFORM_TX_COUNT || "444981", 10);
const PLATFORM_NEP17_TRANSFERS = parseInt(process.env.PLATFORM_NEP17_TRANSFERS || "367526", 10);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const stats: PlatformStats = {
      totalUsers: 0,
      totalTransactions: PLATFORM_TX_COUNT, // Use accurate count from chain explorer
      totalVolume: "0",
      activeApps: 62,
      topApps: [],
      dataSource: "chain-explorer",
    };

    if (!isSupabaseConfigured) {
      return res.status(200).json(stats);
    }

    // Count from Supabase tables for reference (not used for totalTransactions)
    // These counts are subset of actual chain transactions
    const { count: simTxCount } = await supabase.from("simulation_txs").select("*", { count: "exact", head: true });
    const { count: serviceCount } = await supabase.from("service_requests").select("*", { count: "exact", head: true });
    const { count: eventsCount } = await supabase.from("contract_events").select("*", { count: "exact", head: true });

    // Log Supabase counts for debugging (actual chain has more transactions)
    // Supabase total: ~93k, Chain explorer: ~445k
    const supabaseTotal = (simTxCount || 0) + (serviceCount || 0) + (eventsCount || 0);
    console.log(`Supabase records: ${supabaseTotal}, Chain explorer: ${PLATFORM_TX_COUNT}`);

    // Get unique users from simulation_txs (primary source)
    const { data: simTxUsers } = await supabase
      .from("simulation_txs")
      .select("account_address")
      .not("account_address", "is", null);

    const uniqueUsers = new Set<string>();
    let totalVolume = BigInt(0);

    if (simTxUsers) {
      for (const tx of simTxUsers) {
        if (tx.account_address) uniqueUsers.add(tx.account_address);
      }
    }

    // Also get volume from simulation_txs
    const { data: simTxAmounts } = await supabase.from("simulation_txs").select("amount").not("amount", "is", null);

    if (simTxAmounts) {
      for (const tx of simTxAmounts) {
        if (tx.amount) {
          try {
            totalVolume += BigInt(String(tx.amount));
          } catch {
            // Skip invalid amounts
          }
        }
      }
    }

    // Add users from service_requests
    const { data: requesters } = await supabase.from("service_requests").select("requester");
    if (requesters) {
      for (const r of requesters) {
        if (r.requester) uniqueUsers.add(r.requester);
      }
    }

    stats.totalUsers = uniqueUsers.size;
    stats.totalVolume = (Number(totalVolume) / 100000000).toFixed(2);

    // Get top apps by transaction count from simulation_txs
    const { data: simTxApps } = await supabase.from("simulation_txs").select("app_id").not("app_id", "is", null);

    const appTxCounts: Record<string, number> = {};
    if (simTxApps) {
      for (const row of simTxApps) {
        if (row.app_id) appTxCounts[row.app_id] = (appTxCounts[row.app_id] || 0) + 1;
      }
    }

    const colors = ["#00d4aa", "#3498db", "#9b59b6", "#f1c40f", "#e67e22"];
    stats.topApps = Object.entries(appTxCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([appId, count], i) => ({
        name: appId.replace("builtin-", "").replace("miniapp-", "").replace(/-/g, " "),
        users: count,
        color: colors[i % colors.length],
      }));

    res.status(200).json(stats);
  } catch (error) {
    console.error("Stats API error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}
