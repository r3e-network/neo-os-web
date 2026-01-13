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

    if (data === true) {
      console.log(`[stats] Lazy-created stats for ${appId}/${chainId}`);
    }
    return data === true;
  } catch (err) {
    console.warn(`[stats] Exception in lazy creation:`, err);
    return false;
  }
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
