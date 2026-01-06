/**
 * MiniApp Stats API
 * Returns per-app statistics aggregated from multiple Supabase tables
 *
 * Data sources:
 * 1. simulation_txs - Main transaction records (paginated)
 * 2. service_requests - Service layer requests
 * 3. contract_events - On-chain contract events
 *
 * Performance: In-memory cache with 5-minute TTL
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let statsCache: { data: AppStats[]; timestamp: number } | null = null;

interface AppStats {
  app_id: string;
  total_users: number;
  total_transactions: number;
  total_gas_used: string;
  data_sources: string[]; // Track which tables contributed data
}

/**
 * Normalize app_id from database format to frontend format
 * Database: builtin-lottery, builtin-coin-flip, builtin-dice-game
 * Frontend: miniapp-lottery, miniapp-coinflip, miniapp-dicegame
 */
function normalizeAppId(dbAppId: string): string {
  if (!dbAppId.startsWith("builtin-")) return dbAppId;

  // Remove "builtin-" prefix and convert to frontend format
  const name = dbAppId.replace("builtin-", "");

  // Map database names to frontend app_id format
  const nameMap: Record<string, string> = {
    // Gaming
    lottery: "miniapp-lottery",
    "coin-flip": "miniapp-coinflip",
    "dice-game": "miniapp-dicegame",
    "scratch-card": "miniapp-scratchcard",
    "secret-poker": "miniapp-secretpoker",
    "neo-crash": "miniapp-neo-crash",
    "crypto-riddle": "miniapp-cryptoriddle",
    "fog-puzzle": "miniapp-fogpuzzle",
    "burn-league": "miniapp-burn-league",
    "garden-of-neo": "miniapp-garden-of-neo",
    "gas-spin": "miniapp-gasspin",
    "mega-millions": "miniapp-megamillions",
    // DeFi
    flashloan: "miniapp-flashloan",
    "price-predict": "miniapp-pricepredict",
    "self-loan": "miniapp-self-loan",
    "compound-capsule": "miniapp-compound-capsule",
    "turbo-options": "miniapp-turbooptions",
    "micro-predict": "miniapp-micropredict",
    "heritage-trust": "miniapp-heritage-trust",
    "unbreakable-vault": "miniapp-unbreakablevault",
    // Social
    "red-envelope": "miniapp-redenvelope",
    "gas-circle": "miniapp-gascircle",
    "dev-tipping": "miniapp-dev-tipping",
    "time-capsule": "miniapp-time-capsule",
    "breakup-contract": "miniapp-breakupcontract",
    "ex-files": "miniapp-exfiles",
    graveyard: "miniapp-graveyard",
    // Governance & NFT
    "gov-booster": "miniapp-govbooster",
    "gov-merc": "miniapp-gov-merc",
    "masquerade-dao": "miniapp-masqueradedao",
    "doomsday-clock": "miniapp-doomsday-clock",
    "guardian-policy": "miniapp-guardianpolicy",
    "on-chain-tarot": "miniapp-onchaintarot",
    "million-piece-map": "miniapp-millionpiecemap",
    canvas: "miniapp-canvas",
    "puzzle-mining": "miniapp-puzzlemining",
    // Special apps
    "candidate-vote": "miniapp-candidate-vote",
    neoburger: "miniapp-neoburger",
    "neo-swap": "miniapp-neo-swap",
    explorer: "miniapp-explorer",
    "throne-of-gas": "miniapp-throneofgas",
  };

  return nameMap[name] || `miniapp-${name.replace(/-/g, "")}`;
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

  // Check cache first (skip if filtering by specific app_id)
  if (!appIdFilter && statsCache && Date.now() - statsCache.timestamp < CACHE_TTL_MS) {
    return res.status(200).json({ stats: statsCache.data, cached: true });
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

    // Convert to array with normalized app_ids
    const stats: AppStats[] = Object.entries(appStatsMap)
      .map(([appId, data]) => ({
        app_id: normalizeAppId(appId),
        total_users: data.users.size,
        total_transactions: data.txCount,
        total_gas_used: (Number(data.volume) / 100000000).toFixed(2),
        data_sources: Array.from(data.sources),
      }))
      .sort((a, b) => b.total_transactions - a.total_transactions);

    const filteredStats = appIdFilter ? stats.filter((s) => s.app_id === appIdFilter) : stats;

    // Update cache if not filtering
    if (!appIdFilter) {
      statsCache = { data: stats, timestamp: Date.now() };
    }

    res.status(200).json({ stats: filteredStats });
  } catch (error) {
    console.error("MiniApp stats error:", error);
    res.status(200).json({ stats: [] });
  }
}
