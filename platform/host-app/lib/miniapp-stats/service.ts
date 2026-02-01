/**
 * MiniApp Stats Service
 * Main service for fetching and caching MiniApp statistics
 */

import type { MiniAppStats, MiniAppLiveStatus } from "./types";
import { statsCache, CACHE_TTL } from "./collector";
import { supabase, isSupabaseConfigured } from "../supabase";
import { getLotteryState, getContractStats } from "../chain";
import type { ChainId } from "../chains/types";

/**
 * Ensure stats record exists for an app-chain combination (lazy creation)
 * Returns true if stats were created, false if they already existed
 */
export async function ensureStatsExist(appId: string, chainId: ChainId): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { data, error } = await supabase.rpc("ensure_miniapp_stats_exist", {
      p_app_id: appId,
      p_chain_id: chainId,
    });

    if (error) {
      console.warn(`[stats] Lazy creation failed for ${appId}/${chainId}:`, error.message);
      return false;
    }

    return data === true;
  } catch (err) {
    console.warn(`[stats] Exception in lazy creation:`, err);
    return false;
  }
}

/**
 * Get aggregated stats for a MiniApp across ALL chains
 * Used for displaying total transactions and views
 */
export async function getAggregatedMiniAppStats(appId: string): Promise<MiniAppStats | null> {
  const cacheKey = `${appId}:all-chains`;
  // Check cache first
  const cached = statsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.stats;
  }

  if (!isSupabaseConfigured) return null;

  // Fetch stats from all chains for this app
  const { data } = await supabase.from("miniapp_stats").select("*").eq("app_id", appId);

  if (!data || data.length === 0) return null;

  // Aggregate stats across all chains
  const aggregated = data.reduce(
    (acc, row) => {
      acc.totalTransactions += (row.total_transactions as number) || 0;
      acc.viewCount += (row.view_count as number) || 0;
      acc.activeUsersDaily += (row.active_users_daily as number) || 0;
      acc.activeUsersWeekly += (row.active_users_weekly as number) || 0;
      acc.activeUsersMonthly += (row.active_users_monthly as number) || 0;
      acc.transactionsDaily += (row.transactions_24h as number) || 0;
      acc.transactionsWeekly += (row.transactions_7d as number) || 0;
      // For volume, parse and sum
      const vol = parseFloat(row.total_volume_gas as string) || 0;
      acc.totalVolumeGas = (parseFloat(acc.totalVolumeGas) + vol).toString();
      // Rating: use weighted average or max
      if ((row.rating as number) > acc.rating) {
        acc.rating = row.rating as number;
        acc.reviewCount = (row.rating_count as number) || 0;
      }
      return acc;
    },
    {
      appId,
      totalTransactions: 0,
      viewCount: 0,
      activeUsersDaily: 0,
      activeUsersWeekly: 0,
      activeUsersMonthly: 0,
      transactionsDaily: 0,
      transactionsWeekly: 0,
      totalVolumeGas: "0",
      volumeWeeklyGas: "0",
      volumeDailyGas: "0",
      rating: 0,
      reviewCount: 0,
      retentionD1: 0,
      retentionD7: 0,
      avgSessionDuration: 0,
      funnelViewToConnect: 0,
      funnelConnectToTx: 0,
      lastUpdated: Date.now(),
    } as MiniAppStats,
  );

  statsCache.set(cacheKey, { stats: aggregated, timestamp: Date.now() });
  return aggregated;
}

/**
 * Get stats for a single MiniApp
 */
export async function getMiniAppStats(appId: string, chainId: ChainId): Promise<MiniAppStats | null> {
  const cacheKey = `${appId}:${chainId}`;
  // Check cache first
  const cached = statsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.stats;
  }

  // Try to fetch from database
  if (isSupabaseConfigured) {
    const { data } = await supabase
      .from("miniapp_stats")
      .select("*")
      .eq("app_id", appId)
      .eq("chain_id", chainId)
      .single();

    if (data) {
      const stats = mapDbToStats(data);
      statsCache.set(cacheKey, { stats, timestamp: Date.now() });
      return stats;
    }

    // Lazy creation: if stats don't exist, create them
    await ensureStatsExist(appId, chainId);

    // Try fetching again after lazy creation
    const { data: newData } = await supabase
      .from("miniapp_stats")
      .select("*")
      .eq("app_id", appId)
      .eq("chain_id", chainId)
      .single();

    if (newData) {
      const stats = mapDbToStats(newData);
      statsCache.set(cacheKey, { stats, timestamp: Date.now() });
      return stats;
    }
  }

  // Return null if not found in database - no fake data
  return null;
}

/**
 * Get stats for multiple MiniApps
 * Returns only data from database - no static fallbacks
 */
export async function getBatchStats(appIds: string[], chainId: ChainId): Promise<Record<string, MiniAppStats>> {
  const result: Record<string, MiniAppStats> = {};

  if (!isSupabaseConfigured) {
    // Return empty result when database not configured
    return result;
  }

  const { data, error } = await supabase.from("miniapp_stats").select("*").in("app_id", appIds).eq("chain_id", chainId);

  if (error) {
    console.error("Failed to fetch batch stats:", error);
    return result;
  }

  if (data) {
    for (const row of data) {
      const stats = mapDbToStats(row);
      result[row.app_id] = stats;
      statsCache.set(row.app_id, { stats, timestamp: Date.now() });
    }
  }

  // No fallback - only return data that exists in database
  return result;
}

