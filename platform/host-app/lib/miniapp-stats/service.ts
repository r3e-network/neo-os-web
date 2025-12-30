/**
 * MiniApp Stats Service
 * Main service for fetching and caching MiniApp statistics
 */

import type { MiniAppStats, MiniAppLiveStatus } from "./types";
import { statsCache, CACHE_TTL } from "./collector";
import { supabase, isSupabaseConfigured } from "../supabase";
import { getLotteryState, getGameState, getContractStats, CONTRACTS } from "../chain";

/**
 * Get stats for a single MiniApp
 */
export async function getMiniAppStats(
  appId: string,
  network: "testnet" | "mainnet" = "testnet",
): Promise<MiniAppStats | null> {
  // Check cache first
  const cached = statsCache.get(appId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.stats;
  }

  // Try to fetch from database
  if (isSupabaseConfigured) {
    const { data } = await supabase.from("miniapp_stats").select("*").eq("app_id", appId).single();

    if (data) {
      const stats = mapDbToStats(data);
      statsCache.set(appId, { stats, timestamp: Date.now() });
      return stats;
    }
  }

  // Return default stats if not found
  return getDefaultStats(appId);
}

/**
 * Get stats for multiple MiniApps
 */
export async function getBatchStats(
  appIds: string[],
  network: "testnet" | "mainnet" = "testnet",
): Promise<Record<string, MiniAppStats>> {
  const result: Record<string, MiniAppStats> = {};

  if (isSupabaseConfigured) {
    const { data } = await supabase.from("miniapp_stats").select("*").in("app_id", appIds);

    if (data) {
      for (const row of data) {
        const stats = mapDbToStats(row);
        result[row.app_id] = stats;
        statsCache.set(row.app_id, { stats, timestamp: Date.now() });
      }
    }
  }

  // Fill missing with defaults
  for (const appId of appIds) {
    if (!result[appId]) {
      result[appId] = getDefaultStats(appId);
    }
  }

  return result;
}

/**
 * Get live status for gaming/defi apps
 */
export async function getLiveStatus(
  appId: string,
  contractHash: string,
  category: string,
  network: "testnet" | "mainnet" = "testnet",
): Promise<MiniAppLiveStatus> {
  const status: MiniAppLiveStatus = { appId };

  try {
    if (category === "gaming") {
      const state = await getLotteryState(contractHash, network);
      status.jackpot = state.prizePool;
      status.playersOnline = state.ticketsSold;
    }

    if (category === "defi") {
      const stats = await getContractStats(contractHash, network);
      status.tvl = stats.totalValueLocked;
      status.volume24h = stats.totalValueLocked;
    }
  } catch {
    // Return partial status on error
  }

  return status;
}

function mapDbToStats(data: Record<string, unknown>): MiniAppStats {
  return {
    appId: data.app_id as string,
    activeUsersMonthly: (data.active_users_monthly as number) || 0,
    activeUsersWeekly: (data.active_users_weekly as number) || 0,
    activeUsersDaily: (data.active_users_daily as number) || 0,
    totalTransactions: (data.total_transactions as number) || 0,
    transactionsWeekly: (data.transactions_weekly as number) || 0,
    transactionsDaily: (data.transactions_daily as number) || 0,
    totalVolumeGas: (data.total_volume_gas as string) || "0",
    volumeWeeklyGas: (data.volume_weekly_gas as string) || "0",
    volumeDailyGas: (data.volume_daily_gas as string) || "0",
    rating: (data.rating as number) || 0,
    reviewCount: (data.review_count as number) || 0,
    weeklyTrend: (data.weekly_trend as number) || 0,
    lastUpdated: (data.last_updated as number) || Date.now(),
  };
}

function getDefaultStats(appId: string): MiniAppStats {
  return {
    appId,
    activeUsersMonthly: 0,
    activeUsersWeekly: 0,
    activeUsersDaily: 0,
    totalTransactions: 0,
    transactionsWeekly: 0,
    transactionsDaily: 0,
    totalVolumeGas: "0",
    volumeWeeklyGas: "0",
    volumeDailyGas: "0",
    rating: 0,
    reviewCount: 0,
    weeklyTrend: 0,
    lastUpdated: Date.now(),
  };
}

export { getDefaultStats };
