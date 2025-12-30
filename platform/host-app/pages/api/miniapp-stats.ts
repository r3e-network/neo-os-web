/**
 * MiniApp Stats API
 * Returns per-app statistics aggregated from multiple Supabase tables
 *
 * Data sources:
 * 1. simulation_txs - Main transaction records (paginated)
 * 2. service_requests - Service layer requests
 * 3. contract_events - On-chain contract events
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

interface AppStats {
  app_id: string;
  total_users: number;
  total_transactions: number;
  total_gas_used: string;
  data_sources: string[]; // Track which tables contributed data
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Optional filter by app_id
  const appIdFilter = req.query.app_id as string | undefined;

  if (!isSupabaseConfigured) {
    return res.status(200).json({ stats: [] });
  }

  try {
    const appStatsMap: Record<string, { users: Set<string>; txCount: number; volume: bigint; sources: Set<string> }> =
      {};

    // Helper to ensure app entry exists
    const ensureApp = (appId: string) => {
      if (!appStatsMap[appId]) {
        appStatsMap[appId] = { users: new Set(), txCount: 0, volume: BigInt(0), sources: new Set() };
      }
    };

    // 1. Get stats from simulation_txs (paginated)
    let offset = 0;
    const pageSize = 10000;
    while (true) {
      const { data: simTxs } = await supabase
        .from("simulation_txs")
        .select("app_id, account_address, amount")
        .not("app_id", "is", null)
        .range(offset, offset + pageSize - 1);

      if (!simTxs || simTxs.length === 0) break;

      for (const tx of simTxs) {
        if (!tx.app_id) continue;
        ensureApp(tx.app_id);
        appStatsMap[tx.app_id].txCount++;
        appStatsMap[tx.app_id].sources.add("simulation_txs");
        if (tx.account_address) appStatsMap[tx.app_id].users.add(tx.account_address);
        if (tx.amount) {
          try {
            appStatsMap[tx.app_id].volume += BigInt(String(tx.amount));
          } catch {
            // Skip invalid
          }
        }
      }

      if (simTxs.length < pageSize) break;
      offset += pageSize;
    }

    // 2. Get stats from service_requests
    const { data: serviceReqs } = await supabase
      .from("service_requests")
      .select("app_id, requester")
      .not("app_id", "is", null);

    if (serviceReqs) {
      for (const req of serviceReqs) {
        if (!req.app_id) continue;
        ensureApp(req.app_id);
        appStatsMap[req.app_id].txCount++;
        appStatsMap[req.app_id].sources.add("service_requests");
        if (req.requester) appStatsMap[req.app_id].users.add(req.requester);
      }
    }

    // 3. Get stats from contract_events
    const { data: events } = await supabase.from("contract_events").select("app_id, data").not("app_id", "is", null);

    if (events) {
      for (const evt of events) {
        if (!evt.app_id) continue;
        ensureApp(evt.app_id);
        appStatsMap[evt.app_id].txCount++;
        appStatsMap[evt.app_id].sources.add("contract_events");
        const data = evt.data as Record<string, unknown> | null;
        if (data?.sender) appStatsMap[evt.app_id].users.add(String(data.sender));
        if (data?.from) appStatsMap[evt.app_id].users.add(String(data.from));
      }
    }

    // Convert to array
    const stats: AppStats[] = Object.entries(appStatsMap)
      .map(([appId, data]) => ({
        app_id: appId,
        total_users: data.users.size,
        total_transactions: data.txCount,
        total_gas_used: (Number(data.volume) / 100000000).toFixed(2),
        data_sources: Array.from(data.sources),
      }))
      .sort((a, b) => b.total_transactions - a.total_transactions);

    const filteredStats = appIdFilter ? stats.filter((s) => s.app_id === appIdFilter) : stats;
    res.status(200).json({ stats: filteredStats });
  } catch (error) {
    console.error("MiniApp stats error:", error);
    res.status(200).json({ stats: [] });
  }
}
