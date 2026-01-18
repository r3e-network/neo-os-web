/**
 * useMiniAppStats - Hook for cached MiniApp statistics
 *
 * Features:
 * - 5-minute cache (staleTime)
 * - Shared across pages (no reload when navigating)
 * - Supports single app and batch fetching
 * - SSR initial data hydration
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MiniAppStats } from "@/components/types";

// Cache configuration
const STATS_STALE_TIME = 5 * 60 * 1000; // 5 minutes
const STATS_CACHE_TIME = 10 * 60 * 1000; // 10 minutes

// Query keys
export const statsKeys = {
  all: ["miniapp-stats"] as const,
  single: (appId: string) => ["miniapp-stats", appId] as const,
  batch: (appIds: string[]) => ["miniapp-stats", "batch", appIds.sort().join(",")] as const,
};

/**
 * Fetch single app stats (aggregated across all chains)
 */
async function fetchAppStats(appId: string): Promise<MiniAppStats | null> {
  // Fetch aggregated stats across all chains
  const res = await fetch(`/api/miniapp-stats?app_id=${encodeURIComponent(appId)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.stats?.[0] || null;
}

/**
 * Fetch batch stats (aggregated across all chains)
 */
async function fetchBatchStats(appIds: string[]): Promise<Record<string, MiniAppStats>> {
  // Use chain_id=all to get aggregated stats across all chains
  const res = await fetch(`/api/miniapps/batch-stats?chain_id=all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appIds }),
  });
  if (!res.ok) return {};
  const data = await res.json();
  return data.stats || {};
}

interface UseMiniAppStatsOptions {
  /** Initial data from SSR */
  initialData?: MiniAppStats | null;
  /** Enable/disable the query */
  enabled?: boolean;
}

/**
 * Hook for single app stats with caching
 */
export function useMiniAppStats(appId: string, options?: UseMiniAppStatsOptions) {
  const { initialData, enabled = true } = options || {};

  return useQuery({
    queryKey: statsKeys.single(appId),
    queryFn: () => fetchAppStats(appId),
    staleTime: STATS_STALE_TIME,
    gcTime: STATS_CACHE_TIME,
    enabled: enabled && !!appId,
    initialData: initialData ?? undefined,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

interface UseBatchStatsOptions {
  enabled?: boolean;
}

/**
 * Hook for batch stats with caching
 */
export function useBatchMiniAppStats(appIds: string[], options?: UseBatchStatsOptions) {
  const { enabled = true } = options || {};
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: statsKeys.batch(appIds),
    queryFn: async () => {
      const stats = await fetchBatchStats(appIds);
      // Populate individual caches
      Object.entries(stats).forEach(([id, stat]) => {
        queryClient.setQueryData(statsKeys.single(id), stat);
      });
      return stats;
    },
    staleTime: STATS_STALE_TIME,
    gcTime: STATS_CACHE_TIME,
    enabled: enabled && appIds.length > 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Prefetch stats for an app (call before navigation)
 */
export function usePrefetchStats() {
  const queryClient = useQueryClient();

  return (appId: string) => {
    queryClient.prefetchQuery({
      queryKey: statsKeys.single(appId),
      queryFn: () => fetchAppStats(appId),
      staleTime: STATS_STALE_TIME,
    });
  };
}

/**
 * Set stats in cache (for SSR hydration)
 */
export function useSetStatsCache() {
  const queryClient = useQueryClient();

  return (appId: string, stats: MiniAppStats | null) => {
    if (stats) {
      queryClient.setQueryData(statsKeys.single(appId), stats);
    }
  };
}