/**
 * Get aggregated stats for multiple MiniApps across ALL chains
 * Returns stats summed across all chains for each app
 * Performance: Checks cache first, only queries DB for uncached apps
 */
export async function getAggregatedBatchStats(appIds: string[]): Promise<Record<string, MiniAppStats>> {
  const result: Record<string, MiniAppStats> = {};
  const uncachedAppIds: string[] = [];

  if (!isSupabaseConfigured) {
    return result;
  }

  // Check cache first for each app
  for (const appId of appIds) {
    const cacheKey = `${appId}:all-chains`;
    const cached = statsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      result[appId] = cached.stats;
    } else {
      uncachedAppIds.push(appId);
    }
  }

  // If all apps are cached, return early
  if (uncachedAppIds.length === 0) {
    return result;
  }

  // Fetch only uncached apps from database
  const { data, error } = await supabase.from("miniapp_stats").select("*").in("app_id", uncachedAppIds);

  if (error) {
    console.error("Failed to fetch aggregated batch stats:", error);
    return result;
  }

  if (data) {
    // Group and aggregate by app_id
    for (const row of data) {
      const appId = row.app_id as string;
      if (!result[appId]) {
        result[appId] = createEmptyStats(appId);
      }
      // Aggregate values
      aggregateStatsRow(result[appId], row);
    }

    // Cache newly fetched aggregated results
    for (const appId of uncachedAppIds) {
      if (result[appId]) {
        statsCache.set(`${appId}:all-chains`, { stats: result[appId], timestamp: Date.now() });
      }
    }
  }

  return result;
}

/** Create empty stats object for aggregation */
function createEmptyStats(appId: string): MiniAppStats {
  return {
    appId,
    totalTransactions: 0,
    viewCount: 0,
    activeUsersDaily: 0,
    activeUsersWeekly: 0,
    activeUsersMonthly: 0,
    transactionsDaily: 0,
    transactionsWeekly: 0,
    totalVolumeGas: "0",
    volumeWeeklyGas: "0",
    volumeDailyGas: "0",
    rating: 0,
    reviewCount: 0,
    retentionD1: 0,
    retentionD7: 0,
    avgSessionDuration: 0,
    funnelViewToConnect: 0,
    funnelConnectToTx: 0,
    lastUpdated: Date.now(),
  };
}

/** Aggregate a single row into existing stats */
function aggregateStatsRow(stats: MiniAppStats, row: Record<string, unknown>): void {
  stats.totalTransactions += (row.total_transactions as number) || 0;
  stats.viewCount = (stats.viewCount || 0) + ((row.view_count as number) || 0);
  stats.activeUsersDaily += (row.active_users_daily as number) || 0;
  stats.activeUsersWeekly += (row.active_users_weekly as number) || 0;
  stats.activeUsersMonthly += (row.active_users_monthly as number) || 0;
  stats.transactionsDaily += (row.transactions_24h as number) || 0;
  stats.transactionsWeekly += (row.transactions_7d as number) || 0;

  // Sum volumes
  const vol = parseFloat(row.total_volume_gas as string) || 0;
  stats.totalVolumeGas = (parseFloat(stats.totalVolumeGas) + vol).toString();

  // Use max rating
  if ((row.rating as number) > stats.rating) {
    stats.rating = row.rating as number;
    stats.reviewCount = (row.rating_count as number) || 0;
  }
}

/**
 * Get live status for gaming/defi apps
 */
export async function getLiveStatus(
  appId: string,
  contractAddress: string,
  category: string,
  chainId: ChainId,
): Promise<MiniAppLiveStatus> {
  const status: MiniAppLiveStatus = { appId };

  try {
    if (category === "gaming") {
      const state = await getLotteryState(contractAddress, chainId);
      status.jackpot = state.prizePool;
      status.playersOnline = state.ticketsSold;
    }

    if (category === "defi") {
      const stats = await getContractStats(contractAddress, chainId);
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
    transactionsWeekly: (data.transactions_7d as number) || 0,
    transactionsDaily: (data.transactions_24h as number) || 0,
    totalVolumeGas: (data.total_volume_gas as string) || "0",
    volumeWeeklyGas: (data.volume_7d_gas as string) || "0",
    volumeDailyGas: (data.volume_24h_gas as string) || "0",
    rating: (data.rating as number) || 0,
    reviewCount: (data.rating_count as number) || 0,
    // Extended analytics fields
    viewCount: (data.view_count as number) || 0,
    retentionD1: (data.retention_d1 as number) || 0,
    retentionD7: (data.retention_d7 as number) || 0,
    avgSessionDuration: (data.avg_session_duration as number) || 0,
    funnelViewToConnect: (data.funnel_view_to_connect as number) || 0,
    funnelConnectToTx: (data.funnel_connect_to_tx as number) || 0,
    lastUpdated: new Date(data.updated_at as string).getTime() || Date.now(),
  };
}
