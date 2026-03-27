/**
 * MiniApp Stats Service
 * Main service for fetching and caching MiniApp statistics
 */

import type { MiniAppStats, MiniAppLiveStatus } from "./types";
import { statsCache, CACHE_TTL } from "./collector";
import { supabase, isSupabaseConfigured } from "../supabase";
import {
  FLAGSHIP_APPS,
  getContractStats,
  getLiveStatus as getChainLiveStatus,
  getSharedModeContractStats,
  getSharedModeLiveStatus,
} from "../chain";
import { loadBundledMiniAppById } from "../miniapp-definitions";
import { isSharedModeApp } from "../chain/shared-mode";

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
    const { data } = await supabase.from("miniapp_stats").select("app_id,active_users_monthly,active_users_weekly,active_users_daily,total_transactions,transactions_weekly,transactions_daily,total_volume_gas,volume_weekly_gas,volume_daily_gas,rating,review_count,weekly_trend,last_updated").eq("app_id", appId).maybeSingle();

    if (data) {
      const stats = mapDbToStats(data);
      statsCache.set(appId, { stats, timestamp: Date.now() });
      return stats;
    }
  }

  // Return default stats if not found
  const flagship = FLAGSHIP_APPS[appId];
  if (flagship) {
    const chainStats = await getContractStats(flagship.contract, network, appId);
    return {
      appId,
      activeUsersMonthly: chainStats.uniqueUsers,
      activeUsersWeekly: chainStats.uniqueUsers,
      activeUsersDaily: chainStats.uniqueUsers,
      totalTransactions: chainStats.totalTransactions,
      transactionsWeekly: chainStats.totalTransactions,
      transactionsDaily: chainStats.totalTransactions,
      totalVolumeGas: chainStats.totalValueLocked,
      volumeWeeklyGas: chainStats.totalValueLocked,
      volumeDailyGas: chainStats.totalValueLocked,
      rating: 0,
      reviewCount: 0,
      weeklyTrend: 0,
      lastUpdated: Date.now(),
    };
  }

  const bundledApp = await loadBundledMiniAppById(appId).catch(() => null);
  if (bundledApp && isSharedModeApp(bundledApp)) {
    const sharedStats = await getSharedModeContractStats(bundledApp, network).catch(() => null);
    if (sharedStats) {
      return {
        appId,
        activeUsersMonthly: sharedStats.uniqueUsers,
        activeUsersWeekly: sharedStats.uniqueUsers,
        activeUsersDaily: sharedStats.uniqueUsers,
        totalTransactions: sharedStats.totalTransactions,
        transactionsWeekly: sharedStats.totalTransactions,
        transactionsDaily: sharedStats.totalTransactions,
        totalVolumeGas: sharedStats.totalValueLocked,
        volumeWeeklyGas: sharedStats.totalValueLocked,
        volumeDailyGas: sharedStats.totalValueLocked,
        rating: 0,
        reviewCount: 0,
        weeklyTrend: 0,
        lastUpdated: Date.now(),
      };
    }
  }

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
    const { data } = await supabase.from("miniapp_stats").select("app_id,active_users_monthly,active_users_weekly,active_users_daily,total_transactions,transactions_weekly,transactions_daily,total_volume_gas,volume_weekly_gas,volume_daily_gas,rating,review_count,weekly_trend,last_updated").in("app_id", appIds);

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
  const bundledApp = await loadBundledMiniAppById(appId).catch(() => null);
  if (bundledApp && isSharedModeApp(bundledApp)) {
    const sharedStatus = await getSharedModeLiveStatus(bundledApp, network).catch(() => null);
    if (sharedStatus) return sharedStatus;
  }

  try {
    return await getChainLiveStatus(appId, contractHash, category, network);
  } catch {
    // Return partial status on error
  }

  return { appId };
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
